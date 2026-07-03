// ==================== SHIFT SCHEDULING ====================

let scheduleViewMode = 'week'; // 'week' or 'month'
let scheduleWeekStart = getWeekStart(new Date());
let scheduleMonth = new Date().getMonth();
let scheduleYear = new Date().getFullYear();
let scheduleMembers = [];
let scheduleShifts = [];
let scheduleTimeEntries = [];
let scheduleHiddenMembers = new Set();
let scheduleShiftTypeFilter = 'both'; // 'both', 'scheduled', 'logged'

const SHIFT_TYPE_PREFIXES = { time_off: '[OFF]', out_of_town: '[OOT]' };

function encodeShiftNote(type, note) {
    const prefix = SHIFT_TYPE_PREFIXES[type];
    return prefix ? `${prefix} ${note || ''}`.trim() : (note || null);
}

function decodeShiftNote(rawNote) {
    if (!rawNote) return { type: 'shift', note: '' };
    if (rawNote.startsWith('[OFF]')) return { type: 'time_off', note: rawNote.slice(5).trim() };
    if (rawNote.startsWith('[OOT]')) return { type: 'out_of_town', note: rawNote.slice(5).trim() };
    return { type: 'shift', note: rawNote };
}

function getShiftTypeLabel(type) {
    if (type === 'time_off') return 'Time Off';
    if (type === 'out_of_town') return 'Out of Town';
    return '';
}

let myScheduleViewMode = 'week';
let myScheduleWeekStart = getWeekStart(new Date());
let myScheduleMonth = new Date().getMonth();
let myScheduleYear = new Date().getFullYear();
let myScheduleShifts = [];

function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
}

function getWeekEnd(weekStart) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
}

function formatWeekLabel(weekStart) {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    const opts = { month: 'short', day: 'numeric' };
    const startStr = weekStart.toLocaleDateString('en-US', opts);
    const endOpts = weekStart.getMonth() === end.getMonth() ? { day: 'numeric' } : opts;
    const endStr = end.toLocaleDateString('en-US', endOpts);
    return `${startStr} – ${endStr}, ${end.getFullYear()}`;
}

function formatMonthLabel(year, month) {
    return new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function schedFormatDate(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function isOvernightShift(startTime, endTime) {
    if (!startTime || !endTime) return false;
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    return (eh * 60 + em) < (sh * 60 + sm);
}

function formatScheduleTime(timeStr, nextDay) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${String(m).padStart(2, '0')} ${period}${nextDay ? ' +1' : ''}`;
}

function formatEndTime(startTime, endTime) {
    return formatScheduleTime(endTime, isOvernightShift(startTime, endTime));
}

function formatScheduleTimeShort(timeStr, nextDay) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const period = h >= 12 ? 'p' : 'a';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const base = m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2, '0')}${period}`;
    return nextDay ? base + '+1' : base;
}

function formatEndTimeShort(startTime, endTime) {
    return formatScheduleTimeShort(endTime, isOvernightShift(startTime, endTime));
}

function isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
}

function calcShiftHours(startTime, endTime) {
    if (!startTime || !endTime) return 0;
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins < 0) mins += 24 * 60;
    return mins / 60;
}

function calcShiftCost(shift, rate) {
    return calcShiftHours(shift.start_time, shift.end_time) * (rate || 0);
}

function timeEntryToDisplayShift(entry) {
    const clockIn = new Date(entry.clock_in);
    const clockOut = new Date(entry.clock_out);
    const hours = (clockOut - clockIn) / 3600000;
    const pad = n => String(n).padStart(2, '0');
    return {
        id: entry.id,
        shift_date: schedFormatDate(clockIn),
        employee_id: entry.user_id,
        start_time: `${pad(clockIn.getHours())}:${pad(clockIn.getMinutes())}`,
        end_time: `${pad(clockOut.getHours())}:${pad(clockOut.getMinutes())}`,
        note: entry.description || '',
        hours: hours,
        paid: entry.paid || false,
        _isLogged: true
    };
}

function getScheduleDateRange() {
    if (scheduleViewMode === 'week') {
        return { start: scheduleWeekStart, end: getWeekEnd(scheduleWeekStart) };
    }
    const start = new Date(scheduleYear, scheduleMonth, 1);
    const firstDay = start.getDay();
    start.setDate(start.getDate() - firstDay);
    const end = new Date(scheduleYear, scheduleMonth + 1, 0);
    const lastDay = end.getDay();
    end.setDate(end.getDate() + (6 - lastDay));
    end.setHours(23, 59, 59, 999);
    return { start, end };
}

function updateSchedulePeriodLabel() {
    const label = document.getElementById('schedule-period-label');
    if (!label) return;
    label.textContent = scheduleViewMode === 'week'
        ? formatWeekLabel(scheduleWeekStart)
        : formatMonthLabel(scheduleYear, scheduleMonth);
}

function updateScheduleViewPanels() {
    const weekPanel = document.getElementById('schedule-week-panel');
    const monthPanel = document.getElementById('schedule-month-panel');
    if (weekPanel) weekPanel.style.display = scheduleViewMode === 'week' ? '' : 'none';
    if (monthPanel) monthPanel.style.display = scheduleViewMode === 'month' ? '' : 'none';
    document.querySelectorAll('#schedule-view .schedule-toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === scheduleViewMode);
    });
}

// ---- Admin: Load schedule data ----

