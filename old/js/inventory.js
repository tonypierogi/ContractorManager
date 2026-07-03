// ==================== INVENTORY ====================

const INVENTORY_STORAGE_BUCKET = 'sop-media';
let allInventoryItems = [];
let inventoryEditorImageUrl = null;
let currentInventoryRun = null;
let inventoryRunChecks = {};

// ==================== ADMIN: ITEM MANAGEMENT ====================

async function loadInventoryItems() {
    const container = document.getElementById('inventory-items-list');
    if (!container) return;

    const { data, error } = await supabaseClient
        .from('inventory_items')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name');

    if (error) {
        container.innerHTML = '<div class="empty-state"><p>Failed to load inventory items</p></div>';
        return;
    }

    allInventoryItems = data || [];

    if (!allInventoryItems.length) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                </svg>
                <p>No inventory items yet</p>
                <p class="text-muted">Add items your team needs to check during inventory runs.</p>
                <button type="button" class="btn btn-primary" onclick="openInventoryItemEditor()">Add First Item</button>
            </div>
        `;
        return;
    }

    container.innerHTML = allInventoryItems.map(item => `
        <div class="inventory-item-card ${!item.is_active ? 'inactive' : ''}" data-item-id="${item.id}">
            ${item.image_url
                ? `<img class="inventory-item-card-img" src="${escapeHtml(item.image_url)}" alt="" onclick="openLightboxFromUrl('${escapeHtml(item.image_url)}')">`
                : `<div class="inventory-item-card-placeholder">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                    </svg>
                  </div>`
            }
            <div class="inventory-item-card-info">
                <h4>${escapeHtml(item.name)}</h4>
                ${item.location ? `<div class="inventory-item-card-location">${escapeHtml(getLocationLabel(item.location))}</div>` : ''}
                ${item.description ? `<div class="inventory-item-card-desc">${escapeHtml(item.description)}</div>` : ''}
                ${!item.is_active ? '<span class="inventory-inactive-badge">Inactive</span>' : ''}
            </div>
            <div class="inventory-item-card-actions">
                <button type="button" class="btn btn-secondary btn-sm" onclick="openInventoryItemEditor('${item.id}')">Edit</button>
                <button type="button" class="btn btn-danger btn-sm" onclick="deleteInventoryItem('${item.id}', '${escapeHtml(item.name).replace(/'/g, "\\'")}')">Delete</button>
            </div>
        </div>
    `).join('');
}

function populateLocationDropdown(selectEl, selectedValue) {
    let html = '<option value="">-- No location --</option>';
    for (const [floor, zones] of Object.entries(LOCATION_ZONES)) {
        html += `<optgroup label="${floor.charAt(0).toUpperCase() + floor.slice(1)}">`;
        for (const zone of zones) {
            const sel = zone.id === selectedValue ? ' selected' : '';
            html += `<option value="${zone.id}"${sel}>${escapeHtml(zone.label)}</option>`;
        }
        html += '</optgroup>';
    }
    selectEl.innerHTML = html;
}

function openInventoryItemEditor(id) {
    const modal = document.getElementById('inventory-item-editor-modal');
    document.getElementById('inventory-item-editor-title').textContent = id ? 'Edit Inventory Item' : 'Add Inventory Item';
    document.getElementById('inventory-item-editor-id').value = id || '';
    document.getElementById('inventory-item-editor-name').value = '';
    document.getElementById('inventory-item-editor-description').value = '';
    document.getElementById('inventory-item-editor-active').checked = true;
    document.getElementById('inventory-item-image-preview').innerHTML = '';
    inventoryEditorImageUrl = null;

    const locationSelect = document.getElementById('inventory-item-editor-location');

    if (id) {
        const item = allInventoryItems.find(i => i.id === id);
        if (item) {
            document.getElementById('inventory-item-editor-name').value = item.name || '';
            document.getElementById('inventory-item-editor-description').value = item.description || '';
            populateLocationDropdown(locationSelect, item.location || '');
            document.getElementById('inventory-item-editor-active').checked = item.is_active !== false;
            if (item.image_url) {
                inventoryEditorImageUrl = item.image_url;
                document.getElementById('inventory-item-image-preview').innerHTML =
                    `<img src="${escapeHtml(item.image_url)}" alt=""> <button type="button" class="btn btn-secondary btn-sm" id="inventory-item-image-remove-btn">Remove</button>`;
                document.getElementById('inventory-item-image-remove-btn')?.addEventListener('click', () => {
                    inventoryEditorImageUrl = null;
                    document.getElementById('inventory-item-image-preview').innerHTML = '';
                });
            }
        }
    } else {
        populateLocationDropdown(locationSelect, '');
    }
    modal.classList.add('active');
}

function closeInventoryItemEditorModal() {
    document.getElementById('inventory-item-editor-modal').classList.remove('active');
}

async function deleteInventoryItem(id, name) {
    const ok = await showConfirmModal('Delete Item', `Delete "${name}"? This cannot be undone.`, { okLabel: 'Delete', okClass: 'btn-danger' });
    if (!ok) return;
    try {
        await supabaseClient.from('inventory_items').delete().eq('id', id);
        showToast('Item deleted');
        loadInventoryItems();
    } catch (e) {
        showToast('Failed to delete item', 'error');
    }
}

// Image upload for inventory item editor
document.getElementById('inventory-item-image-btn')?.addEventListener('click', () => {
    document.getElementById('inventory-item-image-input').click();
});

document.getElementById('inventory-item-image-input')?.addEventListener('change', async (e) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;
    try {
        const file = await compressImage(rawFile);
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${currentUser.id}/inventory/${Date.now()}-${safeName}`;
        const { data, error } = await supabaseClient.storage.from(INVENTORY_STORAGE_BUCKET).upload(path, file, { upsert: true });
        if (error) throw error;
        const { data: urlData } = supabaseClient.storage.from(INVENTORY_STORAGE_BUCKET).getPublicUrl(data.path);
        inventoryEditorImageUrl = urlData.publicUrl;
        document.getElementById('inventory-item-image-preview').innerHTML =
            `<img src="${escapeHtml(inventoryEditorImageUrl)}" alt=""> <button type="button" class="btn btn-secondary btn-sm" id="inventory-item-image-remove-btn">Remove</button>`;
        document.getElementById('inventory-item-image-remove-btn')?.addEventListener('click', () => {
            inventoryEditorImageUrl = null;
            document.getElementById('inventory-item-image-preview').innerHTML = '';
        });
    } catch (err) {
        showToast('Image upload failed: ' + (err.message || 'Check storage policies'), 'error');
    }
    e.target.value = '';
});

