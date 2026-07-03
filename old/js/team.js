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
