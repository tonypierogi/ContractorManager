// ==================== HASH-BASED ROUTER ====================

const EMPLOYEE_DEFAULT_VIEW = 'timesheet';
const ADMIN_DEFAULT_VIEW = 'team';

function setHash(viewId) {
    history.replaceState(null, '', '#' + viewId);
}

function getHashView() {
    const hash = location.hash.slice(1);
    return hash || null;
}

// Views that are sub-pages (no nav button); the parent nav button to keep highlighted
const SUB_VIEWS = {
    'my-task-detail': 'my-tasks',
    'tl-editor': 'task-lists',
    'sop-editor': 'sop',
};

function navigateToView(viewId, dashboard) {
    const prefix = dashboard === 'admin' ? '#admin-dashboard' : '#employee-dashboard';
    const navBtns = document.querySelectorAll(`${prefix} .nav-btn[data-view]`);
    const views = document.querySelectorAll(`${prefix} .view`);
    const targetView = document.getElementById(`${viewId}-view`);

    if (!targetView) return false;

    const parentViewId = SUB_VIEWS[viewId];
    const targetBtn = document.querySelector(`${prefix} .nav-btn[data-view="${parentViewId || viewId}"]`);

    navBtns.forEach(b => b.classList.remove('active'));
    views.forEach(v => v.classList.remove('active'));

    if (targetBtn) targetBtn.classList.add('active');
    targetView.classList.add('active');

    setHash(viewId);
    return true;
}

function restoreHashView() {
    const viewId = getHashView();
    if (!viewId) return;

    const role = userProfile?.role;
    const dashboard = role === 'admin' ? 'admin' : 'employee';

    if (navigateToView(viewId, dashboard)) {
        triggerViewLoad(viewId, dashboard);
    }
}

function triggerViewLoad(viewId, dashboard) {
    if (dashboard === 'employee') {
        if (viewId === 'sop-employee') loadEmployeeSopView();
        else if (viewId === 'my-tasks') loadMyTasks();
        else if (viewId === 'my-task-detail') { /* content loaded by openMyTaskChecklist */ }
        else if (viewId === 'my-schedule') loadMySchedule();
        else if (viewId === 'locations') initLocationsView('emp');
        else if (viewId === 'my-inventory') loadMyInventory();
    } else {
        if (viewId === 'timesheets') loadAllTimesheets();
        else if (viewId === 'team') loadTeamMembers();
        else if (viewId === 'schedule') loadSchedule();
        else if (viewId === 'sop') loadSopList();
        else if (viewId === 'equipment') loadEquipmentList();
        else if (viewId === 'task-lists') loadTaskLists();
        else if (viewId === 'admin-locations') initLocationsView('admin');
        else if (viewId === 'inventory') loadInventoryAdminView();
        else if (viewId === 'storage') loadStorageBrowser();
    }
}

window.addEventListener('hashchange', () => {
    const viewId = getHashView();
    if (!viewId) return;

    const role = userProfile?.role;
    const dashboard = role === 'admin' ? 'admin' : 'employee';

    if (navigateToView(viewId, dashboard)) {
        triggerViewLoad(viewId, dashboard);
    }
});
