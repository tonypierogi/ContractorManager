// App State
let supabaseClient = null;
let currentUser = null;
let userProfile = null;
let currentClockIn = null;
let clockInterval = null;
let timeWorkedInterval = null;

// DOM Elements
let loadingScreen, authScreen, employeeDashboard, adminDashboard;

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    // Get DOM elements
    loadingScreen = document.getElementById('loading-screen');
    authScreen = document.getElementById('auth-screen');
    employeeDashboard = document.getElementById('employee-dashboard');
    adminDashboard = document.getElementById('admin-dashboard');
    
    // Initialize Supabase client
    if (window.supabase && SUPABASE_CONFIG.url !== 'YOUR_SUPABASE_URL') {
        try {
            supabaseClient = window.supabase.createClient(
                SUPABASE_CONFIG.url,
                SUPABASE_CONFIG.anonKey
            );
        } catch (e) {
            console.error('Failed to initialize Supabase:', e);
        }
    }
    
    await checkAuth();
    initializeEventListeners();
    startClock();
});

// ==================== AUTHENTICATION ====================

async function checkAuth() {
    // Check if Supabase is properly configured
    if (!supabaseClient || SUPABASE_CONFIG.url === 'YOUR_SUPABASE_URL' || SUPABASE_CONFIG.anonKey === 'YOUR_SUPABASE_ANON_KEY') {
        console.warn('Supabase not configured. Please update config.js with your Supabase credentials.');
        showConfigWarning();
        return;
    }
    
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        if (session) {
            currentUser = session.user;
            await loadUserProfile();
            showDashboard();
        } else {
            showAuthScreen();
        }
    } catch (error) {
        console.error('Auth check error:', error);
        showAuthScreen();
    }
}

function showConfigWarning() {
    loadingScreen.innerHTML = `
        <div class="loading-spinner" style="max-width: 500px; text-align: center;">
            <span class="logo-icon" style="font-size: 3rem; color: var(--warning);">⚠</span>
            <h2 style="margin: 1rem 0; color: var(--text-primary);">Supabase Not Configured</h2>
            <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
                To use TimeTrack Pro, you need to set up a Supabase project and update the configuration.
            </p>
            <div style="background: var(--bg-panel); padding: 1.5rem; border-radius: 10px; text-align: left; border: 1px solid var(--border-color);">
                <h3 style="color: var(--accent-primary); margin-bottom: 1rem; font-size: 1rem;">Setup Steps:</h3>
                <ol style="color: var(--text-secondary); padding-left: 1.25rem; line-height: 2;">
                    <li>Create a project at <a href="https://supabase.com" target="_blank" style="color: var(--accent-primary);">supabase.com</a></li>
                    <li>Run the SQL from <code style="background: var(--bg-elevated); padding: 2px 6px; border-radius: 4px;">supabase-schema.sql</code></li>
                    <li>Copy your Project URL and anon key</li>
                    <li>Update <code style="background: var(--bg-elevated); padding: 2px 6px; border-radius: 4px;">config.js</code> with your credentials</li>
                    <li>Refresh this page</li>
                </ol>
            </div>
            <p style="color: var(--text-muted); margin-top: 1.5rem; font-size: 0.85rem;">
                See README.md for detailed instructions.
            </p>
        </div>
    `;
}

async function loadUserProfile() {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();
    
    if (error) {
        console.error('Error loading profile:', error);
    }
    
    if (data) {
        userProfile = data;
        // Check for pending invite and apply settings if profile is new (no hourly rate set)
        await applyPendingInvite();
    } else {
        // Create profile if it doesn't exist
        await createProfile();
    }
}

async function createProfile() {
    // Check for pending invite settings
    const inviteSettings = getPendingInviteSettings(currentUser.email);
    
    const { data, error } = await supabaseClient
        .from('profiles')
        .insert({
            id: currentUser.id,
            email: currentUser.email,
            first_name: inviteSettings?.first_name || currentUser.user_metadata?.first_name || '',
            last_name: inviteSettings?.last_name || currentUser.user_metadata?.last_name || '',
            hourly_rate: inviteSettings?.hourly_rate || 0,
            role: inviteSettings?.role || 'employee'
        })
        .select()
        .single();
    
    if (!error) {
        userProfile = data;
        // Clear the pending invite
        clearPendingInvite(currentUser.email);
    }
}

function getPendingInviteSettings(email) {
    try {
        const pendingInvites = JSON.parse(localStorage.getItem('pendingInvites') || '{}');
        return pendingInvites[email.toLowerCase()] || null;
    } catch {
        return null;
    }
}

function clearPendingInvite(email) {
    try {
        const pendingInvites = JSON.parse(localStorage.getItem('pendingInvites') || '{}');
        delete pendingInvites[email.toLowerCase()];
        localStorage.setItem('pendingInvites', JSON.stringify(pendingInvites));
    } catch {
        // Ignore errors
    }
}

async function applyPendingInvite() {
    const inviteSettings = getPendingInviteSettings(currentUser.email);
    
    // Only apply if there's a pending invite and profile doesn't have hourly rate set
    if (inviteSettings && userProfile && userProfile.hourly_rate === 0) {
        const updates = {};
        
        if (inviteSettings.hourly_rate) updates.hourly_rate = inviteSettings.hourly_rate;
        if (inviteSettings.role) updates.role = inviteSettings.role;
        if (inviteSettings.first_name && !userProfile.first_name) updates.first_name = inviteSettings.first_name;
        if (inviteSettings.last_name && !userProfile.last_name) updates.last_name = inviteSettings.last_name;
        
        if (Object.keys(updates).length > 0) {
            const { data, error } = await supabaseClient
                .from('profiles')
                .update(updates)
                .eq('id', currentUser.id)
                .select()
                .single();
            
            if (!error && data) {
                userProfile = data;
            }
        }
        
        clearPendingInvite(currentUser.email);
    }
}

function showAuthScreen() {
    loadingScreen.style.display = 'none';
    authScreen.style.display = 'flex';
    employeeDashboard.style.display = 'none';
    adminDashboard.style.display = 'none';
}

function showDashboard() {
    loadingScreen.style.display = 'none';
    authScreen.style.display = 'none';
    
    if (userProfile?.role === 'admin') {
        employeeDashboard.style.display = 'none';
        adminDashboard.style.display = 'flex';
        initAdminDashboard();
    } else {
        employeeDashboard.style.display = 'flex';
        adminDashboard.style.display = 'none';
        initEmployeeDashboard();
    }
    
    // Check if onboarding is needed
    if (isProfileIncomplete()) {
        showOnboardingModal();
    }
}

function isProfileIncomplete() {
    if (!userProfile) return true;
    
    const firstName = userProfile.first_name?.trim();
    const lastName = userProfile.last_name?.trim();
    const phone = userProfile.phone?.trim();
    const street = userProfile.address_street?.trim();
    const city = userProfile.address_city?.trim();
    const state = userProfile.address_state?.trim();
    const zip = userProfile.address_zip?.trim();
    
    return !firstName || !lastName || !phone || !street || !city || !state || !zip;
}

function showOnboardingModal() {
    const modal = document.getElementById('onboarding-modal');
    
    // Pre-fill any existing data
    if (userProfile) {
        document.getElementById('onboarding-first-name').value = userProfile.first_name || '';
        document.getElementById('onboarding-last-name').value = userProfile.last_name || '';
        document.getElementById('onboarding-email').value = userProfile.email || '';
        document.getElementById('onboarding-phone').value = userProfile.phone || '';
        document.getElementById('onboarding-street').value = userProfile.address_street || '';
        document.getElementById('onboarding-street2').value = userProfile.address_street2 || '';
        document.getElementById('onboarding-city').value = userProfile.address_city || '';
        document.getElementById('onboarding-state').value = userProfile.address_state || '';
        document.getElementById('onboarding-zip').value = userProfile.address_zip || '';
    }
    
    modal.classList.add('active');
}

function hideOnboardingModal() {
    document.getElementById('onboarding-modal').classList.remove('active');
}

async function handleOnboardingSubmit(formData) {
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
        
        // Update local profile data
        userProfile.first_name = formData.firstName;
        userProfile.last_name = formData.lastName;
        userProfile.phone = formData.phone;
        userProfile.address_street = formData.street;
        userProfile.address_street2 = formData.street2;
        userProfile.address_city = formData.city;
        userProfile.address_state = formData.state;
        userProfile.address_zip = formData.zip;
        
        hideOnboardingModal();
        
        // Update greeting based on role
        if (userProfile.role === 'admin') {
            const adminGreeting = document.getElementById('admin-greeting');
            if (adminGreeting) {
                adminGreeting.textContent = `Hello, ${formData.firstName}!`;
            }
        } else {
            updateGreeting();
        }
        
        showToast('Profile setup complete! Welcome to TimeTrack Pro.');
        
        // Reload profile section if visible
        await loadProfile();
    } catch (error) {
        console.error('Onboarding save error:', error);
        showToast('Failed to save profile. Please try again.', 'error');
    }
}

async function handleLogin(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });
    
    if (error) {
        throw error;
    }
    
    currentUser = data.user;
    await loadUserProfile();
    showDashboard();
}

async function handleSignup(email, password, firstName, lastName) {
    const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
            data: {
                first_name: firstName,
                last_name: lastName
            }
        }
    });
    
    if (error) {
        throw error;
    }
    
    // Check if email confirmation is required
    if (data.user && !data.session) {
        showToast('Check your email to confirm your account!', 'success');
        return;
    }
    
    currentUser = data.user;
    await loadUserProfile();
    showDashboard();
}

async function handleLogout() {
    await supabaseClient.auth.signOut();
    currentUser = null;
    userProfile = null;
    currentClockIn = null;
    showAuthScreen();
}

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

async function clockIn() {
    try {
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
        showToast('Failed to clock in. Please try again.', 'error');
    }
}

async function clockOut() {
    if (!currentClockIn) return;
    
    try {
        const { error } = await supabaseClient
            .from('time_entries')
            .update({ clock_out: new Date().toISOString() })
            .eq('id', currentClockIn.id);
        
        if (error) throw error;
        
        currentClockIn = null;
        updateClockUI(false);
        clearShiftsCache(); // Clear calendar cache
        await loadTodayStats();
        await loadShifts();
        showToast('Clocked out successfully!');
    } catch (error) {
        console.error('Clock out error:', error);
        showToast('Failed to clock out. Please try again.', 'error');
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
            
            if (viewId === 'sop-employee') loadEmployeeSopView();
            if (viewId === 'my-tasks') loadMyTasks();

            // Close mobile nav after selection
            mainNav.classList.remove('open');
            navOverlay.classList.remove('active');
        });
    });
}

// ==================== ADMIN DASHBOARD ====================

async function initAdminDashboard() {
    const greeting = document.getElementById('admin-greeting');
    greeting.textContent = `Hello, ${userProfile?.first_name || 'Admin'}!`;
    
    await loadTeamMembers();
    await loadBusinessSettings();
    initAdminNavigation();
    setAdminDateFilters();
}

async function loadTeamMembers() {
    const container = document.getElementById('team-list');
    const employeeFilter = document.getElementById('employee-filter');
    const invoiceEmployeeSelect = document.getElementById('invoice-employee');
    
    if (!container) {
        console.error('Team list container not found');
        return;
    }
    
    try {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: true });
        
        if (error) {
            console.error('Error loading team members:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    <p>Failed to load team members</p>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 8px;">${error.message}</p>
                </div>
            `;
            return;
        }
        
        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    <p>No team members yet</p>
                </div>
            `;
            
            // Clear dropdowns
            if (employeeFilter) {
                employeeFilter.innerHTML = '<option value="">All Employees</option>';
            }
            if (invoiceEmployeeSelect) {
                invoiceEmployeeSelect.innerHTML = '<option value="">Select Employee</option>';
            }
            return;
        }
        
        // Populate team cards
        container.innerHTML = data.map(member => {
            const initials = `${(member.first_name || '?')[0]}${(member.last_name || '?')[0]}`.toUpperCase();
            const isCurrentUser = member.id === currentUser.id;
            return `
                <div class="team-card">
                    <div class="team-card-header" onclick="showEmployeeDetail('${member.id}')">
                        <div class="team-avatar">${initials}</div>
                        <div>
                            <div class="team-name">${member.first_name || ''} ${member.last_name || ''}</div>
                            <div class="team-email">${member.email}</div>
                        </div>
                    </div>
                    <div class="team-stats" onclick="showEmployeeDetail('${member.id}')">
                        <div class="team-stat">
                            <span class="team-stat-value">${formatCurrency(member.hourly_rate || 0)}</span>
                            <span class="team-stat-label">Hourly Rate</span>
                        </div>
                        <div class="team-stat">
                            <span class="team-stat-value">${member.role === 'admin' ? 'Admin' : 'Employee'}</span>
                            <span class="team-stat-label">Role</span>
                        </div>
                    </div>
                    ${!isCurrentUser ? `
                        <button class="btn-delete-member" onclick="event.stopPropagation(); confirmDeleteMember('${member.id}', '${(member.first_name || '').replace(/'/g, "\\'")} ${(member.last_name || '').replace(/'/g, "\\'")}', '${member.email}')" title="Remove team member">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    ` : `<div class="you-badge">You</div>`}
                </div>
            `;
        }).join('');
        
        // Populate dropdown filters
        const options = data.map(m => 
            `<option value="${m.id}">${m.first_name || ''} ${m.last_name || ''}</option>`
        ).join('');
        
        if (employeeFilter) {
            employeeFilter.innerHTML = '<option value="">All Employees</option>' + options;
        }
        if (invoiceEmployeeSelect) {
            invoiceEmployeeSelect.innerHTML = '<option value="">Select Employee</option>' + options;
        }
    } catch (err) {
        console.error('Unexpected error loading team members:', err);
        container.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                <p>Failed to load team members</p>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 8px;">Please try refreshing the page</p>
            </div>
        `;
    }
}

