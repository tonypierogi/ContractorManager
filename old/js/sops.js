// ==================== SOP (Standard Operating Procedures) ====================

const SOP_STORAGE_BUCKET = 'sop-media';

function getTodayDateString() {
    // Local date, NOT toISOString() (UTC) - otherwise evening clock-ins in
    // US timezones create/fetch the daily SOP under tomorrow's date
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
}

async function getTodayDailySop() {
    const today = getTodayDateString();
    const { data, error } = await supabaseClient
        .from('daily_sops')
        .select('*, sop_templates(name)')
        .eq('date', today)
        .is('completed_at', null)
        .maybeSingle();
    if (error) {
        console.error('getTodayDailySop error', error);
        showToast(`Couldn't load today's checklist: ${error.message}`, 'error');
        return null;
    }
    return data;
}

async function createDailySop(sopTemplateId) {
    const today = getTodayDateString();
    const { data, error } = await supabaseClient
        .from('daily_sops')
        .insert({
            date: today,
            sop_template_id: sopTemplateId,
            created_by: currentUser.id
        })
        .select('*, sop_templates(name)')
        .single();
    if (error) throw error;
    return data;
}

async function showSopFlowAfterClockIn() {
    const daily = await getTodayDailySop();
    if (daily) {
        showSopChecklistPanel(daily);
        return;
    }
    const { data: templates } = await supabaseClient.from('sop_templates').select('id, name').order('name');
    if (!templates || templates.length === 0) {
        return;
    }
    showSelectSopModal(templates);
}

function showSelectSopModal(templates) {
    const modal = document.getElementById('select-sop-modal');
    const list = document.getElementById('sop-select-list');
    list.innerHTML = templates.map(t =>
        `<button type="button" class="sop-select-card" data-sop-id="${t.id}">${escapeHtml(t.name)}</button>`
    ).join('');
    list.querySelectorAll('.sop-select-card').forEach(btn => {
        btn.addEventListener('click', async () => {
            try {
                const daily = await createDailySop(btn.dataset.sopId);
                modal.classList.remove('active');
                showSopChecklistPanel(daily);
            } catch (e) {
                console.error(e);
                showToast('Failed to set today\'s checklist', 'error');
            }
        });
    });
    modal.classList.add('active');
}

function hideSopChecklistPanel() {
    const panel = document.getElementById('sop-checklist-panel');
    if (panel) panel.style.display = 'none';
}

function showSopChecklistPanel(dailySop) {
    const panel = document.getElementById('sop-checklist-panel');
    const titleEl = document.getElementById('sop-checklist-title');
    if (!panel || !titleEl) return;
    titleEl.textContent = dailySop.sop_templates?.name || 'Checklist';
    panel.style.display = 'block';
    loadSopChecklistItems(dailySop.id);
}

async function loadSopChecklistPanelIfClockedIn() {
    if (!currentClockIn) return;
    const daily = await getTodayDailySop();
    if (daily) showSopChecklistPanel(daily);
}

function sortSopItemsUncheckedFirst(items, checkMap) {
    const isTask = (it) => (it.item_type || 'task') === 'task';
    const checkKey = (it) => it._adHoc ? 'adhoc_' + it.id : it.id;
    const unchecked = [];
    const checked = [];
    for (const item of items) {
        if (!isTask(item)) {
            unchecked.push(item);
        } else if (checkMap[checkKey(item)]) {
            checked.push(item);
        } else {
            unchecked.push(item);
        }
    }
    if (checked.length > 0) {
        return [...unchecked, { _divider: true, _count: checked.length }, ...checked];
    }
    return unchecked;
}

async function loadLatestSopComments(sopItemIds) {
    if (!sopItemIds || !sopItemIds.length) return {};
    const { data } = await supabaseClient
        .from('sop_task_comments')
        .select('sop_item_id, comment, created_at, daily_sop_id')
        .in('sop_item_id', sopItemIds)
        .order('created_at', { ascending: false });
    const map = {};
    (data || []).forEach(c => {
        if (!map[c.sop_item_id]) map[c.sop_item_id] = c;
    });
    return map;
}

function renderSopChecklistItemHtml(item, dailySopId, checkMap, names, eqMap, opts) {
    const { isAdmin, commentMap } = opts || {};
    if (item._divider) {
        return `<div class="sop-completed-divider"><span>Completed (${item._count})</span></div>`;
    }
    if (item._adHocHeader) {
        return `<div class="sop-checklist-section-header sop-adhoc-header">Ad Hoc Tasks</div>`;
    }
    const isTask = (it) => (it.item_type || 'task') === 'task';
    if (!isTask(item)) {
        return `<div class="sop-checklist-section-header" data-daily-sop-id="${dailySopId}" data-item-id="${item.id}">${escapeHtml(item.title)}</div>`;
    }
    const adHoc = !!item._adHoc;
    const checkKey = adHoc ? 'adhoc_' + item.id : item.id;
    const c = checkMap[checkKey];
    const checked = !!c;
    const who = c && names[c.checked_by] ? names[c.checked_by] : '';
    const media = Array.isArray(item.media) ? item.media : [];
    const eqIds = Array.isArray(item.equipment) ? item.equipment : [];
    const locationLabel = item.location ? getLocationLabel(item.location) : '';
    const hasDetails = item.description || media.length || eqIds.length;

    const mediaHtml = media.length ? media.map(m => {
        if ((m.type || '').toLowerCase() === 'video') return `<video controls src="${escapeHtml(m.url)}" class="sop-checklist-media"></video>`;
        return `<img src="${escapeHtml(m.url)}" alt="" class="sop-checklist-media">`;
    }).join('') : '';
    const equipHtml = eqIds.length ? `<div class="sop-checklist-equipment">${eqIds.map(eqId => {
        const eq = eqMap[eqId];
        if (!eq) return '';
        return `<div class="sop-checklist-equip-item">
            ${eq.image_url ? `<img src="${escapeHtml(eq.image_url)}" alt="">` : ''}
            <div class="sop-checklist-equip-info">
                <div class="sop-checklist-equip-name">${escapeHtml(eq.name)}</div>
                ${eq.location ? `<div class="sop-checklist-equip-location">${escapeHtml(eq.location)}</div>` : ''}
            </div>
        </div>`;
    }).join('')}</div>` : '';

    const adminComment = (commentMap && !adHoc) ? commentMap[item.id] : null;
    const commentHtml = adminComment ? `
        <div class="sop-admin-comment">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>${escapeHtml(adminComment.comment)}</span>
        </div>` : '';

    const detailsHtml = hasDetails ? `
        <div class="sop-item-details" style="display:none;">
            ${item.description ? `<p class="sop-item-desc">${escapeHtml(item.description)}</p>` : ''}
            ${mediaHtml ? `<div class="sop-item-media-wrap">${mediaHtml}</div>` : ''}
            ${equipHtml}
        </div>` : '';

    const toggleBtn = hasDetails ? `<button type="button" class="sop-details-toggle" aria-label="Toggle details">Details <svg class="sop-toggle-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg></button>` : '';

    const deleteBtn = (adHoc && isAdmin && !checked)
        ? `<button type="button" class="btn btn-close sop-adhoc-delete-btn" title="Remove ad hoc task">&times;</button>`
        : '';

    const actionHtml = checked
        ? `<span class="sop-checked-badge" title="${who ? 'By ' + escapeHtml(who) : ''}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg></span>`
        : `<button type="button" class="btn btn-primary btn-sm sop-check-btn">Done</button>`;

    return `
        <div class="sop-checklist-item ${checked ? 'checked' : ''} ${adHoc ? 'sop-adhoc-item' : ''} ${adminComment ? 'has-comment' : ''}" data-daily-sop-id="${dailySopId}" data-item-id="${item.id}" ${adHoc ? 'data-adhoc="1"' : ''}>
            <div class="sop-item-row">
                <label class="sop-checkbox-label">
                    <input type="checkbox" class="sop-item-check" ${checked ? 'checked disabled' : ''}>
                    <span class="sop-item-title-wrap">
                        <span class="sop-item-title">${escapeHtml(item.title)}</span>
                        ${locationLabel ? `<span class="sop-item-location-badge">${escapeHtml(locationLabel)}</span>` : ''}
                        ${checked && who ? `<span class="sop-completed-by">by ${escapeHtml(who)}</span>` : ''}
                    </span>
                </label>
                <div class="sop-item-actions">
                    ${deleteBtn}
                    ${toggleBtn}
                    ${actionHtml}
                </div>
            </div>
            ${commentHtml}
            ${detailsHtml}
        </div>`;
}