document.getElementById('close-inventory-item-editor-modal')?.addEventListener('click', closeInventoryItemEditorModal);
document.getElementById('inventory-item-editor-cancel')?.addEventListener('click', closeInventoryItemEditorModal);
document.getElementById('add-inventory-item-btn')?.addEventListener('click', () => openInventoryItemEditor());

document.getElementById('inventory-item-editor-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('inventory-item-editor-id').value;
    const name = document.getElementById('inventory-item-editor-name').value.trim();
    const description = document.getElementById('inventory-item-editor-description').value.trim();
    const location = document.getElementById('inventory-item-editor-location').value.trim();
    const isActive = document.getElementById('inventory-item-editor-active').checked;

    if (!name) { showToast('Enter item name', 'error'); return; }

    const row = {
        name,
        description: description || null,
        location: location || null,
        image_url: inventoryEditorImageUrl || null,
        is_active: isActive
    };

    try {
        if (id) {
            row.updated_at = new Date().toISOString();
            const { error } = await supabaseClient.from('inventory_items').update(row).eq('id', id);
            if (error) throw error;
        } else {
            row.created_by = currentUser.id;
            const { error } = await supabaseClient.from('inventory_items').insert(row);
            if (error) throw error;
        }
        closeInventoryItemEditorModal();
        showToast('Item saved');
        loadInventoryItems();
    } catch (err) {
        showToast(err.message || 'Failed to save item', 'error');
    }
});