async function loadSchedule() {
    if (!supabaseClient) return;

    updateSchedulePeriodLabel();
    updateScheduleViewPanels();

    // Load members (include hourly_rate for cost estimates)
    try {
        const { data: members } = await supabaseClient
            .from('profiles')
            .select('id, first_name, last_name, email, hourly_rate')
            .order('first_name');
        scheduleMembers = members || [];
    } catch (e) {
        console.error('Error loading schedule members:', e);
    }

    // Populate member filter
    const filterSelect = document.getElementById('schedule-member-filter');
    if (filterSelect) {
        const currentVal = filterSelect.value;
        filterSelect.innerHTML = '<option value="">All Members</option>';
        scheduleMembers.forEach(m => {
            filterSelect.innerHTML += `<option value="${m.id}">${m.first_name} ${m.last_name}</option>`;
        });
        filterSelect.value = currentVal;
    }

    // Populate schedule shift employee dropdown
    const empSelect = document.getElementById('schedule-shift-employee');
    if (empSelect) {
        empSelect.innerHTML = '<option value="">Select team member</option>';
        scheduleMembers.forEach(m => {
            empSelect.innerHTML += `<option value="${m.id}">${m.first_name} ${m.last_name}</option>`;
        });
    }

    // Load shifts for the visible range
    const { start, end } = getScheduleDateRange();
    const startStr = schedFormatDate(start);
    const endStr = schedFormatDate(end);

    const memberFilter = document.getElementById('schedule-member-filter')?.value;

    try {
        let query = supabaseClient
            .from('scheduled_shifts')
            .select('*')
            .gte('shift_date', startStr)
            .lte('shift_date', endStr)
            .order('start_time');

        if (memberFilter) {
            query = query.eq('employee_id', memberFilter);
        }

        const { data, error } = await query;
        if (error) throw error;
        scheduleShifts = data || [];
    } catch (e) {
        console.error('Error loading scheduled shifts:', e);
        scheduleShifts = [];
    }

    // Fetch actual time entries for the same range (for estimated vs actual comparison)
    try {
        let teQuery = supabaseClient
            .from('time_entries')
            .select('*')
            .gte('clock_in', start.toISOString())
            .lte('clock_in', end.toISOString())
            .not('clock_out', 'is', null);

        if (memberFilter) {
            teQuery = teQuery.eq('user_id', memberFilter);
        }

        const { data: teData, error: teError } = await teQuery;
        if (teError) throw teError;
        scheduleTimeEntries = teData || [];
    } catch (e) {
        console.error('Error loading time entries for schedule:', e);
        scheduleTimeEntries = [];
    }

    if (scheduleViewMode === 'week') {
        renderScheduleWeekGrid();
    } else {
        renderScheduleMonthGrid();
    }
    renderContractorPaySummary();
}

// ---- Admin: Weekly grid ----

function renderScheduleWeekGrid() {
    const grid = document.getElementById('schedule-grid');
    if (!grid) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const memberFilter = document.getElementById('schedule-member-filter')?.value;
    const displayMembers = (memberFilter
        ? scheduleMembers.filter(m => m.id === memberFilter)
        : scheduleMembers
    ).filter(m => !scheduleHiddenMembers.has(m.id));
    const showType = scheduleShiftTypeFilter;

    const loggedDisplayShifts = scheduleTimeEntries.map(timeEntryToDisplayShift);

    if (displayMembers.length === 0) {
        grid.innerHTML = `
            <div class="schedule-empty" style="grid-column: 1 / -1;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                </svg>
                <p>${scheduleHiddenMembers.size > 0 ? 'All members are hidden. Click "Show all" below to restore.' : 'No team members found. Add team members first.'}</p>
            </div>
        `;
        return;
    }

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    let html = '<div class="schedule-grid-header">';
    html += '<div class="schedule-corner"></div>';
    for (let i = 0; i < 7; i++) {
        const d = new Date(scheduleWeekStart);
        d.setDate(d.getDate() + i);
        const isToday = isSameDay(d, today);
        html += `
            <div class="schedule-day-header${isToday ? ' today' : ''}">
                ${dayNames[d.getDay()]}
                <span class="schedule-day-date">${d.getDate()}</span>
            </div>
        `;
    }
    html += '</div>';

    let grandTotalHours = 0;
    let grandTotalCost = 0;

    displayMembers.forEach((member, mIdx) => {
        const initials = `${(member.first_name || '?')[0]}${(member.last_name || '?')[0]}`.toUpperCase();
        const colorIdx = mIdx % 8;
        const rate = member.hourly_rate || 0;
        let memberWeekHours = 0;
        let memberWeekCost = 0;

        html += '<div class="schedule-member-row">';
        html += `
            <div class="schedule-member-label">
                <div class="schedule-member-avatar">${initials}</div>
                <div class="schedule-member-info">
                    <span class="schedule-member-name">${member.first_name} ${member.last_name || ''}</span>
                    <span class="schedule-member-rate">${rate ? formatCurrency(rate) + '/hr' : ''}</span>
                </div>
            </div>
        `;

        for (let i = 0; i < 7; i++) {
            const d = new Date(scheduleWeekStart);
            d.setDate(d.getDate() + i);
            const dateStr = schedFormatDate(d);
            const isToday = isSameDay(d, today);

            const scheduledShifts = (showType !== 'logged')
                ? scheduleShifts.filter(s => s.shift_date === dateStr && s.employee_id === member.id)
                : [];
            const loggedShifts = (showType !== 'scheduled')
                ? loggedDisplayShifts.filter(s => s.shift_date === dateStr && s.employee_id === member.id)
                : [];

            html += `<div class="schedule-cell${isToday ? ' today' : ''}" data-date="${dateStr}" data-member="${member.id}">`;

            scheduledShifts.forEach(shift => {
                const decoded = decodeShiftNote(shift.note);
                const isTimeOff = decoded.type !== 'shift';

                if (isTimeOff) {
                    const typeLabel = getShiftTypeLabel(decoded.type);
                    html += `
                        <div class="schedule-shift-chip timeoff-chip${decoded.type === 'out_of_town' ? ' oot-chip' : ''}" onclick="openEditScheduleShift('${shift.id}')" title="${typeLabel}${decoded.note ? ': ' + decoded.note : ''}">
                            <span class="schedule-shift-time">${typeLabel}</span>
                            ${decoded.note ? `<span class="schedule-shift-note">${decoded.note}</span>` : ''}
                            <button class="schedule-shift-delete" onclick="event.stopPropagation(); deleteScheduledShift('${shift.id}')" title="Delete">×</button>
                        </div>
                    `;
                } else {
                    const hrs = calcShiftHours(shift.start_time, shift.end_time);
                    const cost = hrs * rate;
                    memberWeekHours += hrs;
                    memberWeekCost += cost;

                    html += `
                        <div class="schedule-shift-chip color-${colorIdx}" onclick="openEditScheduleShift('${shift.id}')" title="Scheduled: ${formatScheduleTime(shift.start_time)} – ${formatEndTime(shift.start_time, shift.end_time)}${decoded.note ? '\n' + decoded.note : ''}${rate ? '\n' + hrs.toFixed(1) + 'h · ' + formatCurrency(cost) : ''}">
                            <span class="schedule-shift-time">${formatScheduleTime(shift.start_time)} – ${formatEndTime(shift.start_time, shift.end_time)}</span>
                            ${rate ? `<span class="schedule-shift-cost">${hrs.toFixed(1)}h · ${formatCurrency(cost)}</span>` : ''}
                            ${decoded.note ? `<span class="schedule-shift-note">${decoded.note}</span>` : ''}
                            <button class="schedule-shift-delete" onclick="event.stopPropagation(); deleteScheduledShift('${shift.id}')" title="Delete shift">×</button>
                        </div>
                    `;
                }
            });

            loggedShifts.forEach(shift => {
                const hrs = shift.hours;
                const cost = hrs * rate;
                html += `
                    <div class="schedule-shift-chip logged-chip" title="Logged: ${formatScheduleTime(shift.start_time)} – ${formatEndTime(shift.start_time, shift.end_time)}\n${hrs.toFixed(1)}h · ${formatCurrency(cost)}${shift.paid ? '\n✓ Paid' : '\n○ Unpaid'}">
                        <span class="schedule-shift-time">${formatScheduleTime(shift.start_time)} – ${formatEndTime(shift.start_time, shift.end_time)}</span>
                        ${rate ? `<span class="schedule-shift-cost">${hrs.toFixed(1)}h · ${formatCurrency(cost)}</span>` : ''}
                        <span class="logged-badge${shift.paid ? ' paid' : ''}">${shift.paid ? '✓ Paid' : 'Logged'}</span>
                    </div>
                `;
            });

            html += `
                <div class="schedule-cell-add" onclick="quickAddScheduleShift('${member.id}', '${dateStr}')">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add
                </div>
            `;
            html += '</div>';
        }

        grandTotalHours += memberWeekHours;
        grandTotalCost += memberWeekCost;
        html += '</div>';
    });

    html += `
        <div class="schedule-totals-row">
            <div class="schedule-totals-label">Week Total (Scheduled)</div>
            <div class="schedule-totals-value">${grandTotalHours.toFixed(1)} hrs · ${formatCurrency(grandTotalCost)}</div>
        </div>
    `;

    grid.innerHTML = html;
}