async function showEmployeeDetail(userId) {
    const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    
    if (error || !profile) {
        showToast('Failed to load employee details', 'error');
        return;
    }
    
    // Get recent time entries
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    console.log('=== showEmployeeDetail: Fetching time entries ===');
    console.log('Employee userId:', userId);
    console.log('Current user role:', userProfile?.role);
    console.log('Date range start:', thirtyDaysAgo.toISOString());
    
    const { data: entries, error: entriesError } = await supabaseClient
        .from('time_entries')
        .select('*')
        .eq('user_id', userId)
        .gte('clock_in', thirtyDaysAgo.toISOString())
        .order('clock_in', { ascending: false });
    
    if (entriesError) {
        console.error('Error fetching time entries:', entriesError);
    } else {
        console.log('Time entries fetched:', entries?.length || 0, 'entries');
        console.log('Entries data:', entries);
    }
    
    let totalHours = 0;
    if (entries && entries.length > 0) {
        entries.forEach(e => {
            if (e.clock_out) {
                totalHours += (new Date(e.clock_out) - new Date(e.clock_in)) / 3600000;
            }
        });
    }
    
    const initials = `${(profile.first_name || '?')[0]}${(profile.last_name || '?')[0]}`.toUpperCase();
    
    const modalContent = document.getElementById('employee-modal-content');
    modalContent.innerHTML = `
        <div class="employee-detail-header">
            <div class="employee-detail-avatar">${initials}</div>
            <div class="employee-detail-info">
                <h4>${profile.first_name || ''} ${profile.last_name || ''}</h4>
                <p>${profile.email}</p>
            </div>
        </div>
        
        <div class="employee-detail-section">
            <h5>Contact Information</h5>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-item-label">Phone</div>
                    <div class="detail-item-value">${profile.phone || 'Not provided'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">Email</div>
                    <div class="detail-item-value">${profile.email}</div>
                </div>
            </div>
        </div>
        
        <div class="employee-detail-section">
            <h5>Billing Address</h5>
            <div class="detail-item" style="grid-column: 1/-1;">
                <div class="detail-item-value">${formatAddress(profile)}</div>
            </div>
        </div>
        
        <div class="employee-detail-section">
            <h5>Work Summary (Last 30 Days)</h5>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-item-label">Total Hours</div>
                    <div class="detail-item-value">${totalHours.toFixed(2)} hrs</div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">Total Amount</div>
                    <div class="detail-item-value">${formatCurrency(totalHours * (profile.hourly_rate || 0))}</div>
                </div>
            </div>
        </div>
        
        <div class="employee-detail-section">
            <h5>Recent Shifts</h5>
            ${entries && entries.length > 0 ? `
                <div class="shifts-list" style="max-height: 300px; overflow-y: auto;">
                    ${entries.map(entry => {
                        const clockIn = new Date(entry.clock_in);
                        const clockOut = entry.clock_out ? new Date(entry.clock_out) : null;
                        const hours = clockOut ? ((clockOut - clockIn) / 3600000).toFixed(2) : '-';
                        const earnings = clockOut ? (parseFloat(hours) * (profile.hourly_rate || 0)) : 0;
                        
                        return `
                            <div class="shift-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid var(--border-color);">
                                <div>
                                    <div style="font-weight: 500;">${clockIn.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                                    <div style="font-size: 0.85em; color: var(--text-muted);">${formatTime(clockIn)} → ${clockOut ? formatTime(clockOut) : 'In Progress'}</div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-weight: 500;">${hours}h</div>
                                    <div style="font-size: 0.85em; color: var(--accent-primary);">${formatCurrency(earnings)}</div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            ` : `
                <div class="empty-state small" style="padding: 20px; text-align: center; color: var(--text-muted);">
                    <p>No shifts in the last 30 days</p>
                </div>
            `}
        </div>
        
        <div class="employee-detail-section">
            <h5>Set Hourly Rate</h5>
            <div class="rate-input-group">
                <div class="form-group">
                    <label for="employee-rate-input">Hourly Rate ($)</label>
                    <input type="number" id="employee-rate-input" value="${profile.hourly_rate || 0}" step="0.01" min="0">
                </div>
                <button class="btn btn-primary" onclick="updateEmployeeRate('${userId}')">Update Rate</button>
            </div>
        </div>
    `;
    
    document.getElementById('employee-modal').classList.add('active');
}

async function updateEmployeeRate(userId) {
    const rateInput = document.getElementById('employee-rate-input');
    const rate = parseFloat(rateInput.value) || 0;
    
    try {
        const { error } = await supabaseClient
            .from('profiles')
            .update({ hourly_rate: rate })
            .eq('id', userId);
        
        if (error) throw error;
        
        await loadTeamMembers();
        showToast('Rate updated successfully!');
        document.getElementById('employee-modal').classList.remove('active');
    } catch (error) {
        console.error('Update rate error:', error);
        showToast('Failed to update rate.', 'error');
    }
}

function setAdminDateFilters() {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const todayStr = formatDateForInput(today);
    const thirtyDaysAgoStr = formatDateForInput(thirtyDaysAgo);
    const todayDisplayStr = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const thirtyDaysAgoDisplayStr = thirtyDaysAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    // Admin timesheet filters (last 30 days)
    document.getElementById('admin-start-date').value = thirtyDaysAgoStr;
    document.getElementById('admin-end-date').value = todayStr;
    const adminStartDisplay = document.getElementById('admin-start-date-display');
    const adminEndDisplay = document.getElementById('admin-end-date-display');
    if (adminStartDisplay) adminStartDisplay.value = thirtyDaysAgoDisplayStr;
    if (adminEndDisplay) adminEndDisplay.value = todayDisplayStr;
    
    // Invoice period filters (default to today for both - user picks the range)
    document.getElementById('invoice-period-start').value = todayStr;
    document.getElementById('invoice-period-end').value = todayStr;
    const invoiceStartDisplay = document.getElementById('invoice-period-start-display');
    const invoiceEndDisplay = document.getElementById('invoice-period-end-display');
    if (invoiceStartDisplay) invoiceStartDisplay.value = todayDisplayStr;
    if (invoiceEndDisplay) invoiceEndDisplay.value = todayDisplayStr;
}

async function loadAllTimesheets(employeeId = '', startDate = null, endDate = null) {
    if (!startDate) {
        startDate = new Date(document.getElementById('admin-start-date').value);
    }
    if (!endDate) {
        endDate = new Date(document.getElementById('admin-end-date').value);
        endDate.setDate(endDate.getDate() + 1);
    }
    
    let query = supabaseClient
        .from('time_entries')
        .select('*, profiles(first_name, last_name, hourly_rate)')
        .gte('clock_in', startDate.toISOString())
        .lte('clock_in', endDate.toISOString())
        .order('clock_in', { ascending: false });
    
    if (employeeId) {
        query = query.eq('user_id', employeeId);
    }
    
    const { data, error } = await query;
    
    if (!error && data) {
        renderAdminTimesheets(data);
    }
}

function renderAdminTimesheets(entries) {
    const tbody = document.getElementById('admin-timesheets-body');
    let totalHours = 0;
    let totalAmount = 0;
    
    if (entries.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state">
                    <p>No time entries found for this period</p>
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = entries.map(entry => {
            const clockIn = new Date(entry.clock_in);
            const clockOut = entry.clock_out ? new Date(entry.clock_out) : null;
            const hours = clockOut ? (clockOut - clockIn) / 3600000 : 0;
            const rate = entry.profiles?.hourly_rate || 0;
            const amount = hours * rate;
            const name = `${entry.profiles?.first_name || ''} ${entry.profiles?.last_name || ''}`.trim() || 'Unknown';
            const isPaid = entry.paid || false;
            
            totalHours += hours;
            totalAmount += amount;
            
            // Encode entry data for edit modal
            const entryData = encodeURIComponent(JSON.stringify({
                id: entry.id,
                name: name,
                clock_in: entry.clock_in,
                clock_out: entry.clock_out,
                description: entry.description || ''
            }));
            
            return `
                <tr data-id="${entry.id}">
                    <td>${name}</td>
                    <td>${formatDate(clockIn)}</td>
                    <td>${formatTime(clockIn)}</td>
                    <td>${clockOut ? formatTime(clockOut) : '<em>In progress</em>'}</td>
                    <td>${hours.toFixed(2)}</td>
                    <td>${formatCurrency(rate)}/hr</td>
                    <td>
                        <button class="shift-status ${isPaid ? 'paid' : 'pending'}" onclick="toggleShiftPaid('${entry.id}', ${isPaid})" title="Click to toggle">
                            <span class="shift-status-dot"></span>
                            ${isPaid ? 'Paid' : 'Pending'}
                        </button>
                    </td>
                    <td class="entry-amount">${formatCurrency(amount)}</td>
                    <td>
                        <button class="btn btn-edit" onclick="openEditTimesheetModal('${entryData}')" title="Edit">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    document.getElementById('admin-total-hours').textContent = `${totalHours.toFixed(2)} hrs`;
    document.getElementById('admin-total-amount').textContent = formatCurrency(totalAmount);
}

async function loadBusinessSettings() {
    const { data, error } = await supabaseClient
        .from('business_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
    
    if (data) {
        document.getElementById('business-name').value = data.company_name || '';
        document.getElementById('business-address').value = data.company_address || '';
        document.getElementById('business-email').value = data.company_email || '';
        document.getElementById('business-phone').value = data.company_phone || '';
        document.getElementById('business-payment').value = data.payment_instructions || '';
        const keyInput = document.getElementById('business-openai-key');
        if (keyInput && data.openai_api_key) keyInput.value = data.openai_api_key;
    }
}

async function saveBusinessSettings(formData) {
    try {
        const { data: existing } = await supabaseClient
            .from('business_settings')
            .select('id')
            .limit(1)
            .maybeSingle();
        
        const payload = {
            company_name: formData.name,
            company_address: formData.address,
            company_email: formData.email,
            company_phone: formData.phone,
            payment_instructions: formData.payment
        };

        let error;
        if (existing) {
            ({ error } = await supabaseClient
                .from('business_settings')
                .update(payload)
                .eq('id', existing.id));
        } else {
            ({ error } = await supabaseClient
                .from('business_settings')
                .insert(payload));
        }
        
        if (error) throw error;
        
        showToast('Business settings saved!');
    } catch (error) {
        console.error('Save business settings error:', error);
        showToast('Failed to save settings.', 'error');
    }
}

async function saveOpenAiKey() {
    try {
        const key = document.getElementById('business-openai-key').value.trim();
        const { data: existing } = await supabaseClient
            .from('business_settings')
            .select('id')
            .limit(1)
            .maybeSingle();

        let error;
        if (existing) {
            ({ error } = await supabaseClient
                .from('business_settings')
                .update({ openai_api_key: key || null })
                .eq('id', existing.id));
        } else {
            ({ error } = await supabaseClient
                .from('business_settings')
                .insert({ company_name: 'My Company', openai_api_key: key || null }));
        }
        if (error) throw error;
        showToast('API key saved!');
    } catch (err) {
        console.error('Save OpenAI key error:', err);
        showToast('Failed to save API key.', 'error');
    }
}

async function getOpenAiKey() {
    const { data } = await supabaseClient
        .from('business_settings')
        .select('openai_api_key')
        .limit(1)
        .maybeSingle();
    return data?.openai_api_key || null;
}

async function generateInvoice() {
    const employeeId = document.getElementById('invoice-employee').value;
    const periodStart = document.getElementById('invoice-period-start').value;
    const periodEnd = document.getElementById('invoice-period-end').value;
    const dueDays = parseInt(document.getElementById('invoice-due-days').value);
    
    if (!employeeId || !periodStart || !periodEnd) {
        showToast('Please select an employee and date range', 'error');
        return;
    }
    
    // Get employee profile
    const { data: employee } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', employeeId)
        .single();
    
    if (!employee) {
        showToast('Employee not found', 'error');
        return;
    }
    
    // Get time entries
    const endDate = new Date(periodEnd);
    endDate.setDate(endDate.getDate() + 1);
    
    const { data: entries } = await supabaseClient
        .from('time_entries')
        .select('*')
        .eq('user_id', employeeId)
        .gte('clock_in', new Date(periodStart).toISOString())
        .lt('clock_in', endDate.toISOString())
        .not('clock_out', 'is', null)
        .order('clock_in', { ascending: true });
    
    if (!entries || entries.length === 0) {
        showToast('No completed time entries found for this period', 'error');
        return;
    }
    
    // Get business settings
    const { data: business } = await supabaseClient
        .from('business_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
    
    // Calculate totals
    let totalHours = 0;
    const rate = employee.hourly_rate || 0;
    
    entries.forEach(e => {
        const hours = (new Date(e.clock_out) - new Date(e.clock_in)) / 3600000;
        totalHours += hours;
    });
    
    const subtotal = totalHours * rate;
    const total = subtotal; // No tax for now
    
    // Generate invoice number
    const now = new Date();
    const invoiceNumber = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Date.now().toString().slice(-4)}`;
    
    // Calculate due date
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + dueDays);
    
    // Create invoice preview
    const invoiceHtml = createInvoiceHTML({
        invoiceNumber,
        issueDate: now,
        dueDate,
        employee,
        business,
        entries,
        rate,
        totalHours,
        subtotal,
        total,
        periodStart,
        periodEnd
    });
    
    document.getElementById('invoice-preview').innerHTML = invoiceHtml;
    document.getElementById('invoice-modal').classList.add('active');
    
    // Store invoice data for saving
    window.pendingInvoice = {
        invoice_number: invoiceNumber,
        user_id: employeeId,
        status: 'draft',
        issue_date: now.toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0],
        subtotal,
        total,
        period_start: periodStart,
        period_end: periodEnd
    };
}

function createInvoiceHTML(data) {
    const { invoiceNumber, issueDate, dueDate, employee, business, entries, rate, totalHours, subtotal, total, periodStart, periodEnd } = data;
    
    const formattedIssueDate = issueDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const formattedDueDate = dueDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    
    const lineItems = entries.map(entry => {
        const clockIn = new Date(entry.clock_in);
        const clockOut = new Date(entry.clock_out);
        const hours = (clockOut - clockIn) / 3600000;
        const amount = hours * rate;
        
        return `
            <tr>
                <td class="item-date">${formatDate(clockIn)}</td>
                <td>${entry.description || 'Professional Services'}</td>
                <td class="item-hours">${hours.toFixed(2)}</td>
                <td>${formatCurrency(rate)}</td>
                <td>${formatCurrency(amount)}</td>
            </tr>
        `;
    }).join('');
    
    return `
        <div class="invoice-header">
            <div>
                <div class="invoice-title">INVOICE</div>
                <div class="invoice-number">${invoiceNumber}</div>
            </div>
            <div class="invoice-meta">
                <p><strong>Issue Date:</strong> ${formattedIssueDate}</p>
                <p><strong>Due Date:</strong> ${formattedDueDate}</p>
                <p><strong>Period:</strong> ${periodStart} to ${periodEnd}</p>
            </div>
        </div>
        
        <div class="invoice-parties">
            <div class="party-section">
                <h4>From</h4>
                <p class="party-name">${employee.first_name || ''} ${employee.last_name || ''}</p>
                <p>${employee.email}<br>${formatAddress(employee)}</p>
            </div>
            <div class="party-section">
                <h4>Bill To</h4>
                <p class="party-name">${business?.company_name || 'Company Name'}</p>
                <p>${business?.company_address ? business.company_address.replace(/\n/g, '<br>') : ''}<br>
                ${business?.company_email || ''}</p>
            </div>
        </div>
        
        <div class="invoice-items">
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Hours</th>
                        <th>Rate</th>
                        <th>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${lineItems}
                </tbody>
            </table>
        </div>
        
        <div class="invoice-totals">
            <div class="totals-box">
                <div class="totals-row-invoice">
                    <span>Total Hours</span>
                    <span>${totalHours.toFixed(2)}</span>
                </div>
                <div class="totals-row-invoice">
                    <span>Hourly Rate</span>
                    <span>${formatCurrency(rate)}</span>
                </div>
                <div class="totals-row-invoice grand-total">
                    <span>Amount Due</span>
                    <span>${formatCurrency(total)}</span>
                </div>
            </div>
        </div>
        
        ${business?.payment_instructions ? `
        <div class="invoice-notes">
            <h4>Payment Instructions</h4>
            <p>${business.payment_instructions}</p>
        </div>
        ` : ''}
    `;
}

function initAdminNavigation() {
    const navBtns = document.querySelectorAll('#admin-dashboard .nav-btn');
    const views = document.querySelectorAll('#admin-dashboard .view');
    const hamburgerBtn = document.getElementById('admin-hamburger-btn');
    const mainNav = document.getElementById('admin-main-nav');
    const navOverlay = document.getElementById('admin-nav-overlay');
    
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
            
            // Close mobile nav after selection
            mainNav.classList.remove('open');
            navOverlay.classList.remove('active');
            
            // Load data for specific views
            if (viewId === 'timesheets') {
                loadAllTimesheets();
            } else if (viewId === 'team') {
                loadTeamMembers();
            } else if (viewId === 'sop') {
                loadSopList();
            } else if (viewId === 'equipment') {
                loadEquipmentList();
            } else if (viewId === 'task-lists') {
                loadTaskLists();
            }
        });
    });
}

// ==================== COPY TO SPREADSHEET ====================

function copyShiftsToSpreadsheet() {
    const tbody = document.getElementById('shifts-body');
    const rows = tbody.querySelectorAll('tr');
    const rate = userProfile?.hourly_rate || 0;
    
    let data = 'Date\tClock In\tClock Out\tHours\tDescription\tRate\tAmount\n';
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 6) {
            const date = cells[0].textContent;
            const clockIn = cells[1].textContent;
            const clockOut = cells[2].textContent;
            const hours = cells[3].textContent;
            const desc = cells[4].textContent;
            const amount = cells[5].textContent;
            
            data += `${date}\t${clockIn}\t${clockOut}\t${hours}\t${desc}\t${rate}\t${amount}\n`;
        }
    });
    
    navigator.clipboard.writeText(data).then(() => {
        showToast('Copied to clipboard! Paste into your spreadsheet.');
    }).catch(() => {
        showToast('Failed to copy.', 'error');
    });
}

function copyAdminTimesheetsToSpreadsheet() {
    const tbody = document.getElementById('admin-timesheets-body');
    const rows = tbody.querySelectorAll('tr');
    
    let data = 'Employee\tDate\tClock In\tClock Out\tHours\tRate\tAmount\n';
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 7) {
            data += Array.from(cells).map(c => c.textContent.trim()).join('\t') + '\n';
        }
    });
    
    navigator.clipboard.writeText(data).then(() => {
        showToast('Copied to clipboard!');
    }).catch(() => {
        showToast('Failed to copy.', 'error');
    });
}

// ==================== UTILITY FUNCTIONS ====================

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

function formatAddress(profile, separator = '<br>') {
    const parts = [];
    if (profile.address_street) {
        parts.push(profile.address_street);
    }
    if (profile.address_street2) {
        parts.push(profile.address_street2);
    }
    if (profile.address_city || profile.address_state || profile.address_zip) {
        const cityStateZip = [];
        if (profile.address_city) cityStateZip.push(profile.address_city);
        if (profile.address_state) {
            if (profile.address_city) {
                cityStateZip[cityStateZip.length - 1] += ',';
            }
            cityStateZip.push(profile.address_state);
        }
        if (profile.address_zip) cityStateZip.push(profile.address_zip);
        parts.push(cityStateZip.join(' '));
    }
    return parts.length > 0 ? parts.join(separator) : 'Not provided';
}

function formatDate(date) {
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function formatTime(date) {
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDateForInput(date) {
    return date.toISOString().split('T')[0];
}

function escapeHtml(str) {
    if (str == null) return '';
    const s = String(str);
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

function showConfirmModal(title, message, { okLabel = 'Confirm', okClass = 'btn-primary' } = {}) {
    return new Promise(resolve => {
        const modal = document.getElementById('confirm-modal');
        document.getElementById('confirm-modal-title').textContent = title;
        document.getElementById('confirm-modal-message').textContent = message;
        const okBtn = document.getElementById('confirm-modal-ok');
        okBtn.textContent = okLabel;
        okBtn.className = 'btn ' + okClass;
        const close = (val) => { modal.classList.remove('active'); resolve(val); };
        document.getElementById('confirm-modal-cancel').onclick = () => close(false);
        document.getElementById('close-confirm-modal').onclick = () => close(false);
        okBtn.onclick = () => close(true);
        modal.classList.add('active');
    });
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = toast.querySelector('.toast-message');
    const toastIcon = toast.querySelector('.toast-icon');
    
    toastMessage.textContent = message;
    toastIcon.textContent = type === 'success' ? '✓' : '✕';
    toast.classList.remove('error');
    if (type === 'error') toast.classList.add('error');
    
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ==================== EVENT LISTENERS ====================

// Helper function to add mobile-friendly event listeners
// Ensures buttons work on both touch and mouse devices
function addMobileEventListener(element, handler) {
    if (!element) return;
    
    let lastTouchEnd = 0;
    
    // Handle touch events for mobile (with touch-action: manipulation, this ensures immediate response)
    element.addEventListener('touchend', (e) => {
        const now = Date.now();
        // Prevent double-firing if click is about to fire
        if (now - lastTouchEnd < 300) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        lastTouchEnd = now;
        handler(e);
    }, { passive: false });
    
    // Handle click events (for desktop and as fallback)
    element.addEventListener('click', (e) => {
        // Prevent double-firing from touch events
        if (Date.now() - lastTouchEnd < 300) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        handler(e);
    });
}

function initializeEventListeners() {
    // Auth form toggles
    document.getElementById('show-signup').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('signup-form').style.display = 'block';
    });
    
    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('signup-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'block';
    });
    
    // Onboarding form
    document.getElementById('onboarding-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Saving...';
        
        await handleOnboardingSubmit({
            firstName: document.getElementById('onboarding-first-name').value.trim(),
            lastName: document.getElementById('onboarding-last-name').value.trim(),
            phone: document.getElementById('onboarding-phone').value.trim(),
            street: document.getElementById('onboarding-street').value.trim(),
            street2: document.getElementById('onboarding-street2').value.trim(),
            city: document.getElementById('onboarding-city').value.trim(),
            state: document.getElementById('onboarding-state').value.trim(),
            zip: document.getElementById('onboarding-zip').value.trim()
        });
        
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
            Complete Setup
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left: 8px;">
                <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
        `;
    });
    
    // Login form
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');
        
        try {
            errorEl.textContent = '';
            await handleLogin(email, password);
        } catch (error) {
            errorEl.textContent = error.message || 'Login failed. Please try again.';
        }
    });
    
    // Signup form
    document.getElementById('signup-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const firstName = document.getElementById('signup-first-name').value;
        const lastName = document.getElementById('signup-last-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const errorEl = document.getElementById('signup-error');
        
        try {
            errorEl.textContent = '';
            await handleSignup(email, password, firstName, lastName);
        } catch (error) {
            errorEl.textContent = error.message || 'Signup failed. Please try again.';
        }
    });
    
    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
    document.getElementById('admin-logout-btn')?.addEventListener('click', handleLogout);
    document.getElementById('mobile-logout-btn')?.addEventListener('click', handleLogout);
    document.getElementById('admin-mobile-logout-btn')?.addEventListener('click', handleLogout);
    
    // Clock buttons - use mobile-friendly handlers
    addMobileEventListener(document.getElementById('clock-in-btn'), clockIn);
    addMobileEventListener(document.getElementById('clock-out-btn'), clockOut);
    
    // Add shift modal - use mobile-friendly handlers
    addMobileEventListener(document.getElementById('add-shift-btn'), () => {
        openShiftModal();
    });
    
    // Add manual shift button on Time Clock view - use mobile-friendly handlers
    addMobileEventListener(document.getElementById('add-manual-shift-btn'), () => {
        openShiftModal();
    });
    
    document.getElementById('close-shift-modal')?.addEventListener('click', () => {
        closeShiftModal();
    });
    
    document.getElementById('cancel-shift-btn')?.addEventListener('click', () => {
        closeShiftModal();
    });
    
    // Handle overnight shift checkbox
    document.getElementById('shift-overnight')?.addEventListener('change', (e) => {
        const endDateGroup = document.getElementById('end-date-group');
        const endDateInput = document.getElementById('shift-end-date');
        const startDateInput = document.getElementById('shift-date');
        
        if (e.target.checked) {
            endDateGroup.style.display = 'block';
            // Set end date to next day by default
            if (startDateInput.value) {
                const startDate = new Date(startDateInput.value);
                startDate.setDate(startDate.getDate() + 1);
                endDateInput.value = formatDateForInput(startDate);
            }
        } else {
            endDateGroup.style.display = 'none';
            endDateInput.value = '';
        }
    });
    
    // Update end date when start date changes (if overnight is checked)
    document.getElementById('shift-date')?.addEventListener('change', (e) => {
        const overnightCheckbox = document.getElementById('shift-overnight');
        const endDateInput = document.getElementById('shift-end-date');
        
        if (overnightCheckbox?.checked && e.target.value) {
            const startDate = new Date(e.target.value);
            startDate.setDate(startDate.getDate() + 1);
            endDateInput.value = formatDateForInput(startDate);
        }
    });
    
    document.getElementById('shift-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const date = document.getElementById('shift-date').value;
        const start = document.getElementById('shift-start').value;
        const end = document.getElementById('shift-end').value;
        const desc = document.getElementById('shift-description').value;
        const isOvernight = document.getElementById('shift-overnight').checked;
        const endDate = isOvernight ? document.getElementById('shift-end-date').value : null;
        
        if (!start || !end) {
            showToast('Please set both start and end times', 'error');
            return;
        }
        
        if (isOvernight && !endDate) {
            showToast('Please select an end date for overnight shifts', 'error');
            return;
        }
        
        const success = await addManualShift(date, start, end, desc, endDate);
        if (success) {
            closeShiftModal();
        }
    });
    
    // Filter shifts
    document.getElementById('filter-shifts-btn')?.addEventListener('click', () => {
        const start = new Date(document.getElementById('shifts-start-date').value);
        const end = new Date(document.getElementById('shifts-end-date').value);
        end.setDate(end.getDate() + 1);
        loadShifts(start, end);
    });
    
    document.getElementById('copy-shifts-btn')?.addEventListener('click', copyShiftsToSpreadsheet);
    
    // Profile form
    document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveProfile({
            firstName: document.getElementById('profile-first-name').value,
            lastName: document.getElementById('profile-last-name').value,
            phone: document.getElementById('profile-phone').value,
            street: document.getElementById('profile-street').value,
            street2: document.getElementById('profile-street2').value,
            city: document.getElementById('profile-city').value,
            state: document.getElementById('profile-state').value,
            zip: document.getElementById('profile-zip').value
        });
    });
    
    // Admin filters
    document.getElementById('admin-filter-btn')?.addEventListener('click', () => {
        const employeeId = document.getElementById('employee-filter').value;
        loadAllTimesheets(employeeId);
    });
    
    document.getElementById('admin-copy-btn')?.addEventListener('click', copyAdminTimesheetsToSpreadsheet);
    
    // Business settings form
    document.getElementById('business-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveBusinessSettings({
            name: document.getElementById('business-name').value,
            address: document.getElementById('business-address').value,
            email: document.getElementById('business-email').value,
            phone: document.getElementById('business-phone').value,
            payment: document.getElementById('business-payment').value
        });
    });
    
    // OpenAI API key form
    document.getElementById('openai-key-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveOpenAiKey();
    });

    // Generate invoice
    document.getElementById('generate-invoice-btn')?.addEventListener('click', generateInvoice);
    
    // Modal close buttons
    document.getElementById('close-employee-modal')?.addEventListener('click', () => {
        document.getElementById('employee-modal').classList.remove('active');
    });
    
    document.getElementById('close-invoice-modal')?.addEventListener('click', () => {
        document.getElementById('invoice-modal').classList.remove('active');
    });
    
    // Add Team Member modal
    document.getElementById('add-team-member-btn')?.addEventListener('click', openAddTeamModal);
    document.getElementById('close-add-team-modal')?.addEventListener('click', closeAddTeamModal);
    document.getElementById('search-member-btn')?.addEventListener('click', searchTeamMember);
    document.getElementById('search-member-email')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchTeamMember();
        }
    });
    document.getElementById('back-to-search-btn')?.addEventListener('click', showSearchStep);
    document.getElementById('add-team-form')?.addEventListener('submit', handleAddTeamMember);
    
    // Delete member modal
    document.getElementById('close-delete-modal')?.addEventListener('click', closeDeleteModal);
    document.getElementById('cancel-delete-btn')?.addEventListener('click', closeDeleteModal);
    document.getElementById('confirm-delete-btn')?.addEventListener('click', executeDeleteMember);
    
    // Edit Timesheet modal (Admin)
    document.getElementById('close-edit-timesheet-modal')?.addEventListener('click', closeEditTimesheetModal);
    document.getElementById('cancel-edit-timesheet-btn')?.addEventListener('click', closeEditTimesheetModal);
    document.getElementById('edit-timesheet-form')?.addEventListener('submit', saveEditTimesheet);
    
    // Handle overnight checkbox in edit modal
    document.getElementById('edit-timesheet-overnight')?.addEventListener('change', (e) => {
        const endDateGroup = document.getElementById('edit-end-date-group');
        const endDateInput = document.getElementById('edit-timesheet-end-date');
        const startDateInput = document.getElementById('edit-timesheet-date');
        
        if (e.target.checked) {
            endDateGroup.style.display = 'block';
            // Default to next day if start date is set
            if (startDateInput.value && !endDateInput.value) {
                const startDate = new Date(startDateInput.value);
                startDate.setDate(startDate.getDate() + 1);
                endDateInput.value = formatDateForInput(startDate);
            }
        } else {
            endDateGroup.style.display = 'none';
        }
    });
    
    // Update end date when start date changes in edit modal
    document.getElementById('edit-timesheet-date')?.addEventListener('change', (e) => {
        const overnightCheckbox = document.getElementById('edit-timesheet-overnight');
        const endDateInput = document.getElementById('edit-timesheet-end-date');
        
        if (overnightCheckbox?.checked && e.target.value) {
            const startDate = new Date(e.target.value);
            startDate.setDate(startDate.getDate() + 1);
            endDateInput.value = formatDateForInput(startDate);
        }
    });
    
    document.getElementById('print-invoice-btn')?.addEventListener('click', () => {
        window.print();
    });
    
    // Close modals on overlay click (except onboarding which requires completion)
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal && modal.id !== 'onboarding-modal') {
                modal.classList.remove('active');
            }
        });
    });
    
    // Initialize custom time picker
    initTimePicker();
    
    // Initialize custom calendar picker
    initCalendarPicker();
}

// ==================== SHIFT MODAL HELPERS ====================

function openShiftModal() {
    document.getElementById('shift-date').value = formatDateForInput(new Date());
    document.getElementById('shift-start').value = '';
    document.getElementById('shift-end').value = '';
    document.getElementById('shift-start-display').value = '';
    document.getElementById('shift-end-display').value = '';
    document.getElementById('shift-description').value = '';
    document.getElementById('shift-overnight').checked = false;
    document.getElementById('shift-end-date').value = '';
    document.getElementById('end-date-group').style.display = 'none';
    document.getElementById('shift-modal').classList.add('active');
}

function closeShiftModal() {
    document.getElementById('shift-modal').classList.remove('active');
    document.getElementById('shift-form').reset();
    document.getElementById('shift-start-display').value = '';
    document.getElementById('shift-end-display').value = '';
    document.getElementById('shift-overnight').checked = false;
    document.getElementById('shift-end-date').value = '';
    document.getElementById('end-date-group').style.display = 'none';
}

// ==================== EDIT TIMESHEET MODAL (ADMIN) ====================

function openEditTimesheetModal(encodedData) {
    const data = JSON.parse(decodeURIComponent(encodedData));
    const clockIn = new Date(data.clock_in);
    const clockOut = data.clock_out ? new Date(data.clock_out) : null;
    
    // Check if this is an overnight shift (different dates for clock in/out)
    const isOvernight = clockOut && clockIn.toDateString() !== clockOut.toDateString();
    
    // Populate form fields
    document.getElementById('edit-timesheet-id').value = data.id;
    document.getElementById('edit-timesheet-employee').value = data.name;
    document.getElementById('edit-timesheet-date').value = formatDateForInput(clockIn);
    document.getElementById('edit-timesheet-description').value = data.description || '';
    
    // Set clock in time
    const startTime24 = clockIn.toTimeString().slice(0, 5);
    document.getElementById('edit-timesheet-start').value = startTime24;
    document.getElementById('edit-timesheet-start-display').value = formatTimeForDisplay(startTime24);
    
    // Set clock out time if exists
    if (clockOut) {
        const endTime24 = clockOut.toTimeString().slice(0, 5);
        document.getElementById('edit-timesheet-end').value = endTime24;
        document.getElementById('edit-timesheet-end-display').value = formatTimeForDisplay(endTime24);
        
        if (isOvernight) {
            document.getElementById('edit-timesheet-overnight').checked = true;
            document.getElementById('edit-end-date-group').style.display = 'block';
            document.getElementById('edit-timesheet-end-date').value = formatDateForInput(clockOut);
        }
    } else {
        document.getElementById('edit-timesheet-end').value = '';
        document.getElementById('edit-timesheet-end-display').value = '';
    }
    
    // Handle overnight checkbox
    if (!isOvernight) {
        document.getElementById('edit-timesheet-overnight').checked = false;
        document.getElementById('edit-end-date-group').style.display = 'none';
    }
    
    document.getElementById('edit-timesheet-modal').classList.add('active');
}

