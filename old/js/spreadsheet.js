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