// ---- Admin: Monthly calendar ----

function renderScheduleMonthGrid() {
    const cal = document.getElementById('schedule-month-cal');
    if (!cal) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const showType = scheduleShiftTypeFilter;

    const memberColorMap = {};
    scheduleMembers.forEach((m, i) => { memberColorMap[m.id] = i % 8; });
    const memberNameMap = {};
    scheduleMembers.forEach(m => { memberNameMap[m.id] = `${m.first_name || ''} ${(m.last_name || '')[0] || ''}`.trim(); });
    const memberRateMap = {};
    scheduleMembers.forEach(m => { memberRateMap[m.id] = m.hourly_rate || 0; });

    const loggedDisplayShifts = scheduleTimeEntries.map(timeEntryToDisplayShift);
    const colors = ['#00d4aa','#6366f1','#f59e0b','#ec4899','#3b82f6','#8b5cf6','#14b8a6','#f43f5e'];

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let html = '<div class="schedule-month-weekdays">';
    dayNames.forEach(d => { html += `<span>${d}</span>`; });
    html += '</div>';

    const firstOfMonth = new Date(scheduleYear, scheduleMonth, 1);
    const startDay = firstOfMonth.getDay();
    const daysInMonth = new Date(scheduleYear, scheduleMonth + 1, 0).getDate();
    const totalCells = Math.ceil((startDay + daysInMonth) / 7) * 7;

    html += '<div class="schedule-month-days">';
    for (let i = 0; i < totalCells; i++) {
        const d = new Date(scheduleYear, scheduleMonth, 1 - startDay + i);
        const dateStr = schedFormatDate(d);
        const isCurrentMonth = d.getMonth() === scheduleMonth;
        const isToday = isSameDay(d, today);

        const scheduledDay = (showType !== 'logged') ? scheduleShifts.filter(s => s.shift_date === dateStr && !scheduleHiddenMembers.has(s.employee_id)) : [];
        const loggedDay = (showType !== 'scheduled') ? loggedDisplayShifts.filter(s => s.shift_date === dateStr && !scheduleHiddenMembers.has(s.employee_id)) : [];
        const allPills = [
            ...scheduledDay.map(s => ({ ...s, _type: 'scheduled' })),
            ...loggedDay.map(s => ({ ...s, _type: 'logged' }))
        ];
        const maxShow = 3;

        html += `<div class="schedule-month-day${isCurrentMonth ? '' : ' other-month'}${isToday ? ' today' : ''}">`;
        html += `<span class="schedule-month-day-num">${d.getDate()}</span>`;
        html += '<div class="schedule-month-day-shifts">';

        allPills.slice(0, maxShow).forEach(shift => {
            if (shift._type === 'scheduled') {
                const decoded = decodeShiftNote(shift.note);
                const isTimeOff = decoded.type !== 'shift';
                const name = memberNameMap[shift.employee_id] || '';

                if (isTimeOff) {
                    const typeLabel = getShiftTypeLabel(decoded.type);
                    const isOOT = decoded.type === 'out_of_town';
                    html += `
                        <div class="schedule-month-shift-pill timeoff-pill${isOOT ? ' oot-pill' : ''}" onclick="openEditScheduleShift('${shift.id}')" title="${typeLabel}: ${name}${decoded.note ? '\n' + decoded.note : ''}">
                            <span class="pill-time">${isOOT ? '✈' : '🏖'}</span>
                            <span class="pill-name">${name}</span>
                            <button class="pill-delete" onclick="event.stopPropagation(); deleteScheduledShift('${shift.id}')" title="Delete">×</button>
                        </div>
                    `;
                } else {
                    const colorIdx = memberColorMap[shift.employee_id] ?? 0;
                    const bg = colors[colorIdx] + '22';
                    const fg = colors[colorIdx];
                    const rate = memberRateMap[shift.employee_id] || 0;
                    const cost = calcShiftCost(shift, rate);
                    html += `
                        <div class="schedule-month-shift-pill" style="background:${bg};color:${fg};" onclick="openEditScheduleShift('${shift.id}')" title="Scheduled: ${name}: ${formatScheduleTime(shift.start_time)} – ${formatEndTime(shift.start_time, shift.end_time)}${rate ? '\n' + formatCurrency(cost) : ''}${decoded.note ? '\n' + decoded.note : ''}">
                            <span class="pill-time">${formatScheduleTimeShort(shift.start_time)}</span>
                            <span class="pill-name">${name}</span>
                            ${rate ? `<span class="pill-cost">${formatCurrency(cost)}</span>` : ''}
                            <button class="pill-delete" style="background:${bg};" onclick="event.stopPropagation(); deleteScheduledShift('${shift.id}')" title="Delete">×</button>
                        </div>
                    `;
                }
            } else {
                const name = memberNameMap[shift.employee_id] || '';
                const rate = memberRateMap[shift.employee_id] || 0;
                const cost = shift.hours * rate;
                html += `
                    <div class="schedule-month-shift-pill logged-pill" title="Logged: ${name}: ${formatScheduleTime(shift.start_time)} – ${formatEndTime(shift.start_time, shift.end_time)}\n${shift.hours.toFixed(1)}h · ${formatCurrency(cost)}${shift.paid ? '\n✓ Paid' : '\n○ Unpaid'}">
                        <span class="pill-time">${formatScheduleTimeShort(shift.start_time)}</span>
                        <span class="pill-name">${name}</span>
                        <span class="pill-logged-badge${shift.paid ? ' paid' : ''}">${shift.paid ? '✓' : '○'}</span>
                    </div>
                `;
            }
        });
        if (allPills.length > maxShow) {
            html += `<span class="schedule-month-more">+${allPills.length - maxShow} more</span>`;
        }
        html += '</div>';

        if (isCurrentMonth) {
            html += `<div class="schedule-month-day-add" onclick="quickAddScheduleShift('', '${dateStr}')">+ Add</div>`;
        }
        html += '</div>';
    }
    html += '</div>';

    cal.innerHTML = html;
}

