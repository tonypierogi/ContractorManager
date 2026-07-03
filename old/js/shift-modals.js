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
    
    const isOvernight = clockOut && clockIn.toDateString() !== clockOut.toDateString();
    
    document.getElementById('edit-timesheet-id').value = data.id;
    document.getElementById('edit-timesheet-employee').value = data.name;
    document.getElementById('edit-timesheet-date').value = formatDateForInput(clockIn);
    document.getElementById('edit-timesheet-description').value = data.description || '';
    
    const startTime24 = clockIn.toTimeString().slice(0, 5);
    document.getElementById('edit-timesheet-start').value = startTime24;
    document.getElementById('edit-timesheet-start-display').value = formatTimeForDisplay(startTime24);
    
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