function bindSopCheckButtons(container, reloadFn) {
    container.querySelectorAll('.sop-check-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const row = btn.closest('.sop-checklist-item');
            const dailyId = row.dataset.dailySopId;
            const itemId = row.dataset.itemId;
            const isAdHoc = row.dataset.adhoc === '1';
            btn.disabled = true;
            btn.textContent = '...';
            try {
                const payload = {
                    daily_sop_id: dailyId,
                    checked_by: currentUser.id
                };
                if (isAdHoc) {
                    payload.ad_hoc_task_id = itemId;
                } else {
                    payload.sop_item_id = itemId;
                }
                await supabaseClient.from('sop_item_checks').insert(payload);
                reloadFn(dailyId);
            } catch (e) {
                showToast('Failed to check off', 'error');
                btn.disabled = false;
                btn.textContent = 'Done';
            }
        });
    });
    container.querySelectorAll('.sop-details-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const item = btn.closest('.sop-checklist-item');
            const details = item.querySelector('.sop-item-details');
            if (!details) return;
            const open = details.style.display !== 'none';
            details.style.display = open ? 'none' : 'block';
            btn.classList.toggle('open', !open);
        });
    });
    container.querySelectorAll('.sop-adhoc-delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const row = btn.closest('.sop-checklist-item');
            const dailyId = row.dataset.dailySopId;
            const taskId = row.dataset.itemId;
            if (!confirm('Remove this ad hoc task?')) return;
            btn.disabled = true;
            try {
                await supabaseClient.from('ad_hoc_tasks').delete().eq('id', taskId);
                reloadFn(dailyId);
            } catch (e) {
                showToast('Failed to delete task', 'error');
                btn.disabled = false;
            }
        });
    });
}

async function loadSopChecklistItems(dailySopId) {
    const container = document.getElementById('sop-checklist-items');
    if (!container) return;
    const { data: dailyData } = await supabaseClient
        .from('daily_sops')
        .select('sop_template_id')
        .eq('id', dailySopId)
        .single();
    if (!dailyData) return;
    const { data: items } = await supabaseClient
        .from('sop_items')
        .select('*')
        .eq('sop_template_id', dailyData.sop_template_id)
        .order('sort_order');
    const { data: adHocTasks } = await supabaseClient
        .from('ad_hoc_tasks')
        .select('*')
        .eq('daily_sop_id', dailySopId)
        .order('sort_order');
    const { data: checks } = await supabaseClient
        .from('sop_item_checks')
        .select('sop_item_id, ad_hoc_task_id, checked_by, checked_at, profiles(first_name, last_name)')
        .eq('daily_sop_id', dailySopId);

    const allEqIds = new Set();
    (items || []).forEach(item => {
        (item.equipment || []).forEach(id => allEqIds.add(id));
    });
    let eqMap = {};
    if (allEqIds.size) {
        const { data: eqData } = await supabaseClient
            .from('equipment')
            .select('*')
            .in('id', [...allEqIds]);
        (eqData || []).forEach(eq => { eqMap[eq.id] = eq; });
    }

    const checkMap = {};
    (checks || []).forEach(c => {
        if (c.sop_item_id) checkMap[c.sop_item_id] = c;
        if (c.ad_hoc_task_id) checkMap['adhoc_' + c.ad_hoc_task_id] = c;
    });
    const names = {};
    (checks || []).forEach(c => {
        if (c.profiles) names[c.checked_by] = [c.profiles.first_name, c.profiles.last_name].filter(Boolean).join(' ') || 'Someone';
    });

    const sopItemIds = (items || []).filter(it => (it.item_type || 'task') === 'task').map(it => it.id);
    const commentMap = await loadLatestSopComments(sopItemIds);

    const isAdmin = userProfile?.role === 'admin';
    const renderOpts = { isAdmin, commentMap };
    const sorted = sortSopItemsUncheckedFirst(items || [], checkMap);
    const adHocItems = (adHocTasks || []).map(t => ({ ...t, item_type: 'task', _adHoc: true }));
    const adHocSorted = sortSopItemsUncheckedFirst(adHocItems, checkMap);

    let html = '';
    if (isAdmin) {
        html += renderAdHocAddButton(dailySopId);
    }
    html += sorted.map(item => renderSopChecklistItemHtml(item, dailySopId, checkMap, names, eqMap, renderOpts)).join('');
    if (adHocItems.length) {
        html += renderSopChecklistItemHtml({ _adHocHeader: true }, dailySopId, checkMap, names, eqMap, renderOpts);
        html += adHocSorted.map(item => renderSopChecklistItemHtml(item, dailySopId, checkMap, names, eqMap, renderOpts)).join('');
    }
    container.innerHTML = html;
    bindSopCheckButtons(container, (dailyId) => {
        loadSopChecklistItems(dailyId);
    });
    bindAdHocAddForm(container, (dailyId) => {
        loadSopChecklistItems(dailyId);
    });
}

// --- Employee SOP Tab ---
async function loadEmployeeSopView() {
    const pickEl = document.getElementById('sop-pick-template');
    const activeEl = document.getElementById('sop-active-checklist');
    const emptyEl = document.getElementById('sop-no-templates');
    const completeEl = document.getElementById('sop-today-complete');
    if (!pickEl || !activeEl || !emptyEl) return;

    const dateEl = document.getElementById('sop-current-date');
    if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }

    pickEl.style.display = 'none';
    activeEl.style.display = 'none';
    emptyEl.style.display = 'none';
    if (completeEl) completeEl.style.display = 'none';

    loadEmployeeCompletedSops();

    const daily = await getTodayDailySop();
    if (daily) {
        showEmployeeSopChecklist(daily);
        return;
    }

    const today = getTodayDateString();
    const { data: todayCompleted } = await supabaseClient
        .from('daily_sops')
        .select('id')
        .eq('date', today)
        .not('completed_at', 'is', null)
        .limit(1);
    if (todayCompleted && todayCompleted.length && completeEl) {
        completeEl.style.display = 'block';
    }

    const { data: templates } = await supabaseClient
        .from('sop_templates')
        .select('id, name, description')
        .order('name');

    if (!templates || templates.length === 0) {
        if (!completeEl || completeEl.style.display === 'none') {
            emptyEl.style.display = 'block';
        }
        return;
    }

    renderSopTemplateGrid(templates);
    pickEl.style.display = 'block';
}

async function loadEmployeeCompletedSops() {
    const container = document.getElementById('sop-employee-completed-list');
    if (!container) return;
    const { data, error } = await supabaseClient
        .from('daily_sops')
        .select('id, date, completed_at, sop_templates(name)')
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(50);
    if (error) {
        container.innerHTML = '<p class="text-muted">Failed to load completed SOPs.</p>';
        return;
    }
    if (!data || data.length === 0) {
        container.innerHTML = '<p class="text-muted">No completed SOPs yet.</p>';
        return;
    }
    container.innerHTML = data.map(d => {
        const dateStr = d.date ? new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '';
        const completedStr = d.completed_at ? new Date(d.completed_at).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }) : '';
        const name = (d.sop_templates && d.sop_templates.name) ? escapeHtml(d.sop_templates.name) : 'Checklist';
        return `<div class="sop-completed-card">
            <div class="sop-completed-info">
                <strong>${name}</strong>
                <span class="sop-completed-date">${escapeHtml(dateStr)}</span>
                <span class="sop-completed-at">Completed ${escapeHtml(completedStr)}</span>
            </div>
        </div>`;
    }).join('');
}

