// ==================== STORAGE BROWSER ====================

const STORAGE_BUCKET = 'sop-media';
let storageFiles = [];
let storageUsedUrls = new Map();
let storageSelectedIds = new Set();
let storageSortKey = 'size';
let storageSortAsc = false;
let storageFilterType = '';
let storageFilterUsage = '';
let storageTotalSize = 0;

function formatFileSize(bytes) {
    if (bytes == null) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function classifyPath(fullPath) {
    if (fullPath.includes('/task-videos/')) return 'video';
    if (fullPath.includes('/task-audio/')) return 'audio';
    if (fullPath.includes('/task-screenshots/')) return 'screenshot';
    if (fullPath.includes('/task-markup/')) return 'markup';
    if (fullPath.includes('/task-media/')) return 'image';
    if (fullPath.includes('/equipment/')) return 'equipment';
    if (fullPath.includes('/inventory-checks/')) return 'inv-check';
    if (fullPath.includes('/inventory/')) return 'inventory';
    return 'sop';
}

function typeLabel(type) {
    const labels = {
        video: 'Video', audio: 'Audio', screenshot: 'Screenshot',
        markup: 'Markup', image: 'Task Image', equipment: 'Equipment',
        'inv-check': 'Inv. Check', inventory: 'Inventory', sop: 'SOP Media'
    };
    return labels[type] || type;
}

function typeBadgeClass(type) {
    const map = {
        video: 'badge-danger', audio: 'badge-warning', screenshot: 'badge-info',
        markup: 'badge-info', image: 'badge-primary', equipment: 'badge-secondary',
        'inv-check': 'badge-secondary', inventory: 'badge-secondary', sop: 'badge-primary'
    };
    return map[type] || '';
}

async function collectUsedUrls() {
    storageUsedUrls.clear();
    const sb = supabaseClient;

    const [eqRes, invRes, invCheckRes, tlRes, tlItemRes, sopItemRes] = await Promise.all([
        sb.from('equipment').select('id, name, image_url'),
        sb.from('inventory_items').select('id, name, image_url'),
        sb.from('inventory_checks').select('id, item_id, photo_url, run_id'),
        sb.from('task_lists').select('id, title, source_video_url'),
        sb.from('task_list_items').select('id, task_list_id, title, media'),
        sb.from('sop_items').select('id, sop_template_id, title, media'),
    ]);

    (eqRes.data || []).forEach(r => {
        if (r.image_url) storageUsedUrls.set(r.image_url, { table: 'equipment', label: r.name, id: r.id });
    });
    (invRes.data || []).forEach(r => {
        if (r.image_url) storageUsedUrls.set(r.image_url, { table: 'inventory_items', label: r.name, id: r.id });
    });
    (invCheckRes.data || []).forEach(r => {
        if (r.photo_url) storageUsedUrls.set(r.photo_url, { table: 'inventory_checks', label: `Check #${r.run_id?.slice(0, 8)}`, id: r.id });
    });
    (tlRes.data || []).forEach(r => {
        if (r.source_video_url) storageUsedUrls.set(r.source_video_url, { table: 'task_lists', label: r.title, id: r.id });
    });
    (tlItemRes.data || []).forEach(r => {
        (r.media || []).forEach(m => {
            if (m.url) storageUsedUrls.set(m.url, { table: 'task_list_items', label: r.title, id: r.id, parent: r.task_list_id });
        });
    });
    (sopItemRes.data || []).forEach(r => {
        (r.media || []).forEach(m => {
            if (m.url) storageUsedUrls.set(m.url, { table: 'sop_items', label: r.title, id: r.id, parent: r.sop_template_id });
        });
    });
}

async function listBucketRecursive(prefix) {
    const results = [];
    const { data, error } = await supabaseClient.storage.from(STORAGE_BUCKET).list(prefix || '', {
        limit: 1000,
        sortBy: { column: 'name', order: 'asc' },
    });
    if (error || !data) return results;

    for (const item of data) {
        if (item.name === '.emptyFolderPlaceholder') continue;
        const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id) {
            const { data: urlData } = supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(fullPath);
            results.push({
                id: item.id,
                name: item.name,
                path: fullPath,
                publicUrl: urlData?.publicUrl || '',
                size: item.metadata?.size || 0,
                mimetype: item.metadata?.mimetype || '',
                created_at: item.created_at,
                updated_at: item.updated_at,
                type: classifyPath(fullPath),
            });
        } else {
            const children = await listBucketRecursive(fullPath);
            results.push(...children);
        }
    }
    return results;
}

