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
        const date = formatDateForInput(new Date(shift.clock_in)); // local date, not UTC
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