function renderSopTemplateGrid(templates) {
    const grid = document.getElementById('sop-template-grid');
    if (!grid) return;
    grid.innerHTML = templates.map(t => `
        <button type="button" class="sop-template-card" data-sop-id="${t.id}">
            <div class="sop-template-card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 11l3 3L22 4"></path>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                </svg>
            </div>
            <div class="sop-template-card-name">${escapeHtml(t.name)}</div>
            ${t.description ? `<div class="sop-template-card-desc">${escapeHtml(t.description)}</div>` : ''}
        </button>
    `).join('');

    grid.querySelectorAll('.sop-template-card').forEach(btn => {
        btn.addEventListener('click', async () => {
            const name = btn.querySelector('.sop-template-card-name')?.textContent || 'this SOP';
            const confirmed = await showConfirmModal(
                'Start SOP',
                `Start "${name}" as today's checklist? Your entire team will see and share it.`,
                { okLabel: 'Start', okClass: 'btn-primary' }
            );
            if (!confirmed) return;
            btn.disabled = true;
            btn.classList.add('loading');
            try {
                const daily = await createDailySop(btn.dataset.sopId);
                showEmployeeSopChecklist(daily);
                showSopChecklistPanel(daily);
            } catch (e) {
                console.error(e);
                showToast('Failed to start checklist', 'error');
            } finally {
                btn.disabled = false;
                btn.classList.remove('loading');
            }
        });
    });
}

let activeEmployeeDailySopId = null;

function showEmployeeSopChecklist(dailySop) {
    const pickEl = document.getElementById('sop-pick-template');
    const activeEl = document.getElementById('sop-active-checklist');
    const emptyEl = document.getElementById('sop-no-templates');
    const completeEl = document.getElementById('sop-today-complete');
    if (pickEl) pickEl.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'none';
    if (completeEl) completeEl.style.display = 'none';
    if (activeEl) activeEl.style.display = 'block';

    activeEmployeeDailySopId = dailySop.id;

    const nameEl = document.getElementById('sop-active-name');
    const dateEl = document.getElementById('sop-active-date');
    if (nameEl) nameEl.textContent = dailySop.sop_templates?.name || 'Checklist';
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    loadEmployeeSopChecklistItems(dailySop.id);
}