// ---- Contractor pay summary (estimated vs actual) ----

function reRenderScheduleViews() {
    if (scheduleViewMode === 'week') {
        renderScheduleWeekGrid();
    } else {
        renderScheduleMonthGrid();
    }
    renderContractorPaySummary();
}

function togglePaySummaryMember(memberId) {
    if (scheduleHiddenMembers.has(memberId)) {
        scheduleHiddenMembers.delete(memberId);
    } else {
        scheduleHiddenMembers.add(memberId);
    }
    reRenderScheduleViews();
}
function clearHiddenPayMembers() {
    scheduleHiddenMembers.clear();
    reRenderScheduleViews();
}
window.togglePaySummaryMember = togglePaySummaryMember;
window.clearHiddenPayMembers = clearHiddenPayMembers;

function renderContractorPaySummary() {
    const container = document.getElementById('contractor-pay-summary');
    if (!container) return;

    const memberFilter = document.getElementById('schedule-member-filter')?.value;
    const displayMembers = memberFilter
        ? scheduleMembers.filter(m => m.id === memberFilter)
        : scheduleMembers;

    if (displayMembers.length === 0) {
        container.innerHTML = '';
        return;
    }

    const colors = ['#00d4aa','#6366f1','#f59e0b','#ec4899','#3b82f6','#8b5cf6','#14b8a6','#f43f5e'];
    const memberColorMap = {};
    scheduleMembers.forEach((m, i) => { memberColorMap[m.id] = i % 8; });

    const periodLabel = scheduleViewMode === 'week'
        ? formatWeekLabel(scheduleWeekStart)
        : formatMonthLabel(scheduleYear, scheduleMonth);

    let totalSchedHours = 0;
    let totalSchedPay = 0;
    let totalLoggedHours = 0;
    let totalLoggedPay = 0;
    let totalOwed = 0;

    const visibleMembers = displayMembers.filter(m => !scheduleHiddenMembers.has(m.id));
    const hiddenCount = displayMembers.length - visibleMembers.length;

    let rowsHtml = '';
    visibleMembers.forEach(member => {
        const rate = member.hourly_rate || 0;
        const colorIdx = memberColorMap[member.id] ?? 0;
        const fg = colors[colorIdx];
        const initials = `${(member.first_name || '?')[0]}${(member.last_name || '?')[0]}`.toUpperCase();

        // Scheduled: sum of scheduled shifts (exclude time-off entries)
        const memberShifts = scheduleShifts.filter(s => s.employee_id === member.id && decodeShiftNote(s.note).type === 'shift');
        let schedHours = 0;
        memberShifts.forEach(s => { schedHours += calcShiftHours(s.start_time, s.end_time); });
        const schedPay = schedHours * rate;

        // Logged: sum of real time entries
        const memberEntries = scheduleTimeEntries.filter(e => e.user_id === member.id);
        let loggedHours = 0;
        let unpaidHours = 0;
        memberEntries.forEach(e => {
            const clockIn = new Date(e.clock_in);
            const clockOut = new Date(e.clock_out);
            const h = (clockOut - clockIn) / 3600000;
            loggedHours += h;
            if (!e.paid) unpaidHours += h;
        });
        const loggedPay = loggedHours * rate;
        const owedPay = unpaidHours * rate;
        const pctLogged = schedHours > 0 ? (loggedHours / schedHours) * 100 : (loggedHours > 0 ? 100 : 0);

        totalSchedHours += schedHours;
        totalSchedPay += schedPay;
        totalLoggedHours += loggedHours;
        totalLoggedPay += loggedPay;
        totalOwed += owedPay;

        const pctClass = pctLogged >= 100 ? 'pct-over' : pctLogged >= 50 ? 'pct-mid' : 'pct-low';

        rowsHtml += `
            <div class="pay-summary-row">
                <div class="pay-summary-member">
                    <button class="pay-summary-visibility" onclick="togglePaySummaryMember('${member.id}')" title="Hide from table">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    </button>
                    <div class="pay-summary-avatar" style="background:${fg}22;color:${fg};">${initials}</div>
                    <div class="pay-summary-member-info">
                        <span class="pay-summary-name">${member.first_name} ${member.last_name || ''}</span>
                        <span class="pay-summary-rate">${rate ? formatCurrency(rate) + '/hr' : 'No rate set'}</span>
                    </div>
                </div>
                <div class="pay-summary-col">
                    <span class="pay-summary-hours">${schedHours.toFixed(1)}h</span>
                    <span class="pay-summary-amount">${formatCurrency(schedPay)}</span>
                </div>
                <div class="pay-summary-col">
                    <span class="pay-summary-hours">${loggedHours.toFixed(1)}h</span>
                    <span class="pay-summary-amount">${formatCurrency(loggedPay)}</span>
                </div>
                <div class="pay-summary-col pay-summary-owed">
                    <span class="pay-summary-amount pay-summary-owed-value${owedPay > 0 ? ' has-owed' : ''}">${formatCurrency(owedPay)}</span>
                </div>
                <div class="pay-summary-col pay-summary-pct ${pctClass}">
                    <span class="pay-summary-pct-value">${pctLogged.toFixed(0)}%</span>
                    <div class="pay-summary-pct-bar"><div class="pay-summary-pct-fill" style="width:${Math.min(pctLogged, 100)}%"></div></div>
                </div>
            </div>
        `;
    });

    const totalPctLogged = totalSchedHours > 0 ? (totalLoggedHours / totalSchedHours) * 100 : (totalLoggedHours > 0 ? 100 : 0);

    let hiddenBtnHtml = '';
    if (hiddenCount > 0) {
        hiddenBtnHtml = `<button class="pay-summary-show-hidden" onclick="clearHiddenPayMembers()">${hiddenCount} hidden · Show all</button>`;
    }

    container.innerHTML = `
        <div class="pay-summary-header">
            <div class="pay-summary-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="1" x2="12" y2="23"></line>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
                Contractor Pay Estimates
                ${hiddenBtnHtml}
            </div>
            <span class="pay-summary-period">${periodLabel}</span>
        </div>
        <div class="pay-summary-table">
            <div class="pay-summary-table-header">
                <div class="pay-summary-col-label">Contractor</div>
                <div class="pay-summary-col-label">Scheduled</div>
                <div class="pay-summary-col-label">Logged</div>
                <div class="pay-summary-col-label">Owed</div>
                <div class="pay-summary-col-label">% Logged</div>
            </div>
            ${rowsHtml}
            <div class="pay-summary-totals">
                <div class="pay-summary-totals-label">Totals</div>
                <div class="pay-summary-col">
                    <span class="pay-summary-hours">${totalSchedHours.toFixed(1)}h</span>
                    <span class="pay-summary-amount">${formatCurrency(totalSchedPay)}</span>
                </div>
                <div class="pay-summary-col">
                    <span class="pay-summary-hours">${totalLoggedHours.toFixed(1)}h</span>
                    <span class="pay-summary-amount">${formatCurrency(totalLoggedPay)}</span>
                </div>
                <div class="pay-summary-col pay-summary-owed">
                    <span class="pay-summary-amount pay-summary-owed-value${totalOwed > 0 ? ' has-owed' : ''}">${formatCurrency(totalOwed)}</span>
                </div>
                <div class="pay-summary-col pay-summary-pct">
                    <span class="pay-summary-pct-value">${totalPctLogged.toFixed(0)}%</span>
                </div>
            </div>
        </div>
    `;
}