function closeEditTimesheetModal() {
    document.getElementById('edit-timesheet-modal').classList.remove('active');
    document.getElementById('edit-timesheet-form').reset();
    document.getElementById('edit-timesheet-start-display').value = '';
    document.getElementById('edit-timesheet-end-display').value = '';
    document.getElementById('edit-timesheet-overnight').checked = false;
    document.getElementById('edit-timesheet-end-date').value = '';
    document.getElementById('edit-end-date-group').style.display = 'none';
}

async function saveEditTimesheet(e) {
    e.preventDefault();
    
    const id = document.getElementById('edit-timesheet-id').value;
    const date = document.getElementById('edit-timesheet-date').value;
    const startTime = document.getElementById('edit-timesheet-start').value;
    const endTime = document.getElementById('edit-timesheet-end').value;
    const description = document.getElementById('edit-timesheet-description').value;
    const isOvernight = document.getElementById('edit-timesheet-overnight').checked;
    const endDate = isOvernight ? document.getElementById('edit-timesheet-end-date').value : date;
    
    if (!startTime) {
        showToast('Please set a clock in time', 'error');
        return;
    }
    
    try {
        const clockIn = new Date(`${date}T${startTime}`);
        let clockOut = null;
        
        if (endTime) {
            clockOut = new Date(`${endDate}T${endTime}`);
            
            if (clockOut <= clockIn) {
                throw new Error('Clock out time must be after clock in time');
            }
        }
        
        const updateData = {
            clock_in: clockIn.toISOString(),
            clock_out: clockOut ? clockOut.toISOString() : null,
            description: description || null
        };
        
        const { error } = await supabaseClient
            .from('time_entries')
            .update(updateData)
            .eq('id', id);
        
        if (error) throw error;
        
        closeEditTimesheetModal();
        showToast('Time entry updated successfully!');
        
        // Reload the timesheets view
        await loadAllTimesheets(document.getElementById('employee-filter').value);
    } catch (error) {
        console.error('Update timesheet error:', error);
        showToast(error.message || 'Failed to update time entry.', 'error');
    }
}

function formatTimeForDisplay(time24) {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const h = parseInt(hours);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${period}`;
}

// ==================== ADD TEAM MEMBER ====================

function openAddTeamModal() {
    // Reset to search step
    document.getElementById('search-member-email').value = '';
    document.getElementById('search-result').style.display = 'none';
    document.getElementById('search-result').innerHTML = '';
    document.getElementById('add-team-search-step').style.display = 'block';
    document.getElementById('add-team-invite-step').style.display = 'none';
    document.getElementById('add-team-form').reset();
    document.getElementById('add-team-modal').classList.add('active');
}

function closeAddTeamModal() {
    document.getElementById('add-team-modal').classList.remove('active');
}

function showSearchStep() {
    document.getElementById('add-team-search-step').style.display = 'block';
    document.getElementById('add-team-invite-step').style.display = 'none';
}

function showInviteStep(email) {
    document.getElementById('invite-email').value = email;
    document.getElementById('not-found-email').textContent = email;
    document.getElementById('add-team-search-step').style.display = 'none';
    document.getElementById('add-team-invite-step').style.display = 'block';
}

async function searchTeamMember() {
    const email = document.getElementById('search-member-email').value.trim();
    
    if (!email) {
        showToast('Please enter an email address', 'error');
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast('Please enter a valid email address', 'error');
        return;
    }
    
    const searchBtn = document.getElementById('search-member-btn');
    searchBtn.disabled = true;
    searchBtn.innerHTML = '<span class="spinner"></span>';
    
    try {
        // Search for user by email (case-insensitive)
        console.log('Searching for email:', email);
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .ilike('email', email)
            .maybeSingle();
        
        console.log('Search result:', { profile, error });
        
        if (error) throw error;
        
        const resultContainer = document.getElementById('search-result');
        
        if (profile) {
            // User found - show their card with view shifts button
            const initials = `${(profile.first_name || '?')[0]}${(profile.last_name || '?')[0]}`.toUpperCase();
            resultContainer.innerHTML = `
                <div class="found-member-card">
                    <div class="found-member-header">
                        <div class="team-avatar">${initials}</div>
                        <div class="found-member-info">
                            <div class="team-name">${profile.first_name || ''} ${profile.last_name || ''}</div>
                            <div class="team-email">${profile.email}</div>
                        </div>
                    </div>
                    <div class="found-member-stats">
                        <div class="found-stat">
                            <span class="found-stat-value">${formatCurrency(profile.hourly_rate || 0)}</span>
                            <span class="found-stat-label">Hourly Rate</span>
                        </div>
                        <div class="found-stat">
                            <span class="found-stat-value">${profile.role === 'admin' ? 'Admin' : 'Employee'}</span>
                            <span class="found-stat-label">Role</span>
                        </div>
                    </div>
                    <div class="found-member-actions">
                        <button class="btn btn-primary" onclick="viewMemberShifts('${profile.id}')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="16" y1="2" x2="16" y2="6"></line>
                                <line x1="8" y1="2" x2="8" y2="6"></line>
                                <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                            View Shifts
                        </button>
                        <button class="btn btn-secondary" onclick="showEmployeeDetail('${profile.id}'); closeAddTeamModal();">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                            </svg>
                            View Profile
                        </button>
                    </div>
                </div>
            `;
            resultContainer.style.display = 'block';
        } else {
            // User not found - show invite option
            resultContainer.innerHTML = `
                <div class="not-found-card">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M8 15h8"></path>
                        <circle cx="9" cy="9" r="1"></circle>
                        <circle cx="15" cy="9" r="1"></circle>
                    </svg>
                    <p>No user found with this email</p>
                    <button class="btn btn-primary" onclick="showInviteStep('${email}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                            <polyline points="22,6 12,13 2,6"></polyline>
                        </svg>
                        Send Invite
                    </button>
                </div>
            `;
            resultContainer.style.display = 'block';
        }
        
    } catch (error) {
        console.error('Error searching for member:', error);
        showToast('Failed to search for member', 'error');
    } finally {
        searchBtn.disabled = false;
        searchBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            Search
        `;
    }
}

async function viewMemberShifts(userId) {
    closeAddTeamModal();
    
    // Get user profile
    const { data: profile } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    
    if (!profile) {
        showToast('Could not load member data', 'error');
        return;
    }
    
    // Get their time entries
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const now = new Date();
    
    // Debug: Log current user role and query details
    console.log('=== Loading shifts for team member ===');
    console.log('Team member userId:', userId);
    console.log('Current logged-in user:', currentUser?.id);
    console.log('Current user role:', userProfile?.role);
    console.log('Date range:', thirtyDaysAgo.toISOString(), 'to', now.toISOString());
    
    // First, let's try querying without date filter to see if RLS is the issue
    const { data: allEntries, error: allError } = await supabaseClient
        .from('time_entries')
        .select('*')
        .eq('user_id', userId)
        .order('clock_in', { ascending: false })
        .limit(100);
    
    console.log('All entries query (no date filter):', {
        count: allEntries?.length || 0,
        error: allError,
        sample: allEntries?.[0]
    });
    
    // Now query with date filter
    const { data: entries, error } = await supabaseClient
        .from('time_entries')
        .select('*')
        .eq('user_id', userId)
        .gte('clock_in', thirtyDaysAgo.toISOString())
        .lte('clock_in', now.toISOString())
        .order('clock_in', { ascending: false });
    
    // Check for errors (including RLS policy violations)
    if (error) {
        console.error('Error loading team member shifts:', error);
        console.error('Error details:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
        });
        showToast(`Error loading shifts: ${error.message}`, 'error');
        // Still show the modal with empty state
    } else {
        console.log(`Successfully loaded ${entries?.length || 0} shifts for user ${userId}`);
        console.log('Entries data:', entries);
        if (entries && entries.length > 0) {
            console.log('Sample entry:', entries[0]);
            console.log('Entry dates:', entries.map(e => ({
                id: e.id,
                clock_in: e.clock_in,
                clock_out: e.clock_out,
                user_id: e.user_id
            })));
        } else {
            console.warn('No entries returned, but query succeeded. Possible issues:');
            console.warn('1. Date filter too restrictive');
            console.warn('2. RLS policy returning empty array (check if admin role is set correctly)');
            console.warn('3. user_id mismatch');
        }
    }
    
    // Ensure entries is an array (default to empty if null/undefined)
    const safeEntries = entries || [];
    
    // Calculate totals
    let totalHours = 0;
    let totalEarnings = 0;
    
    if (safeEntries.length > 0) {
        entries.forEach(e => {
            if (e.clock_out) {
                const hours = (new Date(e.clock_out) - new Date(e.clock_in)) / 3600000;
                totalHours += hours;
                totalEarnings += hours * (profile.hourly_rate || 0);
            }
        });
    }
    
    const initials = `${(profile.first_name || '?')[0]}${(profile.last_name || '?')[0]}`.toUpperCase();
    
    // Show in employee modal
    const modalContent = document.getElementById('employee-modal-content');
    modalContent.innerHTML = `
        <div class="employee-detail-header">
            <div class="employee-detail-avatar">
                <div class="team-avatar large">${initials}</div>
            </div>
            <div class="employee-detail-info">
                <h3>${profile.first_name || ''} ${profile.last_name || ''}</h3>
                <p>${profile.email}</p>
                <span class="role-badge ${profile.role}">${profile.role === 'admin' ? 'Admin' : 'Employee'}</span>
            </div>
        </div>
        
        <div class="employee-summary">
            <div class="summary-card">
                <span class="summary-value">${totalHours.toFixed(1)}h</span>
                <span class="summary-label">Hours (30 days)</span>
            </div>
            <div class="summary-card">
                <span class="summary-value">${formatCurrency(profile.hourly_rate || 0)}</span>
                <span class="summary-label">Hourly Rate</span>
            </div>
            <div class="summary-card">
                <span class="summary-value">${formatCurrency(totalEarnings)}</span>
                <span class="summary-label">Earnings (30 days)</span>
            </div>
        </div>
        
        <div class="employee-shifts-section">
            <h4>Recent Shifts</h4>
            ${safeEntries && safeEntries.length > 0 ? `
                <div class="shifts-list">
                    ${safeEntries.map(entry => {
                        const clockIn = new Date(entry.clock_in);
                        const clockOut = entry.clock_out ? new Date(entry.clock_out) : null;
                        const hours = clockOut ? ((clockOut - clockIn) / 3600000).toFixed(2) : '-';
                        const earnings = clockOut ? (hours * (profile.hourly_rate || 0)) : 0;
                        
                        return `
                            <div class="shift-item">
                                <div class="shift-date">
                                    <span class="shift-day">${clockIn.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                                    <span class="shift-full-date">${formatDate(clockIn)}</span>
                                </div>
                                <div class="shift-times">
                                    <span>${formatTime(clockIn)}</span>
                                    <span class="shift-arrow">→</span>
                                    <span>${clockOut ? formatTime(clockOut) : 'In Progress'}</span>
                                </div>
                                <div class="shift-hours">${hours}h</div>
                                <div class="shift-earnings">${formatCurrency(earnings)}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            ` : `
                <div class="empty-state small">
                    <p>No shifts in the last 30 days</p>
                </div>
            `}
        </div>
    `;
    
    document.getElementById('employee-modal').classList.add('active');
}

async function handleAddTeamMember(e) {
    e.preventDefault();
    
    const email = document.getElementById('invite-email').value.trim();
    const firstName = document.getElementById('invite-first-name').value.trim();
    const lastName = document.getElementById('invite-last-name').value.trim();
    const hourlyRate = parseFloat(document.getElementById('invite-hourly-rate').value) || 0;
    const role = document.getElementById('invite-role').value;
    
    if (!email) {
        showToast('Please enter an email address', 'error');
        return;
    }
    
    const submitBtn = document.getElementById('send-invite-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Sending...';
    
    try {
        // Send magic link invite via Supabase
        const { data, error } = await supabaseClient.auth.signInWithOtp({
            email: email,
            options: {
                data: {
                    first_name: firstName,
                    last_name: lastName,
                    hourly_rate: hourlyRate,
                    role: role,
                    invited_by: currentUser.id
                },
                emailRedirectTo: window.location.origin
            }
        });
        
        if (error) {
            throw error;
        }
        
        // Store invite details in localStorage to apply when user signs up
        const pendingInvites = JSON.parse(localStorage.getItem('pendingInvites') || '{}');
        pendingInvites[email.toLowerCase()] = {
            first_name: firstName,
            last_name: lastName,
            hourly_rate: hourlyRate,
            role: role,
            invited_at: new Date().toISOString()
        };
        localStorage.setItem('pendingInvites', JSON.stringify(pendingInvites));
        
        showToast(`Invite sent to ${email}!`, 'success');
        closeAddTeamModal();
        
    } catch (error) {
        console.error('Error sending invite:', error);
        
        // Handle specific error cases
        if (error.message?.includes('rate limit')) {
            showToast('Too many invites sent. Please wait a moment.', 'error');
        } else if (error.message?.includes('already registered')) {
            showToast('This email is already registered', 'error');
        } else {
            showToast(error.message || 'Failed to send invite', 'error');
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
            Send Invite
        `;
    }
}

// ==================== DELETE TEAM MEMBER ====================

let memberToDelete = null;

function confirmDeleteMember(userId, name, email) {
    memberToDelete = userId;
    document.getElementById('delete-member-name').textContent = name || 'Unknown';
    document.getElementById('delete-member-email').textContent = email;
    document.getElementById('delete-member-modal').classList.add('active');
}

function closeDeleteModal() {
    memberToDelete = null;
    document.getElementById('delete-member-modal').classList.remove('active');
}

async function executeDeleteMember() {
    if (!memberToDelete) return;
    
    const deleteBtn = document.getElementById('confirm-delete-btn');
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = '<span class="spinner"></span> Removing...';
    
    try {
        // Delete from profiles (cascades to time_entries and invoices due to ON DELETE CASCADE)
        const { error } = await supabaseClient
            .from('profiles')
            .delete()
            .eq('id', memberToDelete);
        
        if (error) throw error;
        
        showToast('Team member removed successfully');
        closeDeleteModal();
        
        // Reload team list
        await loadTeamMembers();
        
    } catch (error) {
        console.error('Error deleting member:', error);
        showToast(error.message || 'Failed to remove team member', 'error');
    } finally {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            Remove Member
        `;
    }
}

// ==================== SOP (Standard Operating Procedures) ====================

const SOP_STORAGE_BUCKET = 'sop-media';

function getTodayDateString() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
}

async function getTodayDailySop() {
    const today = getTodayDateString();
    const { data, error } = await supabaseClient
        .from('daily_sops')
        .select('*, sop_templates(name)')
        .eq('date', today)
        .is('completed_at', null)
        .maybeSingle();
    if (error) {
        console.error('getTodayDailySop error', error);
        return null;
    }
    return data;
}

async function createDailySop(sopTemplateId) {
    const today = getTodayDateString();
    const { data, error } = await supabaseClient
        .from('daily_sops')
        .insert({
            date: today,
            sop_template_id: sopTemplateId,
            created_by: currentUser.id
        })
        .select('*, sop_templates(name)')
        .single();
    if (error) throw error;
    return data;
}

async function showSopFlowAfterClockIn() {
    const daily = await getTodayDailySop();
    if (daily) {
        showSopChecklistPanel(daily);
        return;
    }
    const { data: templates } = await supabaseClient.from('sop_templates').select('id, name').order('name');
    if (!templates || templates.length === 0) {
        return;
    }
    showSelectSopModal(templates);
}

function showSelectSopModal(templates) {
    const modal = document.getElementById('select-sop-modal');
    const list = document.getElementById('sop-select-list');
    list.innerHTML = templates.map(t =>
        `<button type="button" class="sop-select-card" data-sop-id="${t.id}">${escapeHtml(t.name)}</button>`
    ).join('');
    list.querySelectorAll('.sop-select-card').forEach(btn => {
        btn.addEventListener('click', async () => {
            try {
                const daily = await createDailySop(btn.dataset.sopId);
                modal.classList.remove('active');
                showSopChecklistPanel(daily);
            } catch (e) {
                console.error(e);
                showToast('Failed to set today\'s checklist', 'error');
            }
        });
    });
    modal.classList.add('active');
}

function hideSopChecklistPanel() {
    const panel = document.getElementById('sop-checklist-panel');
    if (panel) panel.style.display = 'none';
}

function showSopChecklistPanel(dailySop) {
    const panel = document.getElementById('sop-checklist-panel');
    const titleEl = document.getElementById('sop-checklist-title');
    if (!panel || !titleEl) return;
    titleEl.textContent = dailySop.sop_templates?.name || 'Checklist';
    panel.style.display = 'block';
    loadSopChecklistItems(dailySop.id);
}

async function loadSopChecklistPanelIfClockedIn() {
    if (!currentClockIn) return;
    const daily = await getTodayDailySop();
    if (daily) showSopChecklistPanel(daily);
}

function sortSopItemsUncheckedFirst(items, checkMap) {
    const isTask = (it) => (it.item_type || 'task') === 'task';
    const checkKey = (it) => it._adHoc ? 'adhoc_' + it.id : it.id;
    const unchecked = [];
    const checked = [];
    for (const item of items) {
        if (!isTask(item)) {
            unchecked.push(item);
        } else if (checkMap[checkKey(item)]) {
            checked.push(item);
        } else {
            unchecked.push(item);
        }
    }
    if (checked.length > 0) {
        return [...unchecked, { _divider: true, _count: checked.length }, ...checked];
    }
    return unchecked;
}

async function loadLatestSopComments(sopItemIds) {
    if (!sopItemIds || !sopItemIds.length) return {};
    const { data } = await supabaseClient
        .from('sop_task_comments')
        .select('sop_item_id, comment, created_at, daily_sop_id')
        .in('sop_item_id', sopItemIds)
        .order('created_at', { ascending: false });
    const map = {};
    (data || []).forEach(c => {
        if (!map[c.sop_item_id]) map[c.sop_item_id] = c;
    });
    return map;
}

function renderSopChecklistItemHtml(item, dailySopId, checkMap, names, eqMap, opts) {
    const { isAdmin, commentMap } = opts || {};
    if (item._divider) {
        return `<div class="sop-completed-divider"><span>Completed (${item._count})</span></div>`;
    }
    if (item._adHocHeader) {
        return `<div class="sop-checklist-section-header sop-adhoc-header">Ad Hoc Tasks</div>`;
    }
    const isTask = (it) => (it.item_type || 'task') === 'task';
    if (!isTask(item)) {
        return `<div class="sop-checklist-section-header" data-daily-sop-id="${dailySopId}" data-item-id="${item.id}">${escapeHtml(item.title)}</div>`;
    }
    const adHoc = !!item._adHoc;
    const checkKey = adHoc ? 'adhoc_' + item.id : item.id;
    const c = checkMap[checkKey];
    const checked = !!c;
    const who = c && names[c.checked_by] ? names[c.checked_by] : '';
    const media = Array.isArray(item.media) ? item.media : [];
    const eqIds = Array.isArray(item.equipment) ? item.equipment : [];
    const hasDetails = item.description || media.length || eqIds.length;

    const mediaHtml = media.length ? media.map(m => {
        if ((m.type || '').toLowerCase() === 'video') return `<video controls src="${escapeHtml(m.url)}" class="sop-checklist-media"></video>`;
        return `<img src="${escapeHtml(m.url)}" alt="" class="sop-checklist-media">`;
    }).join('') : '';
    const equipHtml = eqIds.length ? `<div class="sop-checklist-equipment">${eqIds.map(eqId => {
        const eq = eqMap[eqId];
        if (!eq) return '';
        return `<div class="sop-checklist-equip-item">
            ${eq.image_url ? `<img src="${escapeHtml(eq.image_url)}" alt="">` : ''}
            <div class="sop-checklist-equip-info">
                <div class="sop-checklist-equip-name">${escapeHtml(eq.name)}</div>
                ${eq.location ? `<div class="sop-checklist-equip-location">${escapeHtml(eq.location)}</div>` : ''}
            </div>
        </div>`;
    }).join('')}</div>` : '';

    const adminComment = (commentMap && !adHoc) ? commentMap[item.id] : null;
    const commentHtml = adminComment ? `
        <div class="sop-admin-comment">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>${escapeHtml(adminComment.comment)}</span>
        </div>` : '';

    const detailsHtml = hasDetails ? `
        <div class="sop-item-details" style="display:none;">
            ${item.description ? `<p class="sop-item-desc">${escapeHtml(item.description)}</p>` : ''}
            ${mediaHtml ? `<div class="sop-item-media-wrap">${mediaHtml}</div>` : ''}
            ${equipHtml}
        </div>` : '';

    const toggleBtn = hasDetails ? `<button type="button" class="sop-details-toggle" aria-label="Toggle details">Details <svg class="sop-toggle-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg></button>` : '';

    const deleteBtn = (adHoc && isAdmin && !checked)
        ? `<button type="button" class="btn btn-close sop-adhoc-delete-btn" title="Remove ad hoc task">&times;</button>`
        : '';

    const actionHtml = checked
        ? `<span class="sop-checked-badge" title="${who ? 'By ' + escapeHtml(who) : ''}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg></span>`
        : `<button type="button" class="btn btn-primary btn-sm sop-check-btn">Done</button>`;

    return `
        <div class="sop-checklist-item ${checked ? 'checked' : ''} ${adHoc ? 'sop-adhoc-item' : ''} ${adminComment ? 'has-comment' : ''}" data-daily-sop-id="${dailySopId}" data-item-id="${item.id}" ${adHoc ? 'data-adhoc="1"' : ''}>
            <div class="sop-item-row">
                <label class="sop-checkbox-label">
                    <input type="checkbox" class="sop-item-check" ${checked ? 'checked disabled' : ''}>
                    <span class="sop-item-title-wrap">
                        <span class="sop-item-title">${escapeHtml(item.title)}</span>
                        ${checked && who ? `<span class="sop-completed-by">by ${escapeHtml(who)}</span>` : ''}
                    </span>
                </label>
                <div class="sop-item-actions">
                    ${deleteBtn}
                    ${toggleBtn}
                    ${actionHtml}
                </div>
            </div>
            ${commentHtml}
            ${detailsHtml}
        </div>`;
}

function bindSopCheckButtons(container, reloadFn) {
    container.querySelectorAll('.sop-check-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const row = btn.closest('.sop-checklist-item');
            const dailyId = row.dataset.dailySopId;
            const itemId = row.dataset.itemId;
            const isAdHoc = row.dataset.adhoc === '1';
            btn.disabled = true;
            btn.textContent = '...';
            try {
                const payload = {
                    daily_sop_id: dailyId,
                    checked_by: currentUser.id
                };
                if (isAdHoc) {
                    payload.ad_hoc_task_id = itemId;
                } else {
                    payload.sop_item_id = itemId;
                }
                await supabaseClient.from('sop_item_checks').insert(payload);
                reloadFn(dailyId);
            } catch (e) {
                showToast('Failed to check off', 'error');
                btn.disabled = false;
                btn.textContent = 'Done';
            }
        });
    });
    container.querySelectorAll('.sop-details-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const item = btn.closest('.sop-checklist-item');
            const details = item.querySelector('.sop-item-details');
            if (!details) return;
            const open = details.style.display !== 'none';
            details.style.display = open ? 'none' : 'block';
            btn.classList.toggle('open', !open);
        });
    });
    container.querySelectorAll('.sop-adhoc-delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const row = btn.closest('.sop-checklist-item');
            const dailyId = row.dataset.dailySopId;
            const taskId = row.dataset.itemId;
            if (!confirm('Remove this ad hoc task?')) return;
            btn.disabled = true;
            try {
                await supabaseClient.from('ad_hoc_tasks').delete().eq('id', taskId);
                reloadFn(dailyId);
            } catch (e) {
                showToast('Failed to delete task', 'error');
                btn.disabled = false;
            }
        });
    });
}

