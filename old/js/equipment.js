// ==================== EQUIPMENT ====================

const EQUIPMENT_STORAGE_BUCKET = 'sop-media';
let allEquipment = [];
let equipmentEditorImageUrl = null;

async function loadEquipmentList() {
    const container = document.getElementById('equipment-list');
    if (!container) return;
    const { data, error } = await supabaseClient
        .from('equipment')
        .select('*')
        .order('name');
    if (error) {
        container.innerHTML = '<div class="empty-state"><p>Failed to load equipment</p></div>';
        return;
    }
    allEquipment = data || [];
    if (!allEquipment.length) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No equipment yet</p>
                <p class="text-muted">Add equipment items that can be attached to SOP tasks.</p>
                <button type="button" class="btn btn-primary" id="add-equipment-empty-btn">Add Equipment</button>
            </div>
        `;
        document.getElementById('add-equipment-empty-btn')?.addEventListener('click', () => openEquipmentEditor());
        return;
    }
    container.innerHTML = allEquipment.map(eq => `
        <div class="equipment-card" data-eq-id="${eq.id}">
            ${eq.image_url
                ? `<img class="equipment-card-img" src="${escapeHtml(eq.image_url)}" alt="">`
                : `<div class="equipment-card-placeholder">&#9881;</div>`
            }
            <div class="equipment-card-info">
                <h4>${escapeHtml(eq.name)}</h4>
                ${eq.location ? `<div class="equipment-card-location">${escapeHtml(eq.location)}</div>` : ''}
                <div class="equipment-card-actions">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="openEquipmentEditor('${eq.id}')">Edit</button>
                    <button type="button" class="btn btn-danger btn-sm" onclick="deleteEquipment('${eq.id}', '${escapeHtml(eq.name).replace(/'/g, "\\'")}')">Delete</button>
                </div>
            </div>
        </div>
    `).join('');
}

function openEquipmentEditor(id) {
    const modal = document.getElementById('equipment-editor-modal');
    document.getElementById('equipment-editor-title').textContent = id ? 'Edit Equipment' : 'Add Equipment';
    document.getElementById('equipment-editor-id').value = id || '';
    document.getElementById('equipment-editor-name').value = '';
    document.getElementById('equipment-editor-location').value = '';
    document.getElementById('equipment-image-preview').innerHTML = '';
    equipmentEditorImageUrl = null;
    if (id) {
        const eq = allEquipment.find(e => e.id === id);
        if (eq) {
            document.getElementById('equipment-editor-name').value = eq.name || '';
            document.getElementById('equipment-editor-location').value = eq.location || '';
            if (eq.image_url) {
                equipmentEditorImageUrl = eq.image_url;
                document.getElementById('equipment-image-preview').innerHTML =
                    `<img src="${escapeHtml(eq.image_url)}" alt=""> <button type="button" class="btn btn-secondary btn-sm" id="equipment-image-remove-btn">Remove</button>`;
                document.getElementById('equipment-image-remove-btn')?.addEventListener('click', () => {
                    equipmentEditorImageUrl = null;
                    document.getElementById('equipment-image-preview').innerHTML = '';
                });
            }
        }
    }
    modal.classList.add('active');
}

function closeEquipmentEditorModal() {
    document.getElementById('equipment-editor-modal').classList.remove('active');
}

document.getElementById('close-equipment-editor-modal')?.addEventListener('click', closeEquipmentEditorModal);
document.getElementById('equipment-editor-cancel')?.addEventListener('click', closeEquipmentEditorModal);
document.getElementById('add-equipment-btn')?.addEventListener('click', () => openEquipmentEditor());

document.getElementById('equipment-image-btn')?.addEventListener('click', () => {
    document.getElementById('equipment-image-input').click();
});

document.getElementById('equipment-image-input')?.addEventListener('change', async (e) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;
    try {
        const file = await compressImage(rawFile);
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${currentUser.id}/equipment/${Date.now()}-${safeName}`;
        const { data, error } = await supabaseClient.storage.from(EQUIPMENT_STORAGE_BUCKET).upload(path, file, { upsert: true });
        if (error) throw error;
        const { data: urlData } = supabaseClient.storage.from(EQUIPMENT_STORAGE_BUCKET).getPublicUrl(data.path);
        equipmentEditorImageUrl = urlData.publicUrl;
        document.getElementById('equipment-image-preview').innerHTML =
            `<img src="${escapeHtml(equipmentEditorImageUrl)}" alt=""> <button type="button" class="btn btn-secondary btn-sm" id="equipment-image-remove-btn">Remove</button>`;
        document.getElementById('equipment-image-remove-btn')?.addEventListener('click', () => {
            equipmentEditorImageUrl = null;
            document.getElementById('equipment-image-preview').innerHTML = '';
        });
    } catch (err) {
        showToast('Image upload failed: ' + (err.message || 'Check storage policies'), 'error');
    }
    e.target.value = '';
});