document.getElementById('sop-mark-done-btn')?.addEventListener('click', async () => {
    if (!activeEmployeeDailySopId) return;
    const btn = document.getElementById('sop-mark-done-btn');
    if (btn) btn.disabled = true;
    try {
        const { error } = await supabaseClient
            .from('daily_sops')
            .update({ completed_at: new Date().toISOString() })
            .eq('id', activeEmployeeDailySopId);
        if (error) throw error;

        activeEmployeeDailySopId = null;
        hideSopChecklistPanel();

        // Immediately flip the UI to the complete state without re-querying the DB,
        // so a slow or failed refetch cannot put the active checklist back.
        const pickEl = document.getElementById('sop-pick-template');
        const activeEl = document.getElementById('sop-active-checklist');
        const emptyEl = document.getElementById('sop-no-templates');
        const completeEl = document.getElementById('sop-today-complete');
        if (pickEl) pickEl.style.display = 'none';
        if (activeEl) activeEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'none';
        if (completeEl) completeEl.style.display = 'block';

        showToast('SOP marked as done!');
        loadEmployeeCompletedSops();
    } catch (e) {
        console.error(e);
        showToast('Failed to mark SOP as done', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
});

document.getElementById('sop-cancel-btn')?.addEventListener('click', async () => {
    if (!activeEmployeeDailySopId) return;
    const confirmed = await showConfirmModal(
        'Cancel SOP',
        'Are you sure you want to cancel this checklist? All progress will be lost.',
        { okLabel: 'Cancel SOP', okClass: 'btn-danger' }
    );
    if (!confirmed) return;
    try {
        await supabaseClient.from('daily_sops').delete().eq('id', activeEmployeeDailySopId);
        activeEmployeeDailySopId = null;
        hideSopChecklistPanel();
        showToast('Checklist cancelled');
        loadEmployeeSopView();
    } catch (e) {
        console.error(e);
        showToast('Failed to cancel checklist', 'error');
    }
});

async function loadEmployeeSopChecklistItems(dailySopId) {
    const container = document.getElementById('sop-employee-checklist-items');
    if (!container) return;

    const { data: dailyData } = await supabaseClient
        .from('daily_sops')
        .select('sop_template_id, completed_at')
        .eq('id', dailySopId)
        .single();
    if (!dailyData) return;

    const { data: items } = await supabaseClient
        .from('sop_items')
        .select('*')
        .eq('sop_template_id', dailyData.sop_template_id)
        .order('sort_order');
    const { data: adHocTasks } = await supabaseClient
        .from('ad_hoc_tasks')
        .select('*')
        .eq('daily_sop_id', dailySopId)
        .order('sort_order');
    const { data: checks } = await supabaseClient
        .from('sop_item_checks')
        .select('sop_item_id, ad_hoc_task_id, checked_by, checked_at, profiles(first_name, last_name)')
        .eq('daily_sop_id', dailySopId);

    const allEqIds = new Set();
    (items || []).forEach(item => {
        (item.equipment || []).forEach(id => allEqIds.add(id));
    });
    let eqMap = {};
    if (allEqIds.size) {
        const { data: eqData } = await supabaseClient
            .from('equipment')
            .select('*')
            .in('id', [...allEqIds]);
        (eqData || []).forEach(eq => { eqMap[eq.id] = eq; });
    }

    const checkMap = {};
    (checks || []).forEach(c => {
        if (c.sop_item_id) checkMap[c.sop_item_id] = c;
        if (c.ad_hoc_task_id) checkMap['adhoc_' + c.ad_hoc_task_id] = c;
    });
    const names = {};
    (checks || []).forEach(c => {
        if (c.profiles) names[c.checked_by] = [c.profiles.first_name, c.profiles.last_name].filter(Boolean).join(' ') || 'Someone';
    });

    const adHocItems = (adHocTasks || []).map(t => ({ ...t, item_type: 'task', _adHoc: true }));

    const taskItems = (items || []).filter(it => (it.item_type || 'task') === 'task');
    const totalTasks = taskItems.length + adHocItems.length;
    const checkedTasks = taskItems.filter(it => !!checkMap[it.id]).length
        + adHocItems.filter(it => !!checkMap['adhoc_' + it.id]).length;
    updateSopProgress(checkedTasks, totalTasks);

    const markDoneBtn = document.getElementById('sop-mark-done-btn');
    if (markDoneBtn) {
        markDoneBtn.style.display = (totalTasks > 0 && checkedTasks === totalTasks && !dailyData.completed_at) ? 'block' : 'none';
    }

    const commentMap = await loadLatestSopComments(taskItems.map(it => it.id));

    const isAdmin = userProfile?.role === 'admin';
    const renderOpts = { isAdmin, commentMap };
    const sorted = sortSopItemsUncheckedFirst(items || [], checkMap);
    const adHocSorted = sortSopItemsUncheckedFirst(adHocItems, checkMap);

    let html = '';
    if (isAdmin) {
        html += renderAdHocAddButton(dailySopId);
    }
    html += sorted.map(item => renderSopChecklistItemHtml(item, dailySopId, checkMap, names, eqMap, renderOpts)).join('');
    if (adHocItems.length) {
        html += renderSopChecklistItemHtml({ _adHocHeader: true }, dailySopId, checkMap, names, eqMap, renderOpts);
        html += adHocSorted.map(item => renderSopChecklistItemHtml(item, dailySopId, checkMap, names, eqMap, renderOpts)).join('');
    }
    container.innerHTML = html;
    bindSopCheckButtons(container, (dailyId) => {
        loadEmployeeSopChecklistItems(dailyId);
        const panel = document.getElementById('sop-checklist-panel');
        if (panel && panel.style.display !== 'none') {
            loadSopChecklistItems(dailyId);
        }
    });
    bindAdHocAddForm(container, (dailyId) => {
        loadEmployeeSopChecklistItems(dailyId);
        const panel = document.getElementById('sop-checklist-panel');
        if (panel && panel.style.display !== 'none') {
            loadSopChecklistItems(dailyId);
        }
    });
}

function renderAdHocAddButton(dailySopId) {
    return `
        <div class="sop-adhoc-add" data-daily-sop-id="${dailySopId}">
            <button type="button" class="btn btn-secondary btn-sm sop-adhoc-add-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Add Ad Hoc Task
            </button>
            <form class="sop-adhoc-form" style="display:none;">
                <input type="text" class="sop-adhoc-title-input" placeholder="Task title" required>
                <input type="text" class="sop-adhoc-desc-input" placeholder="Description (optional)">
                <div class="sop-adhoc-form-actions">
                    <button type="button" class="btn btn-secondary btn-sm sop-adhoc-cancel-btn">Cancel</button>
                    <button type="submit" class="btn btn-primary btn-sm">Add</button>
                </div>
            </form>
        </div>`;
}

function bindAdHocAddForm(container, reloadFn) {
    container.querySelectorAll('.sop-adhoc-add').forEach(wrapper => {
        const dailyId = wrapper.dataset.dailySopId;
        const addBtn = wrapper.querySelector('.sop-adhoc-add-btn');
        const form = wrapper.querySelector('.sop-adhoc-form');
        const cancelBtn = wrapper.querySelector('.sop-adhoc-cancel-btn');
        const titleInput = wrapper.querySelector('.sop-adhoc-title-input');

        addBtn.addEventListener('click', () => {
            addBtn.style.display = 'none';
            form.style.display = 'flex';
            titleInput.focus();
        });
        cancelBtn.addEventListener('click', () => {
            form.style.display = 'none';
            addBtn.style.display = '';
            form.reset();
        });
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = titleInput.value.trim();
            if (!title) return;
            const desc = wrapper.querySelector('.sop-adhoc-desc-input').value.trim() || null;
            const submitBtn = form.querySelector('[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = '...';
            try {
                const { data: existing } = await supabaseClient
                    .from('ad_hoc_tasks')
                    .select('sort_order')
                    .eq('daily_sop_id', dailyId)
                    .order('sort_order', { ascending: false })
                    .limit(1);
                const nextOrder = (existing && existing.length ? existing[0].sort_order + 1 : 0);
                await supabaseClient.from('ad_hoc_tasks').insert({
                    daily_sop_id: dailyId,
                    title,
                    description: desc,
                    sort_order: nextOrder,
                    created_by: currentUser.id
                });
                showToast('Ad hoc task added');
                reloadFn(dailyId);
            } catch (err) {
                console.error(err);
                showToast('Failed to add task', 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Add';
            }
        });
    });
}

function updateSopProgress(checked, total) {
    const bar = document.getElementById('sop-progress-fill');
    const text = document.getElementById('sop-progress-text');
    if (!bar || !text) return;
    const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
    bar.style.width = pct + '%';
    text.textContent = `${checked} of ${total} tasks complete (${pct}%)`;
    if (pct === 100) {
        bar.classList.add('complete');
    } else {
        bar.classList.remove('complete');
    }
}

document.getElementById('sop-employee-refresh')?.addEventListener('click', () => {
    loadEmployeeSopView();
});

// --- Admin SOP ---
async function loadAdminDailyChecklist() {
    const panel = document.getElementById('sop-admin-daily-panel');
    if (!panel) return;
    const daily = await getTodayDailySop();
    if (!daily) {
        panel.style.display = 'none';
        return;
    }
    panel.style.display = 'block';
    const nameEl = document.getElementById('sop-admin-daily-name');
    const dateEl = document.getElementById('sop-admin-daily-date');
    if (nameEl) nameEl.textContent = (daily.sop_templates?.name || 'Checklist') + ' — Today';
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    const container = document.getElementById('sop-admin-checklist-items');
    if (!container) return;
    const dailySopId = daily.id;

    const { data: items } = await supabaseClient
        .from('sop_items')
        .select('*')
        .eq('sop_template_id', daily.sop_template_id)
        .order('sort_order');
    const { data: adHocTasks } = await supabaseClient
        .from('ad_hoc_tasks')
        .select('*')
        .eq('daily_sop_id', dailySopId)
        .order('sort_order');
    const { data: checks } = await supabaseClient
        .from('sop_item_checks')
        .select('sop_item_id, ad_hoc_task_id, checked_by, checked_at, profiles(first_name, last_name)')
        .eq('daily_sop_id', dailySopId);

    const allEqIds = new Set();
    (items || []).forEach(item => { (item.equipment || []).forEach(id => allEqIds.add(id)); });
    let eqMap = {};
    if (allEqIds.size) {
        const { data: eqData } = await supabaseClient.from('equipment').select('*').in('id', [...allEqIds]);
        (eqData || []).forEach(eq => { eqMap[eq.id] = eq; });
    }

    const checkMap = {};
    (checks || []).forEach(c => {
        if (c.sop_item_id) checkMap[c.sop_item_id] = c;
        if (c.ad_hoc_task_id) checkMap['adhoc_' + c.ad_hoc_task_id] = c;
    });
    const names = {};
    (checks || []).forEach(c => {
        if (c.profiles) names[c.checked_by] = [c.profiles.first_name, c.profiles.last_name].filter(Boolean).join(' ') || 'Someone';
    });

    const adHocItems = (adHocTasks || []).map(t => ({ ...t, item_type: 'task', _adHoc: true }));
    const taskItems = (items || []).filter(it => (it.item_type || 'task') === 'task');
    const totalTasks = taskItems.length + adHocItems.length;
    const checkedTasks = taskItems.filter(it => !!checkMap[it.id]).length
        + adHocItems.filter(it => !!checkMap['adhoc_' + it.id]).length;

    const bar = document.getElementById('sop-admin-progress-fill');
    const text = document.getElementById('sop-admin-progress-text');
    if (bar && text) {
        const pct = totalTasks > 0 ? Math.round((checkedTasks / totalTasks) * 100) : 0;
        bar.style.width = pct + '%';
        text.textContent = `${checkedTasks} of ${totalTasks} tasks complete (${pct}%)`;
        bar.classList.toggle('complete', pct === 100);
    }

    const commentMap = await loadLatestSopComments(taskItems.map(it => it.id));

    const renderOpts = { isAdmin: true, commentMap };
    const sorted = sortSopItemsUncheckedFirst(items || [], checkMap);
    const adHocSorted = sortSopItemsUncheckedFirst(adHocItems, checkMap);

    let html = renderAdHocAddButton(dailySopId);
    html += sorted.map(item => renderSopChecklistItemHtml(item, dailySopId, checkMap, names, eqMap, renderOpts)).join('');
    if (adHocItems.length) {
        html += renderSopChecklistItemHtml({ _adHocHeader: true }, dailySopId, checkMap, names, eqMap, renderOpts);
        html += adHocSorted.map(item => renderSopChecklistItemHtml(item, dailySopId, checkMap, names, eqMap, renderOpts)).join('');
    }
    container.innerHTML = html;
    bindSopCheckButtons(container, () => loadAdminDailyChecklist());
    bindAdHocAddForm(container, () => loadAdminDailyChecklist());
}

document.getElementById('sop-admin-daily-refresh')?.addEventListener('click', () => loadAdminDailyChecklist());

async function loadSopCompletedList() {
    const container = document.getElementById('sop-completed-list');
    if (!container) return;
    const { data, error } = await supabaseClient
        .from('daily_sops')
        .select('id, date, completed_at, sop_templates(name)')
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(100);
    if (error) {
        container.innerHTML = '<p class="text-muted">Failed to load completed checklists.</p>';
        return;
    }
    if (!data || data.length === 0) {
        container.innerHTML = '<p class="text-muted">No completed checklists yet.</p>';
        return;
    }
    container.innerHTML = data.map(d => {
        const dateStr = d.date ? new Date(d.date + 'Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '';
        const completedStr = d.completed_at ? new Date(d.completed_at).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }) : '';
        const name = (d.sop_templates && d.sop_templates.name) ? escapeHtml(d.sop_templates.name) : 'Checklist';
        return `<div class="sop-completed-card sop-completed-card-reviewable" data-daily-sop-id="${d.id}">
            <div class="sop-completed-info">
                <strong>${name}</strong>
                <span class="sop-completed-date">${escapeHtml(dateStr)}</span>
                <span class="sop-completed-at">Completed ${escapeHtml(completedStr)}</span>
            </div>
            <button type="button" class="btn btn-secondary btn-sm sop-review-btn" data-daily-sop-id="${d.id}">Review</button>
        </div>`;
    }).join('');
    container.querySelectorAll('.sop-review-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openSopReviewModal(btn.dataset.dailySopId);
        });
    });
}

// --- Admin SOP Review ---