async function loadSopChecklistItems(dailySopId) {
    const container = document.getElementById('sop-checklist-items');
    if (!container) return;
    const { data: dailyData } = await supabaseClient
        .from('daily_sops')
        .select('sop_template_id')
        .eq('id', dailySopId)
        .single();
    if (!dailyData) return;
    const { data: items } = await supabaseClient
        .from('sop_items')
        .select('*')
        .eq('sop_template_id', dailyData.sop_template_id)
        .order('sort_order');
    const { data: adHocTasks } = await supabaseClient
        .from('ad_hoc_tasks')
        .select('*')
        .eq('daily_sop_id', dailySopId)
        .order('sort_order');
    const { data: checks } = await supabaseClient
        .from('sop_item_checks')
        .select('sop_item_id, ad_hoc_task_id, checked_by, checked_at, profiles(first_name, last_name)')
        .eq('daily_sop_id', dailySopId);

    const allEqIds = new Set();
    (items || []).forEach(item => {
        (item.equipment || []).forEach(id => allEqIds.add(id));
    });
    let eqMap = {};
    if (allEqIds.size) {
        const { data: eqData } = await supabaseClient
            .from('equipment')
            .select('*')
            .in('id', [...allEqIds]);
        (eqData || []).forEach(eq => { eqMap[eq.id] = eq; });
    }

    const checkMap = {};
    (checks || []).forEach(c => {
        if (c.sop_item_id) checkMap[c.sop_item_id] = c;
        if (c.ad_hoc_task_id) checkMap['adhoc_' + c.ad_hoc_task_id] = c;
    });
    const names = {};
    (checks || []).forEach(c => {
        if (c.profiles) names[c.checked_by] = [c.profiles.first_name, c.profiles.last_name].filter(Boolean).join(' ') || 'Someone';
    });

    const sopItemIds = (items || []).filter(it => (it.item_type || 'task') === 'task').map(it => it.id);
    const commentMap = await loadLatestSopComments(sopItemIds);

    const isAdmin = userProfile?.role === 'admin';
    const renderOpts = { isAdmin, commentMap };
    const sorted = sortSopItemsUncheckedFirst(items || [], checkMap);
    const adHocItems = (adHocTasks || []).map(t => ({ ...t, item_type: 'task', _adHoc: true }));
    const adHocSorted = sortSopItemsUncheckedFirst(adHocItems, checkMap);

    let html = '';
    if (isAdmin) {
        html += renderAdHocAddButton(dailySopId);
    }
    html += sorted.map(item => renderSopChecklistItemHtml(item, dailySopId, checkMap, names, eqMap, renderOpts)).join('');
    if (adHocItems.length) {
        html += renderSopChecklistItemHtml({ _adHocHeader: true }, dailySopId, checkMap, names, eqMap, renderOpts);
        html += adHocSorted.map(item => renderSopChecklistItemHtml(item, dailySopId, checkMap, names, eqMap, renderOpts)).join('');
    }
    container.innerHTML = html;
    bindSopCheckButtons(container, (dailyId) => {
        loadSopChecklistItems(dailyId);
    });
    bindAdHocAddForm(container, (dailyId) => {
        loadSopChecklistItems(dailyId);
    });
}

// --- Employee SOP Tab ---
async function loadEmployeeSopView() {
    const pickEl = document.getElementById('sop-pick-template');
    const activeEl = document.getElementById('sop-active-checklist');
    const emptyEl = document.getElementById('sop-no-templates');
    const completeEl = document.getElementById('sop-today-complete');
    if (!pickEl || !activeEl || !emptyEl) return;

    const dateEl = document.getElementById('sop-current-date');
    if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }

    pickEl.style.display = 'none';
    activeEl.style.display = 'none';
    emptyEl.style.display = 'none';
    if (completeEl) completeEl.style.display = 'none';

    loadEmployeeCompletedSops();

    const daily = await getTodayDailySop();
    if (daily) {
        showEmployeeSopChecklist(daily);
        return;
    }

    const today = getTodayDateString();
    const { data: todayCompleted } = await supabaseClient
        .from('daily_sops')
        .select('id')
        .eq('date', today)
        .not('completed_at', 'is', null)
        .limit(1);
    if (todayCompleted && todayCompleted.length && completeEl) {
        completeEl.style.display = 'block';
    }

    const { data: templates } = await supabaseClient
        .from('sop_templates')
        .select('id, name, description')
        .order('name');

    if (!templates || templates.length === 0) {
        if (!completeEl || completeEl.style.display === 'none') {
            emptyEl.style.display = 'block';
        }
        return;
    }

    renderSopTemplateGrid(templates);
    pickEl.style.display = 'block';
}

async function loadEmployeeCompletedSops() {
    const container = document.getElementById('sop-employee-completed-list');
    if (!container) return;
    const { data, error } = await supabaseClient
        .from('daily_sops')
        .select('id, date, completed_at, sop_templates(name)')
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(50);
    if (error) {
        container.innerHTML = '<p class="text-muted">Failed to load completed SOPs.</p>';
        return;
    }
    if (!data || data.length === 0) {
        container.innerHTML = '<p class="text-muted">No completed SOPs yet.</p>';
        return;
    }
    container.innerHTML = data.map(d => {
        const dateStr = d.date ? new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '';
        const completedStr = d.completed_at ? new Date(d.completed_at).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }) : '';
        const name = (d.sop_templates && d.sop_templates.name) ? escapeHtml(d.sop_templates.name) : 'Checklist';
        return `<div class="sop-completed-card">
            <div class="sop-completed-info">
                <strong>${name}</strong>
                <span class="sop-completed-date">${escapeHtml(dateStr)}</span>
                <span class="sop-completed-at">Completed ${escapeHtml(completedStr)}</span>
            </div>
        </div>`;
    }).join('');
}

function renderSopTemplateGrid(templates) {
    const grid = document.getElementById('sop-template-grid');
    if (!grid) return;
    grid.innerHTML = templates.map(t => `
        <button type="button" class="sop-template-card" data-sop-id="${t.id}">
            <div class="sop-template-card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 11l3 3L22 4"></path>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                </svg>
            </div>
            <div class="sop-template-card-name">${escapeHtml(t.name)}</div>
            ${t.description ? `<div class="sop-template-card-desc">${escapeHtml(t.description)}</div>` : ''}
        </button>
    `).join('');

    grid.querySelectorAll('.sop-template-card').forEach(btn => {
        btn.addEventListener('click', async () => {
            const name = btn.querySelector('.sop-template-card-name')?.textContent || 'this SOP';
            const confirmed = await showConfirmModal(
                'Start SOP',
                `Start "${name}" as today's checklist? Your entire team will see and share it.`,
                { okLabel: 'Start', okClass: 'btn-primary' }
            );
            if (!confirmed) return;
            btn.disabled = true;
            btn.classList.add('loading');
            try {
                const daily = await createDailySop(btn.dataset.sopId);
                showEmployeeSopChecklist(daily);
                showSopChecklistPanel(daily);
            } catch (e) {
                console.error(e);
                showToast('Failed to start checklist', 'error');
            } finally {
                btn.disabled = false;
                btn.classList.remove('loading');
            }
        });
    });
}

let activeEmployeeDailySopId = null;

function showEmployeeSopChecklist(dailySop) {
    const pickEl = document.getElementById('sop-pick-template');
    const activeEl = document.getElementById('sop-active-checklist');
    const emptyEl = document.getElementById('sop-no-templates');
    const completeEl = document.getElementById('sop-today-complete');
    if (pickEl) pickEl.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'none';
    if (completeEl) completeEl.style.display = 'none';
    if (activeEl) activeEl.style.display = 'block';

    activeEmployeeDailySopId = dailySop.id;

    const nameEl = document.getElementById('sop-active-name');
    const dateEl = document.getElementById('sop-active-date');
    if (nameEl) nameEl.textContent = dailySop.sop_templates?.name || 'Checklist';
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    loadEmployeeSopChecklistItems(dailySop.id);
}

document.getElementById('sop-cancel-btn')?.addEventListener('click', async () => {
    if (!activeEmployeeDailySopId) return;
    const confirmed = await showConfirmModal(
        'Cancel SOP',
        'Are you sure you want to cancel this checklist? All progress will be lost.',
        { okLabel: 'Cancel SOP', okClass: 'btn-danger' }
    );
    if (!confirmed) return;
    try {
        await supabaseClient.from('daily_sops').delete().eq('id', activeEmployeeDailySopId);
        activeEmployeeDailySopId = null;
        hideSopChecklistPanel();
        showToast('Checklist cancelled');
        loadEmployeeSopView();
    } catch (e) {
        console.error(e);
        showToast('Failed to cancel checklist', 'error');
    }
});

async function loadEmployeeSopChecklistItems(dailySopId) {
    const container = document.getElementById('sop-employee-checklist-items');
    if (!container) return;

    const { data: dailyData } = await supabaseClient
        .from('daily_sops')
        .select('sop_template_id, completed_at')
        .eq('id', dailySopId)
        .single();
    if (!dailyData) return;

    const { data: items } = await supabaseClient
        .from('sop_items')
        .select('*')
        .eq('sop_template_id', dailyData.sop_template_id)
        .order('sort_order');
    const { data: adHocTasks } = await supabaseClient
        .from('ad_hoc_tasks')
        .select('*')
        .eq('daily_sop_id', dailySopId)
        .order('sort_order');
    const { data: checks } = await supabaseClient
        .from('sop_item_checks')
        .select('sop_item_id, ad_hoc_task_id, checked_by, checked_at, profiles(first_name, last_name)')
        .eq('daily_sop_id', dailySopId);

    const allEqIds = new Set();
    (items || []).forEach(item => {
        (item.equipment || []).forEach(id => allEqIds.add(id));
    });
    let eqMap = {};
    if (allEqIds.size) {
        const { data: eqData } = await supabaseClient
            .from('equipment')
            .select('*')
            .in('id', [...allEqIds]);
        (eqData || []).forEach(eq => { eqMap[eq.id] = eq; });
    }

    const checkMap = {};
    (checks || []).forEach(c => {
        if (c.sop_item_id) checkMap[c.sop_item_id] = c;
        if (c.ad_hoc_task_id) checkMap['adhoc_' + c.ad_hoc_task_id] = c;
    });
    const names = {};
    (checks || []).forEach(c => {
        if (c.profiles) names[c.checked_by] = [c.profiles.first_name, c.profiles.last_name].filter(Boolean).join(' ') || 'Someone';
    });

    const adHocItems = (adHocTasks || []).map(t => ({ ...t, item_type: 'task', _adHoc: true }));

    const taskItems = (items || []).filter(it => (it.item_type || 'task') === 'task');
    const totalTasks = taskItems.length + adHocItems.length;
    const checkedTasks = taskItems.filter(it => !!checkMap[it.id]).length
        + adHocItems.filter(it => !!checkMap['adhoc_' + it.id]).length;
    updateSopProgress(checkedTasks, totalTasks);

    if (totalTasks > 0 && checkedTasks === totalTasks && !dailyData.completed_at) {
        await supabaseClient.from('daily_sops').update({ completed_at: new Date().toISOString() }).eq('id', dailySopId);
        loadEmployeeSopView();
        return;
    }

    const commentMap = await loadLatestSopComments(taskItems.map(it => it.id));

    const isAdmin = userProfile?.role === 'admin';
    const renderOpts = { isAdmin, commentMap };
    const sorted = sortSopItemsUncheckedFirst(items || [], checkMap);
    const adHocSorted = sortSopItemsUncheckedFirst(adHocItems, checkMap);

    let html = '';
    if (isAdmin) {
        html += renderAdHocAddButton(dailySopId);
    }
    html += sorted.map(item => renderSopChecklistItemHtml(item, dailySopId, checkMap, names, eqMap, renderOpts)).join('');
    if (adHocItems.length) {
        html += renderSopChecklistItemHtml({ _adHocHeader: true }, dailySopId, checkMap, names, eqMap, renderOpts);
        html += adHocSorted.map(item => renderSopChecklistItemHtml(item, dailySopId, checkMap, names, eqMap, renderOpts)).join('');
    }
    container.innerHTML = html;
    bindSopCheckButtons(container, (dailyId) => {
        loadEmployeeSopChecklistItems(dailyId);
        const panel = document.getElementById('sop-checklist-panel');
        if (panel && panel.style.display !== 'none') {
            loadSopChecklistItems(dailyId);
        }
    });
    bindAdHocAddForm(container, (dailyId) => {
        loadEmployeeSopChecklistItems(dailyId);
        const panel = document.getElementById('sop-checklist-panel');
        if (panel && panel.style.display !== 'none') {
            loadSopChecklistItems(dailyId);
        }
    });
}

function renderAdHocAddButton(dailySopId) {
    return `
        <div class="sop-adhoc-add" data-daily-sop-id="${dailySopId}">
            <button type="button" class="btn btn-secondary btn-sm sop-adhoc-add-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Add Ad Hoc Task
            </button>
            <form class="sop-adhoc-form" style="display:none;">
                <input type="text" class="sop-adhoc-title-input" placeholder="Task title" required>
                <input type="text" class="sop-adhoc-desc-input" placeholder="Description (optional)">
                <div class="sop-adhoc-form-actions">
                    <button type="button" class="btn btn-secondary btn-sm sop-adhoc-cancel-btn">Cancel</button>
                    <button type="submit" class="btn btn-primary btn-sm">Add</button>
                </div>
            </form>
        </div>`;
}

function bindAdHocAddForm(container, reloadFn) {
    container.querySelectorAll('.sop-adhoc-add').forEach(wrapper => {
        const dailyId = wrapper.dataset.dailySopId;
        const addBtn = wrapper.querySelector('.sop-adhoc-add-btn');
        const form = wrapper.querySelector('.sop-adhoc-form');
        const cancelBtn = wrapper.querySelector('.sop-adhoc-cancel-btn');
        const titleInput = wrapper.querySelector('.sop-adhoc-title-input');

        addBtn.addEventListener('click', () => {
            addBtn.style.display = 'none';
            form.style.display = 'flex';
            titleInput.focus();
        });
        cancelBtn.addEventListener('click', () => {
            form.style.display = 'none';
            addBtn.style.display = '';
            form.reset();
        });
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = titleInput.value.trim();
            if (!title) return;
            const desc = wrapper.querySelector('.sop-adhoc-desc-input').value.trim() || null;
            const submitBtn = form.querySelector('[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = '...';
            try {
                const { data: existing } = await supabaseClient
                    .from('ad_hoc_tasks')
                    .select('sort_order')
                    .eq('daily_sop_id', dailyId)
                    .order('sort_order', { ascending: false })
                    .limit(1);
                const nextOrder = (existing && existing.length ? existing[0].sort_order + 1 : 0);
                await supabaseClient.from('ad_hoc_tasks').insert({
                    daily_sop_id: dailyId,
                    title,
                    description: desc,
                    sort_order: nextOrder,
                    created_by: currentUser.id
                });
                showToast('Ad hoc task added');
                reloadFn(dailyId);
            } catch (err) {
                console.error(err);
                showToast('Failed to add task', 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Add';
            }
        });
    });
}

function updateSopProgress(checked, total) {
    const bar = document.getElementById('sop-progress-fill');
    const text = document.getElementById('sop-progress-text');
    if (!bar || !text) return;
    const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
    bar.style.width = pct + '%';
    text.textContent = `${checked} of ${total} tasks complete (${pct}%)`;
    if (pct === 100) {
        bar.classList.add('complete');
    } else {
        bar.classList.remove('complete');
    }
}

document.getElementById('sop-employee-refresh')?.addEventListener('click', () => {
    loadEmployeeSopView();
});

// --- Admin SOP ---
async function loadAdminDailyChecklist() {
    const panel = document.getElementById('sop-admin-daily-panel');
    if (!panel) return;
    const daily = await getTodayDailySop();
    if (!daily) {
        panel.style.display = 'none';
        return;
    }
    panel.style.display = 'block';
    const nameEl = document.getElementById('sop-admin-daily-name');
    const dateEl = document.getElementById('sop-admin-daily-date');
    if (nameEl) nameEl.textContent = (daily.sop_templates?.name || 'Checklist') + ' — Today';
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    const container = document.getElementById('sop-admin-checklist-items');
    if (!container) return;
    const dailySopId = daily.id;

    const { data: items } = await supabaseClient
        .from('sop_items')
        .select('*')
        .eq('sop_template_id', daily.sop_template_id)
        .order('sort_order');
    const { data: adHocTasks } = await supabaseClient
        .from('ad_hoc_tasks')
        .select('*')
        .eq('daily_sop_id', dailySopId)
        .order('sort_order');
    const { data: checks } = await supabaseClient
        .from('sop_item_checks')
        .select('sop_item_id, ad_hoc_task_id, checked_by, checked_at, profiles(first_name, last_name)')
        .eq('daily_sop_id', dailySopId);

    const allEqIds = new Set();
    (items || []).forEach(item => { (item.equipment || []).forEach(id => allEqIds.add(id)); });
    let eqMap = {};
    if (allEqIds.size) {
        const { data: eqData } = await supabaseClient.from('equipment').select('*').in('id', [...allEqIds]);
        (eqData || []).forEach(eq => { eqMap[eq.id] = eq; });
    }

    const checkMap = {};
    (checks || []).forEach(c => {
        if (c.sop_item_id) checkMap[c.sop_item_id] = c;
        if (c.ad_hoc_task_id) checkMap['adhoc_' + c.ad_hoc_task_id] = c;
    });
    const names = {};
    (checks || []).forEach(c => {
        if (c.profiles) names[c.checked_by] = [c.profiles.first_name, c.profiles.last_name].filter(Boolean).join(' ') || 'Someone';
    });

    const adHocItems = (adHocTasks || []).map(t => ({ ...t, item_type: 'task', _adHoc: true }));
    const taskItems = (items || []).filter(it => (it.item_type || 'task') === 'task');
    const totalTasks = taskItems.length + adHocItems.length;
    const checkedTasks = taskItems.filter(it => !!checkMap[it.id]).length
        + adHocItems.filter(it => !!checkMap['adhoc_' + it.id]).length;

    const bar = document.getElementById('sop-admin-progress-fill');
    const text = document.getElementById('sop-admin-progress-text');
    if (bar && text) {
        const pct = totalTasks > 0 ? Math.round((checkedTasks / totalTasks) * 100) : 0;
        bar.style.width = pct + '%';
        text.textContent = `${checkedTasks} of ${totalTasks} tasks complete (${pct}%)`;
        bar.classList.toggle('complete', pct === 100);
    }

    if (totalTasks > 0 && checkedTasks === totalTasks && !daily.completed_at) {
        await supabaseClient.from('daily_sops').update({ completed_at: new Date().toISOString() }).eq('id', dailySopId);
        loadAdminDailyChecklist();
        loadSopCompletedList();
        return;
    }

    const commentMap = await loadLatestSopComments(taskItems.map(it => it.id));

    const renderOpts = { isAdmin: true, commentMap };
    const sorted = sortSopItemsUncheckedFirst(items || [], checkMap);
    const adHocSorted = sortSopItemsUncheckedFirst(adHocItems, checkMap);

    let html = renderAdHocAddButton(dailySopId);
    html += sorted.map(item => renderSopChecklistItemHtml(item, dailySopId, checkMap, names, eqMap, renderOpts)).join('');
    if (adHocItems.length) {
        html += renderSopChecklistItemHtml({ _adHocHeader: true }, dailySopId, checkMap, names, eqMap, renderOpts);
        html += adHocSorted.map(item => renderSopChecklistItemHtml(item, dailySopId, checkMap, names, eqMap, renderOpts)).join('');
    }
    container.innerHTML = html;
    bindSopCheckButtons(container, () => loadAdminDailyChecklist());
    bindAdHocAddForm(container, () => loadAdminDailyChecklist());
}

document.getElementById('sop-admin-daily-refresh')?.addEventListener('click', () => loadAdminDailyChecklist());

async function loadSopCompletedList() {
    const container = document.getElementById('sop-completed-list');
    if (!container) return;
    const { data, error } = await supabaseClient
        .from('daily_sops')
        .select('id, date, completed_at, sop_templates(name)')
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(100);
    if (error) {
        container.innerHTML = '<p class="text-muted">Failed to load completed checklists.</p>';
        return;
    }
    if (!data || data.length === 0) {
        container.innerHTML = '<p class="text-muted">No completed checklists yet.</p>';
        return;
    }
    container.innerHTML = data.map(d => {
        const dateStr = d.date ? new Date(d.date + 'Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '';
        const completedStr = d.completed_at ? new Date(d.completed_at).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }) : '';
        const name = (d.sop_templates && d.sop_templates.name) ? escapeHtml(d.sop_templates.name) : 'Checklist';
        return `<div class="sop-completed-card sop-completed-card-reviewable" data-daily-sop-id="${d.id}">
            <div class="sop-completed-info">
                <strong>${name}</strong>
                <span class="sop-completed-date">${escapeHtml(dateStr)}</span>
                <span class="sop-completed-at">Completed ${escapeHtml(completedStr)}</span>
            </div>
            <button type="button" class="btn btn-secondary btn-sm sop-review-btn" data-daily-sop-id="${d.id}">Review</button>
        </div>`;
    }).join('');
    container.querySelectorAll('.sop-review-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openSopReviewModal(btn.dataset.dailySopId);
        });
    });
}

// --- Admin SOP Review ---

