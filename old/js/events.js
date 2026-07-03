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