async function openSopReviewModal(dailySopId) {
    const modal = document.getElementById('sop-review-modal');
    const titleEl = document.getElementById('sop-review-title');
    const metaEl = document.getElementById('sop-review-meta');
    const itemsEl = document.getElementById('sop-review-items');
    if (!modal || !itemsEl) return;

    itemsEl.innerHTML = '<p class="text-muted">Loading...</p>';
    metaEl.innerHTML = '';
    titleEl.textContent = 'Review Completed SOP';
    modal.classList.add('active');

    const { data: daily } = await supabaseClient
        .from('daily_sops')
        .select('id, date, completed_at, sop_template_id, sop_templates(name)')
        .eq('id', dailySopId)
        .single();
    if (!daily) {
        itemsEl.innerHTML = '<p class="text-muted">Failed to load SOP data.</p>';
        return;
    }

    const sopName = daily.sop_templates?.name || 'Checklist';
    const dateStr = daily.date ? new Date(daily.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '';
    const completedStr = daily.completed_at ? new Date(daily.completed_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '';
    titleEl.textContent = `Review: ${sopName}`;
    metaEl.innerHTML = `<span class="sop-review-date">${escapeHtml(dateStr)}</span><span class="sop-review-completed">Completed ${escapeHtml(completedStr)}</span>`;

    const { data: items } = await supabaseClient
        .from('sop_items')
        .select('*')
        .eq('sop_template_id', daily.sop_template_id)
        .order('sort_order');
    const { data: adHocTasks } = await supabaseClient
        .from('ad_hoc_tasks')
        .select('*')
        .eq('daily_sop_id', dailySopId)
        .order('sort_order');
    const { data: checks } = await supabaseClient
        .from('sop_item_checks')
        .select('sop_item_id, ad_hoc_task_id, checked_by, checked_at, profiles(first_name, last_name)')
        .eq('daily_sop_id', dailySopId);

    const { data: existingComments } = await supabaseClient
        .from('sop_task_comments')
        .select('*')
        .eq('daily_sop_id', dailySopId);

    const commentMap = {};
    (existingComments || []).forEach(c => {
        commentMap[c.sop_item_id] = c;
    });

    const checkMap = {};
    (checks || []).forEach(c => {
        if (c.sop_item_id) checkMap[c.sop_item_id] = c;
        if (c.ad_hoc_task_id) checkMap['adhoc_' + c.ad_hoc_task_id] = c;
    });
    const names = {};
    (checks || []).forEach(c => {
        if (c.profiles) names[c.checked_by] = [c.profiles.first_name, c.profiles.last_name].filter(Boolean).join(' ') || 'Someone';
    });

    let html = '';
    (items || []).forEach(item => {
        const isTask = (item.item_type || 'task') === 'task';
        if (!isTask) {
            html += `<div class="sop-review-section-header">${escapeHtml(item.title)}</div>`;
            return;
        }
        const c = checkMap[item.id];
        const checked = !!c;
        const who = c ? (names[c.checked_by] || 'Someone') : '';
        const when = c ? new Date(c.checked_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
        const existingComment = commentMap[item.id]?.comment || '';
        html += `
            <div class="sop-review-item" data-sop-item-id="${item.id}">
                <div class="sop-review-item-header">
                    <span class="sop-review-check ${checked ? 'done' : 'missed'}">
                        ${checked
                            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>'
                            : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>'}
                    </span>
                    <span class="sop-review-item-title">${escapeHtml(item.title)}</span>
                    ${checked ? `<span class="sop-review-item-who">by ${escapeHtml(who)} at ${escapeHtml(when)}</span>` : '<span class="sop-review-item-who missed">not completed</span>'}
                </div>
                <div class="sop-review-comment-row">
                    <textarea class="sop-review-comment" data-sop-item-id="${item.id}" placeholder="Add a comment for the team..." rows="1">${escapeHtml(existingComment)}</textarea>
                </div>
            </div>`;
    });

    if (adHocTasks && adHocTasks.length) {
        html += '<div class="sop-review-section-header">Ad Hoc Tasks</div>';
        adHocTasks.forEach(task => {
            const c = checkMap['adhoc_' + task.id];
            const checked = !!c;
            const who = c ? (names[c.checked_by] || 'Someone') : '';
            const when = c ? new Date(c.checked_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
            html += `
                <div class="sop-review-item sop-review-adhoc">
                    <div class="sop-review-item-header">
                        <span class="sop-review-check ${checked ? 'done' : 'missed'}">
                            ${checked
                                ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>'
                                : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>'}
                        </span>
                        <span class="sop-review-item-title">${escapeHtml(task.title)}</span>
                        ${checked ? `<span class="sop-review-item-who">by ${escapeHtml(who)} at ${escapeHtml(when)}</span>` : '<span class="sop-review-item-who missed">not completed</span>'}
                    </div>
                </div>`;
        });
    }

    itemsEl.innerHTML = html;

    itemsEl.querySelectorAll('.sop-review-comment').forEach(ta => {
        ta.addEventListener('input', () => {
            ta.style.height = 'auto';
            ta.style.height = ta.scrollHeight + 'px';
        });
        if (ta.value) {
            ta.style.height = 'auto';
            ta.style.height = ta.scrollHeight + 'px';
        }
    });

    const saveBtn = document.getElementById('sop-review-save');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    newSaveBtn.addEventListener('click', () => saveSopReviewComments(dailySopId, daily.sop_template_id));

    const cancelBtn = document.getElementById('sop-review-cancel');
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    newCancelBtn.addEventListener('click', () => modal.classList.remove('active'));
}

document.getElementById('close-sop-review-modal')?.addEventListener('click', () => {
    document.getElementById('sop-review-modal')?.classList.remove('active');
});

async function saveSopReviewComments(dailySopId, sopTemplateId) {
    const itemsEl = document.getElementById('sop-review-items');
    if (!itemsEl) return;

    const textareas = itemsEl.querySelectorAll('.sop-review-comment');
    const commentsToSave = [];
    textareas.forEach(ta => {
        const itemId = ta.dataset.sopItemId;
        const text = ta.value.trim();
        if (itemId && text) {
            commentsToSave.push({ sop_item_id: itemId, comment: text });
        }
    });

    const saveBtn = document.getElementById('sop-review-save');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

    try {
        await supabaseClient
            .from('sop_task_comments')
            .delete()
            .eq('daily_sop_id', dailySopId);

        if (commentsToSave.length > 0) {
            const rows = commentsToSave.map(c => ({
                sop_item_id: c.sop_item_id,
                daily_sop_id: dailySopId,
                comment: c.comment,
                created_by: currentUser.id
            }));
            const { error } = await supabaseClient.from('sop_task_comments').insert(rows);
            if (error) throw error;
        }

        showToast('Comments saved');
        document.getElementById('sop-review-modal')?.classList.remove('active');
    } catch (e) {
        console.error('saveSopReviewComments error', e);
        showToast('Failed to save comments', 'error');
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Comments'; }
    }
}

async function loadSopList() {
    loadAdminDailyChecklist();
    loadSopCompletedList();
    const container = document.getElementById('sop-list');
    if (!container) return;
    const { data, error } = await supabaseClient
        .from('sop_templates')
        .select('*')
        .order('updated_at', { ascending: false });
    if (error) {
        container.innerHTML = '<div class="empty-state"><p>Failed to load SOPs</p></div>';
        return;
    }
    if (!data || data.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No SOPs yet</p>
                <p class="text-muted">Create a checklist that staff will see when they clock in.</p>
                <button type="button" class="btn btn-primary" id="create-sop-empty-btn">Create SOP</button>
            </div>
        `;
        document.getElementById('create-sop-empty-btn')?.addEventListener('click', () => openSopEditor());
        return;
    }
    container.innerHTML = data.map(t => `
        <div class="sop-card">
            <div class="sop-card-main">
                <h4>${escapeHtml(t.name)}</h4>
                ${t.description ? `<p class="sop-card-desc">${escapeHtml(t.description)}</p>` : ''}
            </div>
            <div class="sop-card-actions">
                <button type="button" class="btn btn-secondary btn-sm" onclick="openSopEditor('${t.id}')">Edit</button>
                <button type="button" class="btn btn-danger btn-sm" onclick="deleteSop('${t.id}', '${escapeHtml(t.name).replace(/'/g, "\\'")}')">Delete</button>
            </div>
        </div>
    `).join('');
}

let sopEditorItems = [];
let sopEditorExpandedIdx = null;
let sopDragSourceIdx = null;
let sopDropIndicatorIdx = null;
let sopReorderSelectedIdxs = new Set();
let sopReorderSelectDrag = null;

function moveItemsByIndexSelection(items, selectedIdxs, targetIndex) {
    const sortedIdxs = [...selectedIdxs]
        .filter(idx => idx >= 0 && idx < items.length)
        .sort((a, b) => a - b);
    if (!sortedIdxs.length) return { items, selectedIdxs: new Set() };

    const selectedSet = new Set(sortedIdxs);
    const movingItems = sortedIdxs.map(idx => items[idx]);
    const remainingItems = items.filter((_, idx) => !selectedSet.has(idx));
    const removedBeforeTarget = sortedIdxs.filter(idx => idx < targetIndex).length;
    const insertIdx = Math.max(0, Math.min(targetIndex - removedBeforeTarget, remainingItems.length));

    remainingItems.splice(insertIdx, 0, ...movingItems);
    return {
        items: remainingItems,
        selectedIdxs: new Set(movingItems.map((_, offset) => insertIdx + offset))
    };
}

function updateSopReorderSelectionBar() {
    const bar = document.getElementById('sop-reorder-multi-bar');
    const countEl = document.getElementById('sop-reorder-multi-count');
    const count = sopReorderSelectedIdxs.size;
    if (bar) bar.style.display = count ? 'flex' : 'none';
    if (countEl) countEl.textContent = `${count} selected to move`;
}

function setSopReorderSelected(idx, selected) {
    if (selected) sopReorderSelectedIdxs.add(idx);
    else sopReorderSelectedIdxs.delete(idx);
    const row = document.querySelector(`#sop-items-list .sop-editor-row[data-idx="${idx}"]`);
    if (row) {
        row.classList.toggle('reorder-selected', selected);
        const cb = row.querySelector('.sop-reorder-select');
        if (cb) cb.checked = selected;
    }
    updateSopReorderSelectionBar();
}

function clearSopReorderSelection() {
    sopReorderSelectedIdxs = new Set();
    document.querySelectorAll('#sop-items-list .sop-editor-row.reorder-selected').forEach(row => {
        row.classList.remove('reorder-selected');
        const cb = row.querySelector('.sop-reorder-select');
        if (cb) cb.checked = false;
    });
    updateSopReorderSelectionBar();
}

function getSopDragSelection(fromIdx) {
    if (sopReorderSelectedIdxs.has(fromIdx)) return new Set(sopReorderSelectedIdxs);
    return new Set([fromIdx]);
}

document.addEventListener('pointerup', () => {
    sopReorderSelectDrag = null;
});
document.addEventListener('pointermove', (e) => {
    if (!sopReorderSelectDrag) return;
    const row = document.elementFromPoint(e.clientX, e.clientY)?.closest('#sop-items-list .sop-editor-row');
    if (!row) return;
    setSopReorderSelected(parseInt(row.dataset.idx, 10), sopReorderSelectDrag.selecting);
    if (e.cancelable) e.preventDefault();
});

function syncSopEditorItemsFromDom() {
    const list = document.getElementById('sop-items-list');
    if (!list || !list.children.length) return;
    for (let i = 0; i < list.children.length; i++) {
        const row = list.children[i];
        if (!row.classList.contains('sop-editor-row')) continue;
        const idx = row.dataset.idx;
        if (idx === undefined) continue;
        const j = parseInt(idx, 10);
        if (sopEditorItems[j] === undefined) continue;
        if (row.classList.contains('sop-section-row')) {
            const titleEl = row.querySelector('.sop-section-title');
            if (titleEl) sopEditorItems[j].title = titleEl.value;
            sopEditorItems[j].type = 'section';
        } else {
            const titleEl = row.querySelector('.sop-item-title');
            const descEl = row.querySelector('.sop-item-desc');
            const locEl = row.querySelector('.sop-item-location-select');
            if (titleEl) sopEditorItems[j].title = titleEl.value;
            if (descEl) sopEditorItems[j].description = descEl.value;
            if (locEl) sopEditorItems[j].location = locEl.value || null;
            sopEditorItems[j].type = sopEditorItems[j].type || 'task';
        }
    }
}

function openSopEditor(id) {
    document.getElementById('sop-editor-title').textContent = id ? 'Edit SOP' : 'Create SOP';
    document.getElementById('sop-editor-id').value = id || '';
    document.getElementById('sop-editor-name').value = '';
    document.getElementById('sop-editor-description').value = '';
    sopEditorItems = [];
    sopEditorExpandedIdx = null;
    clearSopReorderSelection();
    if (typeof sopCopyMultiSelect !== 'undefined') {
        sopCopyMultiSelect = false;
        sopCopySelectedIdxs = new Set();
        const copyBar = document.getElementById('sop-copy-multi-bar');
        if (copyBar) copyBar.style.display = 'none';
        const copyToggle = document.getElementById('sop-copy-multi-btn');
        if (copyToggle) copyToggle.classList.remove('active');
    }
    const list = document.getElementById('sop-items-list');
    list.innerHTML = '';
    if (id) {
        supabaseClient.from('sop_templates').select('*').eq('id', id).single().then(({ data: t, error }) => {
            if (error) console.error('Error loading SOP template:', error);
            if (t) {
                document.getElementById('sop-editor-name').value = t.name || '';
                document.getElementById('sop-editor-description').value = t.description || '';
            }
        });
        supabaseClient.from('sop_items').select('*').eq('sop_template_id', id).order('sort_order').then(async ({ data: items, error }) => {
            if (error) {
                console.error('Error loading SOP items:', error);
                showToast('Failed to load SOP tasks', 'error');
            }
            sopEditorItems = (items || []).map(i => ({
                ...i,
                type: i.item_type || 'task',
                media: i.media || [],
                equipment: i.equipment || [],
                location: i.location || null
            }));
            await ensureEquipmentLoaded();
            renderSopEditorItems();
        });
    }
    navigateToView('sop-editor', 'admin');
}

function renderSopEditorItems(focusExpanded = false) {
    const list = document.getElementById('sop-items-list');
    const taskTpl = document.getElementById('sop-item-row-template');
    const sectionTpl = document.getElementById('sop-section-row-template');
    if (!list || !taskTpl || !sectionTpl) return;
    const dropIndicator = list.querySelector('.sop-drop-indicator');
    list.innerHTML = '';
    sopEditorItems.forEach((item, idx) => {
        const isSection = (item.type || 'task') === 'section';
        const tpl = isSection ? sectionTpl : taskTpl;
        const row = tpl.content.cloneNode(true);
        const rowEl = row.querySelector('.sop-editor-row');
        rowEl.dataset.idx = idx;
        rowEl.classList.toggle('reorder-selected', sopReorderSelectedIdxs.has(idx));
        const selectBox = document.createElement('input');
        selectBox.type = 'checkbox';
        selectBox.className = 'reorder-select-checkbox sop-reorder-select';
        selectBox.dataset.idx = idx;
        selectBox.title = 'Select to move with other items';
        selectBox.checked = sopReorderSelectedIdxs.has(idx);
        const handle = rowEl.querySelector('.sop-drag-handle');
        if (handle) handle.after(selectBox);
        else rowEl.prepend(selectBox);
        const isExpanded = (idx === sopEditorExpandedIdx);
        if (isSection) {
            rowEl.querySelector('.sop-section-title').value = item.title || '';
        } else {
            rowEl.querySelector('.sop-item-title').value = item.title || '';
            rowEl.querySelector('.sop-item-desc').value = item.description || '';
            const locSelect = rowEl.querySelector('.sop-item-location-select');
            if (locSelect && item.location) locSelect.value = item.location;
            const mediaList = rowEl.querySelector('.sop-item-media-list');
            const imageUrls = (item.media || []).filter(x => x.type !== 'video').map(x => x.url);
            (item.media || []).forEach((m, mi) => {
                const span = document.createElement('span');
                span.className = 'sop-media-tag';
                if (m.type !== 'video' && m.url) {
                    const imgIdx = imageUrls.indexOf(m.url);
                    span.innerHTML = `<img src="${escapeHtml(m.url)}" class="sop-media-thumb" alt=""> <button type="button" class="sop-media-remove">×</button>`;
                    span.dataset.url = m.url;
                    span.dataset.lightboxUrls = JSON.stringify(imageUrls);
                    span.dataset.lightboxIndex = String(imgIdx >= 0 ? imgIdx : 0);
                    span.classList.add('sop-media-thumb-wrap');
                } else {
                    span.innerHTML = (m.type === 'video' ? '🎬 ' : '🖼 ') + (m.url?.split('/').pop() || '') + ' <button type="button" class="sop-media-remove">×</button>';
                    span.dataset.url = m.url;
                }
                mediaList.appendChild(span);
            });
        }
        if (!isExpanded) {
            rowEl.classList.add('collapsed');
            const summaryTitle = rowEl.querySelector('.sop-collapsed-title');
            if (summaryTitle) {
                const title = (item.title || '').trim();
                if (title) {
                    summaryTitle.textContent = title;
                } else {
                    summaryTitle.textContent = isSection ? 'Untitled section' : 'Untitled task';
                    summaryTitle.classList.add('placeholder');
                }
                if (!isSection && item.location) {
                    const badge = document.createElement('span');
                    badge.className = 'sop-collapsed-location-badge';
                    badge.textContent = getLocationLabel(item.location);
                    summaryTitle.after(badge);
                }
            }
        }
        list.appendChild(row);
    });
    if (dropIndicator) list.appendChild(dropIndicator);
    list.querySelectorAll('.sop-item-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            syncSopEditorItemsFromDom();
            const row = btn.closest('.sop-editor-row');
            const idx = parseInt(row.dataset.idx, 10);
            if (sopEditorExpandedIdx !== null) {
                if (idx === sopEditorExpandedIdx) sopEditorExpandedIdx = null;
                else if (idx < sopEditorExpandedIdx) sopEditorExpandedIdx--;
            }
            sopEditorItems.splice(idx, 1);
            clearSopReorderSelection();
            renderSopEditorItems();
        });
    });
    list.querySelectorAll('.sop-reorder-select').forEach(cb => {
        cb.addEventListener('change', () => {
            if (cb._suppressReorderChange) {
                cb._suppressReorderChange = false;
                return;
            }
            setSopReorderSelected(parseInt(cb.dataset.idx, 10), cb.checked);
        });
        cb.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            const idx = parseInt(cb.dataset.idx, 10);
            const selecting = !cb.checked;
            sopReorderSelectDrag = { selecting };
            cb._suppressReorderClick = true;
            cb._suppressReorderChange = true;
            setSopReorderSelected(idx, selecting);
            e.preventDefault();
        });
        cb.addEventListener('click', (e) => {
            if (!cb._suppressReorderClick) return;
            cb._suppressReorderClick = false;
            e.preventDefault();
            e.stopPropagation();
            setTimeout(() => { cb._suppressReorderChange = false; }, 0);
        });
    });
    list.querySelectorAll('.sop-editor-row').forEach(rowEl => {
        rowEl.addEventListener('pointerenter', () => {
            if (!sopReorderSelectDrag) return;
            setSopReorderSelected(parseInt(rowEl.dataset.idx, 10), sopReorderSelectDrag.selecting);
        });
    });
    list.querySelectorAll('.sop-item-media-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const row = btn.closest('.sop-item-row');
            if (row) row.querySelector('.sop-item-media-input').click();
        });
    });
    list.querySelectorAll('.sop-item-media-input').forEach(input => {
        input.onchange = async (e) => {
            const files = e.target.files;
            if (!files?.length) return;
            syncSopEditorItemsFromDom();
            const row = input.closest('.sop-item-row');
            const idx = parseInt(row.dataset.idx, 10);
            for (const rawFile of files) {
                try {
                    const file = await compressImage(rawFile);
                    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                    const path = `${currentUser.id}/${Date.now()}-${safeName}`;
                    const { data, error } = await supabaseClient.storage.from(SOP_STORAGE_BUCKET).upload(path, file, { upsert: true });
                    if (error) throw error;
                    const { data: urlData } = supabaseClient.storage.from(SOP_STORAGE_BUCKET).getPublicUrl(data.path);
                    const type = (file.type || '').startsWith('video/') ? 'video' : 'image';
                    if (!sopEditorItems[idx].media) sopEditorItems[idx].media = [];
                    sopEditorItems[idx].media.push({ url: urlData.publicUrl, type });
                    renderSopEditorItems();
                } catch (err) {
                    console.error('SOP media upload error:', err);
                    showToast('Upload failed: ' + (err.message || err.statusCode || 'Check storage policies'), 'error');
                }
            }
            input.value = '';
        };
    });
    list.querySelectorAll('.sop-media-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            syncSopEditorItemsFromDom();
            const tag = btn.closest('.sop-media-tag');
            const row = btn.closest('.sop-item-row');
            const idx = parseInt(row.dataset.idx, 10);
            const url = tag.dataset.url;
            sopEditorItems[idx].media = (sopEditorItems[idx].media || []).filter(m => m.url !== url);
            renderSopEditorItems();
        });
    });
    list.querySelectorAll('.sop-media-thumb-wrap').forEach(wrap => {
        wrap.addEventListener('click', (e) => {
            if (e.target.closest('.sop-media-remove')) return;
            e.stopPropagation();
            const urls = JSON.parse(wrap.dataset.lightboxUrls || '[]');
            const idx = parseInt(wrap.dataset.lightboxIndex || '0', 10);
            if (urls.length && typeof openLightbox === 'function') openLightbox(urls, idx);
        });
    });
    list.querySelectorAll('.sop-item-equipment-add-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await ensureEquipmentLoaded();
            const row = btn.closest('.sop-item-row');
            const idx = parseInt(row.dataset.idx, 10);
            openEquipmentPicker(row, idx);
        });
    });
    list.querySelectorAll('.sop-item-row').forEach(rowEl => {
        const idx = parseInt(rowEl.dataset.idx, 10);
        if (!isNaN(idx)) renderEquipmentTags(rowEl, idx);
    });
    list.querySelectorAll('.sop-row-collapsed-summary').forEach(summary => {
        summary.addEventListener('click', () => {
            const row = summary.closest('.sop-editor-row');
            syncSopEditorItemsFromDom();
            sopEditorExpandedIdx = parseInt(row.dataset.idx, 10);
            renderSopEditorItems(true);
        });
    });
    list.querySelectorAll('.sop-copy-item-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            syncSopEditorItemsFromDom();
            const row = btn.closest('.sop-editor-row');
            const idx = parseInt(row.dataset.idx, 10);
            const item = sopEditorItems[idx];
            if (!item) return;
            const editId = document.getElementById('sop-editor-id').value || null;
            openCopyItemsModal([item], 'sop', editId);
        });
    });
    if (typeof sopCopyMultiSelect !== 'undefined' && sopCopyMultiSelect) {
        list.querySelectorAll('.sop-item-row').forEach(rowEl => {
            const idx = parseInt(rowEl.dataset.idx, 10);
            if (isNaN(idx)) return;
            const item = sopEditorItems[idx];
            if (!item || item.type === 'section') return;
            let cb = rowEl.querySelector('.sop-copy-select');
            if (!cb) {
                cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.className = 'copy-select-checkbox sop-copy-select';
                cb.dataset.idx = idx;
                const handle = rowEl.querySelector('.sop-drag-handle');
                if (handle) handle.after(cb);
                else rowEl.prepend(cb);
            }
            cb.style.display = '';
            cb.checked = sopCopySelectedIdxs.has(idx);
            cb.addEventListener('change', () => {
                if (cb.checked) sopCopySelectedIdxs.add(idx);
                else sopCopySelectedIdxs.delete(idx);
                updateCopyMultiBar('sop');
            });
            const copyBtn = rowEl.querySelector('.sop-copy-item-btn');
            if (copyBtn) copyBtn.style.display = 'none';
        });
    }
    if (focusExpanded && sopEditorExpandedIdx !== null) {
        const expandedRow = list.querySelector(`.sop-editor-row[data-idx="${sopEditorExpandedIdx}"]`);
        if (expandedRow) {
            const titleInput = expandedRow.querySelector('.sop-item-title, .sop-section-title');
            if (titleInput) titleInput.focus();
        }
    }
    initSopRowDragAndDrop(list);
    updateSopReorderSelectionBar();
}