async function openSopReviewModal(dailySopId) {
    const modal = document.getElementById('sop-review-modal');
    const titleEl = document.getElementById('sop-review-title');
    const metaEl = document.getElementById('sop-review-meta');
    const itemsEl = document.getElementById('sop-review-items');
    if (!modal || !itemsEl) return;

    itemsEl.innerHTML = '<p class="text-muted">Loading...</p>';
    metaEl.innerHTML = '';
    titleEl.textContent = 'Review Completed SOP';
    modal.classList.add('active');

    const { data: daily } = await supabaseClient
        .from('daily_sops')
        .select('id, date, completed_at, sop_template_id, sop_templates(name)')
        .eq('id', dailySopId)
        .single();
    if (!daily) {
        itemsEl.innerHTML = '<p class="text-muted">Failed to load SOP data.</p>';
        return;
    }

    const sopName = daily.sop_templates?.name || 'Checklist';
    const dateStr = daily.date ? new Date(daily.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '';
    const completedStr = daily.completed_at ? new Date(daily.completed_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '';
    titleEl.textContent = `Review: ${sopName}`;
    metaEl.innerHTML = `<span class="sop-review-date">${escapeHtml(dateStr)}</span><span class="sop-review-completed">Completed ${escapeHtml(completedStr)}</span>`;

    const { data: items } = await supabaseClient
        .from('sop_items')
        .select('*')
        .eq('sop_template_id', daily.sop_template_id)
        .order('sort_order');
    const { data: adHocTasks } = await supabaseClient
        .from('ad_hoc_tasks')
        .select('*')
        .eq('daily_sop_id', dailySopId)
        .order('sort_order');
    const { data: checks } = await supabaseClient
        .from('sop_item_checks')
        .select('sop_item_id, ad_hoc_task_id, checked_by, checked_at, profiles(first_name, last_name)')
        .eq('daily_sop_id', dailySopId);

    const { data: existingComments } = await supabaseClient
        .from('sop_task_comments')
        .select('*')
        .eq('daily_sop_id', dailySopId);

    const commentMap = {};
    (existingComments || []).forEach(c => {
        commentMap[c.sop_item_id] = c;
    });

    const checkMap = {};
    (checks || []).forEach(c => {
        if (c.sop_item_id) checkMap[c.sop_item_id] = c;
        if (c.ad_hoc_task_id) checkMap['adhoc_' + c.ad_hoc_task_id] = c;
    });
    const names = {};
    (checks || []).forEach(c => {
        if (c.profiles) names[c.checked_by] = [c.profiles.first_name, c.profiles.last_name].filter(Boolean).join(' ') || 'Someone';
    });

    let html = '';
    (items || []).forEach(item => {
        const isTask = (item.item_type || 'task') === 'task';
        if (!isTask) {
            html += `<div class="sop-review-section-header">${escapeHtml(item.title)}</div>`;
            return;
        }
        const c = checkMap[item.id];
        const checked = !!c;
        const who = c ? (names[c.checked_by] || 'Someone') : '';
        const when = c ? new Date(c.checked_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
        const existingComment = commentMap[item.id]?.comment || '';
        html += `
            <div class="sop-review-item" data-sop-item-id="${item.id}">
                <div class="sop-review-item-header">
                    <span class="sop-review-check ${checked ? 'done' : 'missed'}">
                        ${checked
                            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>'
                            : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>'}
                    </span>
                    <span class="sop-review-item-title">${escapeHtml(item.title)}</span>
                    ${checked ? `<span class="sop-review-item-who">by ${escapeHtml(who)} at ${escapeHtml(when)}</span>` : '<span class="sop-review-item-who missed">not completed</span>'}
                </div>
                <div class="sop-review-comment-row">
                    <textarea class="sop-review-comment" data-sop-item-id="${item.id}" placeholder="Add a comment for the team..." rows="1">${escapeHtml(existingComment)}</textarea>
                </div>
            </div>`;
    });

    if (adHocTasks && adHocTasks.length) {
        html += '<div class="sop-review-section-header">Ad Hoc Tasks</div>';
        adHocTasks.forEach(task => {
            const c = checkMap['adhoc_' + task.id];
            const checked = !!c;
            const who = c ? (names[c.checked_by] || 'Someone') : '';
            const when = c ? new Date(c.checked_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
            html += `
                <div class="sop-review-item sop-review-adhoc">
                    <div class="sop-review-item-header">
                        <span class="sop-review-check ${checked ? 'done' : 'missed'}">
                            ${checked
                                ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>'
                                : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>'}
                        </span>
                        <span class="sop-review-item-title">${escapeHtml(task.title)}</span>
                        ${checked ? `<span class="sop-review-item-who">by ${escapeHtml(who)} at ${escapeHtml(when)}</span>` : '<span class="sop-review-item-who missed">not completed</span>'}
                    </div>
                </div>`;
        });
    }

    itemsEl.innerHTML = html;

    itemsEl.querySelectorAll('.sop-review-comment').forEach(ta => {
        ta.addEventListener('input', () => {
            ta.style.height = 'auto';
            ta.style.height = ta.scrollHeight + 'px';
        });
        if (ta.value) {
            ta.style.height = 'auto';
            ta.style.height = ta.scrollHeight + 'px';
        }
    });

    const saveBtn = document.getElementById('sop-review-save');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    newSaveBtn.addEventListener('click', () => saveSopReviewComments(dailySopId, daily.sop_template_id));

    const cancelBtn = document.getElementById('sop-review-cancel');
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    newCancelBtn.addEventListener('click', () => modal.classList.remove('active'));
}

document.getElementById('close-sop-review-modal')?.addEventListener('click', () => {
    document.getElementById('sop-review-modal')?.classList.remove('active');
});

async function saveSopReviewComments(dailySopId, sopTemplateId) {
    const itemsEl = document.getElementById('sop-review-items');
    if (!itemsEl) return;

    const textareas = itemsEl.querySelectorAll('.sop-review-comment');
    const commentsToSave = [];
    textareas.forEach(ta => {
        const itemId = ta.dataset.sopItemId;
        const text = ta.value.trim();
        if (itemId && text) {
            commentsToSave.push({ sop_item_id: itemId, comment: text });
        }
    });

    const saveBtn = document.getElementById('sop-review-save');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

    try {
        await supabaseClient
            .from('sop_task_comments')
            .delete()
            .eq('daily_sop_id', dailySopId);

        if (commentsToSave.length > 0) {
            const rows = commentsToSave.map(c => ({
                sop_item_id: c.sop_item_id,
                daily_sop_id: dailySopId,
                comment: c.comment,
                created_by: currentUser.id
            }));
            const { error } = await supabaseClient.from('sop_task_comments').insert(rows);
            if (error) throw error;
        }

        showToast('Comments saved');
        document.getElementById('sop-review-modal')?.classList.remove('active');
    } catch (e) {
        console.error('saveSopReviewComments error', e);
        showToast('Failed to save comments', 'error');
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Comments'; }
    }
}

async function loadSopList() {
    loadAdminDailyChecklist();
    loadSopCompletedList();
    const container = document.getElementById('sop-list');
    if (!container) return;
    const { data, error } = await supabaseClient
        .from('sop_templates')
        .select('*')
        .order('updated_at', { ascending: false });
    if (error) {
        container.innerHTML = '<div class="empty-state"><p>Failed to load SOPs</p></div>';
        return;
    }
    if (!data || data.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No SOPs yet</p>
                <p class="text-muted">Create a checklist that staff will see when they clock in.</p>
                <button type="button" class="btn btn-primary" id="create-sop-empty-btn">Create SOP</button>
            </div>
        `;
        document.getElementById('create-sop-empty-btn')?.addEventListener('click', () => openSopEditor());
        return;
    }
    container.innerHTML = data.map(t => `
        <div class="sop-card">
            <div class="sop-card-main">
                <h4>${escapeHtml(t.name)}</h4>
                ${t.description ? `<p class="sop-card-desc">${escapeHtml(t.description)}</p>` : ''}
            </div>
            <div class="sop-card-actions">
                <button type="button" class="btn btn-secondary btn-sm" onclick="openSopEditor('${t.id}')">Edit</button>
                <button type="button" class="btn btn-danger btn-sm" onclick="deleteSop('${t.id}', '${escapeHtml(t.name).replace(/'/g, "\\'")}')">Delete</button>
            </div>
        </div>
    `).join('');
}

let sopEditorItems = [];
let sopEditorExpandedIdx = null;
let sopDragSourceIdx = null;
let sopDropIndicatorIdx = null;

function syncSopEditorItemsFromDom() {
    const list = document.getElementById('sop-items-list');
    if (!list || !list.children.length) return;
    for (let i = 0; i < list.children.length; i++) {
        const row = list.children[i];
        if (!row.classList.contains('sop-editor-row')) continue;
        const idx = row.dataset.idx;
        if (idx === undefined) continue;
        const j = parseInt(idx, 10);
        if (sopEditorItems[j] === undefined) continue;
        if (row.classList.contains('sop-section-row')) {
            const titleEl = row.querySelector('.sop-section-title');
            if (titleEl) sopEditorItems[j].title = titleEl.value;
            sopEditorItems[j].type = 'section';
        } else {
            const titleEl = row.querySelector('.sop-item-title');
            const descEl = row.querySelector('.sop-item-desc');
            if (titleEl) sopEditorItems[j].title = titleEl.value;
            if (descEl) sopEditorItems[j].description = descEl.value;
            sopEditorItems[j].type = sopEditorItems[j].type || 'task';
        }
    }
}

function openSopEditor(id) {
    document.getElementById('sop-editor-title').textContent = id ? 'Edit SOP' : 'Create SOP';
    document.getElementById('sop-editor-id').value = id || '';
    document.getElementById('sop-editor-name').value = '';
    document.getElementById('sop-editor-description').value = '';
    sopEditorItems = [];
    sopEditorExpandedIdx = null;
    const list = document.getElementById('sop-items-list');
    list.innerHTML = '';
    if (id) {
        supabaseClient.from('sop_templates').select('*').eq('id', id).single().then(({ data: t, error }) => {
            if (error) console.error('Error loading SOP template:', error);
            if (t) {
                document.getElementById('sop-editor-name').value = t.name || '';
                document.getElementById('sop-editor-description').value = t.description || '';
            }
        });
        supabaseClient.from('sop_items').select('*').eq('sop_template_id', id).order('sort_order').then(async ({ data: items, error }) => {
            if (error) {
                console.error('Error loading SOP items:', error);
                showToast('Failed to load SOP tasks', 'error');
            }
            sopEditorItems = (items || []).map(i => ({
                ...i,
                type: i.item_type || 'task',
                media: i.media || [],
                equipment: i.equipment || []
            }));
            await ensureEquipmentLoaded();
            renderSopEditorItems();
        });
    }
    document.getElementById('sop-editor-modal').classList.add('active');
}

function renderSopEditorItems(focusExpanded = false) {
    const list = document.getElementById('sop-items-list');
    const taskTpl = document.getElementById('sop-item-row-template');
    const sectionTpl = document.getElementById('sop-section-row-template');
    if (!list || !taskTpl || !sectionTpl) return;
    const dropIndicator = list.querySelector('.sop-drop-indicator');
    list.innerHTML = '';
    sopEditorItems.forEach((item, idx) => {
        const isSection = (item.type || 'task') === 'section';
        const tpl = isSection ? sectionTpl : taskTpl;
        const row = tpl.content.cloneNode(true);
        const rowEl = row.querySelector('.sop-editor-row');
        rowEl.dataset.idx = idx;
        const isExpanded = (idx === sopEditorExpandedIdx);
        if (isSection) {
            rowEl.querySelector('.sop-section-title').value = item.title || '';
        } else {
            rowEl.querySelector('.sop-item-title').value = item.title || '';
            rowEl.querySelector('.sop-item-desc').value = item.description || '';
            const mediaList = rowEl.querySelector('.sop-item-media-list');
            (item.media || []).forEach(m => {
                const span = document.createElement('span');
                span.className = 'sop-media-tag';
                span.innerHTML = (m.type === 'video' ? '🎬 ' : '🖼 ') + (m.url?.split('/').pop() || '') + ' <button type="button" class="sop-media-remove">×</button>';
                span.dataset.url = m.url;
                mediaList.appendChild(span);
            });
        }
        if (!isExpanded) {
            rowEl.classList.add('collapsed');
            const summaryTitle = rowEl.querySelector('.sop-collapsed-title');
            if (summaryTitle) {
                const title = (item.title || '').trim();
                if (title) {
                    summaryTitle.textContent = title;
                } else {
                    summaryTitle.textContent = isSection ? 'Untitled section' : 'Untitled task';
                    summaryTitle.classList.add('placeholder');
                }
            }
        }
        list.appendChild(row);
    });
    if (dropIndicator) list.appendChild(dropIndicator);
    list.querySelectorAll('.sop-item-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            syncSopEditorItemsFromDom();
            const row = btn.closest('.sop-editor-row');
            const idx = parseInt(row.dataset.idx, 10);
            if (sopEditorExpandedIdx !== null) {
                if (idx === sopEditorExpandedIdx) sopEditorExpandedIdx = null;
                else if (idx < sopEditorExpandedIdx) sopEditorExpandedIdx--;
            }
            sopEditorItems.splice(idx, 1);
            renderSopEditorItems();
        });
    });
    list.querySelectorAll('.sop-item-media-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const row = btn.closest('.sop-item-row');
            if (row) row.querySelector('.sop-item-media-input').click();
        });
    });
    list.querySelectorAll('.sop-item-media-input').forEach(input => {
        input.onchange = async (e) => {
            const files = e.target.files;
            if (!files?.length) return;
            syncSopEditorItemsFromDom();
            const row = input.closest('.sop-item-row');
            const idx = parseInt(row.dataset.idx, 10);
            for (const file of files) {
                try {
                    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                    const path = `${currentUser.id}/${Date.now()}-${safeName}`;
                    const { data, error } = await supabaseClient.storage.from(SOP_STORAGE_BUCKET).upload(path, file, { upsert: true });
                    if (error) throw error;
                    const { data: urlData } = supabaseClient.storage.from(SOP_STORAGE_BUCKET).getPublicUrl(data.path);
                    const type = (file.type || '').startsWith('video/') ? 'video' : 'image';
                    if (!sopEditorItems[idx].media) sopEditorItems[idx].media = [];
                    sopEditorItems[idx].media.push({ url: urlData.publicUrl, type });
                    renderSopEditorItems();
                } catch (err) {
                    console.error('SOP media upload error:', err);
                    showToast('Upload failed: ' + (err.message || err.statusCode || 'Check storage policies'), 'error');
                }
            }
            input.value = '';
        };
    });
    list.querySelectorAll('.sop-media-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            syncSopEditorItemsFromDom();
            const tag = btn.closest('.sop-media-tag');
            const row = btn.closest('.sop-item-row');
            const idx = parseInt(row.dataset.idx, 10);
            const url = tag.dataset.url;
            sopEditorItems[idx].media = (sopEditorItems[idx].media || []).filter(m => m.url !== url);
            renderSopEditorItems();
        });
    });
    list.querySelectorAll('.sop-item-equipment-add-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await ensureEquipmentLoaded();
            const row = btn.closest('.sop-item-row');
            const idx = parseInt(row.dataset.idx, 10);
            openEquipmentPicker(row, idx);
        });
    });
    list.querySelectorAll('.sop-item-row').forEach(rowEl => {
        const idx = parseInt(rowEl.dataset.idx, 10);
        if (!isNaN(idx)) renderEquipmentTags(rowEl, idx);
    });
    list.querySelectorAll('.sop-row-collapsed-summary').forEach(summary => {
        summary.addEventListener('click', () => {
            const row = summary.closest('.sop-editor-row');
            syncSopEditorItemsFromDom();
            sopEditorExpandedIdx = parseInt(row.dataset.idx, 10);
            renderSopEditorItems(true);
        });
    });
    if (focusExpanded && sopEditorExpandedIdx !== null) {
        const expandedRow = list.querySelector(`.sop-editor-row[data-idx="${sopEditorExpandedIdx}"]`);
        if (expandedRow) {
            const titleInput = expandedRow.querySelector('.sop-item-title, .sop-section-title');
            if (titleInput) titleInput.focus();
        }
    }
    initSopRowDragAndDrop(list);
}

function getSopDropIndicator() {
    const list = document.getElementById('sop-items-list');
    if (!list) return null;
    let indicator = list.querySelector('.sop-drop-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'sop-drop-indicator';
        indicator.setAttribute('aria-hidden', 'true');
        list.appendChild(indicator);
    }
    return indicator;
}

function positionSopDropIndicator(dropIndex) {
    const list = document.getElementById('sop-items-list');
    const indicator = getSopDropIndicator();
    if (!list || !indicator) return;
    const rows = list.querySelectorAll('.sop-editor-row');
    indicator.classList.add('sop-drop-indicator-visible');
    if (dropIndex <= 0) {
        const first = rows[0];
        if (first) list.insertBefore(indicator, first);
        else list.appendChild(indicator);
    } else if (dropIndex >= rows.length) {
        list.appendChild(indicator);
    } else {
        list.insertBefore(indicator, rows[dropIndex]);
    }
    sopDropIndicatorIdx = dropIndex;
}

function hideSopDropIndicator() {
    const indicator = document.querySelector('.sop-drop-indicator');
    if (indicator) indicator.classList.remove('sop-drop-indicator-visible');
    sopDropIndicatorIdx = null;
}

function initSopRowDragAndDrop(list) {
    const rows = list.querySelectorAll('.sop-editor-row');
    rows.forEach((rowEl) => {
        const handle = rowEl.querySelector('.sop-drag-handle');
        if (!handle) return;
        handle.addEventListener('dragstart', (e) => {
            sopDragSourceIdx = parseInt(rowEl.dataset.idx, 10);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', rowEl.dataset.idx);
            requestAnimationFrame(() => rowEl.classList.add('sop-dragging'));
        });
        rowEl.addEventListener('dragend', () => {
            rowEl.classList.remove('sop-dragging');
            hideSopDropIndicator();
            sopDragSourceIdx = null;
        });
        rowEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (sopDragSourceIdx === null) return;
            const rowIdx = parseInt(rowEl.dataset.idx, 10);
            const rect = rowEl.getBoundingClientRect();
            const mid = rect.top + rect.height / 2;
            const dropIndex = e.clientY < mid ? rowIdx : rowIdx + 1;
            positionSopDropIndicator(dropIndex);
        });
    });
    function executeDrop(e) {
        e.preventDefault();
        const fromIdx = sopDragSourceIdx;
        const toIdx = sopDropIndicatorIdx;
        hideSopDropIndicator();
        if (fromIdx === null || toIdx === null) return;
        const adjustedToIdx = fromIdx < toIdx ? toIdx - 1 : toIdx;
        if (fromIdx === adjustedToIdx) {
            sopDragSourceIdx = null;
            return;
        }
        syncSopEditorItemsFromDom();
        const moved = sopEditorItems.splice(fromIdx, 1)[0];
        sopEditorItems.splice(adjustedToIdx, 0, moved);
        if (sopEditorExpandedIdx !== null) {
            if (sopEditorExpandedIdx === fromIdx) {
                sopEditorExpandedIdx = adjustedToIdx;
            } else if (fromIdx < sopEditorExpandedIdx && adjustedToIdx >= sopEditorExpandedIdx) {
                sopEditorExpandedIdx--;
            } else if (fromIdx > sopEditorExpandedIdx && adjustedToIdx <= sopEditorExpandedIdx) {
                sopEditorExpandedIdx++;
            }
        }
        sopDragSourceIdx = null;
        renderSopEditorItems();
    }
    rows.forEach((rowEl) => rowEl.addEventListener('drop', executeDrop));
    list.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (sopDragSourceIdx === null) return;
        const editorRows = list.querySelectorAll('.sop-editor-row');
        if (!editorRows.length) return;
        const lastRow = editorRows[editorRows.length - 1];
        const lastRect = lastRow.getBoundingClientRect();
        if (e.clientY > lastRect.bottom) {
            positionSopDropIndicator(sopEditorItems.length);
        }
    });
    list.addEventListener('drop', executeDrop);
}

document.getElementById('sop-add-item-btn')?.addEventListener('click', () => {
    syncSopEditorItemsFromDom();
    sopEditorItems.unshift({ type: 'task', title: '', description: '', media: [], equipment: [] });
    sopEditorExpandedIdx = 0;
    renderSopEditorItems(true);
});
document.getElementById('sop-add-section-btn')?.addEventListener('click', () => {
    syncSopEditorItemsFromDom();
    sopEditorItems.unshift({ type: 'section', title: '' });
    sopEditorExpandedIdx = 0;
    renderSopEditorItems(true);
});

document.getElementById('sop-editor-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    syncSopEditorItemsFromDom();
    const id = document.getElementById('sop-editor-id').value;
    const name = document.getElementById('sop-editor-name').value.trim();
    const description = document.getElementById('sop-editor-description').value.trim();
    if (!name) {
        showToast('Enter an SOP name', 'error');
        return;
    }
    try {
        let templateId = id;
        if (id) {
            const { error: tplErr } = await supabaseClient.from('sop_templates').update({ name, description }).eq('id', id);
            if (tplErr) throw tplErr;
            const { error: delErr } = await supabaseClient.from('sop_items').delete().eq('sop_template_id', id);
            if (delErr) throw delErr;
        } else {
            const { data, error: insErr } = await supabaseClient.from('sop_templates').insert({ name, description }).select('id').single();
            if (insErr) throw insErr;
            templateId = data.id;
        }
        let hasItemTypeCol = true;
        let hasEquipmentCol = true;
        for (let i = 0; i < sopEditorItems.length; i++) {
            const item = sopEditorItems[i];
            if (!item.title?.trim()) continue;
            const itemType = item.type === 'section' ? 'section' : 'task';
            const row = {
                sop_template_id: templateId,
                sort_order: i,
                title: item.title.trim(),
                description: itemType === 'task' ? ((item.description || '').trim() || null) : null,
                media: itemType === 'task' ? (item.media || []) : []
            };
            if (hasItemTypeCol) row.item_type = itemType;
            if (hasEquipmentCol) row.equipment = itemType === 'task' ? (item.equipment || []) : [];
            const { error: itemErr } = await supabaseClient.from('sop_items').insert(row);
            if (itemErr) {
                if (hasItemTypeCol && itemErr.message?.includes('item_type')) {
                    hasItemTypeCol = false;
                    delete row.item_type;
                    const { error: retryErr } = await supabaseClient.from('sop_items').insert(row);
                    if (retryErr) { console.error('SOP item save error:', retryErr); throw retryErr; }
                } else if (hasEquipmentCol && itemErr.message?.includes('equipment')) {
                    hasEquipmentCol = false;
                    delete row.equipment;
                    const { error: retryErr } = await supabaseClient.from('sop_items').insert(row);
                    if (retryErr) { console.error('SOP item save error:', retryErr); throw retryErr; }
                } else {
                    console.error('SOP item save error:', itemErr);
                    throw itemErr;
                }
            }
        }
        document.getElementById('sop-editor-modal').classList.remove('active');
        showToast('SOP saved');
        if (userProfile?.role === 'admin') loadSopList();
    } catch (err) {
        console.error('SOP save failed:', err);
        showToast(err.message || 'Failed to save SOP', 'error');
    }
});

function closeSopEditorModal() {
    document.getElementById('sop-editor-modal').classList.remove('active');
}

async function deleteSop(id, name) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
        await supabaseClient.from('sop_templates').delete().eq('id', id);
        showToast('SOP deleted');
        loadSopList();
    } catch (e) {
        showToast('Failed to delete SOP', 'error');
    }
}

document.getElementById('close-select-sop-modal')?.addEventListener('click', () => {
    document.getElementById('select-sop-modal').classList.remove('active');
});
document.getElementById('select-sop-skip')?.addEventListener('click', () => {
    document.getElementById('select-sop-modal').classList.remove('active');
});
document.getElementById('close-sop-editor-modal')?.addEventListener('click', closeSopEditorModal);
document.getElementById('sop-editor-cancel')?.addEventListener('click', closeSopEditorModal);
document.getElementById('create-sop-btn')?.addEventListener('click', () => openSopEditor());
document.getElementById('sop-checklist-refresh')?.addEventListener('click', () => {
    const first = document.querySelector('.sop-checklist-item');
    if (first) loadSopChecklistItems(first.dataset.dailySopId);
});

// Expose for inline handlers
window.openSopEditor = openSopEditor;
window.deleteSop = deleteSop;

// Init task list event listeners (runs at module load like SOP listeners above)
initTaskListEventListeners();

// ==================== EQUIPMENT ====================

const EQUIPMENT_STORAGE_BUCKET = 'sop-media';
let allEquipment = [];
let equipmentEditorImageUrl = null;

async function loadEquipmentList() {
    const container = document.getElementById('equipment-list');
    if (!container) return;
    const { data, error } = await supabaseClient
        .from('equipment')
        .select('*')
        .order('name');
    if (error) {
        container.innerHTML = '<div class="empty-state"><p>Failed to load equipment</p></div>';
        return;
    }
    allEquipment = data || [];
    if (!allEquipment.length) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No equipment yet</p>
                <p class="text-muted">Add equipment items that can be attached to SOP tasks.</p>
                <button type="button" class="btn btn-primary" id="add-equipment-empty-btn">Add Equipment</button>
            </div>
        `;
        document.getElementById('add-equipment-empty-btn')?.addEventListener('click', () => openEquipmentEditor());
        return;
    }
    container.innerHTML = allEquipment.map(eq => `
        <div class="equipment-card" data-eq-id="${eq.id}">
            ${eq.image_url
                ? `<img class="equipment-card-img" src="${escapeHtml(eq.image_url)}" alt="">`
                : `<div class="equipment-card-placeholder">&#9881;</div>`
            }
            <div class="equipment-card-info">
                <h4>${escapeHtml(eq.name)}</h4>
                ${eq.location ? `<div class="equipment-card-location">${escapeHtml(eq.location)}</div>` : ''}
                <div class="equipment-card-actions">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="openEquipmentEditor('${eq.id}')">Edit</button>
                    <button type="button" class="btn btn-danger btn-sm" onclick="deleteEquipment('${eq.id}', '${escapeHtml(eq.name).replace(/'/g, "\\'")}')">Delete</button>
                </div>
            </div>
        </div>
    `).join('');
}

function openEquipmentEditor(id) {
    const modal = document.getElementById('equipment-editor-modal');
    document.getElementById('equipment-editor-title').textContent = id ? 'Edit Equipment' : 'Add Equipment';
    document.getElementById('equipment-editor-id').value = id || '';
    document.getElementById('equipment-editor-name').value = '';
    document.getElementById('equipment-editor-location').value = '';
    document.getElementById('equipment-image-preview').innerHTML = '';
    equipmentEditorImageUrl = null;
    if (id) {
        const eq = allEquipment.find(e => e.id === id);
        if (eq) {
            document.getElementById('equipment-editor-name').value = eq.name || '';
            document.getElementById('equipment-editor-location').value = eq.location || '';
            if (eq.image_url) {
                equipmentEditorImageUrl = eq.image_url;
                document.getElementById('equipment-image-preview').innerHTML =
                    `<img src="${escapeHtml(eq.image_url)}" alt=""> <button type="button" class="btn btn-secondary btn-sm" id="equipment-image-remove-btn">Remove</button>`;
                document.getElementById('equipment-image-remove-btn')?.addEventListener('click', () => {
                    equipmentEditorImageUrl = null;
                    document.getElementById('equipment-image-preview').innerHTML = '';
                });
            }
        }
    }
    modal.classList.add('active');
}

function closeEquipmentEditorModal() {
    document.getElementById('equipment-editor-modal').classList.remove('active');
}

document.getElementById('close-equipment-editor-modal')?.addEventListener('click', closeEquipmentEditorModal);
document.getElementById('equipment-editor-cancel')?.addEventListener('click', closeEquipmentEditorModal);
document.getElementById('add-equipment-btn')?.addEventListener('click', () => openEquipmentEditor());

document.getElementById('equipment-image-btn')?.addEventListener('click', () => {
    document.getElementById('equipment-image-input').click();
});

document.getElementById('equipment-image-input')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${currentUser.id}/equipment/${Date.now()}-${safeName}`;
        const { data, error } = await supabaseClient.storage.from(EQUIPMENT_STORAGE_BUCKET).upload(path, file, { upsert: true });
        if (error) throw error;
        const { data: urlData } = supabaseClient.storage.from(EQUIPMENT_STORAGE_BUCKET).getPublicUrl(data.path);
        equipmentEditorImageUrl = urlData.publicUrl;
        document.getElementById('equipment-image-preview').innerHTML =
            `<img src="${escapeHtml(equipmentEditorImageUrl)}" alt=""> <button type="button" class="btn btn-secondary btn-sm" id="equipment-image-remove-btn">Remove</button>`;
        document.getElementById('equipment-image-remove-btn')?.addEventListener('click', () => {
            equipmentEditorImageUrl = null;
            document.getElementById('equipment-image-preview').innerHTML = '';
        });
    } catch (err) {
        showToast('Image upload failed: ' + (err.message || 'Check storage policies'), 'error');
    }
    e.target.value = '';
});

