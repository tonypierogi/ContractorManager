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