// ==================== ADMIN: VIEW LAST RUN ====================

async function loadLastInventoryRun() {
    const container = document.getElementById('inventory-last-run');
    if (!container) return;

    const { data: runs, error } = await supabaseClient
        .from('inventory_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(1);

    if (error || !runs?.length) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
                    <rect x="9" y="3" width="6" height="4" rx="2"/>
                </svg>
                <p>No inventory runs yet</p>
                <p class="text-muted">Your team hasn't completed an inventory check yet.</p>
            </div>
        `;
        return;
    }

    const run = runs[0];
    let runName = 'Unknown';
    if (run.user_id) {
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', run.user_id)
            .single();
        if (profile) {
            runName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown';
        }
    }
    const runDate = new Date(run.started_at);

    const { data: checks } = await supabaseClient
        .from('inventory_checks')
        .select('*, inventory_items:item_id(name, location, image_url)')
        .eq('run_id', run.id)
        .order('checked_at');

    const checksHtml = (checks || []).map(check => {
        const statusClass = check.status === 'OUT' ? 'status-out' : check.status === 'Some' ? 'status-some' : 'status-plenty';
        return `
            <div class="inventory-run-check-card">
                <div class="inventory-run-check-header">
                    ${check.inventory_items?.image_url
                        ? `<img class="inventory-run-check-img" src="${escapeHtml(check.inventory_items.image_url)}" alt="" onclick="openLightboxFromUrl('${escapeHtml(check.inventory_items.image_url)}')">`
                        : ''
                    }
                    <div class="inventory-run-check-info">
                        <h4>${escapeHtml(check.inventory_items?.name || 'Unknown Item')}</h4>
                        ${check.inventory_items?.location ? `<span class="text-muted">${escapeHtml(getLocationLabel(check.inventory_items.location))}</span>` : ''}
                    </div>
                    <span class="inventory-status-badge ${statusClass}">${escapeHtml(check.status)}</span>
                </div>
                ${check.notes ? `<div class="inventory-run-check-notes">${escapeHtml(check.notes)}</div>` : ''}
                ${check.photo_url ? `<img class="inventory-run-check-photo" src="${escapeHtml(check.photo_url)}" alt="Check photo" onclick="openLightboxFromUrl('${escapeHtml(check.photo_url)}')">` : ''}
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="inventory-run-summary panel">
            <div class="inventory-run-summary-header">
                <div>
                    <h3>Last Inventory Run</h3>
                    <p class="text-muted">By <strong>${escapeHtml(runName)}</strong> on ${formatDate(runDate)} at ${formatTime(runDate)}</p>
                    ${run.completed_at ? `<span class="inventory-status-badge status-plenty">Completed</span>` : `<span class="inventory-status-badge status-some">In Progress</span>`}
                </div>
                ${run.notes ? `<p class="inventory-run-notes">${escapeHtml(run.notes)}</p>` : ''}
            </div>
            <div class="inventory-run-checks-list">
                ${checksHtml || '<p class="text-muted">No items checked in this run.</p>'}
            </div>
        </div>
    `;
}

// ==================== ADMIN: TAB SWITCHING ====================

function initInventoryAdminTabs() {
    const tabBtns = document.querySelectorAll('.inventory-admin-tab');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const tab = btn.dataset.tab;
            document.getElementById('inventory-tab-items').style.display = tab === 'items' ? '' : 'none';
            document.getElementById('inventory-tab-last-run').style.display = tab === 'last-run' ? '' : 'none';

            if (tab === 'items') loadInventoryItems();
            else loadLastInventoryRun();
        });
    });
}

async function loadInventoryAdminView() {
    initInventoryAdminTabs();
    const activeTab = document.querySelector('.inventory-admin-tab.active');
    if (activeTab?.dataset.tab === 'last-run') {
        loadLastInventoryRun();
    } else {
        loadInventoryItems();
    }
}

// ==================== EMPLOYEE: INVENTORY CHECK ====================

async function loadMyInventory() {
    const container = document.getElementById('my-inventory-content');
    if (!container) return;

    const { data: items, error } = await supabaseClient
        .from('inventory_items')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
        .order('name');

    if (error || !items?.length) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                </svg>
                <p>No inventory items to check</p>
                <p class="text-muted">Your admin hasn't added any inventory items yet.</p>
            </div>
        `;
        return;
    }

    currentInventoryRun = null;
    inventoryRunChecks = {};

    container.innerHTML = `
        <div class="inventory-run-intro panel">
            <p>Review each item below and set its status. When finished, submit the run.</p>
            <div class="inventory-run-actions">
                <button type="button" class="btn btn-primary" id="submit-inventory-run-btn" disabled>Submit Inventory Run</button>
            </div>
        </div>
        <div class="inventory-check-list" id="inventory-check-list">
            ${items.map(item => `
                <div class="inventory-check-card" data-item-id="${item.id}">
                    <div class="inventory-check-card-header">
                        ${item.image_url
                            ? `<img class="inventory-check-card-img" src="${escapeHtml(item.image_url)}" alt="" onclick="openLightboxFromUrl('${escapeHtml(item.image_url)}')">`
                            : `<div class="inventory-check-card-placeholder">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                    <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                                </svg>
                              </div>`
                        }
                        <div class="inventory-check-card-info">
                            <h4>${escapeHtml(item.name)}</h4>
                            ${item.location ? `<span class="text-muted">${escapeHtml(getLocationLabel(item.location))}</span>` : ''}
                            ${item.description ? `<p class="text-muted inventory-check-card-desc">${escapeHtml(item.description)}</p>` : ''}
                        </div>
                    </div>
                    <div class="inventory-check-card-body">
                        <div class="inventory-status-buttons">
                            <button type="button" class="inventory-status-btn" data-status="Plenty" onclick="setInventoryCheckStatus('${item.id}', 'Plenty', this)">Plenty</button>
                            <button type="button" class="inventory-status-btn" data-status="Some" onclick="setInventoryCheckStatus('${item.id}', 'Some', this)">Some</button>
                            <button type="button" class="inventory-status-btn" data-status="OUT" onclick="setInventoryCheckStatus('${item.id}', 'OUT', this)">OUT</button>
                        </div>
                        <div class="form-group" style="margin-top: 8px;">
                            <input type="text" class="inventory-check-notes" data-item-id="${item.id}" placeholder="Notes (optional)">
                        </div>
                        <div class="inventory-check-photo-row">
                            <input type="file" class="inventory-check-photo-input" data-item-id="${item.id}" accept="image/*" style="display:none;">
                            <button type="button" class="btn btn-secondary btn-sm inventory-check-photo-btn" onclick="triggerInventoryCheckPhoto('${item.id}')">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                                Photo <span class="required-label">*</span>
                            </button>
                            <div class="inventory-check-photo-preview" data-item-id="${item.id}"></div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    document.getElementById('submit-inventory-run-btn')?.addEventListener('click', submitInventoryRun);

    document.querySelectorAll('.inventory-check-photo-input').forEach(input => {
        input.addEventListener('change', async (e) => {
            const itemId = e.target.dataset.itemId;
            const rawFile = e.target.files?.[0];
            if (!rawFile) return;
            try {
                const file = await compressImage(rawFile);
                const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                const path = `${currentUser.id}/inventory-checks/${Date.now()}-${safeName}`;
                const { data, error } = await supabaseClient.storage.from(INVENTORY_STORAGE_BUCKET).upload(path, file, { upsert: true });
                if (error) throw error;
                const { data: urlData } = supabaseClient.storage.from(INVENTORY_STORAGE_BUCKET).getPublicUrl(data.path);
                if (!inventoryRunChecks[itemId]) inventoryRunChecks[itemId] = {};
                inventoryRunChecks[itemId].photo_url = urlData.publicUrl;
                const preview = document.querySelector(`.inventory-check-photo-preview[data-item-id="${itemId}"]`);
                if (preview) {
                    preview.innerHTML = `<img src="${escapeHtml(urlData.publicUrl)}" alt=""> <button type="button" class="btn btn-secondary btn-sm" onclick="removeInventoryCheckPhoto('${itemId}')">Remove</button>`;
                }
                updateSubmitButtonState();
            } catch (err) {
                showToast('Photo upload failed: ' + (err.message || ''), 'error');
            }
            e.target.value = '';
        });
    });
}