document.getElementById('equipment-editor-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('equipment-editor-id').value;
    const name = document.getElementById('equipment-editor-name').value.trim();
    const location = document.getElementById('equipment-editor-location').value.trim();
    if (!name) { showToast('Enter equipment name', 'error'); return; }
    const row = { name, location: location || null, image_url: equipmentEditorImageUrl || null };
    try {
        if (id) {
            const { error } = await supabaseClient.from('equipment').update(row).eq('id', id);
            if (error) throw error;
        } else {
            row.created_by = currentUser.id;
            const { error } = await supabaseClient.from('equipment').insert(row);
            if (error) throw error;
        }
        closeEquipmentEditorModal();
        showToast('Equipment saved');
        loadEquipmentList();
    } catch (err) {
        showToast(err.message || 'Failed to save equipment', 'error');
    }
});

async function deleteEquipment(id, name) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
        await supabaseClient.from('equipment').delete().eq('id', id);
        showToast('Equipment deleted');
        loadEquipmentList();
    } catch (e) {
        showToast('Failed to delete equipment', 'error');
    }
}

window.openEquipmentEditor = openEquipmentEditor;
window.deleteEquipment = deleteEquipment;

// --- Equipment picker inside SOP editor ---

async function ensureEquipmentLoaded() {
    if (allEquipment.length) return;
    const { data } = await supabaseClient.from('equipment').select('*').order('name');
    allEquipment = data || [];
}

function renderEquipmentTags(rowEl, idx) {
    const list = rowEl.querySelector('.sop-item-equipment-list');
    if (!list) return;
    const eqIds = sopEditorItems[idx].equipment || [];
    list.innerHTML = '';
    eqIds.forEach(eqId => {
        const eq = allEquipment.find(e => e.id === eqId);
        if (!eq) return;
        const tag = document.createElement('span');
        tag.className = 'equipment-tag';
        tag.innerHTML = (eq.image_url ? `<img src="${escapeHtml(eq.image_url)}" alt="">` : '') +
            `<span>${escapeHtml(eq.name)}</span>` +
            `<button type="button" class="equipment-tag-remove" data-eq-id="${eq.id}">&times;</button>`;
        list.appendChild(tag);
    });
    list.querySelectorAll('.equipment-tag-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            syncSopEditorItemsFromDom();
            const eqId = btn.dataset.eqId;
            sopEditorItems[idx].equipment = (sopEditorItems[idx].equipment || []).filter(id => id !== eqId);
            renderSopEditorItems();
        });
    });
}

function openEquipmentPicker(rowEl, idx) {
    const dropdown = rowEl.querySelector('.equipment-picker-dropdown');
    if (!dropdown) return;
    const isOpen = dropdown.style.display !== 'none';
    if (isOpen) { dropdown.style.display = 'none'; return; }
    const current = sopEditorItems[idx].equipment || [];
    if (current.length >= 5) {
        showToast('Maximum 5 equipment per task', 'error');
        return;
    }
    dropdown.style.display = 'block';
    const searchInput = dropdown.querySelector('.equipment-picker-search');
    const resultsDiv = dropdown.querySelector('.equipment-picker-results');
    searchInput.value = '';
    searchInput.focus();

    function render(filter) {
        const term = (filter || '').toLowerCase();
        const available = allEquipment.filter(eq =>
            !current.includes(eq.id) &&
            (!term || eq.name.toLowerCase().includes(term) || (eq.location || '').toLowerCase().includes(term))
        );
        if (!available.length) {
            resultsDiv.innerHTML = '<div class="equipment-picker-empty">No equipment found</div>';
            return;
        }
        resultsDiv.innerHTML = available.map(eq => `
            <div class="equipment-picker-item" data-eq-id="${eq.id}">
                ${eq.image_url
                    ? `<img src="${escapeHtml(eq.image_url)}" alt="">`
                    : `<div class="equipment-picker-item-placeholder">&#9881;</div>`
                }
                <div class="equipment-picker-item-info">
                    <div class="equipment-picker-item-name">${escapeHtml(eq.name)}</div>
                    ${eq.location ? `<div class="equipment-picker-item-location">${escapeHtml(eq.location)}</div>` : ''}
                </div>
            </div>
        `).join('');
        resultsDiv.querySelectorAll('.equipment-picker-item').forEach(item => {
            item.addEventListener('click', () => {
                syncSopEditorItemsFromDom();
                const eqId = item.dataset.eqId;
                if (!sopEditorItems[idx].equipment) sopEditorItems[idx].equipment = [];
                if (sopEditorItems[idx].equipment.length >= 5) {
                    showToast('Maximum 5 equipment per task', 'error');
                    return;
                }
                sopEditorItems[idx].equipment.push(eqId);
                dropdown.style.display = 'none';
                renderSopEditorItems();
            });
        });
    }
    render('');
    searchInput.oninput = () => render(searchInput.value);
}

// Close equipment picker when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.sop-item-equipment')) {
        document.querySelectorAll('.equipment-picker-dropdown').forEach(dd => dd.style.display = 'none');
    }
});

// ==================== CUSTOM TIME PICKER ====================

let timePickerState = {
    hour: 12,
    minute: 0,
    period: 'PM',
    targetInput: null,
    targetDisplay: null
};

function initTimePicker() {
    const popup = document.getElementById('time-picker-popup');
    const backdrop = document.getElementById('time-picker-backdrop');
    
    if (!popup || !backdrop) return;
    
    // Use event delegation for time picker triggers
    document.addEventListener('click', (e) => {
        const target = e.target;
        
        // Check if clicked on start time wrapper or its children (Add Shift modal)
        const startWrapper = target.closest('#start-time-wrapper');
        if (startWrapper) {
            e.preventDefault();
            openTimePicker('shift-start', 'shift-start-display');
            return;
        }
        
        // Check if clicked on end time wrapper or its children (Add Shift modal)
        const endWrapper = target.closest('#end-time-wrapper');
        if (endWrapper) {
            e.preventDefault();
            openTimePicker('shift-end', 'shift-end-display');
            return;
        }
        
        // Check if clicked on edit start time wrapper (Edit Timesheet modal)
        const editStartWrapper = target.closest('#edit-start-time-wrapper');
        if (editStartWrapper) {
            e.preventDefault();
            openTimePicker('edit-timesheet-start', 'edit-timesheet-start-display');
            return;
        }
        
        // Check if clicked on edit end time wrapper (Edit Timesheet modal)
        const editEndWrapper = target.closest('#edit-end-time-wrapper');
        if (editEndWrapper) {
            e.preventDefault();
            openTimePicker('edit-timesheet-end', 'edit-timesheet-end-display');
            return;
        }
    });
    
    // Close on backdrop click
    backdrop.addEventListener('click', closeTimePicker);
    
    // Use event delegation for all time picker controls
    popup.addEventListener('click', (e) => {
        const target = e.target;
        
        // Close button
        if (target.closest('#time-picker-close')) {
            closeTimePicker();
            return;
        }
        
        // Arrow buttons
        const arrowBtn = target.closest('.time-picker-arrow');
        if (arrowBtn) {
            e.preventDefault();
            handleTimePickerArrow(arrowBtn.dataset.action);
            return;
        }
        
        // AM/PM buttons
        if (target.closest('#time-picker-am')) {
            timePickerState.period = 'AM';
            updateTimePickerUI();
            return;
        }
        
        if (target.closest('#time-picker-pm')) {
            timePickerState.period = 'PM';
            updateTimePickerUI();
            return;
        }
        
        // Quick select buttons
        const quickBtn = target.closest('.time-picker-quick-btn');
        if (quickBtn) {
            const time = quickBtn.dataset.time;
            if (time === 'now') {
                const now = new Date();
                let hours = now.getHours();
                timePickerState.period = hours >= 12 ? 'PM' : 'AM';
                timePickerState.hour = hours % 12 || 12;
                timePickerState.minute = Math.round(now.getMinutes() / 5) * 5;
                if (timePickerState.minute === 60) {
                    timePickerState.minute = 0;
                    timePickerState.hour = (timePickerState.hour % 12) + 1;
                }
            } else {
                const [hours, minutes] = time.split(':').map(Number);
                timePickerState.period = hours >= 12 ? 'PM' : 'AM';
                timePickerState.hour = hours % 12 || 12;
                timePickerState.minute = minutes;
            }
            updateTimePickerUI();
            return;
        }
        
        // Confirm button
        if (target.closest('#time-picker-confirm')) {
            confirmTimePicker();
            return;
        }
    });
}

function openTimePicker(inputId, displayId) {
    const popup = document.getElementById('time-picker-popup');
    const backdrop = document.getElementById('time-picker-backdrop');
    const hiddenInput = document.getElementById(inputId);
    
    timePickerState.targetInput = inputId;
    timePickerState.targetDisplay = displayId;
    
    // Parse existing value if present
    if (hiddenInput?.value) {
        const [hours, minutes] = hiddenInput.value.split(':').map(Number);
        timePickerState.period = hours >= 12 ? 'PM' : 'AM';
        timePickerState.hour = hours % 12 || 12;
        timePickerState.minute = minutes;
    } else {
        // Default to current time rounded to nearest 5 minutes
        const now = new Date();
        let hours = now.getHours();
        timePickerState.period = hours >= 12 ? 'PM' : 'AM';
        timePickerState.hour = hours % 12 || 12;
        timePickerState.minute = Math.round(now.getMinutes() / 5) * 5;
        if (timePickerState.minute === 60) {
            timePickerState.minute = 0;
        }
    }
    
    updateTimePickerUI();
    popup.classList.add('active');
    backdrop.classList.add('active');
}

function closeTimePicker() {
    document.getElementById('time-picker-popup')?.classList.remove('active');
    document.getElementById('time-picker-backdrop')?.classList.remove('active');
}

function handleTimePickerArrow(action) {
    switch (action) {
        case 'hour-up':
            timePickerState.hour = timePickerState.hour === 12 ? 1 : timePickerState.hour + 1;
            break;
        case 'hour-down':
            timePickerState.hour = timePickerState.hour === 1 ? 12 : timePickerState.hour - 1;
            break;
        case 'minute-up':
            timePickerState.minute = (timePickerState.minute + 5) % 60;
            break;
        case 'minute-down':
            timePickerState.minute = timePickerState.minute === 0 ? 55 : timePickerState.minute - 5;
            break;
    }
    updateTimePickerUI();
}

function updateTimePickerUI() {
    const hourEl = document.getElementById('time-picker-hour');
    const minuteEl = document.getElementById('time-picker-minute');
    const previewEl = document.getElementById('time-picker-preview');
    const amBtn = document.getElementById('time-picker-am');
    const pmBtn = document.getElementById('time-picker-pm');
    
    if (hourEl) hourEl.textContent = timePickerState.hour;
    if (minuteEl) minuteEl.textContent = String(timePickerState.minute).padStart(2, '0');
    if (previewEl) previewEl.textContent = `${timePickerState.hour}:${String(timePickerState.minute).padStart(2, '0')} ${timePickerState.period}`;
    
    amBtn?.classList.toggle('active', timePickerState.period === 'AM');
    pmBtn?.classList.toggle('active', timePickerState.period === 'PM');
}

function confirmTimePicker() {
    // Convert to 24-hour format for the hidden input
    let hours24 = timePickerState.hour;
    if (timePickerState.period === 'PM' && timePickerState.hour !== 12) {
        hours24 = timePickerState.hour + 12;
    } else if (timePickerState.period === 'AM' && timePickerState.hour === 12) {
        hours24 = 0;
    }
    
    const timeValue = `${String(hours24).padStart(2, '0')}:${String(timePickerState.minute).padStart(2, '0')}`;
    const displayValue = `${timePickerState.hour}:${String(timePickerState.minute).padStart(2, '0')} ${timePickerState.period}`;
    
    // Set values
    const hiddenInput = document.getElementById(timePickerState.targetInput);
    const displayInput = document.getElementById(timePickerState.targetDisplay);
    
    if (hiddenInput) hiddenInput.value = timeValue;
    if (displayInput) displayInput.value = displayValue;
    
    closeTimePicker();
}

// ==================== CUSTOM CALENDAR PICKER ====================

let calendarPickerState = {
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
    selectedDate: null,
    targetInput: null,
    targetDisplay: null,
    employeeId: null, // For filtering shifts when admin selects employee
    context: null, // 'invoice', 'employee-shifts', or 'admin-timesheets'
    shiftsCache: {} // Cache shifts by month key
};

function initCalendarPicker() {
    const popup = document.getElementById('calendar-picker-popup');
    const backdrop = document.getElementById('calendar-picker-backdrop');
    
    if (!popup || !backdrop) return;
    
    // Use event delegation for calendar input triggers
    document.addEventListener('click', (e) => {
        const target = e.target;
        
        // Check for calendar input wrappers
        const wrappers = [
            { id: 'period-start-wrapper', input: 'invoice-period-start', display: 'invoice-period-start-display', context: 'invoice' },
            { id: 'period-end-wrapper', input: 'invoice-period-end', display: 'invoice-period-end-display', context: 'invoice' },
            { id: 'shifts-start-wrapper', input: 'shifts-start-date', display: 'shifts-start-date-display', context: 'employee-shifts' },
            { id: 'shifts-end-wrapper', input: 'shifts-end-date', display: 'shifts-end-date-display', context: 'employee-shifts' },
            { id: 'admin-start-wrapper', input: 'admin-start-date', display: 'admin-start-date-display', context: 'admin-timesheets' },
            { id: 'admin-end-wrapper', input: 'admin-end-date', display: 'admin-end-date-display', context: 'admin-timesheets' }
        ];
        
        for (const wrapper of wrappers) {
            if (target.closest(`#${wrapper.id}`)) {
                e.preventDefault();
                calendarPickerState.context = wrapper.context;
                
                // Set employee ID based on context
                if (wrapper.context === 'invoice') {
                    // For invoice: only show shifts for the selected employee
                    const employeeSelect = document.getElementById('invoice-employee');
                    calendarPickerState.employeeId = employeeSelect?.value || null;
                } else if (wrapper.context === 'admin-timesheets') {
                    // For admin timesheets: show shifts for filtered employee (or none if "All")
                    const employeeFilter = document.getElementById('employee-filter');
                    calendarPickerState.employeeId = employeeFilter?.value || null;
                } else {
                    // For employee shifts view: show current user's shifts
                    calendarPickerState.employeeId = currentUser?.id || null;
                }
                openCalendarPicker(wrapper.input, wrapper.display);
                return;
            }
        }
    });
    
    // Close on backdrop click
    backdrop.addEventListener('click', closeCalendarPicker);
    
    // Navigation buttons
    document.getElementById('calendar-prev-month')?.addEventListener('click', () => {
        calendarPickerState.currentMonth--;
        if (calendarPickerState.currentMonth < 0) {
            calendarPickerState.currentMonth = 11;
            calendarPickerState.currentYear--;
        }
        renderCalendar();
    });
    
    document.getElementById('calendar-next-month')?.addEventListener('click', () => {
        calendarPickerState.currentMonth++;
        if (calendarPickerState.currentMonth > 11) {
            calendarPickerState.currentMonth = 0;
            calendarPickerState.currentYear++;
        }
        renderCalendar();
    });
    
    // Clear and Today buttons
    document.getElementById('calendar-clear')?.addEventListener('click', () => {
        const hiddenInput = document.getElementById(calendarPickerState.targetInput);
        const displayInput = document.getElementById(calendarPickerState.targetDisplay);
        if (hiddenInput) hiddenInput.value = '';
        if (displayInput) displayInput.value = '';
        closeCalendarPicker();
    });
    
    document.getElementById('calendar-today')?.addEventListener('click', () => {
        const today = new Date();
        selectCalendarDate(today);
    });
    
    // Day click handler using event delegation
    document.getElementById('calendar-days')?.addEventListener('click', (e) => {
        const dayEl = e.target.closest('.calendar-day');
        if (dayEl && !dayEl.classList.contains('disabled')) {
            const dateStr = dayEl.dataset.date;
            if (dateStr) {
                const date = new Date(dateStr + 'T00:00:00');
                selectCalendarDate(date);
            }
        }
    });
}

async function openCalendarPicker(inputId, displayId) {
    const popup = document.getElementById('calendar-picker-popup');
    const backdrop = document.getElementById('calendar-picker-backdrop');
    const hiddenInput = document.getElementById(inputId);
    
    calendarPickerState.targetInput = inputId;
    calendarPickerState.targetDisplay = displayId;
    
    // Parse existing value if present (for showing selected state)
    if (hiddenInput?.value) {
        const date = new Date(hiddenInput.value + 'T00:00:00');
        calendarPickerState.selectedDate = date;
    } else {
        calendarPickerState.selectedDate = null;
    }
    
    // Always start at today's month so user can navigate back
    const now = new Date();
    calendarPickerState.currentMonth = now.getMonth();
    calendarPickerState.currentYear = now.getFullYear();
    
    popup.classList.add('active');
    backdrop.classList.add('active');
    
    await renderCalendar();
}

function closeCalendarPicker() {
    document.getElementById('calendar-picker-popup')?.classList.remove('active');
    document.getElementById('calendar-picker-backdrop')?.classList.remove('active');
}

function selectCalendarDate(date) {
    const dateStr = formatDateForInput(date);
    const displayStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    const hiddenInput = document.getElementById(calendarPickerState.targetInput);
    const displayInput = document.getElementById(calendarPickerState.targetDisplay);
    
    if (hiddenInput) hiddenInput.value = dateStr;
    if (displayInput) displayInput.value = displayStr;
    
    closeCalendarPicker();
}

async function renderCalendar() {
    const titleEl = document.getElementById('calendar-month-title');
    const daysContainer = document.getElementById('calendar-days');
    
    if (!titleEl || !daysContainer) return;
    
    const { currentMonth, currentYear, selectedDate } = calendarPickerState;
    
    // Update title
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    titleEl.textContent = `${monthNames[currentMonth]} ${currentYear}`;
    
    // Fetch shifts for this month
    const shifts = await fetchShiftsForMonth(currentYear, currentMonth);
    
    // Group shifts by date
    const shiftsByDate = {};
    shifts.forEach(shift => {
        const date = new Date(shift.clock_in).toISOString().split('T')[0];
        if (!shiftsByDate[date]) {
            shiftsByDate[date] = { pending: 0, paid: 0 };
        }
        if (shift.paid) {
            shiftsByDate[date].paid++;
        } else {
            shiftsByDate[date].pending++;
        }
    });
    
    // Get first day of month and total days
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const totalDays = lastDay.getDate();
    
    // Get previous month's last days
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    
    // Today for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let html = '';
    
    // Previous month days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
        const day = prevMonthLastDay - i;
        const date = new Date(currentYear, currentMonth - 1, day);
        const dateStr = formatDateForInput(date);
        html += `<button type="button" class="calendar-day other-month" data-date="${dateStr}">${day}</button>`;
    }
    
    // Current month days
    for (let day = 1; day <= totalDays; day++) {
        const date = new Date(currentYear, currentMonth, day);
        const dateStr = formatDateForInput(date);
        
        const isToday = date.getTime() === today.getTime();
        const isSelected = selectedDate && date.getTime() === selectedDate.getTime();
        
        let classes = 'calendar-day';
        if (isToday) classes += ' today';
        if (isSelected) classes += ' selected';
        
        // Check for shifts on this day
        const dayShifts = shiftsByDate[dateStr];
        let indicators = '';
        if (dayShifts) {
            indicators = '<span class="calendar-day-indicators">';
            if (dayShifts.pending > 0) {
                indicators += '<span class="shift-dot pending"></span>';
            }
            if (dayShifts.paid > 0) {
                indicators += '<span class="shift-dot paid"></span>';
            }
            indicators += '</span>';
        }
        
        html += `<button type="button" class="${classes}" data-date="${dateStr}">${day}${indicators}</button>`;
    }
    
    // Next month days to fill the grid
    const totalCells = startDayOfWeek + totalDays;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for (let day = 1; day <= remainingCells; day++) {
        const date = new Date(currentYear, currentMonth + 1, day);
        const dateStr = formatDateForInput(date);
        html += `<button type="button" class="calendar-day other-month" data-date="${dateStr}">${day}</button>`;
    }
    
    daysContainer.innerHTML = html;
}

async function fetchShiftsForMonth(year, month) {
    if (!supabaseClient) return [];
    
    const { context, employeeId } = calendarPickerState;
    
    // For invoice context: require an employee to be selected, otherwise show no dots
    if (context === 'invoice' && !employeeId) {
        return [];
    }
    
    // For admin timesheets with "All Employees": don't show dots (too cluttered)
    if (context === 'admin-timesheets' && !employeeId) {
        return [];
    }
    
    const cacheKey = `${year}-${month}-${employeeId || 'self'}-${context}`;
    
    // Check cache
    if (calendarPickerState.shiftsCache[cacheKey]) {
        return calendarPickerState.shiftsCache[cacheKey];
    }
    
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);
    
    try {
        let query = supabaseClient
            .from('time_entries')
            .select('id, clock_in, clock_out, paid')
            .gte('clock_in', startDate.toISOString())
            .lte('clock_in', endDate.toISOString());
        
        // Filter by employee
        if (employeeId) {
            query = query.eq('user_id', employeeId);
        } else {
            // Default to current user's shifts
            query = query.eq('user_id', currentUser?.id);
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.error('Error fetching shifts for calendar:', error);
            return [];
        }
        
        // Cache the results
        calendarPickerState.shiftsCache[cacheKey] = data || [];
        return data || [];
    } catch (err) {
        console.error('Error fetching shifts:', err);
        return [];
    }
}