function getSopDropIndicator() {
    const list = document.getElementById('sop-items-list');
    if (!list) return null;
    let indicator = list.querySelector('.sop-drop-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'sop-drop-indicator';
        indicator.setAttribute('aria-hidden', 'true');
        list.appendChild(indicator);
    }
    return indicator;
}

function positionSopDropIndicator(dropIndex) {
    const list = document.getElementById('sop-items-list');
    const indicator = getSopDropIndicator();
    if (!list || !indicator) return;
    const rows = list.querySelectorAll('.sop-editor-row');
    indicator.classList.add('sop-drop-indicator-visible');
    if (dropIndex <= 0) {
        const first = rows[0];
        if (first) list.insertBefore(indicator, first);
        else list.appendChild(indicator);
    } else if (dropIndex >= rows.length) {
        list.appendChild(indicator);
    } else {
        list.insertBefore(indicator, rows[dropIndex]);
    }
    sopDropIndicatorIdx = dropIndex;
}

function hideSopDropIndicator() {
    const indicator = document.querySelector('.sop-drop-indicator');
    if (indicator) indicator.classList.remove('sop-drop-indicator-visible');
    sopDropIndicatorIdx = null;
}

function initSopRowDragAndDrop(list) {
    const rows = list.querySelectorAll('.sop-editor-row');
    rows.forEach((rowEl) => {
        const handle = rowEl.querySelector('.sop-drag-handle');
        if (!handle) return;
        handle.addEventListener('dragstart', (e) => {
            sopDragSourceIdx = parseInt(rowEl.dataset.idx, 10);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', rowEl.dataset.idx);
            const dragCount = getSopDragSelection(sopDragSourceIdx).size;
            if (dragCount > 1) e.dataTransfer.setData('text/plain', `${dragCount} selected items`);
            requestAnimationFrame(() => rowEl.classList.add('sop-dragging'));
        });
        rowEl.addEventListener('dragend', () => {
            rowEl.classList.remove('sop-dragging');
            hideSopDropIndicator();
            sopDragSourceIdx = null;
        });
        rowEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (sopDragSourceIdx === null) return;
            const rowIdx = parseInt(rowEl.dataset.idx, 10);
            const rect = rowEl.getBoundingClientRect();
            const mid = rect.top + rect.height / 2;
            const dropIndex = e.clientY < mid ? rowIdx : rowIdx + 1;
            positionSopDropIndicator(dropIndex);
        });
    });
    function executeDrop(e) {
        e.preventDefault();
        const fromIdx = sopDragSourceIdx;
        const toIdx = sopDropIndicatorIdx;
        hideSopDropIndicator();
        if (fromIdx === null || toIdx === null) return;
        syncSopEditorItemsFromDom();
        const expandedItem = sopEditorExpandedIdx !== null ? sopEditorItems[sopEditorExpandedIdx] : null;
        const dragSelection = getSopDragSelection(fromIdx);
        const moveResult = moveItemsByIndexSelection(sopEditorItems, dragSelection, toIdx);
        sopEditorItems = moveResult.items;
        sopReorderSelectedIdxs = dragSelection.size > 1 || dragSelection.has(fromIdx) ? moveResult.selectedIdxs : new Set();
        sopEditorExpandedIdx = expandedItem ? sopEditorItems.indexOf(expandedItem) : null;
        if (sopEditorExpandedIdx < 0) sopEditorExpandedIdx = null;
        sopDragSourceIdx = null;
        renderSopEditorItems();
    }
    rows.forEach((rowEl) => rowEl.addEventListener('drop', executeDrop));
    list.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (sopDragSourceIdx === null) return;
        const editorRows = list.querySelectorAll('.sop-editor-row');
        if (!editorRows.length) return;
        const lastRow = editorRows[editorRows.length - 1];
        const lastRect = lastRow.getBoundingClientRect();
        if (e.clientY > lastRect.bottom) {
            positionSopDropIndicator(sopEditorItems.length);
        }
    });
    list.addEventListener('drop', executeDrop);
}