function getFilteredFiles() {
    let files = [...storageFiles];
    if (storageFilterType) files = files.filter(f => f.type === storageFilterType);
    if (storageFilterUsage === 'orphaned') files = files.filter(f => !storageUsedUrls.has(f.publicUrl));
    if (storageFilterUsage === 'in-use') files = files.filter(f => storageUsedUrls.has(f.publicUrl));

    files.sort((a, b) => {
        let va, vb;
        if (storageSortKey === 'size') { va = a.size; vb = b.size; }
        else if (storageSortKey === 'date') { va = a.created_at || ''; vb = b.created_at || ''; }
        else if (storageSortKey === 'type') { va = a.type; vb = b.type; }
        else if (storageSortKey === 'name') { va = a.name.toLowerCase(); vb = b.name.toLowerCase(); }
        else { va = a.size; vb = b.size; }
        if (va < vb) return storageSortAsc ? -1 : 1;
        if (va > vb) return storageSortAsc ? 1 : -1;
        return 0;
    });
    return files;
}

function renderStorageSummary() {
    const el = document.getElementById('storage-summary');
    if (!el) return;
    const orphanedFiles = storageFiles.filter(f => !storageUsedUrls.has(f.publicUrl));
    const orphanedSize = orphanedFiles.reduce((s, f) => s + (f.size || 0), 0);
    const videoFiles = storageFiles.filter(f => f.type === 'video');
    const videoSize = videoFiles.reduce((s, f) => s + (f.size || 0), 0);
    const screenshotFiles = storageFiles.filter(f => f.type === 'screenshot');
    const screenshotSize = screenshotFiles.reduce((s, f) => s + (f.size || 0), 0);

    el.innerHTML = `
        <div class="storage-stat-cards">
            <div class="storage-stat-card">
                <div class="storage-stat-value">${formatFileSize(storageTotalSize)}</div>
                <div class="storage-stat-label">Total</div>
                <div class="storage-stat-count">${storageFiles.length} files</div>
            </div>
            <div class="storage-stat-card storage-stat-danger" style="cursor:pointer" onclick="setStorageFilter('usage','orphaned')">
                <div class="storage-stat-value">${formatFileSize(orphanedSize)}</div>
                <div class="storage-stat-label">Orphaned</div>
                <div class="storage-stat-count">${orphanedFiles.length} files — safe to delete</div>
            </div>
            <div class="storage-stat-card" style="cursor:pointer" onclick="setStorageFilter('type','video')">
                <div class="storage-stat-value">${formatFileSize(videoSize)}</div>
                <div class="storage-stat-label">Videos</div>
                <div class="storage-stat-count">${videoFiles.length} files</div>
            </div>
            <div class="storage-stat-card" style="cursor:pointer" onclick="setStorageFilter('type','screenshot')">
                <div class="storage-stat-value">${formatFileSize(screenshotSize)}</div>
                <div class="storage-stat-label">Screenshots</div>
                <div class="storage-stat-count">${screenshotFiles.length} files</div>
            </div>
        </div>
    `;
}