// Clear cache when shifts are modified
function clearShiftsCache() {
    calendarPickerState.shiftsCache = {};
}

// ==================== TOGGLE SHIFT PAID STATUS ====================

async function toggleShiftPaid(shiftId, currentStatus) {
    if (!supabaseClient) return;
    
    const newStatus = !currentStatus;
    
    try {
        const { error } = await supabaseClient
            .from('time_entries')
            .update({ paid: newStatus })
            .eq('id', shiftId);
        
        if (error) throw error;
        
        // Clear cache and reload
        clearShiftsCache();
        
        // Reload appropriate view
        if (userProfile?.role === 'admin') {
            await loadAllTimesheets();
        } else {
            await loadShifts();
        }
        
        showToast(newStatus ? 'Shift marked as paid' : 'Shift marked as pending');
    } catch (error) {
        console.error('Toggle paid status error:', error);
        showToast('Failed to update shift status', 'error');
    }
}

// ==================== TASK LISTS ====================

const TASK_LIST_STORAGE_BUCKET = 'sop-media';
let tlEditorItems = [];
let tlEditorMode = 'manual';
let tlVideoFile = null;
let tlVideoUrl = null;

let _ffmpeg = null;
let _ffmpegUtil = null;

function buildFFmpegWorkerBlobURL() {
    const workerScript = `
const CORE_URL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js";
const FFMessageType = {
    LOAD:"LOAD",EXEC:"EXEC",WRITE_FILE:"WRITE_FILE",READ_FILE:"READ_FILE",
    DELETE_FILE:"DELETE_FILE",RENAME:"RENAME",CREATE_DIR:"CREATE_DIR",
    LIST_DIR:"LIST_DIR",DELETE_DIR:"DELETE_DIR",ERROR:"ERROR",
    DOWNLOAD:"DOWNLOAD",PROGRESS:"PROGRESS",LOG:"LOG",MOUNT:"MOUNT",UNMOUNT:"UNMOUNT"
};
const ERROR_UNKNOWN_MESSAGE_TYPE = new Error("unknown message type");
const ERROR_NOT_LOADED = new Error("ffmpeg is not loaded, call ffmpeg.load() first");
const ERROR_IMPORT_FAILURE = new Error("failed to import ffmpeg-core.js");

let ffmpeg;
const load = async ({ coreURL: _coreURL, wasmURL: _wasmURL, workerURL: _workerURL }) => {
    const first = !ffmpeg;
    try {
        if (!_coreURL) _coreURL = CORE_URL;
        importScripts(_coreURL);
    } catch {
        if (!_coreURL) _coreURL = CORE_URL.replace('/umd/', '/esm/');
        const _mod = await import(_coreURL);
        if (_mod.default) self.createFFmpegCore = _mod.default;
        if (!self.createFFmpegCore) throw ERROR_IMPORT_FAILURE;
    }
    const coreURL = _coreURL;
    const wasmURL = _wasmURL ? _wasmURL : _coreURL.replace(/.js$/g, ".wasm");
    const workerURL = _workerURL ? _workerURL : _coreURL.replace(/.js$/g, ".worker.js");
    ffmpeg = await self.createFFmpegCore({
        mainScriptUrlOrBlob: coreURL + "#" + btoa(JSON.stringify({ wasmURL, workerURL })),
    });
    ffmpeg.setLogger((data) => self.postMessage({ type: FFMessageType.LOG, data }));
    ffmpeg.setProgress((data) => self.postMessage({ type: FFMessageType.PROGRESS, data }));
    return first;
};
const exec = ({ args, timeout = -1 }) => { ffmpeg.setTimeout(timeout); ffmpeg.exec(...args); const ret = ffmpeg.ret; ffmpeg.reset(); return ret; };
const writeFile = ({ path, data }) => { ffmpeg.FS.writeFile(path, data); return true; };
const readFile = ({ path, encoding }) => ffmpeg.FS.readFile(path, { encoding });
const deleteFile = ({ path }) => { ffmpeg.FS.unlink(path); return true; };
const rename = ({ oldPath, newPath }) => { ffmpeg.FS.rename(oldPath, newPath); return true; };
const createDir = ({ path }) => { ffmpeg.FS.mkdir(path); return true; };
const listDir = ({ path }) => {
    const names = ffmpeg.FS.readdir(path);
    const nodes = [];
    for (const name of names) { const stat = ffmpeg.FS.stat(path+"/"+name); nodes.push({ name, isDir: ffmpeg.FS.isDir(stat.mode) }); }
    return nodes;
};
const deleteDir = ({ path }) => { ffmpeg.FS.rmdir(path); return true; };
const mount = ({ fsType, options, mountPoint }) => { const fs = ffmpeg.FS.filesystems[fsType]; if (!fs) return false; ffmpeg.FS.mount(fs, options, mountPoint); return true; };
const unmount = ({ mountPoint }) => { ffmpeg.FS.unmount(mountPoint); return true; };

self.onmessage = async ({ data: { id, type, data: _data } }) => {
    const trans = [];
    let data;
    try {
        if (type !== FFMessageType.LOAD && !ffmpeg) throw ERROR_NOT_LOADED;
        switch (type) {
            case FFMessageType.LOAD: data = await load(_data); break;
            case FFMessageType.EXEC: data = exec(_data); break;
            case FFMessageType.WRITE_FILE: data = writeFile(_data); break;
            case FFMessageType.READ_FILE: data = readFile(_data); break;
            case FFMessageType.DELETE_FILE: data = deleteFile(_data); break;
            case FFMessageType.RENAME: data = rename(_data); break;
            case FFMessageType.CREATE_DIR: data = createDir(_data); break;
            case FFMessageType.LIST_DIR: data = listDir(_data); break;
            case FFMessageType.DELETE_DIR: data = deleteDir(_data); break;
            case FFMessageType.MOUNT: data = mount(_data); break;
            case FFMessageType.UNMOUNT: data = unmount(_data); break;
            default: throw ERROR_UNKNOWN_MESSAGE_TYPE;
        }
    } catch (e) { self.postMessage({ id, type: FFMessageType.ERROR, data: e.toString() }); return; }
    if (data instanceof Uint8Array) trans.push(data.buffer);
    self.postMessage({ id, type, data }, trans);
};`;
    const blob = new Blob([workerScript], { type: 'text/javascript' });
    return URL.createObjectURL(blob);
}

async function loadFFmpegInstance() {
    if (_ffmpeg) return _ffmpeg;

    const { FFmpeg } = await import('https://esm.sh/@ffmpeg/ffmpeg@0.12.10');
    _ffmpegUtil = await import('https://esm.sh/@ffmpeg/util@0.12.1');

    const ffmpeg = new FFmpeg();
    const esmBase = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';

    await ffmpeg.load({
        coreURL: `${esmBase}/ffmpeg-core.js`,
        wasmURL: `${esmBase}/ffmpeg-core.wasm`,
        classWorkerURL: buildFFmpegWorkerBlobURL(),
    });

    _ffmpeg = ffmpeg;
    return ffmpeg;
}
let tlTranscript = null;
let tlCurrentFilter = 'all';

// ---- Admin: Load & List ----

async function loadTaskLists() {
    const container = document.getElementById('tl-cards');
    const emptyState = document.getElementById('tl-empty-state');
    if (!container) return;

    let query = supabaseClient
        .from('task_lists')
        .select('*, task_list_items(id), task_list_assignments(id, status)')
        .order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) {
        container.innerHTML = '<p class="text-muted">Failed to load task lists.</p>';
        return;
    }

    let filtered = data || [];
    if (tlCurrentFilter === 'sop') filtered = filtered.filter(t => t.is_sop);
    else if (tlCurrentFilter === 'task') filtered = filtered.filter(t => !t.is_sop);

    if (filtered.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = '';
        return;
    }
    emptyState.style.display = 'none';

    container.innerHTML = filtered.map(t => {
        const itemCount = (t.task_list_items || []).length;
        const assignments = t.task_list_assignments || [];
        const completedCount = assignments.filter(a => a.status === 'completed').length;
        return `
        <div class="tl-card" data-id="${t.id}">
            <div class="tl-card-header">
                <h4>${escapeHtml(t.title)} <span class="tl-badge ${t.is_sop ? 'sop' : 'task'}">${t.is_sop ? 'SOP' : 'Task'}</span></h4>
            </div>
            ${t.description ? `<div class="tl-card-meta">${escapeHtml(t.description)}</div>` : ''}
            <div class="tl-card-stats">
                <span>${itemCount} task${itemCount !== 1 ? 's' : ''}</span>
                <span>${assignments.length} assigned</span>
                <span>${completedCount} completed</span>
                ${t.source_video_url ? '<span>Has video</span>' : ''}
            </div>
            <div class="tl-card-actions">
                <button type="button" class="btn btn-secondary btn-sm tl-action-view" data-id="${t.id}">View</button>
                <button type="button" class="btn btn-secondary btn-sm tl-action-assign" data-id="${t.id}">Assign</button>
                <button type="button" class="btn btn-secondary btn-sm tl-action-edit" data-id="${t.id}">Edit</button>
                <button type="button" class="btn btn-danger btn-sm tl-action-delete" data-id="${t.id}" data-name="${escapeHtml(t.title)}">Delete</button>
            </div>
        </div>`;
    }).join('');

    container.querySelectorAll('.tl-action-view').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); openTaskListDetail(btn.dataset.id); });
    });
    container.querySelectorAll('.tl-action-assign').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); openTaskListAssignModal(btn.dataset.id); });
    });
    container.querySelectorAll('.tl-action-edit').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); openTaskListEditor(btn.dataset.id); });
    });
    container.querySelectorAll('.tl-action-delete').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); deleteTaskList(btn.dataset.id, btn.dataset.name); });
    });
}

async function deleteTaskList(id, name) {
    if (!confirm(`Delete task list "${name}"? This cannot be undone.`)) return;
    const { error } = await supabaseClient.from('task_lists').delete().eq('id', id);
    if (error) { showToast('Failed to delete task list', 'error'); return; }
    showToast('Task list deleted');
    loadTaskLists();
}

// ---- Admin: Editor ----

function resetTlEditor() {
    tlEditorItems = [];
    tlEditorMode = 'manual';
    tlVideoFile = null;
    tlVideoUrl = null;
    tlTranscript = null;
    document.getElementById('tl-editor-id').value = '';
    document.getElementById('tl-editor-name').value = '';
    document.getElementById('tl-editor-description').value = '';
    document.getElementById('tl-editor-is-sop').checked = false;
    document.getElementById('tl-editor-title').textContent = 'Create Task List';
    document.getElementById('tl-items-list').innerHTML = '';

    // Reset video UI
    document.getElementById('tl-video-upload-area').style.display = '';
    document.getElementById('tl-video-preview').style.display = 'none';
    document.getElementById('tl-video-processing').style.display = 'none';
    document.getElementById('tl-process-video-btn').style.display = 'none';
    document.getElementById('tl-transcript-panel').style.display = 'none';
    document.getElementById('tl-generated-items').style.display = 'none';

    // Default to manual tab
    document.querySelectorAll('.tl-mode-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.tl-mode-tab[data-mode="manual"]').classList.add('active');
    document.getElementById('tl-mode-manual').style.display = '';
    document.getElementById('tl-mode-video').style.display = 'none';
}

async function openTaskListEditor(editId) {
    resetTlEditor();
    if (editId) {
        document.getElementById('tl-editor-title').textContent = 'Edit Task List';
        document.getElementById('tl-editor-id').value = editId;
        const { data: tl } = await supabaseClient.from('task_lists').select('*').eq('id', editId).single();
        if (tl) {
            document.getElementById('tl-editor-name').value = tl.title || '';
            document.getElementById('tl-editor-description').value = tl.description || '';
            document.getElementById('tl-editor-is-sop').checked = tl.is_sop;
            if (tl.source_video_url) tlVideoUrl = tl.source_video_url;
            if (tl.source_transcript) tlTranscript = tl.source_transcript;
        }
        const { data: items } = await supabaseClient
            .from('task_list_items')
            .select('*')
            .eq('task_list_id', editId)
            .order('sort_order');
        if (items) {
            tlEditorItems = items.map(it => ({
                id: it.id,
                title: it.title || '',
                description: it.description || '',
                media: it.media || []
            }));
        }
    }
    renderTlEditorItems();
    document.getElementById('tl-editor-modal').classList.add('active');
}

function renderTlEditorItems(targetList) {
    const listId = targetList || 'tl-items-list';
    const list = document.getElementById(listId);
    if (!list) return;

    list.innerHTML = tlEditorItems.map((item, idx) => `
        <div class="tl-item-row" data-idx="${idx}" draggable="true">
            <div class="tl-drag-handle">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
            </div>
            <div class="tl-item-fields">
                <input type="text" class="tl-item-title" placeholder="Task title" value="${escapeHtml(item.title)}" required>
                <textarea class="tl-item-desc" rows="2" placeholder="Description (optional)">${escapeHtml(item.description)}</textarea>
                <div class="tl-item-media-row">
                    ${(item.media || []).map((m, mi) => `
                        <span style="position:relative;display:inline-block;">
                            <img src="${escapeHtml(m.url)}" class="tl-item-media-thumb" alt="">
                            <button type="button" class="btn btn-close tl-media-remove" data-idx="${idx}" data-mi="${mi}" style="position:absolute;top:-4px;right:-4px;font-size:12px;width:18px;height:18px;">&times;</button>
                        </span>
                    `).join('')}
                    <input type="file" class="tl-item-media-input" accept="image/*" multiple style="display:none;" data-idx="${idx}">
                    <button type="button" class="btn btn-secondary btn-sm tl-item-media-btn" data-idx="${idx}">+ Image</button>
                </div>
            </div>
            <button type="button" class="btn btn-close tl-item-remove" data-idx="${idx}">&times;</button>
        </div>
    `).join('');

    // Bind events
    list.querySelectorAll('.tl-item-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            syncTlEditorItems(listId);
            tlEditorItems.splice(parseInt(btn.dataset.idx, 10), 1);
            renderTlEditorItems(listId);
        });
    });
    list.querySelectorAll('.tl-item-media-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            list.querySelector(`.tl-item-media-input[data-idx="${btn.dataset.idx}"]`).click();
        });
    });
    list.querySelectorAll('.tl-item-media-input').forEach(input => {
        input.onchange = async (e) => {
            const files = e.target.files;
            if (!files?.length) return;
            syncTlEditorItems(listId);
            const idx = parseInt(input.dataset.idx, 10);
            for (const file of files) {
                try {
                    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                    const path = `${currentUser.id}/task-media/${Date.now()}-${safeName}`;
                    const { data, error } = await supabaseClient.storage.from(TASK_LIST_STORAGE_BUCKET).upload(path, file, { upsert: true });
                    if (error) throw error;
                    const { data: urlData } = supabaseClient.storage.from(TASK_LIST_STORAGE_BUCKET).getPublicUrl(data.path);
                    if (!tlEditorItems[idx].media) tlEditorItems[idx].media = [];
                    tlEditorItems[idx].media.push({ url: urlData.publicUrl, type: 'image' });
                    renderTlEditorItems(listId);
                } catch (err) {
                    showToast('Image upload failed', 'error');
                }
            }
            input.value = '';
        };
    });
    list.querySelectorAll('.tl-media-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            syncTlEditorItems(listId);
            const idx = parseInt(btn.dataset.idx, 10);
            const mi = parseInt(btn.dataset.mi, 10);
            tlEditorItems[idx].media.splice(mi, 1);
            renderTlEditorItems(listId);
        });
    });

    // Drag and drop reorder
    initTlDragAndDrop(list, listId);
}

function syncTlEditorItems(listId) {
    const list = document.getElementById(listId || 'tl-items-list');
    if (!list) return;
    list.querySelectorAll('.tl-item-row').forEach(row => {
        const idx = parseInt(row.dataset.idx, 10);
        if (tlEditorItems[idx] === undefined) return;
        const titleEl = row.querySelector('.tl-item-title');
        const descEl = row.querySelector('.tl-item-desc');
        if (titleEl) tlEditorItems[idx].title = titleEl.value;
        if (descEl) tlEditorItems[idx].description = descEl.value;
    });
}

function initTlDragAndDrop(list, listId) {
    let dragIdx = null;
    list.querySelectorAll('.tl-item-row').forEach(row => {
        row.addEventListener('dragstart', (e) => {
            dragIdx = parseInt(row.dataset.idx, 10);
            row.style.opacity = '0.5';
            e.dataTransfer.effectAllowed = 'move';
        });
        row.addEventListener('dragend', () => {
            row.style.opacity = '';
            dragIdx = null;
        });
        row.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
        row.addEventListener('drop', (e) => {
            e.preventDefault();
            const dropIdx = parseInt(row.dataset.idx, 10);
            if (dragIdx === null || dragIdx === dropIdx) return;
            syncTlEditorItems(listId);
            const [moved] = tlEditorItems.splice(dragIdx, 1);
            tlEditorItems.splice(dropIdx, 0, moved);
            renderTlEditorItems(listId);
        });
    });
}

async function saveTaskList(e) {
    e.preventDefault();
    const id = document.getElementById('tl-editor-id').value;
    const title = document.getElementById('tl-editor-name').value.trim();
    const description = document.getElementById('tl-editor-description').value.trim();
    const isSop = document.getElementById('tl-editor-is-sop').checked;

    if (!title) { showToast('Please enter a task list name', 'error'); return; }

    // Sync items from whichever list is visible
    const activeListId = tlEditorMode === 'video' && document.getElementById('tl-generated-items').style.display !== 'none'
        ? 'tl-generated-items-list' : 'tl-items-list';
    syncTlEditorItems(activeListId);

    const validItems = tlEditorItems.filter(it => it.title.trim());
    if (validItems.length === 0) { showToast('Add at least one task', 'error'); return; }

    try {
        let taskListId = id;
        const payload = {
            title,
            description: description || null,
            is_sop: isSop,
            source_video_url: tlVideoUrl || null,
            source_transcript: tlTranscript || null
        };

        if (id) {
            const { error } = await supabaseClient.from('task_lists').update(payload).eq('id', id);
            if (error) throw error;
            await supabaseClient.from('task_list_items').delete().eq('task_list_id', id);
        } else {
            payload.created_by = currentUser.id;
            const { data, error } = await supabaseClient.from('task_lists').insert(payload).select().single();
            if (error) throw error;
            taskListId = data.id;
        }

        const itemRows = validItems.map((it, idx) => ({
            task_list_id: taskListId,
            sort_order: idx,
            title: it.title.trim(),
            description: it.description?.trim() || null,
            media: it.media || []
        }));

        const { error: itemsErr } = await supabaseClient.from('task_list_items').insert(itemRows);
        if (itemsErr) throw itemsErr;

        document.getElementById('tl-editor-modal').classList.remove('active');
        showToast(id ? 'Task list updated' : 'Task list created');
        loadTaskLists();
    } catch (err) {
        console.error('Save task list error:', err);
        showToast('Failed to save task list', 'error');
    }
}

// ---- Video Processing ----

function setupTlVideoUpload() {
    const dropzone = document.getElementById('tl-video-dropzone');
    const fileInput = document.getElementById('tl-video-input');
    const browseBtn = document.getElementById('tl-video-browse-btn');

    browseBtn?.addEventListener('click', () => fileInput.click());
    dropzone?.addEventListener('click', (e) => {
        if (e.target === browseBtn || browseBtn.contains(e.target)) return;
        fileInput.click();
    });

    dropzone?.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone?.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('video/')) handleTlVideoSelect(file);
        else showToast('Please drop a video file', 'error');
    });

    fileInput?.addEventListener('change', (e) => {
        if (e.target.files[0]) handleTlVideoSelect(e.target.files[0]);
    });
}

function handleTlVideoSelect(file) {
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > 2048) {
        showToast(`Video is ${sizeMB.toFixed(0)}MB — too large to process in browser. Try a shorter video.`, 'error');
        return;
    }
    tlVideoFile = file;
    const player = document.getElementById('tl-video-player');
    player.src = URL.createObjectURL(file);
    document.getElementById('tl-video-filename').textContent = file.name;
    document.getElementById('tl-video-upload-area').style.display = 'none';
    document.getElementById('tl-video-preview').style.display = '';
    document.getElementById('tl-process-video-btn').style.display = '';
}