document.getElementById('sop-add-item-btn')?.addEventListener('click', () => {
    syncSopEditorItemsFromDom();
    sopEditorItems.unshift({ type: 'task', title: '', description: '', media: [], equipment: [], location: null });
    sopEditorExpandedIdx = 0;
    clearSopReorderSelection();
    renderSopEditorItems(true);
});
document.getElementById('sop-add-section-btn')?.addEventListener('click', () => {
    syncSopEditorItemsFromDom();
    sopEditorItems.unshift({ type: 'section', title: '' });
    sopEditorExpandedIdx = 0;
    clearSopReorderSelection();
    renderSopEditorItems(true);
});

document.getElementById('sop-editor-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    syncSopEditorItemsFromDom();
    const id = document.getElementById('sop-editor-id').value;
    const name = document.getElementById('sop-editor-name').value.trim();
    const description = document.getElementById('sop-editor-description').value.trim();
    if (!name) {
        showToast('Enter an SOP name', 'error');
        return;
    }
    try {
        let templateId = id;
        if (id) {
            const { error: tplErr } = await supabaseClient.from('sop_templates').update({ name, description }).eq('id', id);
            if (tplErr) throw tplErr;
            const { error: delErr } = await supabaseClient.from('sop_items').delete().eq('sop_template_id', id);
            if (delErr) throw delErr;
        } else {
            const { data, error: insErr } = await supabaseClient.from('sop_templates').insert({ name, description }).select('id').single();
            if (insErr) throw insErr;
            templateId = data.id;
        }
        let hasItemTypeCol = true;
        let hasEquipmentCol = true;
        let hasLocationCol = true;
        for (let i = 0; i < sopEditorItems.length; i++) {
            const item = sopEditorItems[i];
            if (!item.title?.trim()) continue;
            const itemType = item.type === 'section' ? 'section' : 'task';
            const row = {
                sop_template_id: templateId,
                sort_order: i,
                title: item.title.trim(),
                description: itemType === 'task' ? ((item.description || '').trim() || null) : null,
                media: itemType === 'task' ? (item.media || []) : []
            };
            if (hasItemTypeCol) row.item_type = itemType;
            if (hasEquipmentCol) row.equipment = itemType === 'task' ? (item.equipment || []) : [];
            if (hasLocationCol) row.location = itemType === 'task' ? (item.location || null) : null;
            const { error: itemErr } = await supabaseClient.from('sop_items').insert(row);
            if (itemErr) {
                if (hasItemTypeCol && itemErr.message?.includes('item_type')) {
                    hasItemTypeCol = false;
                    delete row.item_type;
                    const { error: retryErr } = await supabaseClient.from('sop_items').insert(row);
                    if (retryErr) { console.error('SOP item save error:', retryErr); throw retryErr; }
                } else if (hasEquipmentCol && itemErr.message?.includes('equipment')) {
                    hasEquipmentCol = false;
                    delete row.equipment;
                    const { error: retryErr } = await supabaseClient.from('sop_items').insert(row);
                    if (retryErr) { console.error('SOP item save error:', retryErr); throw retryErr; }
                } else if (hasLocationCol && itemErr.message?.includes('location')) {
                    hasLocationCol = false;
                    delete row.location;
                    const { error: retryErr } = await supabaseClient.from('sop_items').insert(row);
                    if (retryErr) { console.error('SOP item save error:', retryErr); throw retryErr; }
                } else {
                    console.error('SOP item save error:', itemErr);
                    throw itemErr;
                }
            }
        }
        showToast('SOP saved');
        navigateToView('sop', 'admin');
        if (userProfile?.role === 'admin') loadSopList();
    } catch (err) {
        console.error('SOP save failed:', err);
        showToast(err.message || 'Failed to save SOP', 'error');
    }
});