document.getElementById('equipment-editor-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('equipment-editor-id').value;
    const name = document.getElementById('equipment-editor-name').value.trim();
    const location = document.getElementById('equipment-editor-location').value.trim();
    if (!name) { showToast('Enter equipment name', 'error'); return; }
    const row = { name, location: location || null, image_url: equipmentEditorImageUrl || null };
    try {
        if (id) {
            const { error } = await supabaseClient.from('equipment').update(row).eq('id', id);
            if (error) throw error;
        } else {
            row.created_by = currentUser.id;
            const { error } = await supabaseClient.from('equipment').insert(row);
            if (error) throw error;
        }
        closeEquipmentEditorModal();
        showToast('Equipment saved');
        loadEquipmentList();
    } catch (err) {
        showToast(err.message || 'Failed to save equipment', 'error');
    }
});

async function deleteEquipment(id, name) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
        await supabaseClient.from('equipment').delete().eq('id', id);
        showToast('Equipment deleted');
        loadEquipmentList();
    } catch (e) {
        showToast('Failed to delete equipment', 'error');
    }
}

window.openEquipmentEditor = openEquipmentEditor;
window.deleteEquipment = deleteEquipment;

// --- Equipment picker inside SOP editor ---

async function ensureEquipmentLoaded() {
    if (allEquipment.length) return;
    const { data } = await supabaseClient.from('equipment').select('*').order('name');
    allEquipment = data || [];
}

function renderEquipmentTags(rowEl, idx) {
    const list = rowEl.querySelector('.sop-item-equipment-list');
    if (!list) return;
    const eqIds = sopEditorItems[idx].equipment || [];
    list.innerHTML = '';
    eqIds.forEach(eqId => {
        const eq = allEquipment.find(e => e.id === eqId);
        if (!eq) return;
        const tag = document.createElement('span');
        tag.className = 'equipment-tag';
        tag.innerHTML = (eq.image_url ? `<img src="${escapeHtml(eq.image_url)}" alt="">` : '') +
            `<span>${escapeHtml(eq.name)}</span>` +
            `<button type="button" class="equipment-tag-remove" data-eq-id="${eq.id}">&times;</button>`;
        list.appendChild(tag);
    });
    list.querySelectorAll('.equipment-tag-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            syncSopEditorItemsFromDom();
            const eqId = btn.dataset.eqId;
            sopEditorItems[idx].equipment = (sopEditorItems[idx].equipment || []).filter(id => id !== eqId);
            renderSopEditorItems();
        });
    });
}

function openEquipmentPicker(rowEl, idx) {
    const dropdown = rowEl.querySelector('.equipment-picker-dropdown');
    if (!dropdown) return;
    const isOpen = dropdown.style.display !== 'none';
    if (isOpen) { dropdown.style.display = 'none'; return; }
    const current = sopEditorItems[idx].equipment || [];
    if (current.length >= 5) {
        showToast('Maximum 5 equipment per task', 'error');
        return;
    }
    dropdown.style.display = 'block';
    const searchInput = dropdown.querySelector('.equipment-picker-search');
    const resultsDiv = dropdown.querySelector('.equipment-picker-results');
    searchInput.value = '';
    searchInput.focus();

    function render(filter) {
        const term = (filter || '').toLowerCase();
        const available = allEquipment.filter(eq =>
            !current.includes(eq.id) &&
            (!term || eq.name.toLowerCase().includes(term) || (eq.location || '').toLowerCase().includes(term))
        );
        if (!available.length) {
            resultsDiv.innerHTML = '<div class="equipment-picker-empty">No equipment found</div>';
            return;
        }
        resultsDiv.innerHTML = available.map(eq => `
            <div class="equipment-picker-item" data-eq-id="${eq.id}">
                ${eq.image_url
                    ? `<img src="${escapeHtml(eq.image_url)}" alt="">`
                    : `<div class="equipment-picker-item-placeholder">&#9881;</div>`
                }
                <div class="equipment-picker-item-info">
                    <div class="equipment-picker-item-name">${escapeHtml(eq.name)}</div>
                    ${eq.location ? `<div class="equipment-picker-item-location">${escapeHtml(eq.location)}</div>` : ''}
                </div>
            </div>
        `).join('');
        resultsDiv.querySelectorAll('.equipment-picker-item').forEach(item => {
            item.addEventListener('click', () => {
                syncSopEditorItemsFromDom();
                const eqId = item.dataset.eqId;
                if (!sopEditorItems[idx].equipment) sopEditorItems[idx].equipment = [];
                if (sopEditorItems[idx].equipment.length >= 5) {
                    showToast('Maximum 5 equipment per task', 'error');
                    return;
                }
                sopEditorItems[idx].equipment.push(eqId);
                dropdown.style.display = 'none';
                renderSopEditorItems();
            });
        });
    }
    render('');
    searchInput.oninput = () => render(searchInput.value);
}

// Close equipment picker when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.sop-item-equipment')) {
        document.querySelectorAll('.equipment-picker-dropdown').forEach(dd => dd.style.display = 'none');
    }
});