// ---- Modal helpers ----

function openScheduleShiftModal(employeeId = '', dateStr = '') {
    const modal = document.getElementById('schedule-shift-modal');
    const form = document.getElementById('schedule-shift-form');
    form.reset();
    document.getElementById('schedule-shift-id').value = '';
    document.getElementById('schedule-shift-type').value = 'shift';
    document.getElementById('schedule-modal-title').textContent = 'Schedule Shift';
    document.getElementById('save-schedule-shift-btn').textContent = 'Save';
    document.getElementById('schedule-shift-start-display').value = '';
    document.getElementById('schedule-shift-end-display').value = '';
    document.getElementById('schedule-shift-start').value = '';
    document.getElementById('schedule-shift-end').value = '';
    document.getElementById('schedule-repeat-weeks-group').style.display = 'none';
    document.getElementById('schedule-shift-repeat').checked = false;
    document.getElementById('schedule-time-fields').style.display = '';

    if (employeeId) document.getElementById('schedule-shift-employee').value = employeeId;
    if (dateStr) {
        document.getElementById('schedule-shift-date').value = dateStr;
    } else {
        document.getElementById('schedule-shift-date').value = schedFormatDate(new Date());
    }

    modal.classList.add('active');
}

function closeScheduleShiftModal() {
    document.getElementById('schedule-shift-modal').classList.remove('active');
}

function quickAddScheduleShift(memberId, dateStr) {
    openScheduleShiftModal(memberId, dateStr);
}

// ---- Time Off modal ----