function triggerInventoryCheckPhoto(itemId) {
    const input = document.querySelector(`.inventory-check-photo-input[data-item-id="${itemId}"]`);
    if (input) input.click();
}

function removeInventoryCheckPhoto(itemId) {
    if (inventoryRunChecks[itemId]) inventoryRunChecks[itemId].photo_url = null;
    const preview = document.querySelector(`.inventory-check-photo-preview[data-item-id="${itemId}"]`);
    if (preview) preview.innerHTML = '';
    updateSubmitButtonState();
}

function setInventoryCheckStatus(itemId, status, btnEl) {
    if (!inventoryRunChecks[itemId]) inventoryRunChecks[itemId] = {};
    inventoryRunChecks[itemId].status = status;

    const card = btnEl.closest('.inventory-check-card');
    card.querySelectorAll('.inventory-status-btn').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');

    card.classList.remove('check-plenty', 'check-some', 'check-out');
    if (status === 'Plenty') card.classList.add('check-plenty');
    else if (status === 'Some') card.classList.add('check-some');
    else if (status === 'OUT') card.classList.add('check-out');

    updateSubmitButtonState();
}

function updateSubmitButtonState() {
    const allCards = document.querySelectorAll('.inventory-check-card');
    const total = allCards.length;
    const readyCount = Object.values(inventoryRunChecks).filter(c => c.status && c.photo_url).length;
    const btn = document.getElementById('submit-inventory-run-btn');
    if (btn) {
        btn.disabled = readyCount < total;
        btn.textContent = `Submit Inventory Run (${readyCount}/${total})`;
    }
}