async function processTaskVideo() {
    if (!tlVideoFile) return;

    const processingEl = document.getElementById('tl-video-processing');
    const processBtn = document.getElementById('tl-process-video-btn');
    const statusEl = document.getElementById('tl-processing-status');

    processBtn.style.display = 'none';
    processingEl.style.display = '';

    function setStep(stepId) {
        document.querySelectorAll('.tl-step').forEach(s => s.classList.remove('active'));
        const el = document.getElementById(stepId);
        if (el) el.classList.add('active');
        let found = false;
        document.querySelectorAll('.tl-step').forEach(s => {
            if (s.id === stepId) found = true;
            else if (!found) s.classList.add('done');
        });
    }

    try {
        // Step 1: Compress video with FFmpeg.wasm
        setStep('tl-step-compress');
        statusEl.textContent = 'Loading video compressor (first time may take a moment)…';

        const ffmpeg = await loadFFmpegInstance();
        ffmpeg.on('progress', ({ progress }) => {
            const pct = Math.min(100, Math.round(progress * 100));
            statusEl.textContent = `Compressing video… ${pct}%`;
        });

        const ext = tlVideoFile.name.split('.').pop().toLowerCase();
        const inputName = `input.${ext}`;
        await ffmpeg.writeFile(inputName, await _ffmpegUtil.fetchFile(tlVideoFile));

        await ffmpeg.exec([
            '-i', inputName,
            '-vf', 'scale=-2:720',
            '-r', '24',
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-crf', '28',
            '-c:a', 'aac',
            '-b:a', '64k',
            'output.mp4'
        ]);

        statusEl.textContent = 'Extracting audio for transcription…';
        await ffmpeg.exec([
            '-i', inputName,
            '-vn',
            '-c:a', 'libmp3lame',
            '-b:a', '96k',
            '-ar', '16000',
            '-ac', '1',
            'output.mp3'
        ]);

        const videoData = await ffmpeg.readFile('output.mp4');
        const audioData = await ffmpeg.readFile('output.mp3');

        await ffmpeg.deleteFile(inputName);
        await ffmpeg.deleteFile('output.mp4');
        await ffmpeg.deleteFile('output.mp3');

        const compressedVideoBlob = new Blob([videoData.buffer], { type: 'video/mp4' });
        const audioBlob = new Blob([audioData.buffer], { type: 'audio/mpeg' });

        console.log(`Compressed video: ${(compressedVideoBlob.size / 1048576).toFixed(1)}MB, Audio MP3: ${(audioBlob.size / 1048576).toFixed(1)}MB`);

        // Step 2: Upload compressed video + audio
        setStep('tl-step-upload');
        statusEl.textContent = 'Uploading compressed video…';

        const safeName = tlVideoFile.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.\w+$/, '.mp4');
        const storagePath = `${currentUser.id}/task-videos/${Date.now()}-${safeName}`;
        const { data: uploadData, error: uploadErr } = await supabaseClient.storage
            .from(TASK_LIST_STORAGE_BUCKET)
            .upload(storagePath, compressedVideoBlob, { upsert: true, contentType: 'video/mp4' });
        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabaseClient.storage.from(TASK_LIST_STORAGE_BUCKET).getPublicUrl(uploadData.path);
        tlVideoUrl = urlData.publicUrl;

        statusEl.textContent = 'Uploading audio…';
        const audioPath = `${currentUser.id}/task-audio/${Date.now()}.mp3`;
        const { data: audioUpload, error: audioErr } = await supabaseClient.storage
            .from(TASK_LIST_STORAGE_BUCKET)
            .upload(audioPath, audioBlob, { upsert: true, contentType: 'audio/mpeg' });
        if (audioErr) throw audioErr;

        const { data: audioUrlData } = supabaseClient.storage.from(TASK_LIST_STORAGE_BUCKET).getPublicUrl(audioUpload.path);

        // Step 3: Transcribe + generate tasks
        setStep('tl-step-transcribe');
        statusEl.textContent = 'Transcribing audio…';

        const session = await supabaseClient.auth.getSession();
        const token = session.data.session?.access_token;

        const edgeResp = await fetch(`${SUPABASE_CONFIG.edgeFunctionUrl}/process-task-video`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'apikey': SUPABASE_CONFIG.anonKey
            },
            body: JSON.stringify({ video_url: audioUrlData.publicUrl })
        });

        if (!edgeResp.ok) {
            const errData = await edgeResp.json().catch(() => ({}));
            throw new Error(errData.error || `Processing failed (${edgeResp.status})`);
        }

        const result = await edgeResp.json();
        tlTranscript = result.transcript;

        setStep('tl-step-generate');
        statusEl.textContent = 'Generating tasks…';
        await new Promise(r => setTimeout(r, 500));

        // Step 4: Capture screenshots from the compressed MP4
        setStep('tl-step-screenshots');
        statusEl.textContent = 'Capturing screenshots…';

        let screenshotUrls = [];
        if (result.capture_timestamps && result.capture_timestamps.length > 0) {
            const mp4BlobUrl = URL.createObjectURL(compressedVideoBlob);
            screenshotUrls = await captureVideoScreenshots(mp4BlobUrl, result.capture_timestamps);
            URL.revokeObjectURL(mp4BlobUrl);
        }

        // Build task items from AI result
        const tasks = result.tasks || [];
        tlEditorItems = tasks.map((t, idx) => {
            const media = [];
            const indices = t.capture_indices || (t.capture_index != null ? [t.capture_index] : []);
            for (const ci of indices) {
                if (screenshotUrls[ci]) {
                    media.push({ url: screenshotUrls[ci], type: 'image' });
                }
            }
            return {
                title: t.title || `Task ${idx + 1}`,
                description: t.description || '',
                media
            };
        });

        // Show results
        processingEl.style.display = 'none';

        if (tlTranscript) {
            document.getElementById('tl-transcript-text').textContent = tlTranscript;
            document.getElementById('tl-transcript-panel').style.display = '';
        }

        document.getElementById('tl-generated-items').style.display = '';
        renderTlEditorItems('tl-generated-items-list');
        showToast(`Generated ${tlEditorItems.length} tasks from video`);

    } catch (err) {
        console.error('Video processing error:', err);
        processingEl.style.display = 'none';
        processBtn.style.display = '';
        showToast('Video processing failed: ' + (err.message || 'Unknown error'), 'error');
    }
}

// ---- Screenshot Extraction ----

async function captureVideoScreenshots(videoUrl, timestamps) {
    const video = document.getElementById('tl-screenshot-video');
    const canvas = document.getElementById('tl-screenshot-canvas');
    const ctx = canvas.getContext('2d');
    const urls = [];

    if (videoUrl.startsWith('blob:')) {
        video.removeAttribute('crossorigin');
    } else {
        video.crossOrigin = 'anonymous';
    }
    video.src = videoUrl;
    video.muted = true;

    try {
        await Promise.race([
            new Promise((res, rej) => {
                video.onloadedmetadata = res;
                video.onerror = () => rej(new Error('Video decode failed'));
                video.load();
            }),
            new Promise((_, rej) => setTimeout(() => rej(new Error('Video load timeout')), 8000))
        ]);
    } catch (err) {
        console.warn('Cannot capture screenshots:', err.message, '— your browser may not support this video codec. Screenshots will be skipped.');
        video.src = '';
        return timestamps.map(() => null);
    }

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 360;

    for (const ts of timestamps) {
        try {
            video.currentTime = Math.max(0, ts - 0.5);
            await Promise.race([
                new Promise((res) => { video.onseeked = res; }),
                new Promise((_, rej) => setTimeout(() => rej(new Error('Seek timeout')), 5000))
            ]);

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));

            const path = `${currentUser.id}/task-screenshots/${Date.now()}-${ts.toFixed(1)}s.png`;
            const { data, error } = await supabaseClient.storage
                .from(TASK_LIST_STORAGE_BUCKET)
                .upload(path, blob, { upsert: true, contentType: 'image/png' });

            if (!error) {
                const { data: urlData } = supabaseClient.storage.from(TASK_LIST_STORAGE_BUCKET).getPublicUrl(data.path);
                urls.push(urlData.publicUrl);
            } else {
                urls.push(null);
            }
        } catch {
            urls.push(null);
        }
    }

    video.src = '';
    return urls;
}

// ---- Assignment ----

async function openTaskListAssignModal(taskListId) {
    const modal = document.getElementById('tl-assign-modal');
    modal.dataset.taskListId = taskListId;

    // Load employees
    const { data: employees } = await supabaseClient
        .from('profiles')
        .select('id, first_name, last_name, email, role')
        .neq('id', currentUser.id)
        .order('first_name');

    // Load existing assignments
    const { data: existing } = await supabaseClient
        .from('task_list_assignments')
        .select('id, assigned_to, status, profiles!task_list_assignments_assigned_to_fkey(first_name, last_name)')
        .eq('task_list_id', taskListId);

    const assignedIds = (existing || []).map(a => a.assigned_to);

    const empContainer = document.getElementById('tl-assign-employees');
    const unassigned = (employees || []).filter(e => !assignedIds.includes(e.id));
    empContainer.innerHTML = unassigned.length === 0
        ? '<p class="text-muted">All team members are already assigned.</p>'
        : unassigned.map(e => `
            <div class="tl-assign-employee-row">
                <input type="checkbox" id="tl-assign-${e.id}" value="${e.id}">
                <label for="tl-assign-${e.id}">${escapeHtml(e.first_name || '')} ${escapeHtml(e.last_name || '')} <span class="text-muted">${escapeHtml(e.email || '')}</span></label>
            </div>
        `).join('');

    const existContainer = document.getElementById('tl-assign-existing');
    if (existing && existing.length > 0) {
        existContainer.innerHTML = '<label style="font-weight:600;margin-bottom:4px;display:block;">Current Assignments</label>' +
            existing.map(a => {
                const name = a.profiles ? `${a.profiles.first_name || ''} ${a.profiles.last_name || ''}` : 'Unknown';
                return `<div class="tl-assign-existing-row">
                    <span>${escapeHtml(name)}</span>
                    <span class="tl-assign-status ${a.status}">${a.status.replace('_', ' ')}</span>
                </div>`;
            }).join('');
    } else {
        existContainer.innerHTML = '';
    }

    modal.classList.add('active');
}

async function saveTaskListAssignments() {
    const modal = document.getElementById('tl-assign-modal');
    const taskListId = modal.dataset.taskListId;
    const checkboxes = document.querySelectorAll('#tl-assign-employees input[type="checkbox"]:checked');

    if (checkboxes.length === 0) {
        showToast('Select at least one employee', 'error');
        return;
    }

    const rows = Array.from(checkboxes).map(cb => ({
        task_list_id: taskListId,
        assigned_to: cb.value,
        assigned_by: currentUser.id,
        status: 'pending'
    }));

    const { error } = await supabaseClient.from('task_list_assignments').insert(rows);
    if (error) {
        showToast('Failed to assign', 'error');
        return;
    }

    modal.classList.remove('active');
    showToast(`Assigned to ${rows.length} employee${rows.length > 1 ? 's' : ''}`);
    loadTaskLists();
}

// ---- Admin Detail View ----

async function openTaskListDetail(taskListId) {
    const { data: tl } = await supabaseClient.from('task_lists').select('*').eq('id', taskListId).single();
    if (!tl) { showToast('Task list not found', 'error'); return; }

    const { data: items } = await supabaseClient
        .from('task_list_items')
        .select('*')
        .eq('task_list_id', taskListId)
        .order('sort_order');

    const { data: assignments } = await supabaseClient
        .from('task_list_assignments')
        .select('*, profiles!task_list_assignments_assigned_to_fkey(first_name, last_name)')
        .eq('task_list_id', taskListId);

    document.getElementById('tl-detail-title').textContent = tl.title;
    document.getElementById('tl-detail-meta').innerHTML = `
        <span class="tl-badge ${tl.is_sop ? 'sop' : 'task'}">${tl.is_sop ? 'SOP' : 'Task'}</span>
        ${tl.description ? ` &mdash; ${escapeHtml(tl.description)}` : ''}
    `;

    if (tl.source_video_url) {
        document.getElementById('tl-detail-video').style.display = '';
        document.getElementById('tl-detail-video-player').src = tl.source_video_url;
    } else {
        document.getElementById('tl-detail-video').style.display = 'none';
    }

    if (tl.source_transcript) {
        document.getElementById('tl-detail-transcript').style.display = '';
        document.getElementById('tl-detail-transcript-text').textContent = tl.source_transcript;
    } else {
        document.getElementById('tl-detail-transcript').style.display = 'none';
    }

    const itemsContainer = document.getElementById('tl-detail-items');
    itemsContainer.innerHTML = (items || []).map((item, idx) => `
        <div class="tl-detail-item">
            <div class="tl-detail-item-num">${idx + 1}</div>
            <div class="tl-detail-item-content">
                <h5>${escapeHtml(item.title)}</h5>
                ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
                ${(item.media && item.media.length > 0) ? `
                    <div class="tl-detail-item-media">
                        ${item.media.map(m => `<img src="${escapeHtml(m.url)}" alt="Task media">`).join('')}
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('');

    const assignContainer = document.getElementById('tl-detail-assignment-list');
    if (assignments && assignments.length > 0) {
        assignContainer.innerHTML = assignments.map(a => {
            const name = a.profiles ? `${a.profiles.first_name || ''} ${a.profiles.last_name || ''}` : 'Unknown';
            return `<div class="tl-assign-existing-row">
                <span>${escapeHtml(name)}</span>
                <span class="tl-assign-status ${a.status}">${a.status.replace('_', ' ')}</span>
            </div>`;
        }).join('');
    } else {
        assignContainer.innerHTML = '<p class="text-muted">No one assigned yet.</p>';
    }

    document.getElementById('tl-detail-modal').classList.add('active');
}

// ---- Employee: My Tasks View ----

async function loadMyTasks() {
    if (!currentUser) return;

    const { data: assignments, error } = await supabaseClient
        .from('task_list_assignments')
        .select('*, task_lists(id, title, description, is_sop, source_video_url), task_list_item_checks(id)')
        .eq('assigned_to', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) { console.error('loadMyTasks error', error); return; }

    const pending = (assignments || []).filter(a => a.status !== 'completed');
    const completed = (assignments || []).filter(a => a.status === 'completed');

    const pendingList = document.getElementById('my-tasks-pending-list');
    const completedList = document.getElementById('my-tasks-completed-list');
    const emptyEl = document.getElementById('my-tasks-empty');

    if (pending.length === 0) {
        pendingList.innerHTML = '';
        emptyEl.style.display = '';
    } else {
        emptyEl.style.display = 'none';
        pendingList.innerHTML = pending.map(a => `
            <div class="my-task-assignment-card" data-assignment-id="${a.id}">
                <div>
                    <h4>${escapeHtml(a.task_lists?.title || 'Task List')}</h4>
                    <p>${escapeHtml(a.task_lists?.description || '')} &mdash; <span class="tl-assign-status ${a.status}">${a.status.replace('_', ' ')}</span></p>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
            </div>
        `).join('');

        pendingList.querySelectorAll('.my-task-assignment-card').forEach(card => {
            card.addEventListener('click', () => openMyTaskChecklist(card.dataset.assignmentId));
        });
    }

    if (completed.length === 0) {
        completedList.innerHTML = '<p class="text-muted">No completed tasks yet.</p>';
    } else {
        completedList.innerHTML = completed.map(a => `
            <div class="my-task-assignment-card" data-assignment-id="${a.id}" style="opacity:0.7;">
                <div>
                    <h4>${escapeHtml(a.task_lists?.title || 'Task List')}</h4>
                    <p><span class="tl-assign-status completed">completed</span></p>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
            </div>
        `).join('');
        completedList.querySelectorAll('.my-task-assignment-card').forEach(card => {
            card.addEventListener('click', () => openMyTaskChecklist(card.dataset.assignmentId));
        });
    }
}

async function openMyTaskChecklist(assignmentId) {
    const { data: assignment } = await supabaseClient
        .from('task_list_assignments')
        .select('*, task_lists(id, title, description, source_video_url)')
        .eq('id', assignmentId)
        .single();

    if (!assignment) { showToast('Assignment not found', 'error'); return; }

    const taskList = assignment.task_lists;

    const { data: items } = await supabaseClient
        .from('task_list_items')
        .select('*')
        .eq('task_list_id', taskList.id)
        .order('sort_order');

    const { data: checks } = await supabaseClient
        .from('task_list_item_checks')
        .select('*')
        .eq('assignment_id', assignmentId);

    const checkMap = {};
    (checks || []).forEach(c => { checkMap[c.task_list_item_id] = c; });

    document.getElementById('my-task-checklist-title').textContent = taskList.title;
    document.getElementById('my-task-meta').innerHTML = taskList.description ? escapeHtml(taskList.description) : '';

    if (taskList.source_video_url) {
        document.getElementById('my-task-video').style.display = '';
        document.getElementById('my-task-video-player').src = taskList.source_video_url;
    } else {
        document.getElementById('my-task-video').style.display = 'none';
    }

    const total = (items || []).length;
    const checkedCount = Object.keys(checkMap).length;
    const pct = total > 0 ? Math.round((checkedCount / total) * 100) : 0;
    document.getElementById('my-task-progress-fill').style.width = `${pct}%`;
    document.getElementById('my-task-progress-text').textContent = `${checkedCount} of ${total} tasks complete (${pct}%)`;

    const listEl = document.getElementById('my-task-checklist-items');
    listEl.innerHTML = (items || []).map(item => {
        const checked = !!checkMap[item.id];
        return `
        <div class="sop-checklist-item ${checked ? 'checked' : ''}" data-item-id="${item.id}" data-assignment-id="${assignmentId}">
            <label class="sop-checklist-label">
                <input type="checkbox" class="my-task-check" data-item-id="${item.id}" data-assignment-id="${assignmentId}" ${checked ? 'checked disabled' : ''}>
                <span class="sop-check-custom"></span>
                <span class="sop-checklist-text">
                    <strong>${escapeHtml(item.title)}</strong>
                    ${item.description ? `<br><span class="text-muted">${escapeHtml(item.description)}</span>` : ''}
                </span>
            </label>
            ${(item.media && item.media.length > 0) ? `
                <div class="tl-detail-item-media" style="margin-left:28px;margin-top:4px;">
                    ${item.media.map(m => `<img src="${escapeHtml(m.url)}" alt="" style="width:80px;height:60px;object-fit:cover;border-radius:6px;border:1px solid var(--border-color);cursor:pointer;" onclick="window.open('${escapeHtml(m.url)}','_blank')">`).join('')}
                </div>
            ` : ''}
        </div>`;
    }).join('');

    listEl.querySelectorAll('.my-task-check:not(:disabled)').forEach(cb => {
        cb.addEventListener('change', async () => {
            if (!cb.checked) return;
            cb.disabled = true;
            const itemId = cb.dataset.itemId;
            const aId = cb.dataset.assignmentId;

            const { error } = await supabaseClient.from('task_list_item_checks').insert({
                assignment_id: aId,
                task_list_item_id: itemId,
                checked_by: currentUser.id
            });

            if (error) {
                cb.checked = false;
                cb.disabled = false;
                showToast('Failed to check off task', 'error');
                return;
            }

            cb.closest('.sop-checklist-item').classList.add('checked');

            // Update progress
            const allCbs = listEl.querySelectorAll('.my-task-check');
            const checkedNow = listEl.querySelectorAll('.my-task-check:checked').length;
            const totalNow = allCbs.length;
            const pctNow = totalNow > 0 ? Math.round((checkedNow / totalNow) * 100) : 0;
            document.getElementById('my-task-progress-fill').style.width = `${pctNow}%`;
            document.getElementById('my-task-progress-text').textContent = `${checkedNow} of ${totalNow} tasks complete (${pctNow}%)`;

            // If all done, mark assignment as completed
            if (checkedNow === totalNow) {
                await supabaseClient.from('task_list_assignments')
                    .update({ status: 'completed' })
                    .eq('id', aId);
                showToast('All tasks completed!');
                loadMyTasks();
                loadTaskListClockInPanel();
            }

            // If first check, mark as in_progress
            if (checkedNow === 1) {
                await supabaseClient.from('task_list_assignments')
                    .update({ status: 'in_progress' })
                    .eq('id', aId);
            }
        });
    });

    document.getElementById('my-task-checklist-modal').classList.add('active');
}

// ---- Clock-in Integration ----

async function fetchPendingTaskAssignments() {
    if (!currentUser) return [];
    const { data } = await supabaseClient
        .from('task_list_assignments')
        .select('*, task_lists(title, description)')
        .eq('assigned_to', currentUser.id)
        .in('status', ['pending', 'in_progress']);
    return data || [];
}

async function showTaskListClockInPopup() {
    const assignments = await fetchPendingTaskAssignments();
    if (assignments.length === 0) return false;

    const modal = document.getElementById('tl-clockin-modal');
    const list = document.getElementById('tl-clockin-list');

    list.innerHTML = assignments.map(a => `
        <div class="tl-clockin-card" data-assignment-id="${a.id}">
            <div class="tl-clockin-card-info">
                <h4>${escapeHtml(a.task_lists?.title || 'Task List')}</h4>
                <p>${a.task_lists?.description ? escapeHtml(a.task_lists.description) : ''}</p>
                <span class="tl-assign-status ${a.status}">${a.status.replace('_', ' ')}</span>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
        </div>
    `).join('');

    list.querySelectorAll('.tl-clockin-card').forEach(card => {
        card.addEventListener('click', () => {
            modal.classList.remove('active');
            openMyTaskChecklist(card.dataset.assignmentId);
        });
    });

    modal.classList.add('active');
    return true;
}

async function loadTaskListClockInPanel() {
    if (!currentUser) return;
    const panel = document.getElementById('tl-clockin-panel');
    if (!panel) return;

    const assignments = await fetchPendingTaskAssignments();

    if (assignments.length === 0) {
        panel.style.display = 'none';
        return;
    }

    panel.style.display = '';
    const container = document.getElementById('tl-clockin-assignments');
    container.innerHTML = assignments.map(a => `
        <div class="tl-clockin-card" data-assignment-id="${a.id}">
            <div class="tl-clockin-card-info">
                <h4>${escapeHtml(a.task_lists?.title || 'Task List')}</h4>
                <p>${a.task_lists?.description ? escapeHtml(a.task_lists.description) : ''} &mdash; <span class="tl-assign-status ${a.status}">${a.status.replace('_', ' ')}</span></p>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
        </div>
    `).join('');

    container.querySelectorAll('.tl-clockin-card').forEach(card => {
        card.addEventListener('click', () => openMyTaskChecklist(card.dataset.assignmentId));
    });
}

// ---- Event Binding ----

function initTaskListEventListeners() {
    // Admin: create
    document.getElementById('create-task-list-btn')?.addEventListener('click', () => openTaskListEditor());

    // Editor modal close/cancel
    document.getElementById('close-tl-editor-modal')?.addEventListener('click', () => {
        document.getElementById('tl-editor-modal').classList.remove('active');
    });
    document.getElementById('tl-editor-cancel')?.addEventListener('click', () => {
        document.getElementById('tl-editor-modal').classList.remove('active');
    });

    // Editor form submit
    document.getElementById('tl-editor-form')?.addEventListener('submit', saveTaskList);

    // Add task button
    document.getElementById('tl-add-item-btn')?.addEventListener('click', () => {
        syncTlEditorItems('tl-items-list');
        tlEditorItems.push({ title: '', description: '', media: [] });
        renderTlEditorItems('tl-items-list');
    });

    // Mode tabs
    document.querySelectorAll('.tl-mode-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tl-mode-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            tlEditorMode = tab.dataset.mode;
            document.getElementById('tl-mode-manual').style.display = tlEditorMode === 'manual' ? '' : 'none';
            document.getElementById('tl-mode-video').style.display = tlEditorMode === 'video' ? '' : 'none';
        });
    });

    // Video upload
    setupTlVideoUpload();

    document.getElementById('tl-video-remove')?.addEventListener('click', () => {
        tlVideoFile = null;
        document.getElementById('tl-video-player').src = '';
        document.getElementById('tl-video-preview').style.display = 'none';
        document.getElementById('tl-video-upload-area').style.display = '';
        document.getElementById('tl-process-video-btn').style.display = 'none';
        document.getElementById('tl-transcript-panel').style.display = 'none';
        document.getElementById('tl-generated-items').style.display = 'none';
    });

    document.getElementById('tl-process-video-btn')?.addEventListener('click', processTaskVideo);

    // Filter buttons
    document.querySelectorAll('.tl-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tl-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            tlCurrentFilter = btn.dataset.filter;
            loadTaskLists();
        });
    });

    // Assign modal
    document.getElementById('close-tl-assign-modal')?.addEventListener('click', () => {
        document.getElementById('tl-assign-modal').classList.remove('active');
    });
    document.getElementById('tl-assign-cancel')?.addEventListener('click', () => {
        document.getElementById('tl-assign-modal').classList.remove('active');
    });
    document.getElementById('tl-assign-save')?.addEventListener('click', saveTaskListAssignments);

    // Detail modal
    document.getElementById('close-tl-detail-modal')?.addEventListener('click', () => {
        document.getElementById('tl-detail-modal').classList.remove('active');
    });
    document.getElementById('tl-detail-close')?.addEventListener('click', () => {
        document.getElementById('tl-detail-modal').classList.remove('active');
    });

    // Employee: my-task checklist modal
    document.getElementById('close-my-task-checklist-modal')?.addEventListener('click', () => {
        document.getElementById('my-task-checklist-modal').classList.remove('active');
    });
    document.getElementById('my-task-checklist-close')?.addEventListener('click', () => {
        document.getElementById('my-task-checklist-modal').classList.remove('active');
    });

    // Clock-in panel refresh
    document.getElementById('tl-clockin-refresh')?.addEventListener('click', loadTaskListClockInPanel);

    // Clock-in task list popup dismiss
    document.getElementById('tl-clockin-modal-dismiss')?.addEventListener('click', () => {
        document.getElementById('tl-clockin-modal').classList.remove('active');
    });
}

// Make functions available globally for inline handlers
window.deleteShift = deleteShift;
window.showEmployeeDetail = showEmployeeDetail;
window.updateEmployeeRate = updateEmployeeRate;
window.toggleShiftPaid = toggleShiftPaid;
window.openEditTimesheetModal = openEditTimesheetModal;
window.viewInvoice = async (id) => {
    showToast('Invoice viewing coming soon!');
};
window.openTaskListEditor = openTaskListEditor;
window.deleteTaskList = deleteTaskList;
window.openTaskListAssignModal = openTaskListAssignModal;
window.openTaskListDetail = openTaskListDetail;
window.openMyTaskChecklist = openMyTaskChecklist;