function openTimeOffModal(employeeId = '', startDate = '', endDate = '', type = 'time_off', reason = '', editId = '') {
    const modal = document.getElementById('timeoff-modal');
    const form = document.getElementById('timeoff-form');
    form.reset();

    document.getElementById('timeoff-type-value').value = type;
    document.querySelectorAll('.timeoff-type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });

    // Populate employee dropdown from scheduleMembers
    const empSelect = document.getElementById('timeoff-employee');
    empSelect.innerHTML = '<option value="">Select team member</option>';
    scheduleMembers.forEach(m => {
        empSelect.innerHTML += `<option value="${m.id}">${m.first_name} ${m.last_name}</option>`;
    });

    if (employeeId) empSelect.value = employeeId;

    const today = schedFormatDate(new Date());
    document.getElementById('timeoff-start-date').value = startDate || today;
    document.getElementById('timeoff-end-date').value = endDate || today;
    document.getElementById('timeoff-reason').value = reason || '';
    document.getElementById('timeoff-day-count').textContent = '';

    // Store edit id if editing a single day
    form.dataset.editId = editId || '';
    if (editId) {
        document.querySelector('#timeoff-modal .modal-header h3').textContent = 'Edit Time Off';
        document.getElementById('save-timeoff-btn').textContent = 'Update';
    } else {
        document.querySelector('#timeoff-modal .modal-header h3').textContent = 'Schedule Time Off';
        document.getElementById('save-timeoff-btn').textContent = 'Save Time Off';
    }

    updateTimeOffDayCount();
    modal.classList.add('active');
}

function closeTimeOffModal() {
    document.getElementById('timeoff-modal').classList.remove('active');
}

function updateTimeOffDayCount() {
    const startVal = document.getElementById('timeoff-start-date').value;
    const endVal = document.getElementById('timeoff-end-date').value;
    const el = document.getElementById('timeoff-day-count');
    if (!startVal || !endVal) { el.textContent = ''; return; }

    const start = new Date(startVal + 'T00:00:00');
    const end = new Date(endVal + 'T00:00:00');
    const diffMs = end - start;
    if (diffMs < 0) {
        el.textContent = 'End date must be on or after start date';
        el.style.color = 'var(--error)';
        return;
    }
    const days = Math.round(diffMs / 86400000) + 1;
    el.textContent = days === 1 ? '1 day' : `${days} days`;
    el.style.color = 'var(--text-muted)';
}

async function saveTimeOff(e) {
    e.preventDefault();
    if (!supabaseClient) return;

    const form = document.getElementById('timeoff-form');
    const editId = form.dataset.editId;
    const type = document.getElementById('timeoff-type-value').value;
    const employeeId = document.getElementById('timeoff-employee').value;
    const startVal = document.getElementById('timeoff-start-date').value;
    const endVal = document.getElementById('timeoff-end-date').value;
    const reason = document.getElementById('timeoff-reason').value.trim();

    if (!employeeId || !startVal || !endVal) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    const startDate = new Date(startVal + 'T00:00:00');
    const endDate = new Date(endVal + 'T00:00:00');
    if (endDate < startDate) {
        showToast('End date must be on or after start date', 'error');
        return;
    }

    const encodedNote = encodeShiftNote(type, reason);

    try {
        if (editId) {
            const { error } = await supabaseClient
                .from('scheduled_shifts')
                .update({
                    employee_id: employeeId,
                    shift_date: startVal,
                    start_time: '00:00',
                    end_time: '23:59',
                    note: encodedNote
                })
                .eq('id', editId);
            if (error) throw error;
            showToast('Updated!');
        } else {
            const entries = [];
            const d = new Date(startDate);
            while (d <= endDate) {
                entries.push({
                    employee_id: employeeId,
                    shift_date: schedFormatDate(d),
                    start_time: '00:00',
                    end_time: '23:59',
                    note: encodedNote,
                    created_by: currentUser.id
                });
                d.setDate(d.getDate() + 1);
            }

            const { error } = await supabaseClient
                .from('scheduled_shifts')
                .insert(entries);
            if (error) throw error;

            const days = entries.length;
            const typeLabel = getShiftTypeLabel(type);
            showToast(`${typeLabel} scheduled for ${days} day${days > 1 ? 's' : ''}`);
        }

        closeTimeOffModal();

        if (userProfile?.role === 'admin') {
            if (scheduleViewMode === 'week') {
                scheduleViewMode = 'month';
                scheduleMonth = startDate.getMonth();
                scheduleYear = startDate.getFullYear();
            }
            await loadSchedule();
        } else {
            await loadMySchedule();
        }
    } catch (error) {
        console.error('Error saving time off:', error);
        showToast('Failed to save: ' + error.message, 'error');
    }
}

async function openEditScheduleShift(shiftId) {
    const shift = scheduleShifts.find(s => s.id === shiftId) ||
                  myScheduleShifts.find(s => s.id === shiftId);
    if (!shift) return;

    const decoded = decodeShiftNote(shift.note);

    if (decoded.type !== 'shift') {
        openTimeOffModal(shift.employee_id, shift.shift_date, shift.shift_date, decoded.type, decoded.note, shift.id);
        return;
    }

    openScheduleShiftModal(shift.employee_id, shift.shift_date);
    document.getElementById('schedule-shift-id').value = shift.id;
    document.getElementById('schedule-modal-title').textContent = 'Edit Scheduled Shift';
    document.getElementById('save-schedule-shift-btn').textContent = 'Update';

    if (shift.start_time) {
        document.getElementById('schedule-shift-start').value = shift.start_time;
        document.getElementById('schedule-shift-start-display').value = formatScheduleTime(shift.start_time);
    }
    if (shift.end_time) {
        document.getElementById('schedule-shift-end').value = shift.end_time;
        document.getElementById('schedule-shift-end-display').value = formatEndTime(shift.start_time, shift.end_time);
    }
    document.getElementById('schedule-shift-note').value = decoded.note;
}

async function saveScheduledShift(e) {
    e.preventDefault();
    if (!supabaseClient) return;

    const shiftId = document.getElementById('schedule-shift-id').value;
    const employeeId = document.getElementById('schedule-shift-employee').value;
    const shiftDate = document.getElementById('schedule-shift-date').value;
    const rawNote = document.getElementById('schedule-shift-note').value.trim();
    const repeat = document.getElementById('schedule-shift-repeat').checked;
    const repeatWeeks = parseInt(document.getElementById('schedule-shift-repeat-weeks').value) || 4;
    const startTime = document.getElementById('schedule-shift-start').value;
    const endTime = document.getElementById('schedule-shift-end').value;

    if (!employeeId || !shiftDate || !startTime || !endTime) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    const encodedNote = rawNote || null;

    try {
        if (shiftId) {
            const { error } = await supabaseClient
                .from('scheduled_shifts')
                .update({
                    employee_id: employeeId,
                    shift_date: shiftDate,
                    start_time: startTime,
                    end_time: endTime,
                    note: encodedNote
                })
                .eq('id', shiftId);
            if (error) throw error;
            showToast('Updated!');
        } else {
            const shiftsToInsert = [];
            const baseDate = new Date(shiftDate + 'T00:00:00');
            const weeks = repeat ? repeatWeeks : 1;

            for (let w = 0; w < weeks; w++) {
                const d = new Date(baseDate);
                d.setDate(d.getDate() + (w * 7));
                shiftsToInsert.push({
                    employee_id: employeeId,
                    shift_date: schedFormatDate(d),
                    start_time: startTime,
                    end_time: endTime,
                    note: encodedNote,
                    created_by: currentUser.id
                });
            }

            const { error } = await supabaseClient
                .from('scheduled_shifts')
                .insert(shiftsToInsert);
            if (error) throw error;

            if (repeat) {
                const lastDate = new Date(baseDate);
                lastDate.setDate(lastDate.getDate() + ((weeks - 1) * 7));
                showToast(`${weeks} shifts scheduled through ${lastDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);
            } else {
                showToast('Shift scheduled!');
            }
        }

        closeScheduleShiftModal();

        if (userProfile?.role === 'admin') {
            if (repeat && scheduleViewMode === 'week') {
                scheduleViewMode = 'month';
                scheduleMonth = new Date(shiftDate + 'T00:00:00').getMonth();
                scheduleYear = new Date(shiftDate + 'T00:00:00').getFullYear();
            }
            await loadSchedule();
        } else {
            await loadMySchedule();
        }
    } catch (error) {
        console.error('Error saving scheduled shift:', error);
        showToast('Failed to save shift: ' + error.message, 'error');
    }
}

async function deleteScheduledShift(shiftId) {
    if (!confirm('Delete this scheduled shift?')) return;
    if (!supabaseClient) return;

    try {
        const { error } = await supabaseClient
            .from('scheduled_shifts')
            .delete()
            .eq('id', shiftId);
        if (error) throw error;
        showToast('Shift removed from schedule');
        if (userProfile?.role === 'admin') {
            await loadSchedule();
        } else {
            await loadMySchedule();
        }
    } catch (error) {
        console.error('Error deleting scheduled shift:', error);
        showToast('Failed to delete shift', 'error');
    }
}

// ---- Admin: navigation helpers ----

function scheduleNavigatePrev() {
    if (scheduleViewMode === 'week') {
        scheduleWeekStart.setDate(scheduleWeekStart.getDate() - 7);
    } else {
        scheduleMonth--;
        if (scheduleMonth < 0) { scheduleMonth = 11; scheduleYear--; }
    }
    loadSchedule();
}

function scheduleNavigateNext() {
    if (scheduleViewMode === 'week') {
        scheduleWeekStart.setDate(scheduleWeekStart.getDate() + 7);
    } else {
        scheduleMonth++;
        if (scheduleMonth > 11) { scheduleMonth = 0; scheduleYear++; }
    }
    loadSchedule();
}

function scheduleGoToday() {
    const now = new Date();
    scheduleWeekStart = getWeekStart(now);
    scheduleMonth = now.getMonth();
    scheduleYear = now.getFullYear();
    loadSchedule();
}

function setScheduleViewMode(mode) {
    scheduleViewMode = mode;
    const now = new Date();
    if (mode === 'month') {
        scheduleMonth = scheduleWeekStart.getMonth();
        scheduleYear = scheduleWeekStart.getFullYear();
    } else {
        if (scheduleYear === now.getFullYear() && scheduleMonth === now.getMonth()) {
            scheduleWeekStart = getWeekStart(now);
        } else {
            scheduleWeekStart = getWeekStart(new Date(scheduleYear, scheduleMonth, 1));
        }
    }
    loadSchedule();
}

// ==================== EMPLOYEE: MY SCHEDULE ====================

function getMyScheduleDateRange() {
    if (myScheduleViewMode === 'week') {
        return { start: myScheduleWeekStart, end: getWeekEnd(myScheduleWeekStart) };
    }
    const start = new Date(myScheduleYear, myScheduleMonth, 1);
    const firstDay = start.getDay();
    start.setDate(start.getDate() - firstDay);
    const end = new Date(myScheduleYear, myScheduleMonth + 1, 0);
    const lastDay = end.getDay();
    end.setDate(end.getDate() + (6 - lastDay));
    end.setHours(23, 59, 59, 999);
    return { start, end };
}

function updateMySchedulePeriodLabel() {
    const label = document.getElementById('my-schedule-period-label');
    if (!label) return;
    label.textContent = myScheduleViewMode === 'week'
        ? formatWeekLabel(myScheduleWeekStart)
        : formatMonthLabel(myScheduleYear, myScheduleMonth);
}

function updateMyScheduleViewPanels() {
    const weekPanel = document.getElementById('my-schedule-week-panel');
    const monthPanel = document.getElementById('my-schedule-month-panel');
    if (weekPanel) weekPanel.style.display = myScheduleViewMode === 'week' ? '' : 'none';
    if (monthPanel) monthPanel.style.display = myScheduleViewMode === 'month' ? '' : 'none';
    document.querySelectorAll('#my-schedule-view .schedule-toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === myScheduleViewMode);
    });
}

async function loadMySchedule() {
    if (!supabaseClient || !currentUser) return;

    updateMySchedulePeriodLabel();
    updateMyScheduleViewPanels();

    const { start, end } = getMyScheduleDateRange();
    const startStr = schedFormatDate(start);
    const endStr = schedFormatDate(end);

    try {
        const { data, error } = await supabaseClient
            .from('scheduled_shifts')
            .select('*')
            .eq('employee_id', currentUser.id)
            .gte('shift_date', startStr)
            .lte('shift_date', endStr)
            .order('shift_date')
            .order('start_time');

        if (error) throw error;
        myScheduleShifts = data || [];
    } catch (e) {
        console.error('Error loading my schedule:', e);
        myScheduleShifts = [];
    }

    if (myScheduleViewMode === 'week') {
        renderMyScheduleWeek();
    } else {
        renderMyScheduleMonth();
    }
}

function renderMyScheduleWeek() {
    const container = document.getElementById('my-schedule-list');
    if (!container) return;

    if (myScheduleShifts.length === 0) {
        container.innerHTML = `
            <div class="my-schedule-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <p>No shifts scheduled this week</p>
            </div>
        `;
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const grouped = {};
    myScheduleShifts.forEach(s => {
        if (!grouped[s.shift_date]) grouped[s.shift_date] = [];
        grouped[s.shift_date].push(s);
    });

    let html = '';
    for (let i = 0; i < 7; i++) {
        const d = new Date(myScheduleWeekStart);
        d.setDate(d.getDate() + i);
        const dateStr = schedFormatDate(d);
        const isToday = isSameDay(d, today);
        const dayShifts = grouped[dateStr] || [];

        html += `<div class="my-schedule-day">`;
        html += `<div class="my-schedule-day-header${isToday ? ' today' : ''}">`;
        html += `${dayNames[d.getDay()]}, ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        if (isToday) html += ' · Today';
        html += `</div>`;

        if (dayShifts.length === 0) {
            html += `<div style="padding: 8px 12px; color: var(--text-muted); font-size: 0.85rem;">No shifts</div>`;
        } else {
            const empRate = userProfile?.hourly_rate || 0;
            dayShifts.forEach(shift => {
                const decoded = decodeShiftNote(shift.note);
                const isTimeOff = decoded.type !== 'shift';

                if (isTimeOff) {
                    const typeLabel = getShiftTypeLabel(decoded.type);
                    html += `
                        <div class="my-schedule-shift-card timeoff-card${decoded.type === 'out_of_town' ? ' oot-card' : ''}">
                            <div>
                                <div class="my-schedule-shift-time">${typeLabel}</div>
                                ${decoded.note ? `<div class="my-schedule-shift-duration">${decoded.note}</div>` : '<div class="my-schedule-shift-duration">All day</div>'}
                            </div>
                        </div>
                    `;
                } else {
                    const durationHrs = calcShiftHours(shift.start_time, shift.end_time);
                    const cost = durationHrs * empRate;

                    html += `
                        <div class="my-schedule-shift-card${isToday ? ' today-shift' : ''}">
                            <div>
                                <div class="my-schedule-shift-time">${formatScheduleTime(shift.start_time)} – ${formatEndTime(shift.start_time, shift.end_time)}</div>
                                <div class="my-schedule-shift-duration">${durationHrs.toFixed(1)} hours${empRate ? ' · ' + formatCurrency(cost) : ''}</div>
                            </div>
                            ${decoded.note ? `<div class="my-schedule-shift-note">${decoded.note}</div>` : ''}
                        </div>
                    `;
                }
            });
        }
        html += `</div>`;
    }

    container.innerHTML = html;
}

function renderMyScheduleMonth() {
    const cal = document.getElementById('my-schedule-month-cal');
    if (!cal) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let html = '<div class="schedule-month-weekdays">';
    dayNames.forEach(d => { html += `<span>${d}</span>`; });
    html += '</div>';

    const firstOfMonth = new Date(myScheduleYear, myScheduleMonth, 1);
    const startDay = firstOfMonth.getDay();
    const daysInMonth = new Date(myScheduleYear, myScheduleMonth + 1, 0).getDate();
    const totalCells = Math.ceil((startDay + daysInMonth) / 7) * 7;

    html += '<div class="schedule-month-days">';
    for (let i = 0; i < totalCells; i++) {
        const d = new Date(myScheduleYear, myScheduleMonth, 1 - startDay + i);
        const dateStr = schedFormatDate(d);
        const isCurrentMonth = d.getMonth() === myScheduleMonth;
        const isToday = isSameDay(d, today);
        const dayShifts = myScheduleShifts.filter(s => s.shift_date === dateStr);

        html += `<div class="schedule-month-day${isCurrentMonth ? '' : ' other-month'}${isToday ? ' today' : ''}">`;
        html += `<span class="schedule-month-day-num">${d.getDate()}</span>`;
        html += '<div class="schedule-month-day-shifts my-schedule-month-day-shifts">';

        const myRate = userProfile?.hourly_rate || 0;
        dayShifts.forEach(shift => {
            const decoded = decodeShiftNote(shift.note);
            const isTimeOff = decoded.type !== 'shift';

            if (isTimeOff) {
                const typeLabel = getShiftTypeLabel(decoded.type);
                const isOOT = decoded.type === 'out_of_town';
                html += `
                    <div class="schedule-month-shift-pill timeoff-pill${isOOT ? ' oot-pill' : ''}" title="${typeLabel}${decoded.note ? ': ' + decoded.note : ''}">
                        <span class="pill-time">${isOOT ? '✈' : '🏖'}</span>
                        <span class="pill-name">${typeLabel}</span>
                    </div>
                `;
            } else {
                const cost = calcShiftCost(shift, myRate);
                html += `
                    <div class="schedule-month-shift-pill" style="background:rgba(0,212,170,0.12);color:#00d4aa;" title="${formatScheduleTime(shift.start_time)} – ${formatEndTime(shift.start_time, shift.end_time)}${myRate ? '\n' + formatCurrency(cost) : ''}${decoded.note ? '\n' + decoded.note : ''}">
                        <span class="pill-time">${formatScheduleTimeShort(shift.start_time)}–${formatEndTimeShort(shift.start_time, shift.end_time)}</span>
                        ${myRate ? `<span class="pill-cost">${formatCurrency(cost)}</span>` : ''}
                        ${decoded.note ? `<span class="pill-name">${decoded.note}</span>` : ''}
                    </div>
                `;
            }
        });

        html += '</div></div>';
    }
    html += '</div>';

    cal.innerHTML = html;
}

// ---- Employee: navigation helpers ----

function myScheduleNavigatePrev() {
    if (myScheduleViewMode === 'week') {
        myScheduleWeekStart.setDate(myScheduleWeekStart.getDate() - 7);
    } else {
        myScheduleMonth--;
        if (myScheduleMonth < 0) { myScheduleMonth = 11; myScheduleYear--; }
    }
    loadMySchedule();
}

function myScheduleNavigateNext() {
    if (myScheduleViewMode === 'week') {
        myScheduleWeekStart.setDate(myScheduleWeekStart.getDate() + 7);
    } else {
        myScheduleMonth++;
        if (myScheduleMonth > 11) { myScheduleMonth = 0; myScheduleYear++; }
    }
    loadMySchedule();
}

function myScheduleGoToday() {
    const now = new Date();
    myScheduleWeekStart = getWeekStart(now);
    myScheduleMonth = now.getMonth();
    myScheduleYear = now.getFullYear();
    loadMySchedule();
}

function setMyScheduleViewMode(mode) {
    myScheduleViewMode = mode;
    const now = new Date();
    if (mode === 'month') {
        myScheduleMonth = myScheduleWeekStart.getMonth();
        myScheduleYear = myScheduleWeekStart.getFullYear();
    } else {
        if (myScheduleYear === now.getFullYear() && myScheduleMonth === now.getMonth()) {
            myScheduleWeekStart = getWeekStart(now);
        } else {
            myScheduleWeekStart = getWeekStart(new Date(myScheduleYear, myScheduleMonth, 1));
        }
    }
    loadMySchedule();
}

// ==================== SCHEDULE EVENT LISTENERS ====================

function initScheduleEventListeners() {
    // Admin: view mode toggle
    document.getElementById('schedule-view-week')?.addEventListener('click', () => setScheduleViewMode('week'));
    document.getElementById('schedule-view-month')?.addEventListener('click', () => setScheduleViewMode('month'));

    // Admin: prev / next / today
    document.getElementById('schedule-prev')?.addEventListener('click', scheduleNavigatePrev);
    document.getElementById('schedule-next')?.addEventListener('click', scheduleNavigateNext);
    document.getElementById('schedule-today-btn')?.addEventListener('click', scheduleGoToday);
    document.getElementById('schedule-member-filter')?.addEventListener('change', () => loadSchedule());
    document.getElementById('schedule-shift-type-filter')?.addEventListener('change', (e) => {
        scheduleShiftTypeFilter = e.target.value;
        loadSchedule();
    });

    // Schedule shift modal
    document.getElementById('add-scheduled-shift-btn')?.addEventListener('click', () => openScheduleShiftModal());
    document.getElementById('close-schedule-shift-modal')?.addEventListener('click', closeScheduleShiftModal);
    document.getElementById('cancel-schedule-shift-btn')?.addEventListener('click', closeScheduleShiftModal);
    document.getElementById('schedule-shift-form')?.addEventListener('submit', saveScheduledShift);

    // Time Off modal
    document.getElementById('add-timeoff-btn')?.addEventListener('click', () => openTimeOffModal());
    document.getElementById('close-timeoff-modal')?.addEventListener('click', closeTimeOffModal);
    document.getElementById('cancel-timeoff-btn')?.addEventListener('click', closeTimeOffModal);
    document.getElementById('timeoff-form')?.addEventListener('submit', saveTimeOff);
    document.getElementById('timeoff-start-date')?.addEventListener('change', updateTimeOffDayCount);
    document.getElementById('timeoff-end-date')?.addEventListener('change', updateTimeOffDayCount);
    document.querySelectorAll('.timeoff-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.timeoff-type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('timeoff-type-value').value = btn.dataset.type;
        });
    });

    // Repeat toggle
    document.getElementById('schedule-shift-repeat')?.addEventListener('change', (e) => {
        document.getElementById('schedule-repeat-weeks-group').style.display = e.target.checked ? 'flex' : 'none';
    });

    // Time picker wrappers for schedule modal
    document.getElementById('sched-start-time-wrapper')?.addEventListener('click', () => {
        openTimePicker('schedule-shift-start', 'schedule-shift-start-display');
    });
    document.getElementById('sched-end-time-wrapper')?.addEventListener('click', () => {
        openTimePicker('schedule-shift-end', 'schedule-shift-end-display');
    });

    // Employee: view mode toggle
    document.getElementById('my-schedule-view-week')?.addEventListener('click', () => setMyScheduleViewMode('week'));
    document.getElementById('my-schedule-view-month')?.addEventListener('click', () => setMyScheduleViewMode('month'));

    // Employee: prev / next / today
    document.getElementById('my-schedule-prev')?.addEventListener('click', myScheduleNavigatePrev);
    document.getElementById('my-schedule-next')?.addEventListener('click', myScheduleNavigateNext);
    document.getElementById('my-schedule-today-btn')?.addEventListener('click', myScheduleGoToday);
}

document.addEventListener('DOMContentLoaded', () => {
    initScheduleEventListeners();
});

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
window.quickAddScheduleShift = quickAddScheduleShift;
window.openEditScheduleShift = openEditScheduleShift;
window.deleteScheduledShift = deleteScheduledShift;

