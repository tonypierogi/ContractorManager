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
        issue_date: formatDateForInput(now),
        due_date: formatDateForInput(dueDate),
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
    const navBtns = document.querySelectorAll('#admin-dashboard .nav-btn[data-view]');
    const views = document.querySelectorAll('#admin-dashboard .view');
    const hamburgerBtn = document.getElementById('admin-hamburger-btn');
    const mainNav = document.getElementById('admin-main-nav');
    const navOverlay = document.getElementById('admin-nav-overlay');
    
    hamburgerBtn?.addEventListener('click', () => {
        mainNav.classList.toggle('open');
        navOverlay.classList.toggle('active');
    });
    
    navOverlay?.addEventListener('click', () => {
        mainNav.classList.remove('open');
        navOverlay.classList.remove('active');
    });

    initNavDropdowns();
    
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const viewId = btn.dataset.view;
            
            navBtns.forEach(b => b.classList.remove('active'));
            views.forEach(v => v.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(`${viewId}-view`).classList.add('active');
            
            setHash(viewId);
            
            mainNav.classList.remove('open');
            navOverlay.classList.remove('active');

            closeAllNavDropdowns();
            updateDropdownTriggerStates();
            
            if (viewId === 'timesheets') {
                loadAllTimesheets();
            } else if (viewId === 'team') {
                loadTeamMembers();
            } else if (viewId === 'schedule') {
                loadSchedule();
            } else if (viewId === 'sop') {
                loadSopList();
            } else if (viewId === 'equipment') {
                loadEquipmentList();
            } else if (viewId === 'task-lists') {
                loadTaskLists();
            } else if (viewId === 'admin-locations') {
                initLocationsView('admin');
            } else if (viewId === 'inventory') {
                loadInventoryAdminView();
            }
        });
    });
}

function initNavDropdowns() {
    const dropdowns = document.querySelectorAll('.nav-dropdown');
    
    dropdowns.forEach(dropdown => {
        const trigger = dropdown.querySelector('.nav-dropdown-trigger');
        trigger?.addEventListener('click', (e) => {
            e.stopPropagation();
            const wasOpen = dropdown.classList.contains('open');
            closeAllNavDropdowns();
            if (!wasOpen) {
                dropdown.classList.add('open');
            }
        });
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.nav-dropdown')) {
            closeAllNavDropdowns();
        }
    });

    updateDropdownTriggerStates();
}

function closeAllNavDropdowns() {
    document.querySelectorAll('.nav-dropdown.open').forEach(d => d.classList.remove('open'));
}

function updateDropdownTriggerStates() {
    document.querySelectorAll('.nav-dropdown').forEach(dropdown => {
        const trigger = dropdown.querySelector('.nav-dropdown-trigger');
        const hasActive = dropdown.querySelector('.nav-dropdown-menu .nav-btn.active');
        trigger?.classList.toggle('has-active-child', !!hasActive);
    });
}
