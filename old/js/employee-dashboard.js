// ==================== EMPLOYEE DASHBOARD ====================

async function initEmployeeDashboard() {
    updateGreeting();
    updateCurrentDate();
    await loadProfile();
    await checkCurrentClockIn();
    await loadTodayStats();
    await loadShifts();
    await loadInvoices();
    loadEmployeeSopView();
    initEmployeeNavigation();
}

function updateGreeting() {
    const greeting = document.getElementById('user-greeting');
    const name = userProfile?.first_name || 'there';
    greeting.textContent = `Hello, ${name}!`;
}

function updateCurrentDate() {
    const dateEl = document.getElementById('current-date');
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateEl.textContent = new Date().toLocaleDateString('en-US', options);
}

function startClock() {
    const updateTime = () => {
        const timeEl = document.getElementById('current-time');
        if (timeEl) {
            timeEl.textContent = new Date().toLocaleTimeString('en-US', { 
                hour12: true, 
                hour: 'numeric', 
                minute: '2-digit', 
                second: '2-digit' 
            });
        }
    };
    updateTime();
    clockInterval = setInterval(updateTime, 1000);
}

async function checkCurrentClockIn() {
    const { data, error } = await supabaseClient
        .from('time_entries')
        .select('*')
        .eq('user_id', currentUser.id)
        .is('clock_out', null)
        .order('clock_in', { ascending: false })
        .limit(1)
        .maybeSingle();
    
    if (error) {
        console.error('Check clock-in status error:', error);
        showToast(`Couldn't load clock status: ${error.message}`, 'error');
    }
    
    if (data) {
        currentClockIn = data;
        updateClockUI(true);
        startTimeWorkedCounter();
        loadSopChecklistPanelIfClockedIn();
        loadTaskListClockInPanel();
    } else {
        currentClockIn = null;
        updateClockUI(false);
        hideSopChecklistPanel();
    }
}