function renderStorageTable() {
    const container = document.getElementById('storage-file-list');
    if (!container) return;
    const files = getFilteredFiles();
    const selectedCount = storageSelectedIds.size;
    const selectedSize = storageFiles.filter(f => storageSelectedIds.has(f.id)).reduce((s, f) => s + (f.size || 0), 0);

    const allChecked = files.length > 0 && files.every(f => storageSelectedIds.has(f.id));

    container.innerHTML = `
        <div class="storage-toolbar">
            <div class="storage-filters">
                <select id="storage-filter-type" class="storage-select">
                    <option value="">All types</option>
                    <option value="video" ${storageFilterType === 'video' ? 'selected' : ''}>Videos</option>
                    <option value="audio" ${storageFilterType === 'audio' ? 'selected' : ''}>Audio</option>
                    <option value="screenshot" ${storageFilterType === 'screenshot' ? 'selected' : ''}>Screenshots</option>
                    <option value="markup" ${storageFilterType === 'markup' ? 'selected' : ''}>Markup</option>
                    <option value="image" ${storageFilterType === 'image' ? 'selected' : ''}>Task Images</option>
                    <option value="equipment" ${storageFilterType === 'equipment' ? 'selected' : ''}>Equipment</option>
                    <option value="inventory" ${storageFilterType === 'inventory' ? 'selected' : ''}>Inventory</option>
                    <option value="inv-check" ${storageFilterType === 'inv-check' ? 'selected' : ''}>Inv. Checks</option>
                    <option value="sop" ${storageFilterType === 'sop' ? 'selected' : ''}>SOP Media</option>
                </select>
                <select id="storage-filter-usage" class="storage-select">
                    <option value="">All files</option>
                    <option value="orphaned" ${storageFilterUsage === 'orphaned' ? 'selected' : ''}>Orphaned only</option>
                    <option value="in-use" ${storageFilterUsage === 'in-use' ? 'selected' : ''}>In-use only</option>
                </select>
            </div>
            <div class="storage-actions-bar">
                ${selectedCount > 0
                    ? `<span class="storage-sel-info">${selectedCount} selected (${formatFileSize(selectedSize)})</span>
                       <button class="btn btn-danger btn-sm" id="storage-delete-selected-btn">Delete Selected</button>`
                    : ''}
            </div>
        </div>
        ${files.length === 0
            ? '<div class="empty-state"><p>No files match the current filters</p></div>'
            : `
        <div class="storage-table-wrap">
            <table class="storage-table">
                <thead>
                    <tr>
                        <th class="storage-th-check"><input type="checkbox" id="storage-select-all" ${allChecked ? 'checked' : ''}></th>
                        <th class="storage-th-preview"></th>
                        <th class="storage-th-sortable" data-sort="name">Name ${storageSortKey === 'name' ? (storageSortAsc ? '↑' : '↓') : ''}</th>
                        <th class="storage-th-sortable" data-sort="type">Type ${storageSortKey === 'type' ? (storageSortAsc ? '↑' : '↓') : ''}</th>
                        <th class="storage-th-sortable" data-sort="size">Size ${storageSortKey === 'size' ? (storageSortAsc ? '↑' : '↓') : ''}</th>
                        <th class="storage-th-sortable" data-sort="date">Created ${storageSortKey === 'date' ? (storageSortAsc ? '↑' : '↓') : ''}</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${files.map(f => {
                        const usage = storageUsedUrls.get(f.publicUrl);
                        const isImg = f.mimetype?.startsWith('image/');
                        const checked = storageSelectedIds.has(f.id);
                        return `
                    <tr class="${checked ? 'storage-row-selected' : ''}">
                        <td><input type="checkbox" class="storage-row-check" data-id="${f.id}" ${checked ? 'checked' : ''}></td>
                        <td class="storage-td-preview">
                            ${isImg ? `<img src="${escapeHtml(f.publicUrl)}" alt="" class="storage-thumb" loading="lazy">` : `<div class="storage-thumb-placeholder">${f.type === 'video' ? '▶' : f.type === 'audio' ? '♪' : '◆'}</div>`}
                        </td>
                        <td class="storage-td-name" title="${escapeHtml(f.path)}">
                            <div class="storage-filename">${escapeHtml(f.name)}</div>
                            <div class="storage-filepath">${escapeHtml(f.path)}</div>
                        </td>
                        <td><span class="badge ${typeBadgeClass(f.type)}">${typeLabel(f.type)}</span></td>
                        <td class="storage-td-size">${formatFileSize(f.size)}</td>
                        <td class="storage-td-date">${f.created_at ? new Date(f.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                        <td>${usage
                            ? `<span class="badge badge-success">In use</span><div class="storage-usage-ref">${escapeHtml(usage.table)}: ${escapeHtml(usage.label || '')}</div>`
                            : `<span class="badge badge-danger">Orphaned</span>`}
                        </td>
                    </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>`}
    `;

    document.getElementById('storage-filter-type')?.addEventListener('change', (e) => {
        storageFilterType = e.target.value;
        renderStorageTable();
    });
    document.getElementById('storage-filter-usage')?.addEventListener('change', (e) => {
        storageFilterUsage = e.target.value;
        renderStorageTable();
    });
    document.getElementById('storage-select-all')?.addEventListener('change', (e) => {
        if (e.target.checked) {
            files.forEach(f => storageSelectedIds.add(f.id));
        } else {
            files.forEach(f => storageSelectedIds.delete(f.id));
        }
        renderStorageTable();
    });
    container.querySelectorAll('.storage-row-check').forEach(cb => {
        cb.addEventListener('change', () => {
            const id = cb.dataset.id;
            if (cb.checked) storageSelectedIds.add(id);
            else storageSelectedIds.delete(id);
            renderStorageTable();
        });
    });
    container.querySelectorAll('.storage-th-sortable').forEach(th => {
        th.addEventListener('click', () => {
            const key = th.dataset.sort;
            if (storageSortKey === key) storageSortAsc = !storageSortAsc;
            else { storageSortKey = key; storageSortAsc = true; }
            renderStorageTable();
        });
    });
    document.getElementById('storage-delete-selected-btn')?.addEventListener('click', deleteSelectedFiles);
}

async function deleteSelectedFiles() {
    const ids = [...storageSelectedIds];
    const filesToDelete = storageFiles.filter(f => ids.includes(f.id));
    if (!filesToDelete.length) return;

    const inUse = filesToDelete.filter(f => storageUsedUrls.has(f.publicUrl));
    let msg = `Delete ${filesToDelete.length} file(s) (${formatFileSize(filesToDelete.reduce((s, f) => s + (f.size || 0), 0))})?`;
    if (inUse.length) msg += `\n\n⚠ ${inUse.length} of these are still referenced in the database. Deleting them will break those references.`;

    const confirmed = await showConfirmModal(
        'Delete Files',
        msg,
        { okLabel: 'Delete', okClass: 'btn-danger' }
    );
    if (!confirmed) return;

    const paths = filesToDelete.map(f => f.path);
    const batchSize = 100;
    let deleted = 0;
    let errors = 0;

    for (let i = 0; i < paths.length; i += batchSize) {
        const batch = paths.slice(i, i + batchSize);
        const { error } = await supabaseClient.storage.from(STORAGE_BUCKET).remove(batch);
        if (error) errors += batch.length;
        else deleted += batch.length;
    }

    storageSelectedIds.clear();
    showToast(`Deleted ${deleted} file(s)${errors ? `, ${errors} failed` : ''}`);
    loadStorageBrowser();
}

function setStorageFilter(key, value) {
    if (key === 'type') {
        storageFilterType = storageFilterType === value ? '' : value;
        storageFilterUsage = '';
    } else {
        storageFilterUsage = storageFilterUsage === value ? '' : value;
        storageFilterType = '';
    }
    renderStorageTable();
}
window.setStorageFilter = setStorageFilter;

document.getElementById('storage-refresh-btn')?.addEventListener('click', () => loadStorageBrowser());

async function loadStorageBrowser() {
    const container = document.getElementById('storage-file-list');
    const summaryEl = document.getElementById('storage-summary');
    if (!container) return;

    summaryEl.innerHTML = '';
    container.innerHTML = '<div class="empty-state"><div class="loading-spinner"><span class="logo-icon pulse">◈</span><p>Scanning storage bucket…</p></div></div>';

    try {
        await collectUsedUrls();
        storageFiles = await listBucketRecursive('');
        storageTotalSize = storageFiles.reduce((s, f) => s + (f.size || 0), 0);
        storageSelectedIds.clear();
        renderStorageSummary();
        renderStorageTable();
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><p>Failed to load storage: ${escapeHtml(err.message)}</p></div>`;
    }
}