function closeSopEditorModal() {
    navigateToView('sop', 'admin');
    loadSopList();
}

async function deleteSop(id, name) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
        await supabaseClient.from('sop_templates').delete().eq('id', id);
        showToast('SOP deleted');
        loadSopList();
    } catch (e) {
        showToast('Failed to delete SOP', 'error');
    }
}

document.getElementById('close-select-sop-modal')?.addEventListener('click', () => {
    document.getElementById('select-sop-modal').classList.remove('active');
});
document.getElementById('select-sop-skip')?.addEventListener('click', () => {
    document.getElementById('select-sop-modal').classList.remove('active');
});
document.getElementById('sop-editor-back-btn')?.addEventListener('click', closeSopEditorModal);
document.getElementById('sop-editor-cancel')?.addEventListener('click', closeSopEditorModal);
document.getElementById('sop-reorder-clear-btn')?.addEventListener('click', clearSopReorderSelection);
document.getElementById('create-sop-btn')?.addEventListener('click', () => openSopEditor());
document.getElementById('sop-checklist-refresh')?.addEventListener('click', () => {
    const first = document.querySelector('.sop-checklist-item');
    if (first) loadSopChecklistItems(first.dataset.dailySopId);
});

// Expose for inline handlers
window.openSopEditor = openSopEditor;
window.deleteSop = deleteSop;