function updateClockUI(isClockedIn) {
    const clockInBtn = document.getElementById('clock-in-btn');
    const clockOutBtn = document.getElementById('clock-out-btn');
    const sessionInfo = document.getElementById('session-info');
    const clockStatus = document.getElementById('clock-status');
    
    if (isClockedIn && currentClockIn) {
        clockInBtn.style.display = 'none';
        clockOutBtn.style.display = 'flex';
        sessionInfo.style.display = 'flex';
        clockStatus.textContent = 'Currently clocked in';
        clockStatus.classList.add('clocked-in');
        
        const clockInTime = new Date(currentClockIn.clock_in);
        document.getElementById('clocked-in-time').textContent = 
            clockInTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else {
        clockInBtn.style.display = 'flex';
        clockOutBtn.style.display = 'none';
        sessionInfo.style.display = 'none';
        clockStatus.textContent = 'Not clocked in';
        clockStatus.classList.remove('clocked-in');
        
        if (timeWorkedInterval) {
            clearInterval(timeWorkedInterval);
            timeWorkedInterval = null;
        }
    }
}

function startTimeWorkedCounter() {
    const updateTimeWorked = () => {
        if (!currentClockIn) return;
        
        const start = new Date(currentClockIn.clock_in);
        const now = new Date();
        const diff = now - start;
        
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        
        document.getElementById('time-worked').textContent = 
            `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };
    
    updateTimeWorked();
    timeWorkedInterval = setInterval(updateTimeWorked, 1000);
}

function setClockButtonsDisabled(disabled) {
    const clockInBtn = document.getElementById('clock-in-btn');
    const clockOutBtn = document.getElementById('clock-out-btn');
    if (clockInBtn) clockInBtn.disabled = disabled;
    if (clockOutBtn) clockOutBtn.disabled = disabled;
}

async function clockIn() {
    // Guard against rapid double-taps creating duplicate open shifts
    if (isClockBusy) return;
    isClockBusy = true;
    setClockButtonsDisabled(true);
    
    try {
        if (!userProfile) {
            throw new Error('Your profile could not be loaded. Please log out and back in, or contact your admin.');
        }
        
        const { data, error } = await supabaseClient
            .from('time_entries')
            .insert({
                user_id: currentUser.id,
                clock_in: new Date().toISOString(),
                is_manual: false,
                paid: false
            })
            .select()
            .single();
        
        if (error) throw error;
        
        currentClockIn = data;
        updateClockUI(true);
        startTimeWorkedCounter();
        clearShiftsCache(); // Clear calendar cache
        showToast('Clocked in successfully!');
        const hasTaskLists = await showTaskListClockInPopup();
        if (!hasTaskLists) {
            await showSopFlowAfterClockIn();
        }
    } catch (error) {
        console.error('Clock in error:', error);
        if (error.code === '23505') {
            // Unique index says an open shift already exists - sync UI to reality
            showToast('You are already clocked in.', 'error');
            await checkCurrentClockIn();
        } else {
            showToast(`Failed to clock in: ${error.message || 'Unknown error'}`, 'error');
        }
    } finally {
        isClockBusy = false;
        setClockButtonsDisabled(false);
    }
}

async function clockOut() {
    if (!currentClockIn) return;
    if (isClockBusy) return;
    isClockBusy = true;
    setClockButtonsDisabled(true);
    
    try {
        // Close ALL open entries for this user, not just the latest one,
        // so legacy duplicate open shifts can't leave the UI stuck clocked in
        const { error } = await supabaseClient
            .from('time_entries')
            .update({ clock_out: new Date().toISOString() })
            .eq('user_id', currentUser.id)
            .is('clock_out', null);
        
        if (error) throw error;
        
        currentClockIn = null;
        updateClockUI(false);
        clearShiftsCache(); // Clear calendar cache
        await loadTodayStats();
        await loadShifts();
        showToast('Clocked out successfully!');
    } catch (error) {
        console.error('Clock out error:', error);
        showToast(`Failed to clock out: ${error.message || 'Unknown error'}`, 'error');
    } finally {
        isClockBusy = false;
        setClockButtonsDisabled(false);
    }
}

async function loadTodayStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const { data, error } = await supabaseClient
        .from('time_entries')
        .select('*')
        .eq('user_id', currentUser.id)
        .gte('clock_in', today.toISOString())
        .lt('clock_in', tomorrow.toISOString());
    
    if (!error && data) {
        let totalHours = 0;
        data.forEach(entry => {
            if (entry.clock_out) {
                const start = new Date(entry.clock_in);
                const end = new Date(entry.clock_out);
                totalHours += (end - start) / 3600000;
            }
        });
        
        const rate = userProfile?.hourly_rate || 0;
        
        document.getElementById('today-hours').textContent = totalHours.toFixed(2);
        document.getElementById('today-earnings').textContent = formatCurrency(totalHours * rate);
        document.getElementById('hourly-rate-display').textContent = `${formatCurrency(rate)}/hr`;
    }
}

async function loadProfile() {
    if (!userProfile) return;
    
    document.getElementById('profile-first-name').value = userProfile.first_name || '';
    document.getElementById('profile-last-name').value = userProfile.last_name || '';
    document.getElementById('profile-email').value = userProfile.email || '';
    document.getElementById('profile-phone').value = userProfile.phone || '';
    document.getElementById('profile-street').value = userProfile.address_street || '';
    document.getElementById('profile-street2').value = userProfile.address_street2 || '';
    document.getElementById('profile-city').value = userProfile.address_city || '';
    document.getElementById('profile-state').value = userProfile.address_state || '';
    document.getElementById('profile-zip').value = userProfile.address_zip || '';
    document.getElementById('profile-rate').textContent = formatCurrency(userProfile.hourly_rate || 0);
}

async function saveProfile(formData) {
    try {
        const { error } = await supabaseClient
            .from('profiles')
            .update({
                first_name: formData.firstName,
                last_name: formData.lastName,
                phone: formData.phone,
                address_street: formData.street,
                address_street2: formData.street2,
                address_city: formData.city,
                address_state: formData.state,
                address_zip: formData.zip
            })
            .eq('id', currentUser.id);
        
        if (error) throw error;
        
        userProfile.first_name = formData.firstName;
        userProfile.last_name = formData.lastName;
        userProfile.phone = formData.phone;
        userProfile.address_street = formData.street;
        userProfile.address_street2 = formData.street2;
        userProfile.address_city = formData.city;
        userProfile.address_state = formData.state;
        userProfile.address_zip = formData.zip;
        
        updateGreeting();
        showToast('Profile saved successfully!');
    } catch (error) {
        console.error('Save profile error:', error);
        showToast('Failed to save profile.', 'error');
    }
}

async function loadShifts(startDate = null, endDate = null) {
    // Default to last 30 days
    if (!startDate) {
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
    }
    if (!endDate) {
        endDate = new Date();
        endDate.setDate(endDate.getDate() + 1);
    }
    
    // Update hidden date inputs
    document.getElementById('shifts-start-date').value = formatDateForInput(startDate);
    document.getElementById('shifts-end-date').value = formatDateForInput(endDate);
    
    // Update display inputs
    const startDisplay = document.getElementById('shifts-start-date-display');
    const endDisplay = document.getElementById('shifts-end-date-display');
    if (startDisplay) {
        startDisplay.value = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    if (endDisplay) {
        endDisplay.value = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    
    const { data, error } = await supabaseClient
        .from('time_entries')
        .select('*')
        .eq('user_id', currentUser.id)
        .gte('clock_in', startDate.toISOString())
        .lte('clock_in', endDate.toISOString())
        .order('clock_in', { ascending: false });
    
    if (!error && data) {
        renderShifts(data);
    }
}

function renderShifts(shifts) {
    const tbody = document.getElementById('shifts-body');
    const rate = userProfile?.hourly_rate || 0;
    let totalHours = 0;
    let totalAmount = 0;
    
    if (shifts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    <p>No shifts found for this period</p>
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = shifts.map(shift => {
            const clockIn = new Date(shift.clock_in);
            const clockOut = shift.clock_out ? new Date(shift.clock_out) : null;
            const hours = clockOut ? (clockOut - clockIn) / 3600000 : 0;
            const amount = hours * rate;
            const isPaid = shift.paid || false;
            
            totalHours += hours;
            totalAmount += amount;
            
            return `
                <tr data-id="${shift.id}">
                    <td>${formatDate(clockIn)}</td>
                    <td>${formatTime(clockIn)}</td>
                    <td>${clockOut ? formatTime(clockOut) : '<em>In progress</em>'}</td>
                    <td>${hours.toFixed(2)}</td>
                    <td>${shift.description || '-'}</td>
                    <td>
                        <button class="shift-status ${isPaid ? 'paid' : 'pending'}" onclick="toggleShiftPaid('${shift.id}', ${isPaid})" title="Click to toggle">
                            <span class="shift-status-dot"></span>
                            ${isPaid ? 'Paid' : 'Pending'}
                        </button>
                    </td>
                    <td class="entry-amount">${formatCurrency(amount)}</td>
                    <td>
                        <button class="btn btn-delete" onclick="deleteShift('${shift.id}')" title="Delete">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                            </svg>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    document.getElementById('period-hours').textContent = `${totalHours.toFixed(2)} hrs`;
    document.getElementById('period-amount').textContent = formatCurrency(totalAmount);
}

async function addManualShift(date, startTime, endTime, description, endDate = null) {
    try {
        const clockIn = new Date(`${date}T${startTime}`);
        // Use endDate if provided (overnight shift), otherwise use the same date
        const clockOutDate = endDate || date;
        const clockOut = new Date(`${clockOutDate}T${endTime}`);
        
        if (clockOut <= clockIn) {
            throw new Error('End time must be after start time');
        }
        
        const { error } = await supabaseClient
            .from('time_entries')
            .insert({
                user_id: currentUser.id,
                clock_in: clockIn.toISOString(),
                clock_out: clockOut.toISOString(),
                description: description,
                is_manual: true,
                paid: false
            });
        
        if (error) throw error;
        
        clearShiftsCache(); // Clear calendar cache
        await loadShifts();
        await loadTodayStats();
        showToast('Shift added successfully!');
        return true;
    } catch (error) {
        console.error('Add shift error:', error);
        showToast(error.message || 'Failed to add shift.', 'error');
        return false;
    }
}

async function deleteShift(id) {
    if (!confirm('Are you sure you want to delete this shift?')) return;
    
    try {
        const { error } = await supabaseClient
            .from('time_entries')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        clearShiftsCache(); // Clear calendar cache
        await loadShifts();
        await loadTodayStats();
        showToast('Shift deleted!');
    } catch (error) {
        console.error('Delete shift error:', error);
        showToast('Failed to delete shift.', 'error');
    }
}

async function loadInvoices() {
    const { data, error } = await supabaseClient
        .from('invoices')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });
    
    const container = document.getElementById('invoices-list');
    
    if (!error && data && data.length > 0) {
        container.innerHTML = data.map(invoice => `
            <div class="invoice-card" onclick="viewInvoice('${invoice.id}')">
                <div class="invoice-card-header">
                    <span class="invoice-number">${invoice.invoice_number}</span>
                    <span class="invoice-status ${invoice.status}">${invoice.status}</span>
                </div>
                <div class="invoice-card-details">
                    <p>Period: ${formatDate(new Date(invoice.period_start))} - ${formatDate(new Date(invoice.period_end))}</p>
                    <p>Due: ${formatDate(new Date(invoice.due_date))}</p>
                </div>
                <div class="invoice-amount">${formatCurrency(invoice.total)}</div>
            </div>
        `).join('');
    } else {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                <p>No invoices yet</p>
            </div>
        `;
    }
}

function initEmployeeNavigation() {
    const navBtns = document.querySelectorAll('#employee-dashboard .nav-btn');
    const views = document.querySelectorAll('#employee-dashboard .view');
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const mainNav = document.getElementById('main-nav');
    const navOverlay = document.getElementById('nav-overlay');
    
    // Hamburger menu toggle
    hamburgerBtn?.addEventListener('click', () => {
        mainNav.classList.toggle('open');
        navOverlay.classList.toggle('active');
    });
    
    // Close menu on overlay click
    navOverlay?.addEventListener('click', () => {
        mainNav.classList.remove('open');
        navOverlay.classList.remove('active');
    });
    
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const viewId = btn.dataset.view;
            
            navBtns.forEach(b => b.classList.remove('active'));
            views.forEach(v => v.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(`${viewId}-view`).classList.add('active');
            
            setHash(viewId);
            
            if (viewId === 'sop-employee') loadEmployeeSopView();
            if (viewId === 'my-tasks') loadMyTasks();
            if (viewId === 'my-schedule') loadMySchedule();
            if (viewId === 'locations') initLocationsView('emp');
            if (viewId === 'my-inventory') loadMyInventory();

            // Close mobile nav after selection
            mainNav.classList.remove('open');
            navOverlay.classList.remove('active');
        });
    });
}
