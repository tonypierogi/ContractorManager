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
    
    restoreHashView();
    
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
    history.replaceState(null, '', location.pathname);
    showAuthScreen();
}