async function submitInventoryRun() {
    const missing = Object.entries(inventoryRunChecks).filter(([, c]) => !c.photo_url);
    if (missing.length) {
        showToast('Every item requires a photo before submitting', 'error');
        return;
    }
    const btn = document.getElementById('submit-inventory-run-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }

    try {
        const { data: run, error: runError } = await supabaseClient
            .from('inventory_runs')
            .insert({ user_id: currentUser.id, completed_at: new Date().toISOString() })
            .select()
            .single();

        if (runError) throw runError;

        const checks = [];
        for (const [itemId, checkData] of Object.entries(inventoryRunChecks)) {
            if (!checkData.status) continue;
            const notesInput = document.querySelector(`.inventory-check-notes[data-item-id="${itemId}"]`);
            checks.push({
                run_id: run.id,
                item_id: itemId,
                status: checkData.status,
                notes: notesInput?.value?.trim() || null,
                photo_url: checkData.photo_url || null
            });
        }

        if (checks.length) {
            const { error: checksError } = await supabaseClient.from('inventory_checks').insert(checks);
            if (checksError) throw checksError;
        }

        showToast('Inventory run submitted!');
        loadMyInventory();
    } catch (err) {
        showToast(err.message || 'Failed to submit inventory run', 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Submit Inventory Run'; }
    }
}

function openLightboxFromUrl(url) {
    if (typeof openLightbox === 'function') {
        openLightbox(url);
    } else {
        window.open(url, '_blank');
    }
}

// Expose to global scope for inline onclick
window.openInventoryItemEditor = openInventoryItemEditor;
window.deleteInventoryItem = deleteInventoryItem;
window.setInventoryCheckStatus = setInventoryCheckStatus;
window.triggerInventoryCheckPhoto = triggerInventoryCheckPhoto;
window.removeInventoryCheckPhoto = removeInventoryCheckPhoto;
window.openLightboxFromUrl = openLightboxFromUrl;
