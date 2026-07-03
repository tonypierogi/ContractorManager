// ==================== TOGGLE SHIFT PAID STATUS ====================

async function toggleShiftPaid(shiftId, currentStatus) {
    if (!supabaseClient) return;
    
    const newStatus = !currentStatus;
    
    try {
        const { error } = await supabaseClient
            .from('time_entries')
            .update({ paid: newStatus })
            .eq('id', shiftId);
        
        if (error) throw error;
        
        // Clear cache and reload
        clearShiftsCache();
        
        // Reload appropriate view
        if (userProfile?.role === 'admin') {
            await loadAllTimesheets();
        } else {
            await loadShifts();
        }
        
        showToast(newStatus ? 'Shift marked as paid' : 'Shift marked as pending');
    } catch (error) {
        console.error('Toggle paid status error:', error);
        showToast('Failed to update shift status', 'error');
    }
}

// ==================== TASK LISTS ====================

const TASK_LIST_STORAGE_BUCKET = 'sop-media';

function formatVideoTime(seconds) {
    if (seconds == null || isNaN(seconds) || seconds < 0) return '';
    const s = Math.floor(seconds);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    return `${m}:${String(s % 60).padStart(2, '0')}`;
}
let tlEditorItems = [];
let tlEditorMode = 'manual';
let tlVideoFile = null;
let tlVideoUrl = null;
let tlReorderSelectedIdxs = new Set();
let tlReorderSelectDrag = null;

function moveTlItemsByIndexSelection(items, selectedIdxs, insertIndex) {
    const sortedIdxs = [...selectedIdxs]
        .filter(idx => idx >= 0 && idx < items.length)
        .sort((a, b) => a - b);
    if (!sortedIdxs.length) return { items, selectedIdxs: new Set() };

    const selectedSet = new Set(sortedIdxs);
    const movingItems = sortedIdxs.map(idx => items[idx]);
    const remainingItems = items.filter((_, idx) => !selectedSet.has(idx));
    const removedBeforeTarget = sortedIdxs.filter(idx => idx < insertIndex).length;
    const insertIdx = Math.max(
        0,
        Math.min(insertIndex - removedBeforeTarget, remainingItems.length)
    );

    remainingItems.splice(insertIdx, 0, ...movingItems);
    return {
        items: remainingItems,
        selectedIdxs: new Set(movingItems.map((_, offset) => insertIdx + offset))
    };
}

function updateTlReorderSelectionBar() {
    const bar = document.getElementById('tl-reorder-multi-bar');
    const countEl = document.getElementById('tl-reorder-multi-count');
    const count = tlReorderSelectedIdxs.size;
    if (bar) bar.style.display = count ? 'flex' : 'none';
    if (countEl) countEl.textContent = `${count} selected to move`;
}

function setTlReorderSelected(idx, selected) {
    if (selected) tlReorderSelectedIdxs.add(idx);
    else tlReorderSelectedIdxs.delete(idx);
    document.querySelectorAll(`.tl-items-list .tl-item-row[data-idx="${idx}"]`).forEach(row => {
        row.classList.toggle('reorder-selected', selected);
        const cb = row.querySelector('.tl-reorder-select');
        if (cb) cb.checked = selected;
    });
    updateTlReorderSelectionBar();
}

function clearTlReorderSelection() {
    tlReorderSelectedIdxs = new Set();
    document.querySelectorAll('.tl-items-list .tl-item-row.reorder-selected').forEach(row => {
        row.classList.remove('reorder-selected');
        const cb = row.querySelector('.tl-reorder-select');
        if (cb) cb.checked = false;
    });
    updateTlReorderSelectionBar();
}

function getTlDragSelection(fromIdx) {
    if (tlReorderSelectedIdxs.has(fromIdx)) return new Set(tlReorderSelectedIdxs);
    return new Set([fromIdx]);
}

document.addEventListener('pointerup', () => {
    tlReorderSelectDrag = null;
});
document.addEventListener('pointermove', (e) => {
    if (!tlReorderSelectDrag) return;
    const row = document.elementFromPoint(e.clientX, e.clientY)?.closest('.tl-items-list .tl-item-row');
    if (!row) return;
    setTlReorderSelected(parseInt(row.dataset.idx, 10), tlReorderSelectDrag.selecting);
    if (e.cancelable) e.preventDefault();
});

let _ffmpeg = null;
let _ffmpegUtil = null;
const MAX_COMPRESS_WORKERS = 4;
const COMPRESS_CHUNK_MIN_SECONDS = 60;

function buildFFmpegWorkerBlobURL() {
    const workerScript = `
const CORE_URL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js";
const FFMessageType = {
    LOAD:"LOAD",EXEC:"EXEC",WRITE_FILE:"WRITE_FILE",READ_FILE:"READ_FILE",
    DELETE_FILE:"DELETE_FILE",RENAME:"RENAME",CREATE_DIR:"CREATE_DIR",
    LIST_DIR:"LIST_DIR",DELETE_DIR:"DELETE_DIR",ERROR:"ERROR",
    DOWNLOAD:"DOWNLOAD",PROGRESS:"PROGRESS",LOG:"LOG",MOUNT:"MOUNT",UNMOUNT:"UNMOUNT"
};
const ERROR_UNKNOWN_MESSAGE_TYPE = new Error("unknown message type");
const ERROR_NOT_LOADED = new Error("ffmpeg is not loaded, call ffmpeg.load() first");
const ERROR_IMPORT_FAILURE = new Error("failed to import ffmpeg-core.js");

let ffmpeg;
const load = async ({ coreURL: _coreURL, wasmURL: _wasmURL, workerURL: _workerURL }) => {
    const first = !ffmpeg;
    try {
        if (!_coreURL) _coreURL = CORE_URL;
        importScripts(_coreURL);
    } catch {
        if (!_coreURL) _coreURL = CORE_URL.replace('/umd/', '/esm/');
        const _mod = await import(_coreURL);
        if (_mod.default) self.createFFmpegCore = _mod.default;
        if (!self.createFFmpegCore) throw ERROR_IMPORT_FAILURE;
    }
    const coreURL = _coreURL;
    const wasmURL = _wasmURL ? _wasmURL : _coreURL.replace(/.js$/g, ".wasm");
    const workerURL = _workerURL ? _workerURL : _coreURL.replace(/.js$/g, ".worker.js");
    ffmpeg = await self.createFFmpegCore({
        mainScriptUrlOrBlob: coreURL + "#" + btoa(JSON.stringify({ wasmURL, workerURL })),
    });
    ffmpeg.setLogger((data) => self.postMessage({ type: FFMessageType.LOG, data }));
    ffmpeg.setProgress((data) => self.postMessage({ type: FFMessageType.PROGRESS, data }));
    return first;
};
const exec = ({ args, timeout = -1 }) => { ffmpeg.setTimeout(timeout); ffmpeg.exec(...args); const ret = ffmpeg.ret; ffmpeg.reset(); return ret; };
const writeFile = ({ path, data }) => { ffmpeg.FS.writeFile(path, data); return true; };
const readFile = ({ path, encoding }) => ffmpeg.FS.readFile(path, { encoding });
const deleteFile = ({ path }) => { ffmpeg.FS.unlink(path); return true; };
const rename = ({ oldPath, newPath }) => { ffmpeg.FS.rename(oldPath, newPath); return true; };
const createDir = ({ path }) => { ffmpeg.FS.mkdir(path); return true; };
const listDir = ({ path }) => {
    const names = ffmpeg.FS.readdir(path);
    const nodes = [];
    for (const name of names) { const stat = ffmpeg.FS.stat(path+"/"+name); nodes.push({ name, isDir: ffmpeg.FS.isDir(stat.mode) }); }
    return nodes;
};
const deleteDir = ({ path }) => { ffmpeg.FS.rmdir(path); return true; };
const mount = ({ fsType, options, mountPoint }) => { const fs = ffmpeg.FS.filesystems[fsType]; if (!fs) return false; ffmpeg.FS.mount(fs, options, mountPoint); return true; };
const unmount = ({ mountPoint }) => { ffmpeg.FS.unmount(mountPoint); return true; };

self.onmessage = async ({ data: { id, type, data: _data } }) => {
    const trans = [];
    let data;
    try {
        if (type !== FFMessageType.LOAD && !ffmpeg) throw ERROR_NOT_LOADED;
        switch (type) {
            case FFMessageType.LOAD: data = await load(_data); break;
            case FFMessageType.EXEC: data = exec(_data); break;
            case FFMessageType.WRITE_FILE: data = writeFile(_data); break;
            case FFMessageType.READ_FILE: data = readFile(_data); break;
            case FFMessageType.DELETE_FILE: data = deleteFile(_data); break;
            case FFMessageType.RENAME: data = rename(_data); break;
            case FFMessageType.CREATE_DIR: data = createDir(_data); break;
            case FFMessageType.LIST_DIR: data = listDir(_data); break;
            case FFMessageType.DELETE_DIR: data = deleteDir(_data); break;
            case FFMessageType.MOUNT: data = mount(_data); break;
            case FFMessageType.UNMOUNT: data = unmount(_data); break;
            default: throw ERROR_UNKNOWN_MESSAGE_TYPE;
        }
    } catch (e) { self.postMessage({ id, type: FFMessageType.ERROR, data: e.toString() }); return; }
    if (data instanceof Uint8Array) trans.push(data.buffer);
    self.postMessage({ id, type, data }, trans);
};`;
    const blob = new Blob([workerScript], { type: 'text/javascript' });
    return URL.createObjectURL(blob);
}

async function loadFFmpegInstance() {
    if (_ffmpeg) return _ffmpeg;

    const { FFmpeg } = await import('https://esm.sh/@ffmpeg/ffmpeg@0.12.10');
    _ffmpegUtil = await import('https://esm.sh/@ffmpeg/util@0.12.1');

    const ffmpeg = new FFmpeg();
    const esmBase = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';

    await ffmpeg.load({
        coreURL: `${esmBase}/ffmpeg-core.js`,
        wasmURL: `${esmBase}/ffmpeg-core.wasm`,
        classWorkerURL: buildFFmpegWorkerBlobURL(),
    });

    _ffmpeg = ffmpeg;
    return ffmpeg;
}

async function createFreshFFmpegInstance() {
    const { FFmpeg } = await import('https://esm.sh/@ffmpeg/ffmpeg@0.12.10');
    const ffmpeg = new FFmpeg();
    const esmBase = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
    await ffmpeg.load({
        coreURL: `${esmBase}/ffmpeg-core.js`,
        wasmURL: `${esmBase}/ffmpeg-core.wasm`,
        classWorkerURL: buildFFmpegWorkerBlobURL(),
    });
    return ffmpeg;
}

const TUNED_ENCODE_ARGS = [
    '-vf', 'scale=-2:480',
    '-r', '15',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '30',
    '-c:a', 'aac',
    '-b:a', '64k',
];

async function compressVideoChunked(mainFfmpeg, inputName, duration, onProgress) {
    const numWorkers = Math.min(MAX_COMPRESS_WORKERS, navigator.hardwareConcurrency || 2);

    if (duration < COMPRESS_CHUNK_MIN_SECONDS || numWorkers <= 1) {
        onProgress('Compressing video…', 0);
        const handler = ({ progress }) => {
            onProgress(`Compressing video… ${Math.min(100, Math.round(progress * 100))}%`, progress);
        };
        mainFfmpeg.on('progress', handler);
        await mainFfmpeg.exec(['-i', inputName, ...TUNED_ENCODE_ARGS, 'output.mp4']);
        mainFfmpeg.off('progress', handler);
        const data = await mainFfmpeg.readFile('output.mp4');
        await mainFfmpeg.deleteFile(inputName);
        await mainFfmpeg.deleteFile('output.mp4');
        return new Blob([data.buffer], { type: 'video/mp4' });
    }

    const chunkDuration = Math.ceil(duration / numWorkers);
    onProgress(`Splitting video into ${numWorkers} chunks…`, 0);

    const chunkDataArr = [];
    for (let i = 0; i < numWorkers; i++) {
        const start = i * chunkDuration;
        const outName = `chunk_${i}.mp4`;
        await mainFfmpeg.exec([
            '-ss', String(start),
            '-i', inputName,
            '-t', String(chunkDuration),
            '-c', 'copy',
            '-avoid_negative_ts', 'make_zero',
            outName
        ]);
        chunkDataArr.push(await mainFfmpeg.readFile(outName));
        await mainFfmpeg.deleteFile(outName);
    }
    await mainFfmpeg.deleteFile(inputName);

    const workerProgress = new Array(numWorkers).fill(0);

    async function compressChunk(chunkData, index) {
        const ffmpeg = await createFreshFFmpegInstance();
        ffmpeg.on('progress', ({ progress }) => {
            workerProgress[index] = progress;
            const avg = workerProgress.reduce((a, b) => a + b, 0) / numWorkers;
            onProgress(`Compressing video… ${Math.min(100, Math.round(avg * 100))}%`, avg);
        });
        await ffmpeg.writeFile('chunk.mp4', chunkData);
        await ffmpeg.exec(['-i', 'chunk.mp4', ...TUNED_ENCODE_ARGS, 'out.mp4']);
        const result = await ffmpeg.readFile('out.mp4');
        ffmpeg.terminate();
        return result;
    }

    onProgress(`Compressing video (${numWorkers} workers)… 0%`, 0);
    const compressed = await Promise.all(
        chunkDataArr.map((data, i) => compressChunk(data, i))
    );

    onProgress('Joining compressed segments…', 0.95);
    let listContent = '';
    for (let i = 0; i < compressed.length; i++) {
        const name = `c_${i}.mp4`;
        await mainFfmpeg.writeFile(name, compressed[i]);
        listContent += `file '${name}'\n`;
    }
    await mainFfmpeg.writeFile('list.txt', new TextEncoder().encode(listContent));
    await mainFfmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', 'final.mp4']);
    const finalData = await mainFfmpeg.readFile('final.mp4');

    for (let i = 0; i < compressed.length; i++) await mainFfmpeg.deleteFile(`c_${i}.mp4`);
    await mainFfmpeg.deleteFile('list.txt');
    await mainFfmpeg.deleteFile('final.mp4');

    return new Blob([finalData.buffer], { type: 'video/mp4' });
}

let tlTranscript = null;
let tlCurrentFilter = 'all';

// ---- Admin: Load & List ----

async function loadTaskLists() {
    const container = document.getElementById('tl-cards');
    const emptyState = document.getElementById('tl-empty-state');
    if (!container) return;

    let query = supabaseClient
        .from('task_lists')
        .select('*, task_list_items(id), task_list_assignments(id, status)')
        .order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) {
        container.innerHTML = '<p class="text-muted">Failed to load task lists.</p>';
        return;
    }

    let filtered = data || [];
    if (tlCurrentFilter === 'sop') filtered = filtered.filter(t => t.is_sop);
    else if (tlCurrentFilter === 'task') filtered = filtered.filter(t => !t.is_sop);

    if (filtered.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = '';
        return;
    }
    emptyState.style.display = 'none';

    container.innerHTML = filtered.map(t => {
        const itemCount = (t.task_list_items || []).length;
        const assignments = t.task_list_assignments || [];
        const completedCount = assignments.filter(a => a.status === 'completed').length;
        const locLabel = t.location ? getLocationLabel(t.location) : null;
        return `
        <div class="tl-card" data-id="${t.id}">
            <div class="tl-card-header">
                <h4>${escapeHtml(t.title)} <span class="tl-badge ${t.is_sop ? 'sop' : 'task'}">${t.is_sop ? 'SOP' : 'Task'}</span>${locLabel ? ` <span class="tl-badge location">${escapeHtml(locLabel)}</span>` : ''}</h4>
            </div>
            ${t.description ? `<div class="tl-card-meta">${escapeHtml(t.description)}</div>` : ''}
            <div class="tl-card-stats">
                <span>${itemCount} task${itemCount !== 1 ? 's' : ''}</span>
                <span>${assignments.length} assigned</span>
                <span>${completedCount} completed</span>
                ${t.source_video_url ? '<span>Has video</span>' : ''}
            </div>
            <div class="tl-card-actions">
                <button type="button" class="btn btn-secondary btn-sm tl-action-view" data-id="${t.id}">View</button>
                <button type="button" class="btn btn-secondary btn-sm tl-action-assign" data-id="${t.id}">Assign</button>
                ${t.share_token ? `<button type="button" class="btn btn-secondary btn-sm tl-action-share" data-id="${t.id}" data-token="${escapeHtml(t.share_token)}" title="Copy share link">Share</button>` : ''}
                <button type="button" class="btn btn-secondary btn-sm tl-action-edit" data-id="${t.id}">Edit</button>
                <button type="button" class="btn btn-danger btn-sm tl-action-delete" data-id="${t.id}" data-name="${escapeHtml(t.title)}">Delete</button>
            </div>
        </div>`;
    }).join('');

    container.querySelectorAll('.tl-action-view').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); openTaskListDetail(btn.dataset.id); });
    });
    container.querySelectorAll('.tl-action-assign').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); openTaskListAssignModal(btn.dataset.id); });
    });
    container.querySelectorAll('.tl-action-edit').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); openTaskListEditor(btn.dataset.id); });
    });
    container.querySelectorAll('.tl-action-share').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); copyTaskListShareLink(btn.dataset.token); });
    });
    container.querySelectorAll('.tl-action-delete').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); deleteTaskList(btn.dataset.id, btn.dataset.name); });
    });
}

function getTaskListShareUrl(token) {
    const base = location.origin + location.pathname.replace(/index\.html?$/, '').replace(/\/$/, '') + '/list';
    return `${base}?token=${encodeURIComponent(token)}`;
}

async function copyTaskListShareLink(token) {
    if (!token) return;
    const url = getTaskListShareUrl(token);
    try {
        await navigator.clipboard.writeText(url);
        showToast('Share link copied to clipboard');
    } catch {
        showToast('Could not copy. Share this link: ' + url, 'error');
    }
}

async function ensureTaskListShareToken(taskListId) {
    const { data: tl } = await supabaseClient.from('task_lists').select('share_token').eq('id', taskListId).single();
    if (tl?.share_token) return tl.share_token;
    const token = crypto.randomUUID();
    const { error } = await supabaseClient.from('task_lists').update({ share_token: token }).eq('id', taskListId);
    if (error) return null;
    return token;
}

async function deleteTaskList(id, name) {
    if (!confirm(`Delete task list "${name}"? This cannot be undone.`)) return;
    const { error } = await supabaseClient.from('task_lists').delete().eq('id', id);
    if (error) { showToast('Failed to delete task list', 'error'); return; }
    showToast('Task list deleted');
    loadTaskLists();
}

// ---- Admin: Editor ----

function resetTlEditor() {
    tlEditorItems = [];
    tlEditorMode = 'manual';
    tlVideoFile = null;
    tlVideoUrl = null;
    tlTranscript = null;
    tlCopyMultiSelect = false;
    tlCopySelectedIdxs = new Set();
    clearTlReorderSelection();
    const copyBar = document.getElementById('tl-copy-multi-bar');
    if (copyBar) copyBar.style.display = 'none';
    const copyToggle = document.getElementById('tl-copy-multi-btn');
    if (copyToggle) copyToggle.classList.remove('active');
    document.getElementById('tl-editor-id').value = '';
    document.getElementById('tl-editor-name').value = '';
    document.getElementById('tl-editor-description').value = '';
    document.getElementById('tl-editor-is-sop').checked = false;
    document.getElementById('tl-editor-location').value = '';
    document.getElementById('tl-editor-shareable').checked = false;
    document.getElementById('tl-editor-title').textContent = 'Create Task List';
    document.getElementById('tl-items-list').innerHTML = '';

    // Reset video UI
    document.getElementById('tl-video-upload-area').style.display = '';
    document.getElementById('tl-video-preview').style.display = 'none';
    document.getElementById('tl-video-processing').style.display = 'none';
    document.getElementById('tl-process-video-btn').style.display = 'none';
    document.getElementById('tl-transcript-panel').style.display = 'none';
    document.getElementById('tl-generated-items').style.display = 'none';
    const compressEl = document.getElementById('tl-compress-status');
    if (compressEl) compressEl.style.display = 'none';

    // Default to manual tab
    document.querySelectorAll('.tl-mode-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.tl-mode-tab[data-mode="manual"]').classList.add('active');
    document.getElementById('tl-mode-manual').style.display = '';
    document.getElementById('tl-mode-video').style.display = 'none';
}

async function openTaskListEditor(editId) {
    resetTlEditor();
    await ensureEquipmentLoaded();
    if (editId) {
        document.getElementById('tl-editor-title').textContent = 'Edit Task List';
        document.getElementById('tl-editor-id').value = editId;
        const { data: tl } = await supabaseClient.from('task_lists').select('*').eq('id', editId).single();
        if (tl) {
            document.getElementById('tl-editor-name').value = tl.title || '';
            document.getElementById('tl-editor-description').value = tl.description || '';
            document.getElementById('tl-editor-is-sop').checked = tl.is_sop;
            document.getElementById('tl-editor-location').value = tl.location || '';
            document.getElementById('tl-editor-shareable').checked = !!tl.share_token;
            if (tl.source_video_url) tlVideoUrl = tl.source_video_url;
            if (tl.source_transcript) tlTranscript = tl.source_transcript;
        }
        const { data: items } = await supabaseClient
            .from('task_list_items')
            .select('*')
            .eq('task_list_id', editId)
            .order('sort_order');
        if (items) {
            tlEditorItems = items.map(it => ({
                id: it.id,
                title: it.title || '',
                description: it.description || '',
                media: it.media || [],
                type: it.item_type || 'task',
                location_from: it.location_from || null,
                location_to: it.location_to || null,
                equipment: it.equipment || [],
                video_timestamp: it.video_timestamp != null ? it.video_timestamp : null,
                collapsed: false
            }));
        }
    }
    renderTlEditorItems();
    navigateToView('tl-editor', 'admin');
}

function tlLocationOptions(selected) {
    const opts = [
        { value: '', label: 'None' },
        { group: 'Upstairs', items: [
            { value: 'back-closet', label: 'Back Closet' },
            { value: 'big-room', label: 'Big Room' },
            { value: 'loft', label: 'Loft' },
        ]},
        { group: 'Downstairs', items: [
            { value: 'office', label: 'Office' },
            { value: 'av-closet', label: 'AV Closet' },
            { value: 'sauna', label: 'Sauna' },
            { value: 'basement', label: 'Basement' },
            { value: 'lounge', label: 'Lounge' },
            { value: 'lobby', label: 'Lobby' },
            { value: 'bar-closet', label: 'Bar Closet' },
        ]},
    ];
    let html = `<option value=""${!selected ? ' selected' : ''}>None</option>`;
    for (const g of opts) {
        if (g.group) {
            html += `<optgroup label="${g.group}">`;
            for (const o of g.items) {
                html += `<option value="${o.value}"${selected === o.value ? ' selected' : ''}>${o.label}</option>`;
            }
            html += '</optgroup>';
        }
    }
    return html;
}

function renderTlEquipmentTags(item, idx) {
    const eqIds = item.equipment || [];
    if (!eqIds.length) return '';
    return eqIds.map(eqId => {
        const eq = allEquipment.find(e => e.id === eqId);
        if (!eq) return '';
        return `<span class="equipment-tag">
            ${eq.image_url ? `<img src="${escapeHtml(eq.image_url)}" alt="">` : ''}
            <span>${escapeHtml(eq.name)}</span>
            <button type="button" class="equipment-tag-remove tl-eq-remove" data-idx="${idx}" data-eq-id="${eq.id}">&times;</button>
        </span>`;
    }).join('');
}

function renderTlEditorItems(targetList) {
    const listId = targetList || 'tl-items-list';
    const list = document.getElementById(listId);
    if (!list) return;

    list.innerHTML = tlEditorItems.map((item, idx) => {
        const isHeader = item.type === 'header';
        const collapsed = !!item.collapsed;
        const canCollapse = !isHeader;
        return `
        <div class="tl-item-row ${isHeader ? 'tl-item-header' : ''} ${collapsed ? 'tl-collapsed' : ''} ${tlReorderSelectedIdxs.has(idx) ? 'reorder-selected' : ''}" data-idx="${idx}">
            <div class="tl-item-top-row">
                <div class="tl-drag-handle">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                </div>
                <input type="checkbox" class="reorder-select-checkbox tl-reorder-select" data-idx="${idx}" title="Select to move with other items" ${tlReorderSelectedIdxs.has(idx) ? 'checked' : ''}>
                ${canCollapse ? `<button type="button" class="btn btn-icon btn-sm tl-collapse-btn" data-idx="${idx}" title="${collapsed ? 'Expand' : 'Collapse'}">
                    <svg class="tl-collapse-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>` : ''}
                <div class="tl-item-fields">
                    <input type="text" class="tl-item-title" placeholder="${isHeader ? 'Section header' : 'Task title'}" value="${escapeHtml(item.title)}">
                </div>
                <div class="tl-reorder-buttons">
                    <button type="button" class="btn btn-icon btn-sm tl-move-top" data-idx="${idx}" title="Move to top"${idx === 0 ? ' style="display:none"' : ''}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>
                    <button type="button" class="btn btn-icon btn-sm tl-move-up" data-idx="${idx}" title="Move up"${idx === 0 ? ' style="display:none"' : ''}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg></button>
                    <button type="button" class="btn btn-icon btn-sm tl-move-down" data-idx="${idx}" title="Move down"${idx >= tlEditorItems.length - 1 ? ' style="display:none"' : ''}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></button>
                    <button type="button" class="btn btn-icon btn-sm tl-move-bottom" data-idx="${idx}" title="Move to bottom"${idx >= tlEditorItems.length - 1 ? ' style="display:none"' : ''}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg></button>
                </div>
                <div class="tl-item-row-actions">
                    ${!isHeader ? `<input type="checkbox" class="copy-select-checkbox tl-copy-select" data-idx="${idx}" style="display:none;">` : ''}
                    ${!isHeader ? `<button type="button" class="btn btn-icon btn-sm copy-item-btn tl-copy-item-btn" data-idx="${idx}" title="Copy to another list">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>` : ''}
                    <button type="button" class="btn btn-close tl-item-remove" data-idx="${idx}">&times;</button>
                </div>
            </div>
            ${isHeader ? '' : `
            <div class="tl-item-body">
                <textarea class="tl-item-desc" rows="2" placeholder="Description (optional)">${escapeHtml(item.description)}</textarea>
                <div class="tl-item-locations-row">
                    <div class="tl-item-location-field">
                        <label>From</label>
                        <select class="tl-item-location-from" data-idx="${idx}">${tlLocationOptions(item.location_from)}</select>
                    </div>
                    <div class="tl-item-location-field">
                        <label>To</label>
                        <select class="tl-item-location-to" data-idx="${idx}">${tlLocationOptions(item.location_to)}</select>
                    </div>
                </div>
                <div class="tl-item-equipment" data-idx="${idx}">
                    <label>Equipment <span class="text-muted">(max 5)</span></label>
                    <div class="tl-item-equipment-list">${renderTlEquipmentTags(item, idx)}</div>
                    <button type="button" class="btn btn-secondary btn-sm tl-eq-add-btn" data-idx="${idx}">+ Add Equipment</button>
                    <div class="equipment-picker-dropdown" style="display:none;">
                        <input type="text" class="equipment-picker-search" placeholder="Search equipment...">
                        <div class="equipment-picker-results"></div>
                    </div>
                </div>
                <div class="tl-item-media-row">
                    ${(item.media || []).map((m, mi) => `
                        <span class="tl-thumb-wrap" style="position:relative;display:inline-block;" data-idx="${idx}" data-mi="${mi}">
                            <img src="${escapeHtml(m.url)}" class="tl-item-media-thumb tl-thumb-viewable" alt="" data-idx="${idx}" data-mi="${mi}">
                            <button type="button" class="btn btn-close tl-media-remove" data-idx="${idx}" data-mi="${mi}" style="position:absolute;top:-4px;right:-4px;font-size:12px;width:18px;height:18px;">&times;</button>
                        </span>
                    `).join('')}
                    <input type="file" class="tl-item-media-input" accept="image/*" multiple style="display:none;" data-idx="${idx}">
                    <button type="button" class="btn btn-secondary btn-sm tl-item-media-btn" data-idx="${idx}">+ Image</button>
                    ${item.video_timestamp != null ? `<span class="tl-item-timestamp-badge"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> ${escapeHtml(formatVideoTime(item.video_timestamp))}</span>` : ''}
                </div>
            </div>
            `}
        </div>`;
    }).join('');

    list.querySelectorAll('.tl-item-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            syncTlEditorItems(listId);
            tlEditorItems.splice(parseInt(btn.dataset.idx, 10), 1);
            clearTlReorderSelection();
            renderTlEditorItems(listId);
        });
    });

    list.querySelectorAll('.tl-reorder-select').forEach(cb => {
        cb.addEventListener('change', () => {
            if (cb._suppressReorderChange) {
                cb._suppressReorderChange = false;
                return;
            }
            setTlReorderSelected(parseInt(cb.dataset.idx, 10), cb.checked);
        });
        cb.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            const idx = parseInt(cb.dataset.idx, 10);
            const selecting = !cb.checked;
            tlReorderSelectDrag = { selecting };
            cb._suppressReorderClick = true;
            cb._suppressReorderChange = true;
            setTlReorderSelected(idx, selecting);
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
    list.querySelectorAll('.tl-item-row').forEach(rowEl => {
        rowEl.addEventListener('pointerenter', () => {
            if (!tlReorderSelectDrag) return;
            setTlReorderSelected(parseInt(rowEl.dataset.idx, 10), tlReorderSelectDrag.selecting);
        });
    });

    // Collapse toggle
    list.querySelectorAll('.tl-collapse-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx, 10);
            if (tlEditorItems[idx]) {
                syncTlEditorItems(listId);
                tlEditorItems[idx].collapsed = !tlEditorItems[idx].collapsed;
                renderTlEditorItems(listId);
            }
        });
    });

    // Reorder: move up, down, to top, to bottom (DOM-based, no full re-render)
    list.querySelectorAll('.tl-move-top').forEach(btn => {
        btn.addEventListener('click', () => {
            _reorderTlItem(list, listId, parseInt(btn.dataset.idx, 10), 0, false, true);
        });
    });
    list.querySelectorAll('.tl-move-up').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx, 10);
            if (idx > 0) _reorderTlItem(list, listId, idx, idx - 1, false, true);
        });
    });
    list.querySelectorAll('.tl-move-down').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx, 10);
            if (idx < tlEditorItems.length - 1) _reorderTlItem(list, listId, idx, idx + 2, false, true);
        });
    });
    list.querySelectorAll('.tl-move-bottom').forEach(btn => {
        btn.addEventListener('click', () => {
            _reorderTlItem(list, listId, parseInt(btn.dataset.idx, 10), tlEditorItems.length, false, true);
        });
    });
    list.querySelectorAll('.tl-item-media-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            list.querySelector(`.tl-item-media-input[data-idx="${btn.dataset.idx}"]`).click();
        });
    });
    list.querySelectorAll('.tl-item-media-input').forEach(input => {
        input.onchange = async (e) => {
            const files = e.target.files;
            if (!files?.length) return;
            syncTlEditorItems(listId);
            const idx = parseInt(input.dataset.idx, 10);
            for (const rawFile of files) {
                try {
                    const file = await compressImage(rawFile);
                    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                    const path = `${currentUser.id}/task-media/${Date.now()}-${safeName}`;
                    const { data, error } = await supabaseClient.storage.from(TASK_LIST_STORAGE_BUCKET).upload(path, file, { upsert: true });
                    if (error) throw error;
                    const { data: urlData } = supabaseClient.storage.from(TASK_LIST_STORAGE_BUCKET).getPublicUrl(data.path);
                    if (!tlEditorItems[idx].media) tlEditorItems[idx].media = [];
                    tlEditorItems[idx].media.push({ url: urlData.publicUrl, type: 'image' });
                    renderTlEditorItems(listId);
                } catch (err) {
                    showToast('Image upload failed', 'error');
                }
            }
            input.value = '';
        };
    });
    list.querySelectorAll('.tl-media-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            syncTlEditorItems(listId);
            const idx = parseInt(btn.dataset.idx, 10);
            const mi = parseInt(btn.dataset.mi, 10);
            tlEditorItems[idx].media.splice(mi, 1);
            renderTlEditorItems(listId);
        });
    });

    // Equipment: remove tags
    list.querySelectorAll('.tl-eq-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            syncTlEditorItems(listId);
            const idx = parseInt(btn.dataset.idx, 10);
            const eqId = btn.dataset.eqId;
            tlEditorItems[idx].equipment = (tlEditorItems[idx].equipment || []).filter(id => id !== eqId);
            renderTlEditorItems(listId);
        });
    });

    // Equipment: add button opens picker
    list.querySelectorAll('.tl-eq-add-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx, 10);
            const wrapper = btn.closest('.tl-item-equipment');
            openTlEquipmentPicker(wrapper, idx, listId);
        });
    });

    // Thumbnails: tap to view full image in lightbox, long-press to go straight to markup
    list.querySelectorAll('.tl-thumb-wrap').forEach(wrap => {
        let pressTimer = null;
        const idx = parseInt(wrap.dataset.idx, 10);
        const mi = parseInt(wrap.dataset.mi, 10);
        const getUrls = () => (tlEditorItems[idx]?.media || []).map(m => m.url);

        const openFullImage = (e) => {
            if (e.target.closest('.tl-media-remove')) return;
            e.stopPropagation();
            e.preventDefault();
            if (wrap._didLongPress) { wrap._didLongPress = false; return; }
            if (typeof openLightbox === 'function') openLightbox(getUrls(), mi, idx, 0);
        };

        wrap.addEventListener('click', openFullImage);
        wrap.addEventListener('pointerdown', (e) => {
            if (e.target.closest('.tl-media-remove')) return;
            wrap._didLongPress = false;
            pressTimer = setTimeout(() => {
                wrap._didLongPress = true;
                const url = getUrls()[mi];
                if (url && typeof openImageMarkup === 'function') openImageMarkup(url, idx, mi);
            }, 500);
        });
        wrap.addEventListener('pointerup', () => clearTimeout(pressTimer));
        wrap.addEventListener('pointerleave', () => clearTimeout(pressTimer));
    });

    list.querySelectorAll('.tl-copy-item-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            syncTlEditorItems(listId);
            const idx = parseInt(btn.dataset.idx, 10);
            const item = tlEditorItems[idx];
            if (!item) return;
            const editId = document.getElementById('tl-editor-id').value || null;
            openCopyItemsModal([item], 'task_list', editId);
        });
    });

    if (tlCopyMultiSelect) {
        list.querySelectorAll('.tl-copy-select').forEach(cb => {
            cb.style.display = '';
            cb.checked = tlCopySelectedIdxs.has(parseInt(cb.dataset.idx, 10));
            cb.addEventListener('change', () => {
                const idx = parseInt(cb.dataset.idx, 10);
                if (cb.checked) tlCopySelectedIdxs.add(idx);
                else tlCopySelectedIdxs.delete(idx);
                updateCopyMultiBar('tl');
            });
        });
        list.querySelectorAll('.tl-copy-item-btn').forEach(btn => btn.style.display = 'none');
    }

    initTlDragAndDrop(list, listId);
    updateTlReorderSelectionBar();
}

function syncTlEditorItems(listId) {
    const list = document.getElementById(listId || 'tl-items-list');
    if (!list) return;
    list.querySelectorAll('.tl-item-row').forEach(row => {
        const idx = parseInt(row.dataset.idx, 10);
        if (tlEditorItems[idx] === undefined) return;
        const titleEl = row.querySelector('.tl-item-title');
        const descEl = row.querySelector('.tl-item-desc');
        const locFromEl = row.querySelector('.tl-item-location-from');
        const locToEl = row.querySelector('.tl-item-location-to');
        if (titleEl) tlEditorItems[idx].title = titleEl.value;
        if (descEl) tlEditorItems[idx].description = descEl.value;
        if (locFromEl) tlEditorItems[idx].location_from = locFromEl.value || null;
        if (locToEl) tlEditorItems[idx].location_to = locToEl.value || null;
    });
}

function _reorderTlItem(list, listId, fromIdx, toIdx, groupSelection = true, toIdxIsInsertIndex = false) {
    if (fromIdx === toIdx && !toIdxIsInsertIndex) return;
    syncTlEditorItems(listId);
    const dragSelection = groupSelection ? getTlDragSelection(fromIdx) : new Set([fromIdx]);
    if (groupSelection && dragSelection.has(toIdx) && !toIdxIsInsertIndex) return;
    const movingDown = Math.min(...dragSelection) < toIdx;
    const insertIndex = toIdxIsInsertIndex ? toIdx : (movingDown ? toIdx + 1 : toIdx);
    const moveResult = moveTlItemsByIndexSelection(tlEditorItems, dragSelection, insertIndex);
    tlEditorItems = moveResult.items;
    tlReorderSelectedIdxs = groupSelection ? moveResult.selectedIdxs : new Set();
    renderTlEditorItems(listId);
}

function _updateTlIndices(list) {
    const rows = list.querySelectorAll('.tl-item-row');
    const total = rows.length;
    rows.forEach((row, newIdx) => {
        row.dataset.idx = newIdx;
        row.querySelectorAll('[data-idx]').forEach(el => { el.dataset.idx = newIdx; });

        const top = row.querySelector('.tl-move-top');
        const up = row.querySelector('.tl-move-up');
        const down = row.querySelector('.tl-move-down');
        const bottom = row.querySelector('.tl-move-bottom');
        if (top) top.style.display = newIdx > 0 ? '' : 'none';
        if (up) up.style.display = newIdx > 0 ? '' : 'none';
        if (down) down.style.display = newIdx < total - 1 ? '' : 'none';
        if (bottom) bottom.style.display = newIdx < total - 1 ? '' : 'none';
    });
}

// Module-level touch-drag state (shared across re-renders)
const _tlDrag = { idx: null, ghost: null, row: null, placeholder: null, list: null, listId: null };
let _tlDragDocBound = false;

function _tlDragBindDoc() {
    if (_tlDragDocBound) return;
    _tlDragDocBound = true;

    document.addEventListener('touchmove', (e) => {
        const d = _tlDrag;
        if (!d.ghost || d.idx === null || !d.list) return;
        const touch = e.touches[0];
        d.ghost.style.top = (touch.clientY - 20) + 'px';

        const rows = Array.from(d.list.querySelectorAll('.tl-item-row:not(.tl-dragging)'));
        let insertBefore = null;
        for (const r of rows) {
            const rRect = r.getBoundingClientRect();
            if (touch.clientY < rRect.top + rRect.height / 2) {
                insertBefore = r;
                break;
            }
        }
        if (d.placeholder) {
            if (insertBefore) d.list.insertBefore(d.placeholder, insertBefore);
            else d.list.appendChild(d.placeholder);
        }
    }, { passive: true });

    document.addEventListener('touchend', () => {
        const d = _tlDrag;
        if (d.idx === null || !d.row) return;
        syncTlEditorItems(d.listId);

        let dropIdx = d.idx;
        if (d.placeholder) {
            const allNodes = Array.from(d.list.children).filter(n => n !== d.row);
            dropIdx = allNodes.indexOf(d.placeholder);
            if (dropIdx === -1) dropIdx = tlEditorItems.length - 1;
            if (dropIdx > d.idx) dropIdx++;
        }

        if (d.ghost) { d.ghost.remove(); d.ghost = null; }
        if (d.placeholder) { d.placeholder.remove(); d.placeholder = null; }
        if (d.row) { d.row.style.display = ''; d.row.classList.remove('tl-dragging'); }

        const listId = d.listId;
        const theList = d.list;
        d.row = null;

        if (dropIdx !== d.idx && theList) {
            _reorderTlItem(theList, listId, d.idx, dropIdx, true, true);
        }
        d.idx = null;
        d.list = null;
        d.listId = null;
    }, { passive: true });
}

function initTlDragAndDrop(list, listId) {
    _tlDragBindDoc();

    // HTML5 drag (desktop)
    let dragIdx = null;
    list.querySelectorAll('.tl-item-row').forEach(row => {
        row.setAttribute('draggable', 'true');

        row.addEventListener('dragstart', (e) => {
            dragIdx = parseInt(row.dataset.idx, 10);
            row.classList.add('tl-dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        row.addEventListener('dragend', () => {
            row.classList.remove('tl-dragging');
            dragIdx = null;
        });
        row.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            row.classList.add('tl-dragover');
        });
        row.addEventListener('dragleave', () => {
            row.classList.remove('tl-dragover');
        });
        row.addEventListener('drop', (e) => {
            e.preventDefault();
            row.classList.remove('tl-dragover');
            const dropIdx = parseInt(row.dataset.idx, 10);
            if (dragIdx === null || dragIdx === dropIdx) return;
            _reorderTlItem(list, listId, dragIdx, dropIdx);
        });
    });

    // Touch drag (mobile) — start on handle, state lives in _tlDrag
    list.querySelectorAll('.tl-drag-handle').forEach(handle => {
        handle.addEventListener('touchstart', (e) => {
            const row = handle.closest('.tl-item-row');
            if (!row) return;
            e.preventDefault();

            const d = _tlDrag;
            d.idx = parseInt(row.dataset.idx, 10);
            d.row = row;
            d.list = list;
            d.listId = listId;

            const rect = row.getBoundingClientRect();
            d.ghost = row.cloneNode(true);
            d.ghost.classList.add('tl-drag-ghost');
            d.ghost.style.width = rect.width + 'px';
            d.ghost.style.top = rect.top + 'px';
            d.ghost.style.left = rect.left + 'px';
            document.body.appendChild(d.ghost);

            row.classList.add('tl-dragging');

            d.placeholder = document.createElement('div');
            d.placeholder.className = 'tl-drag-placeholder';
            d.placeholder.style.height = rect.height + 'px';
            row.parentNode.insertBefore(d.placeholder, row);
            row.style.display = 'none';
        }, { passive: false });
    });
}

function openTlEquipmentPicker(wrapperEl, idx, listId) {
    const dropdown = wrapperEl.querySelector('.equipment-picker-dropdown');
    if (!dropdown) return;
    const isOpen = dropdown.style.display !== 'none';
    if (isOpen) { dropdown.style.display = 'none'; return; }
    const current = tlEditorItems[idx].equipment || [];
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
                syncTlEditorItems(listId);
                const eqId = item.dataset.eqId;
                if (!tlEditorItems[idx].equipment) tlEditorItems[idx].equipment = [];
                if (tlEditorItems[idx].equipment.length >= 5) {
                    showToast('Maximum 5 equipment per task', 'error');
                    return;
                }
                tlEditorItems[idx].equipment.push(eqId);
                dropdown.style.display = 'none';
                renderTlEditorItems(listId);
            });
        });
    }
    render('');
    searchInput.oninput = () => render(searchInput.value);
}

// Close task-list equipment pickers when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.tl-item-equipment')) {
        document.querySelectorAll('.tl-item-equipment .equipment-picker-dropdown').forEach(dd => dd.style.display = 'none');
    }
});

async function saveTaskList(e) {
    e.preventDefault();
    const id = document.getElementById('tl-editor-id').value;
    const title = document.getElementById('tl-editor-name').value.trim();
    const description = document.getElementById('tl-editor-description').value.trim();
    const isSop = document.getElementById('tl-editor-is-sop').checked;
    const location = document.getElementById('tl-editor-location').value || null;

    if (!title) { showToast('Please enter a task list name', 'error'); return; }

    // Sync items from whichever list is visible
    const activeListId = tlEditorMode === 'video' && document.getElementById('tl-generated-items').style.display !== 'none'
        ? 'tl-generated-items-list' : 'tl-items-list';
    syncTlEditorItems(activeListId);

    const validItems = tlEditorItems.filter(it => it.title.trim());
    if (validItems.length === 0) { showToast('Add at least one task', 'error'); return; }

    try {
        let taskListId = id;
        const payload = {
            title,
            description: description || null,
            is_sop: isSop,
            location,
            source_video_url: tlVideoUrl || null,
            source_transcript: tlTranscript || null
        };

        const shareable = document.getElementById('tl-editor-shareable').checked;
        if (shareable) {
            if (id) {
                const { data: existing } = await supabaseClient.from('task_lists').select('share_token').eq('id', id).single();
                if (!existing?.share_token) payload.share_token = crypto.randomUUID();
            } else {
                payload.share_token = crypto.randomUUID();
            }
        } else if (id) {
            payload.share_token = null;
        }

        if (id) {
            const { error } = await supabaseClient.from('task_lists').update(payload).eq('id', id);
            if (error) throw error;
            await supabaseClient.from('task_list_items').delete().eq('task_list_id', id);
        } else {
            payload.created_by = currentUser.id;
            const { data, error } = await supabaseClient.from('task_lists').insert(payload).select().single();
            if (error) throw error;
            taskListId = data.id;
        }

        const itemRows = validItems.map((it, idx) => ({
            task_list_id: taskListId,
            sort_order: idx,
            title: it.title.trim(),
            description: it.description?.trim() || null,
            media: it.media || [],
            item_type: it.type || 'task',
            location_from: it.location_from || null,
            location_to: it.location_to || null,
            equipment: it.equipment || [],
            video_timestamp: it.video_timestamp != null ? it.video_timestamp : null
        }));

        const { error: itemsErr } = await supabaseClient.from('task_list_items').insert(itemRows);
        if (itemsErr) throw itemsErr;

        showToast(id ? 'Task list updated' : 'Task list created');
        navigateToView('task-lists', 'admin');
        loadTaskLists();
    } catch (err) {
        console.error('Save task list error:', err);
        showToast('Failed to save task list', 'error');
    }
}

// ---- Video Processing ----

function setupTlVideoUpload() {
    const dropzone = document.getElementById('tl-video-dropzone');
    const fileInput = document.getElementById('tl-video-input');
    const browseBtn = document.getElementById('tl-video-browse-btn');

    browseBtn?.addEventListener('click', () => fileInput.click());
    dropzone?.addEventListener('click', (e) => {
        if (e.target === browseBtn || browseBtn.contains(e.target)) return;
        fileInput.click();
    });

    dropzone?.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone?.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('video/')) handleTlVideoSelect(file);
        else showToast('Please drop a video file', 'error');
    });

    fileInput?.addEventListener('change', (e) => {
        if (e.target.files[0]) handleTlVideoSelect(e.target.files[0]);
    });
}

function handleTlVideoSelect(file) {
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > 2048) {
        showToast(`Video is ${sizeMB.toFixed(0)}MB — too large to process in browser. Try a shorter video.`, 'error');
        return;
    }
    tlVideoFile = file;
    const player = document.getElementById('tl-video-player');
    player.src = URL.createObjectURL(file);
    document.getElementById('tl-video-filename').textContent = file.name;
    document.getElementById('tl-video-upload-area').style.display = 'none';
    document.getElementById('tl-video-preview').style.display = '';
    document.getElementById('tl-process-video-btn').style.display = '';
}

async function processTaskVideo() {
    if (!tlVideoFile) return;

    const processingEl = document.getElementById('tl-video-processing');
    const processBtn = document.getElementById('tl-process-video-btn');
    const statusEl = document.getElementById('tl-processing-status');
    const compressStatusEl = document.getElementById('tl-compress-status');

    processBtn.style.display = 'none';
    processingEl.style.display = '';
    if (compressStatusEl) compressStatusEl.style.display = 'none';

    function setStep(stepId) {
        document.querySelectorAll('.tl-step').forEach(s => s.classList.remove('active'));
        const el = document.getElementById(stepId);
        if (el) el.classList.add('active');
        let found = false;
        document.querySelectorAll('.tl-step').forEach(s => {
            if (s.id === stepId) found = true;
            else if (!found) s.classList.add('done');
        });
    }

    try {
        // ── Phase 1: Extract audio (fast, ~10 seconds) ──
        setStep('tl-step-extract');
        statusEl.textContent = 'Loading video processor (first time may take a moment)…';

        const mainFfmpeg = await loadFFmpegInstance();
        const ext = tlVideoFile.name.split('.').pop().toLowerCase();
        const inputName = `input.${ext}`;

        statusEl.textContent = 'Reading video file…';
        await mainFfmpeg.writeFile(inputName, await _ffmpegUtil.fetchFile(tlVideoFile));

        statusEl.textContent = 'Extracting audio…';
        await mainFfmpeg.exec([
            '-i', inputName,
            '-vn',
            '-c:a', 'libmp3lame',
            '-b:a', '96k',
            '-ar', '16000',
            '-ac', '1',
            'audio.mp3'
        ]);

        const audioData = await mainFfmpeg.readFile('audio.mp3');
        await mainFfmpeg.deleteFile('audio.mp3');
        const audioBlob = new Blob([audioData.buffer], { type: 'audio/mpeg' });
        console.log(`Audio extracted: ${(audioBlob.size / 1048576).toFixed(1)}MB`);

        // ── Phase 2: Launch two parallel tracks ──
        const player = document.getElementById('tl-video-player');
        const videoDuration = player.duration;

        // BACKGROUND TRACK: chunked parallel compression → upload
        if (compressStatusEl) {
            compressStatusEl.style.display = '';
            compressStatusEl.textContent = 'Compressing video in background… 0%';
        }

        const compressionPromise = compressVideoChunked(
            mainFfmpeg, inputName, videoDuration,
            (msg) => { if (compressStatusEl) compressStatusEl.textContent = msg; }
        ).then(async (compressedBlob) => {
            if (compressStatusEl) compressStatusEl.textContent = 'Uploading compressed video…';
            const safeName = tlVideoFile.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.\w+$/, '.mp4');
            const storagePath = `${currentUser.id}/task-videos/${Date.now()}-${safeName}`;
            const { data: uploadData, error: uploadErr } = await supabaseClient.storage
                .from(TASK_LIST_STORAGE_BUCKET)
                .upload(storagePath, compressedBlob, { upsert: true, contentType: 'video/mp4' });
            if (uploadErr) throw uploadErr;
            const { data: urlData } = supabaseClient.storage.from(TASK_LIST_STORAGE_BUCKET).getPublicUrl(uploadData.path);
            tlVideoUrl = urlData.publicUrl;
            if (compressStatusEl) compressStatusEl.textContent = '✓ Video compressed & uploaded';
            console.log(`Compressed video: ${(compressedBlob.size / 1048576).toFixed(1)}MB → ${tlVideoUrl}`);
        }).catch(err => {
            console.error('Background compression failed:', err);
            if (compressStatusEl) compressStatusEl.textContent = '⚠ Compression failed — you can still save without video';
        });

        // FAST TRACK: upload audio → transcribe → generate tasks → screenshots
        setStep('tl-step-transcribe');
        statusEl.textContent = 'Uploading audio…';

        const audioPath = `${currentUser.id}/task-audio/${Date.now()}.mp3`;
        const { data: audioUpload, error: audioErr } = await supabaseClient.storage
            .from(TASK_LIST_STORAGE_BUCKET)
            .upload(audioPath, audioBlob, { upsert: true, contentType: 'audio/mpeg' });
        if (audioErr) throw audioErr;
        const { data: audioUrlData } = supabaseClient.storage.from(TASK_LIST_STORAGE_BUCKET).getPublicUrl(audioUpload.path);

        statusEl.textContent = 'Transcribing audio…';
        const session = await supabaseClient.auth.getSession();
        const token = session.data.session?.access_token;

        const edgeResp = await fetch(`${SUPABASE_CONFIG.edgeFunctionUrl}/process-task-video`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'apikey': SUPABASE_CONFIG.anonKey
            },
            body: JSON.stringify({ video_url: audioUrlData.publicUrl })
        });

        if (!edgeResp.ok) {
            const errData = await edgeResp.json().catch(() => ({}));
            throw new Error(errData.error || `Processing failed (${edgeResp.status})`);
        }

        const result = await edgeResp.json();
        tlTranscript = result.transcript;

        setStep('tl-step-generate');
        statusEl.textContent = 'Generating tasks…';
        await new Promise(r => setTimeout(r, 500));

        // Screenshots from the ORIGINAL video already loaded in the player
        setStep('tl-step-screenshots');
        statusEl.textContent = 'Capturing screenshots…';

        let screenshotUrls = [];
        if (result.capture_timestamps && result.capture_timestamps.length > 0) {
            screenshotUrls = await captureVideoScreenshots(player.src, result.capture_timestamps);
        }

        // Build task items from AI result
        const tasks = result.tasks || [];
        tlEditorItems = tasks.map((t, idx) => {
            const media = [];
            const indices = t.capture_indices || (t.capture_index != null ? [t.capture_index] : []);
            let video_timestamp = null;
            for (const ci of indices) {
                if (screenshotUrls[ci]) {
                    media.push({ url: screenshotUrls[ci], type: 'image' });
                }
                if (video_timestamp === null && result.capture_timestamps?.[ci] != null) {
                    video_timestamp = result.capture_timestamps[ci];
                }
            }
            return {
                title: t.title || `Task ${idx + 1}`,
                description: t.description || '',
                media,
                type: 'task',
                location_from: null,
                location_to: null,
                equipment: [],
                video_timestamp,
                collapsed: false
            };
        });

        await ensureEquipmentLoaded();

        // Fast track done — show results immediately
        processingEl.style.display = 'none';

        if (tlTranscript) {
            document.getElementById('tl-transcript-text').textContent = tlTranscript;
            document.getElementById('tl-transcript-panel').style.display = '';
        }

        document.getElementById('tl-generated-items').style.display = '';
        renderTlEditorItems('tl-generated-items-list');
        showToast(`Generated ${tlEditorItems.length} tasks from video`);

    } catch (err) {
        console.error('Video processing error:', err);
        processingEl.style.display = 'none';
        processBtn.style.display = '';
        showToast('Video processing failed: ' + (err.message || 'Unknown error'), 'error');
    }
}

// ---- Screenshot Extraction ----

async function captureVideoScreenshots(videoUrl, timestamps) {
    const video = document.getElementById('tl-screenshot-video');
    const canvas = document.getElementById('tl-screenshot-canvas');
    const ctx = canvas.getContext('2d');
    const urls = [];

    if (videoUrl.startsWith('blob:')) {
        video.removeAttribute('crossorigin');
    } else {
        video.crossOrigin = 'anonymous';
    }
    video.src = videoUrl;
    video.muted = true;

    try {
        await Promise.race([
            new Promise((res, rej) => {
                video.onloadedmetadata = res;
                video.onerror = () => rej(new Error('Video decode failed'));
                video.load();
            }),
            new Promise((_, rej) => setTimeout(() => rej(new Error('Video load timeout')), 8000))
        ]);
    } catch (err) {
        console.warn('Cannot capture screenshots:', err.message, '— your browser may not support this video codec. Screenshots will be skipped.');
        video.src = '';
        return timestamps.map(() => null);
    }

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 360;

    for (const ts of timestamps) {
        try {
            video.currentTime = Math.max(0, ts - 0.5);
            await Promise.race([
                new Promise((res) => { video.onseeked = res; }),
                new Promise((_, rej) => setTimeout(() => rej(new Error('Seek timeout')), 5000))
            ]);

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));

            const path = `${currentUser.id}/task-screenshots/${Date.now()}-${ts.toFixed(1)}s.png`;
            const { data, error } = await supabaseClient.storage
                .from(TASK_LIST_STORAGE_BUCKET)
                .upload(path, blob, { upsert: true, contentType: 'image/png' });

            if (!error) {
                const { data: urlData } = supabaseClient.storage.from(TASK_LIST_STORAGE_BUCKET).getPublicUrl(data.path);
                urls.push(urlData.publicUrl);
            } else {
                urls.push(null);
            }
        } catch {
            urls.push(null);
        }
    }

    video.src = '';
    return urls;
}

// ---- Assignment ----

async function openTaskListAssignModal(taskListId) {
    const modal = document.getElementById('tl-assign-modal');
    modal.dataset.taskListId = taskListId;

    // Load employees
    const { data: employees } = await supabaseClient
        .from('profiles')
        .select('id, first_name, last_name, email, role')
        .neq('id', currentUser.id)
        .order('first_name');

    // Load existing assignments
    const { data: existing } = await supabaseClient
        .from('task_list_assignments')
        .select('id, assigned_to, status, profiles!task_list_assignments_assigned_to_fkey(first_name, last_name)')
        .eq('task_list_id', taskListId);

    const assignedIds = (existing || []).map(a => a.assigned_to);

    const empContainer = document.getElementById('tl-assign-employees');
    const unassigned = (employees || []).filter(e => !assignedIds.includes(e.id));
    empContainer.innerHTML = unassigned.length === 0
        ? '<p class="text-muted">All team members are already assigned.</p>'
        : unassigned.map(e => `
            <div class="tl-assign-employee-row">
                <input type="checkbox" id="tl-assign-${e.id}" value="${e.id}">
                <label for="tl-assign-${e.id}">${escapeHtml(e.first_name || '')} ${escapeHtml(e.last_name || '')} <span class="text-muted">${escapeHtml(e.email || '')}</span></label>
            </div>
        `).join('');

    const existContainer = document.getElementById('tl-assign-existing');
    if (existing && existing.length > 0) {
        existContainer.innerHTML = '<label style="font-weight:600;margin-bottom:4px;display:block;">Current Assignments</label>' +
            existing.map(a => {
                const name = a.profiles ? `${a.profiles.first_name || ''} ${a.profiles.last_name || ''}` : 'Unknown';
                return `<div class="tl-assign-existing-row">
                    <span>${escapeHtml(name)}</span>
                    <span class="tl-assign-status ${a.status}">${a.status.replace('_', ' ')}</span>
                </div>`;
            }).join('');
    } else {
        existContainer.innerHTML = '';
    }

    modal.classList.add('active');
}

async function saveTaskListAssignments() {
    const modal = document.getElementById('tl-assign-modal');
    const taskListId = modal.dataset.taskListId;
    const checkboxes = document.querySelectorAll('#tl-assign-employees input[type="checkbox"]:checked');

    if (checkboxes.length === 0) {
        showToast('Select at least one employee', 'error');
        return;
    }

    const rows = Array.from(checkboxes).map(cb => ({
        task_list_id: taskListId,
        assigned_to: cb.value,
        assigned_by: currentUser.id,
        status: 'pending'
    }));

    const { error } = await supabaseClient.from('task_list_assignments').insert(rows);
    if (error) {
        showToast('Failed to assign', 'error');
        return;
    }

    modal.classList.remove('active');
    showToast(`Assigned to ${rows.length} employee${rows.length > 1 ? 's' : ''}`);
    loadTaskLists();
}

function showLocationPopup(zoneId) {
    const all = [...LOCATION_ZONES.upstairs, ...LOCATION_ZONES.downstairs];
    const zone = all.find(z => z.id === zoneId);
    if (!zone) return;

    const isUpstairs = LOCATION_ZONES.upstairs.some(z => z.id === zoneId);
    const floorPrefix = isUpstairs ? 'up' : 'down';
    const overlays = ZONE_OVERLAYS[isUpstairs ? 'upstairs' : 'downstairs'];
    const ov = overlays.find(o => o.id === zoneId);

    document.getElementById('location-popup-title').textContent = zone.label;
    document.getElementById('location-popup-fp-img').src = `images/locations/fp-${floorPrefix}-${zoneId}.png`;
    document.getElementById('location-popup-photo-img').src = `images/locations/photo-${zoneId}.png`;

    const overlayEl = document.getElementById('location-popup-zone-overlay');
    if (ov) {
        overlayEl.style.top = ov.top + '%';
        overlayEl.style.left = ov.left + '%';
        overlayEl.style.width = ov.width + '%';
        overlayEl.style.height = ov.height + '%';
        overlayEl.style.display = '';
    } else {
        overlayEl.style.display = 'none';
    }

    document.getElementById('location-popup-modal').classList.add('active');
}

document.getElementById('close-location-popup')?.addEventListener('click', () => {
    document.getElementById('location-popup-modal').classList.remove('active');
});

function renderTlItemDetailExtras(item) {
    let html = '';
    const locFrom = item.location_from ? getLocationLabel(item.location_from) : null;
    const locTo = item.location_to ? getLocationLabel(item.location_to) : null;
    if (locFrom || locTo) {
        html += '<div class="tl-detail-item-locations">';
        if (locFrom) html += `<button type="button" class="tl-loc-badge from tl-loc-popup-btn" data-zone="${escapeHtml(item.location_from)}">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
            From: ${escapeHtml(locFrom)}</button>`;
        if (locTo) html += `<button type="button" class="tl-loc-badge to tl-loc-popup-btn" data-zone="${escapeHtml(item.location_to)}">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
            To: ${escapeHtml(locTo)}</button>`;
        html += '</div>';
    }
    const eqIds = item.equipment || [];
    if (eqIds.length) {
        html += '<div class="tl-detail-item-equipment">';
        eqIds.forEach(eqId => {
            const eq = allEquipment.find(e => e.id === eqId);
            if (!eq) return;
            html += `<span class="equipment-tag">
                ${eq.image_url ? `<img src="${escapeHtml(eq.image_url)}" alt="">` : ''}
                <span>${escapeHtml(eq.name)}</span>
            </span>`;
        });
        html += '</div>';
    }
    return html;
}

// ---- Admin Detail View ----

async function openTaskListDetail(taskListId) {
    const { data: tl } = await supabaseClient.from('task_lists').select('*').eq('id', taskListId).single();
    if (!tl) { showToast('Task list not found', 'error'); return; }

    const { data: items } = await supabaseClient
        .from('task_list_items')
        .select('*')
        .eq('task_list_id', taskListId)
        .order('sort_order');

    const { data: assignments } = await supabaseClient
        .from('task_list_assignments')
        .select('*, profiles!task_list_assignments_assigned_to_fkey(first_name, last_name)')
        .eq('task_list_id', taskListId);

    await ensureEquipmentLoaded();

    document.getElementById('tl-detail-title').textContent = tl.title;
    document.getElementById('tl-detail-meta').innerHTML = `
        <span class="tl-badge ${tl.is_sop ? 'sop' : 'task'}">${tl.is_sop ? 'SOP' : 'Task'}</span>
        ${tl.description ? ` &mdash; ${escapeHtml(tl.description)}` : ''}
    `;

    if (tl.source_video_url) {
        document.getElementById('tl-detail-video').style.display = '';
        document.getElementById('tl-detail-video-player').src = tl.source_video_url;
    } else {
        document.getElementById('tl-detail-video').style.display = 'none';
    }

    if (tl.source_transcript) {
        document.getElementById('tl-detail-transcript').style.display = '';
        document.getElementById('tl-detail-transcript-text').textContent = tl.source_transcript;
    } else {
        document.getElementById('tl-detail-transcript').style.display = 'none';
    }

    const itemsContainer = document.getElementById('tl-detail-items');
    let taskNum = 0;
    itemsContainer.innerHTML = (items || []).map((item) => {
        const isHeader = item.item_type === 'header';
        if (!isHeader) taskNum++;
        if (isHeader) {
            return `<div class="tl-detail-item tl-detail-header"><div class="tl-detail-item-content"><h4>${escapeHtml(item.title)}</h4></div></div>`;
        }
        const hasDetailTimestamp = item.video_timestamp != null && tl.source_video_url;
        return `
        <div class="tl-detail-item">
            <div class="tl-detail-item-num">${taskNum}</div>
            <div class="tl-detail-item-content">
                <h5>${escapeHtml(item.title)}</h5>
                ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
                ${renderTlItemDetailExtras(item)}
                ${hasDetailTimestamp ? `
                    <button type="button" class="tl-video-jump-btn tl-detail-video-jump" data-timestamp="${item.video_timestamp}">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                        Watch at ${escapeHtml(formatVideoTime(item.video_timestamp))}
                    </button>
                ` : ''}
                ${(item.media && item.media.length > 0) ? `
                    <div class="tl-detail-item-media">
                        ${item.media.map((m, mi) => `<img src="${escapeHtml(m.url)}" alt="Task media" data-lightbox-urls='${JSON.stringify(item.media.map(x => x.url))}' data-lightbox-index="${mi}" onclick="openLightbox(JSON.parse(this.dataset.lightboxUrls), ${mi})">`).join('')}
                    </div>
                ` : ''}
            </div>
        </div>`;
    }).join('');

    itemsContainer.querySelectorAll('.tl-detail-video-jump').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const ts = parseFloat(btn.dataset.timestamp);
            if (isNaN(ts)) return;
            const player = document.getElementById('tl-detail-video-player');
            if (player) {
                document.getElementById('tl-detail-video').style.display = '';
                player.currentTime = ts;
                player.play().catch(() => {});
                player.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    const assignContainer = document.getElementById('tl-detail-assignment-list');
    if (assignments && assignments.length > 0) {
        assignContainer.innerHTML = assignments.map(a => {
            const name = a.profiles ? `${a.profiles.first_name || ''} ${a.profiles.last_name || ''}` : 'Unknown';
            return `<div class="tl-assign-existing-row">
                <span>${escapeHtml(name)}</span>
                <span class="tl-assign-status ${a.status}">${a.status.replace('_', ' ')}</span>
            </div>`;
        }).join('');
    } else {
        assignContainer.innerHTML = '<p class="text-muted">No one assigned yet.</p>';
    }

    const shareBtn = document.getElementById('tl-detail-share-link');
    if (shareBtn) {
        shareBtn.style.display = '';
        shareBtn.onclick = async () => {
            let token = tl.share_token;
            if (!token) {
                token = await ensureTaskListShareToken(taskListId);
                if (token) tl.share_token = token;
            }
            if (token) copyTaskListShareLink(token);
            else showToast('Failed to create share link', 'error');
        };
    }

    document.getElementById('tl-detail-modal').classList.add('active');
}

// ---- Employee: My Tasks View ----

async function loadMyTasks() {
    if (!currentUser) return;

    const { data: assignments, error } = await supabaseClient
        .from('task_list_assignments')
        .select('*, task_lists(id, title, description, is_sop, source_video_url), task_list_item_checks(id)')
        .eq('assigned_to', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) { console.error('loadMyTasks error', error); return; }

    const pending = (assignments || []).filter(a => a.status !== 'completed');
    const completed = (assignments || []).filter(a => a.status === 'completed');

    const pendingList = document.getElementById('my-tasks-pending-list');
    const completedList = document.getElementById('my-tasks-completed-list');
    const emptyEl = document.getElementById('my-tasks-empty');

    if (pending.length === 0) {
        pendingList.innerHTML = '';
        emptyEl.style.display = '';
    } else {
        emptyEl.style.display = 'none';
        pendingList.innerHTML = pending.map(a => `
            <div class="my-task-assignment-card" data-assignment-id="${a.id}">
                <div>
                    <h4>${escapeHtml(a.task_lists?.title || 'Task List')}</h4>
                    <p>${escapeHtml(a.task_lists?.description || '')} &mdash; <span class="tl-assign-status ${a.status}">${a.status.replace('_', ' ')}</span></p>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
            </div>
        `).join('');

        pendingList.querySelectorAll('.my-task-assignment-card').forEach(card => {
            card.addEventListener('click', () => openMyTaskChecklist(card.dataset.assignmentId));
        });
    }

    if (completed.length === 0) {
        completedList.innerHTML = '<p class="text-muted">No completed tasks yet.</p>';
    } else {
        completedList.innerHTML = completed.map(a => `
            <div class="my-task-assignment-card" data-assignment-id="${a.id}" style="opacity:0.7;">
                <div>
                    <h4>${escapeHtml(a.task_lists?.title || 'Task List')}</h4>
                    <p><span class="tl-assign-status completed">completed</span></p>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
            </div>
        `).join('');
        completedList.querySelectorAll('.my-task-assignment-card').forEach(card => {
            card.addEventListener('click', () => openMyTaskChecklist(card.dataset.assignmentId));
        });
    }
}

async function openMyTaskChecklist(assignmentId) {
    const { data: assignment } = await supabaseClient
        .from('task_list_assignments')
        .select('*, task_lists(id, title, description, source_video_url)')
        .eq('id', assignmentId)
        .single();

    if (!assignment) { showToast('Assignment not found', 'error'); return; }

    const taskList = assignment.task_lists;

    const { data: items } = await supabaseClient
        .from('task_list_items')
        .select('*')
        .eq('task_list_id', taskList.id)
        .order('sort_order');

    const { data: checks } = await supabaseClient
        .from('task_list_item_checks')
        .select('*')
        .eq('assignment_id', assignmentId);

    const checkMap = {};
    (checks || []).forEach(c => { checkMap[c.task_list_item_id] = c; });

    await ensureEquipmentLoaded();

    document.getElementById('my-task-checklist-title').textContent = taskList.title;
    document.getElementById('my-task-meta').innerHTML = taskList.description ? escapeHtml(taskList.description) : '';

    const videoSection = document.getElementById('my-task-video');
    const videoToggle = document.getElementById('my-task-video-toggle');
    const videoWrap = document.getElementById('my-task-video-wrap');
    const videoPlayer = document.getElementById('my-task-video-player');

    if (taskList.source_video_url) {
        videoSection.style.display = '';
        videoPlayer.src = taskList.source_video_url;
        videoToggle.classList.remove('open');
        videoWrap.classList.remove('open');
        videoToggle.onclick = () => {
            const isOpen = videoWrap.classList.toggle('open');
            videoToggle.classList.toggle('open', isOpen);
            if (!isOpen) { videoPlayer.pause(); }
        };
    } else {
        videoSection.style.display = 'none';
    }

    const taskItems = (items || []).filter(i => i.item_type !== 'header');
    const total = taskItems.length;
    const checkedCount = Object.keys(checkMap).length;
    updateMyTaskProgress(checkedCount, total);

    const checkSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';

    const listEl = document.getElementById('my-task-checklist-items');
    listEl.innerHTML = (items || []).map((item) => {
        const isHeader = item.item_type === 'header';
        if (isHeader) {
            return `<div class="my-task-section-header"><h4>${escapeHtml(item.title)}</h4></div>`;
        }
        const checked = !!checkMap[item.id];
        const hasTimestamp = item.video_timestamp != null && taskList.source_video_url;
        return `
        <div class="my-task-item ${checked ? 'checked' : ''}" data-item-id="${item.id}" data-assignment-id="${assignmentId}">
            <div class="my-task-item-body">
                <p class="my-task-item-title">${escapeHtml(item.title)}</p>
                ${item.description ? `<p class="my-task-item-desc">${escapeHtml(item.description)}</p>` : ''}
                ${renderTlItemDetailExtras(item)}
                ${hasTimestamp ? `
                    <button type="button" class="tl-video-jump-btn" data-timestamp="${item.video_timestamp}">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                        Watch at ${escapeHtml(formatVideoTime(item.video_timestamp))}
                    </button>
                ` : ''}
                ${(item.media && item.media.length > 0) ? `
                    <div class="my-task-item-media">
                        ${item.media.map((m, mi) => `<img src="${escapeHtml(m.url)}" alt="" data-lightbox-urls='${JSON.stringify(item.media.map(x => x.url))}' data-lightbox-index="${mi}" onclick="event.stopPropagation(); openLightbox(JSON.parse(this.dataset.lightboxUrls), ${mi})">`).join('')}
                    </div>
                ` : ''}
            </div>
            <div class="my-task-item-check">${checkSvg}</div>
        </div>`;
    }).join('');

    listEl.querySelectorAll('.tl-loc-popup-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            showLocationPopup(btn.dataset.zone);
        });
    });

    listEl.querySelectorAll('.tl-video-jump-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const ts = parseFloat(btn.dataset.timestamp);
            if (isNaN(ts)) return;

            // Expand the video section
            const videoWrap = document.getElementById('my-task-video-wrap');
            const videoToggle = document.getElementById('my-task-video-toggle');
            if (videoWrap && !videoWrap.classList.contains('open')) {
                videoWrap.classList.add('open');
                videoToggle?.classList.add('open');
            }

            // Seek and play
            const player = document.getElementById('my-task-video-player');
            if (player) {
                player.currentTime = ts;
                player.play().catch(() => {});
            }

            // Scroll the video into view
            const videoSection = document.getElementById('my-task-video');
            if (videoSection) {
                videoSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    listEl.querySelectorAll('.my-task-item').forEach(row => {
        row.addEventListener('click', async (e) => {
            if (e.target.closest('.my-task-item-media img')) return;
            if (e.target.closest('.tl-loc-popup-btn')) return;
            if (e.target.closest('.tl-video-jump-btn')) return;
            if (row.dataset.busy) return;
            row.dataset.busy = '1';

            const itemId = row.dataset.itemId;
            const aId = row.dataset.assignmentId;
            const isChecked = row.classList.contains('checked');

            if (isChecked) {
                const { error } = await supabaseClient
                    .from('task_list_item_checks')
                    .delete()
                    .eq('assignment_id', aId)
                    .eq('task_list_item_id', itemId);

                if (error) {
                    delete row.dataset.busy;
                    showToast('Failed to uncheck task', 'error');
                    return;
                }
                row.classList.remove('checked');
            } else {
                const { error } = await supabaseClient.from('task_list_item_checks').insert({
                    assignment_id: aId,
                    task_list_item_id: itemId,
                    checked_by: currentUser.id
                });

                if (error) {
                    delete row.dataset.busy;
                    showToast('Failed to check off task', 'error');
                    return;
                }
                row.classList.add('checked');
            }

            delete row.dataset.busy;

            const checkedNow = listEl.querySelectorAll('.my-task-item.checked').length;
            const totalNow = listEl.querySelectorAll('.my-task-item').length;
            updateMyTaskProgress(checkedNow, totalNow);

            if (checkedNow === totalNow && totalNow > 0) {
                await supabaseClient.from('task_list_assignments')
                    .update({ status: 'completed' })
                    .eq('id', aId);
                showToast('All tasks completed!');
                loadMyTasks();
                loadTaskListClockInPanel();
            } else if (checkedNow > 0) {
                await supabaseClient.from('task_list_assignments')
                    .update({ status: 'in_progress' })
                    .eq('id', aId);
            } else {
                await supabaseClient.from('task_list_assignments')
                    .update({ status: 'pending' })
                    .eq('id', aId);
            }
        });
    });

    navigateToView('my-task-detail', 'employee');
}

function updateMyTaskProgress(checked, total) {
    const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
    const fillEl = document.getElementById('my-task-progress-fill');
    fillEl.style.width = `${pct}%`;
    fillEl.classList.toggle('complete', pct >= 100);
    document.getElementById('my-task-progress-count').textContent = `${checked}/${total}`;
    document.getElementById('my-task-progress-text').textContent = `${pct}%`;
}

// ---- Clock-in Integration ----

async function fetchPendingTaskAssignments() {
    if (!currentUser) return [];
    const { data } = await supabaseClient
        .from('task_list_assignments')
        .select('*, task_lists(title, description)')
        .eq('assigned_to', currentUser.id)
        .in('status', ['pending', 'in_progress']);
    return data || [];
}

async function showTaskListClockInPopup() {
    const assignments = await fetchPendingTaskAssignments();
    if (assignments.length === 0) return false;

    const modal = document.getElementById('tl-clockin-modal');
    const list = document.getElementById('tl-clockin-list');

    list.innerHTML = assignments.map(a => `
        <div class="tl-clockin-card" data-assignment-id="${a.id}">
            <div class="tl-clockin-card-info">
                <h4>${escapeHtml(a.task_lists?.title || 'Task List')}</h4>
                <p>${a.task_lists?.description ? escapeHtml(a.task_lists.description) : ''}</p>
                <span class="tl-assign-status ${a.status}">${a.status.replace('_', ' ')}</span>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
        </div>
    `).join('');

    list.querySelectorAll('.tl-clockin-card').forEach(card => {
        card.addEventListener('click', () => {
            modal.classList.remove('active');
            openMyTaskChecklist(card.dataset.assignmentId);
        });
    });

    modal.classList.add('active');
    return true;
}

async function loadTaskListClockInPanel() {
    if (!currentUser) return;
    const panel = document.getElementById('tl-clockin-panel');
    if (!panel) return;

    const assignments = await fetchPendingTaskAssignments();

    if (assignments.length === 0) {
        panel.style.display = 'none';
        return;
    }

    panel.style.display = '';
    const container = document.getElementById('tl-clockin-assignments');
    container.innerHTML = assignments.map(a => `
        <div class="tl-clockin-card" data-assignment-id="${a.id}">
            <div class="tl-clockin-card-info">
                <h4>${escapeHtml(a.task_lists?.title || 'Task List')}</h4>
                <p>${a.task_lists?.description ? escapeHtml(a.task_lists.description) : ''} &mdash; <span class="tl-assign-status ${a.status}">${a.status.replace('_', ' ')}</span></p>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
        </div>
    `).join('');

    container.querySelectorAll('.tl-clockin-card').forEach(card => {
        card.addEventListener('click', () => openMyTaskChecklist(card.dataset.assignmentId));
    });
}

// ---- Event Binding ----

function initTaskListEventListeners() {
    // Admin: create
    document.getElementById('create-task-list-btn')?.addEventListener('click', () => openTaskListEditor());

    // Editor back/cancel
    const tlEditorBack = () => {
        navigateToView('task-lists', 'admin');
        loadTaskLists();
    };
    document.getElementById('tl-editor-back-btn')?.addEventListener('click', tlEditorBack);
    document.getElementById('tl-editor-cancel')?.addEventListener('click', tlEditorBack);
    document.getElementById('tl-reorder-clear-btn')?.addEventListener('click', clearTlReorderSelection);

    // Editor form submit
    document.getElementById('tl-editor-form')?.addEventListener('submit', saveTaskList);

    // Add task button
    document.getElementById('tl-add-item-btn')?.addEventListener('click', () => {
        syncTlEditorItems('tl-items-list');
        tlEditorItems.unshift({ title: '', description: '', media: [], type: 'task', location_from: null, location_to: null, equipment: [], collapsed: false });
        clearTlReorderSelection();
        renderTlEditorItems('tl-items-list');
    });

    document.getElementById('tl-add-header-btn')?.addEventListener('click', () => {
        syncTlEditorItems('tl-items-list');
        tlEditorItems.unshift({ title: '', description: '', media: [], type: 'header', collapsed: false });
        clearTlReorderSelection();
        renderTlEditorItems('tl-items-list');
    });

    document.getElementById('tl-video-add-item-btn')?.addEventListener('click', () => {
        syncTlEditorItems('tl-generated-items-list');
        tlEditorItems.unshift({ title: '', description: '', media: [], type: 'task', location_from: null, location_to: null, equipment: [], collapsed: false });
        clearTlReorderSelection();
        renderTlEditorItems('tl-generated-items-list');
    });

    document.getElementById('tl-video-add-header-btn')?.addEventListener('click', () => {
        syncTlEditorItems('tl-generated-items-list');
        tlEditorItems.unshift({ title: '', description: '', media: [], type: 'header', collapsed: false });
        clearTlReorderSelection();
        renderTlEditorItems('tl-generated-items-list');
    });

    // Mode tabs
    document.querySelectorAll('.tl-mode-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tl-mode-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            tlEditorMode = tab.dataset.mode;
            document.getElementById('tl-mode-manual').style.display = tlEditorMode === 'manual' ? '' : 'none';
            document.getElementById('tl-mode-video').style.display = tlEditorMode === 'video' ? '' : 'none';
        });
    });

    // Video upload
    setupTlVideoUpload();

    document.getElementById('tl-video-remove')?.addEventListener('click', () => {
        tlVideoFile = null;
        document.getElementById('tl-video-player').src = '';
        document.getElementById('tl-video-preview').style.display = 'none';
        document.getElementById('tl-video-upload-area').style.display = '';
        document.getElementById('tl-process-video-btn').style.display = 'none';
        document.getElementById('tl-transcript-panel').style.display = 'none';
        document.getElementById('tl-generated-items').style.display = 'none';
    });

    document.getElementById('tl-process-video-btn')?.addEventListener('click', processTaskVideo);

    // Filter buttons
    document.querySelectorAll('.tl-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tl-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            tlCurrentFilter = btn.dataset.filter;
            loadTaskLists();
        });
    });

    // Assign modal
    document.getElementById('close-tl-assign-modal')?.addEventListener('click', () => {
        document.getElementById('tl-assign-modal').classList.remove('active');
    });
    document.getElementById('tl-assign-cancel')?.addEventListener('click', () => {
        document.getElementById('tl-assign-modal').classList.remove('active');
    });
    document.getElementById('tl-assign-save')?.addEventListener('click', saveTaskListAssignments);

    // Detail modal
    document.getElementById('close-tl-detail-modal')?.addEventListener('click', () => {
        document.getElementById('tl-detail-modal').classList.remove('active');
    });
    document.getElementById('tl-detail-close')?.addEventListener('click', () => {
        document.getElementById('tl-detail-modal').classList.remove('active');
    });

    // Employee: task checklist back / done
    const goBackToMyTasks = () => {
        navigateToView('my-tasks', 'employee');
        loadMyTasks();
    };
    document.getElementById('my-task-back-btn')?.addEventListener('click', goBackToMyTasks);
    document.getElementById('my-task-checklist-close')?.addEventListener('click', goBackToMyTasks);

    // Clock-in panel refresh
    document.getElementById('tl-clockin-refresh')?.addEventListener('click', loadTaskListClockInPanel);

    // Clock-in task list popup dismiss
    document.getElementById('tl-clockin-modal-dismiss')?.addEventListener('click', () => {
        document.getElementById('tl-clockin-modal').classList.remove('active');
    });
}

// Self-init: register task-list event listeners at load time
initTaskListEventListeners();

// ==================== COPY ITEMS ====================

let tlCopyMultiSelect = false;
let tlCopySelectedIdxs = new Set();
let sopCopyMultiSelect = false;
let sopCopySelectedIdxs = new Set();

let _copyPendingItems = [];
let _copySourceType = null;
let _copySourceId = null;
let _copyDestFilter = 'all';

function updateCopyMultiBar(editorType) {
    const selectedSet = editorType === 'tl' ? tlCopySelectedIdxs : sopCopySelectedIdxs;
    const countEl = document.getElementById(`${editorType === 'tl' ? 'tl' : 'sop'}-copy-multi-count`);
    if (countEl) countEl.textContent = `${selectedSet.size} selected`;
}

function toggleCopyMultiSelect(editorType) {
    if (editorType === 'tl') {
        tlCopyMultiSelect = !tlCopyMultiSelect;
        tlCopySelectedIdxs.clear();
        const bar = document.getElementById('tl-copy-multi-bar');
        const toggle = document.getElementById('tl-copy-multi-btn');
        bar.style.display = tlCopyMultiSelect ? '' : 'none';
        toggle.classList.toggle('active', tlCopyMultiSelect);
        updateCopyMultiBar('tl');
        const activeListId = tlEditorMode === 'video' && document.getElementById('tl-generated-items').style.display !== 'none'
            ? 'tl-generated-items-list' : 'tl-items-list';
        renderTlEditorItems(activeListId);
    } else {
        sopCopyMultiSelect = !sopCopyMultiSelect;
        sopCopySelectedIdxs.clear();
        const bar = document.getElementById('sop-copy-multi-bar');
        const toggle = document.getElementById('sop-copy-multi-btn');
        bar.style.display = sopCopyMultiSelect ? '' : 'none';
        toggle.classList.toggle('active', sopCopyMultiSelect);
        updateCopyMultiBar('sop');
        renderSopEditorItems();
    }
}

function copySelectedItems(editorType) {
    const items = editorType === 'tl' ? tlEditorItems : sopEditorItems;
    const selectedSet = editorType === 'tl' ? tlCopySelectedIdxs : sopCopySelectedIdxs;
    if (selectedSet.size === 0) {
        showToast('Select at least one task to copy', 'error');
        return;
    }
    if (editorType === 'tl') {
        const activeListId = tlEditorMode === 'video' && document.getElementById('tl-generated-items').style.display !== 'none'
            ? 'tl-generated-items-list' : 'tl-items-list';
        syncTlEditorItems(activeListId);
    } else {
        syncSopEditorItemsFromDom();
    }
    const selected = Array.from(selectedSet)
        .sort((a, b) => a - b)
        .map(idx => items[idx])
        .filter(it => it && (it.type || 'task') !== 'header' && (it.type || 'task') !== 'section');
    if (selected.length === 0) {
        showToast('No tasks selected (headers/sections cannot be copied)', 'error');
        return;
    }
    const sourceId = editorType === 'tl'
        ? (document.getElementById('tl-editor-id').value || null)
        : (document.getElementById('sop-editor-id').value || null);
    openCopyItemsModal(selected, editorType === 'tl' ? 'task_list' : 'sop', sourceId);
}

async function openCopyItemsModal(items, sourceType, sourceId) {
    _copyPendingItems = items;
    _copySourceType = sourceType;
    _copySourceId = sourceId;
    _copyDestFilter = 'all';

    document.getElementById('copy-items-title').textContent =
        items.length === 1 ? 'Copy Task To…' : `Copy ${items.length} Tasks To…`;

    document.querySelectorAll('.copy-filter-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.filter === 'all');
    });

    await loadCopyDestinations();
    document.getElementById('copy-items-modal').classList.add('active');
}

async function loadCopyDestinations() {
    const list = document.getElementById('copy-items-destination-list');
    list.innerHTML = '<p class="text-muted" style="text-align:center;padding:1rem;">Loading…</p>';

    const [{ data: taskLists }, { data: sopTemplates }] = await Promise.all([
        supabaseClient.from('task_lists').select('id, title, is_sop, created_at').order('created_at', { ascending: false }),
        supabaseClient.from('sop_templates').select('id, name, created_at').order('created_at', { ascending: false })
    ]);

    let destinations = [];

    (taskLists || []).forEach(tl => {
        if (_copySourceType === 'task_list' && _copySourceId === tl.id) return;
        destinations.push({
            id: tl.id,
            name: tl.title,
            type: 'task_list',
            badge: tl.is_sop ? 'SOP' : 'Task',
            badgeClass: tl.is_sop ? 'sop' : 'task',
            createdAt: tl.created_at || ''
        });
    });

    (sopTemplates || []).forEach(sop => {
        if (_copySourceType === 'sop' && _copySourceId === sop.id) return;
        destinations.push({
            id: sop.id,
            name: sop.name,
            type: 'sop',
            badge: 'SOP Template',
            badgeClass: 'sop',
            createdAt: sop.created_at || ''
        });
    });

    destinations.sort((a, b) => (b.createdAt > a.createdAt ? 1 : b.createdAt < a.createdAt ? -1 : 0));

    if (_copyDestFilter === 'task') {
        destinations = destinations.filter(d => d.type === 'task_list');
    } else if (_copyDestFilter === 'sop') {
        destinations = destinations.filter(d => d.type === 'sop');
    }

    if (destinations.length === 0) {
        list.innerHTML = '<p class="text-muted" style="text-align:center;padding:1rem;">No destinations available.</p>';
        return;
    }

    list.innerHTML = destinations.map(d => `
        <button type="button" class="copy-dest-card" data-dest-id="${d.id}" data-dest-type="${d.type}">
            <span class="copy-dest-name">${escapeHtml(d.name)}</span>
            <span class="tl-badge ${d.badgeClass}">${d.badge}</span>
        </button>
    `).join('');

    list.querySelectorAll('.copy-dest-card').forEach(card => {
        card.addEventListener('click', () => {
            executeCopyToDestination(card.dataset.destType, card.dataset.destId);
        });
    });
}

async function executeCopyToDestination(destType, destId) {
    const items = _copyPendingItems;
    if (!items || !items.length) return;

    const modal = document.getElementById('copy-items-modal');
    const cards = modal.querySelectorAll('.copy-dest-card');
    cards.forEach(c => { c.disabled = true; c.style.opacity = '0.5'; });

    try {
        if (destType === 'task_list') {
            const { data: existing } = await supabaseClient
                .from('task_list_items')
                .select('sort_order')
                .eq('task_list_id', destId)
                .order('sort_order', { ascending: false })
                .limit(1);
            let nextOrder = (existing && existing.length) ? existing[0].sort_order + 1 : 0;

            const rows = items.map((item, i) => {
                const row = {
                    task_list_id: destId,
                    sort_order: nextOrder + i,
                    title: item.title || 'Untitled',
                    description: item.description || null,
                    media: item.media || [],
                    item_type: 'task',
                    equipment: item.equipment || [],
                    video_timestamp: item.video_timestamp != null ? item.video_timestamp : null
                };
                if (_copySourceType === 'task_list') {
                    row.location_from = item.location_from || null;
                    row.location_to = item.location_to || null;
                } else {
                    row.location_from = item.location || null;
                    row.location_to = null;
                }
                return row;
            });

            const { error } = await supabaseClient.from('task_list_items').insert(rows);
            if (error) throw error;

        } else if (destType === 'sop') {
            const { data: existing } = await supabaseClient
                .from('sop_items')
                .select('sort_order')
                .eq('sop_template_id', destId)
                .order('sort_order', { ascending: false })
                .limit(1);
            let nextOrder = (existing && existing.length) ? existing[0].sort_order + 1 : 0;

            const rows = items.map((item, i) => {
                const row = {
                    sop_template_id: destId,
                    sort_order: nextOrder + i,
                    title: item.title || 'Untitled',
                    description: item.description || null,
                    media: item.media || [],
                    item_type: 'task',
                    equipment: item.equipment || []
                };
                if (_copySourceType === 'sop') {
                    row.location = item.location || null;
                } else {
                    row.location = item.location_from || null;
                }
                return row;
            });

            const { error } = await supabaseClient.from('sop_items').insert(rows);
            if (error) throw error;
        }

        modal.classList.remove('active');
        showToast(`Copied ${items.length} task${items.length > 1 ? 's' : ''} successfully`);

        if (tlCopyMultiSelect) toggleCopyMultiSelect('tl');
        if (sopCopyMultiSelect) toggleCopyMultiSelect('sop');

    } catch (err) {
        console.error('Copy items error:', err);
        showToast('Failed to copy tasks: ' + (err.message || 'Unknown error'), 'error');
    } finally {
        cards.forEach(c => { c.disabled = false; c.style.opacity = ''; });
    }
}

function initCopyItemsListeners() {
    document.getElementById('close-copy-items-modal')?.addEventListener('click', () => {
        document.getElementById('copy-items-modal').classList.remove('active');
    });

    document.querySelectorAll('.copy-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.copy-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            _copyDestFilter = btn.dataset.filter;
            loadCopyDestinations();
        });
    });

    // Task list multi-select
    document.getElementById('tl-copy-multi-btn')?.addEventListener('click', () => toggleCopyMultiSelect('tl'));
    document.getElementById('tl-copy-selected-btn')?.addEventListener('click', () => copySelectedItems('tl'));
    document.getElementById('tl-copy-cancel-btn')?.addEventListener('click', () => toggleCopyMultiSelect('tl'));

    // SOP multi-select
    document.getElementById('sop-copy-multi-btn')?.addEventListener('click', () => toggleCopyMultiSelect('sop'));
    document.getElementById('sop-copy-selected-btn')?.addEventListener('click', () => copySelectedItems('sop'));
    document.getElementById('sop-copy-cancel-btn')?.addEventListener('click', () => toggleCopyMultiSelect('sop'));
}

initCopyItemsListeners();

// ==================== IMAGE MARKUP ====================

const markup = {
    overlay: null,
    canvas: null,
    ctx: null,
    baseImage: null,
    history: [],
    currentTool: 'pen',
    currentColor: '#FF3B30',
    lineWidth: 4,
    drawing: false,
    lastX: 0,
    lastY: 0,
    shapeStart: null,
    _callbackItemIdx: null,
    _callbackMediaIdx: null,

    init() {
        this.overlay = document.getElementById('markup-overlay');
        this.canvas = document.getElementById('markup-canvas');
        this.ctx = this.canvas.getContext('2d');

        document.getElementById('markup-close').addEventListener('click', () => this.close());
        document.getElementById('markup-save').addEventListener('click', () => this.save());
        document.getElementById('markup-undo').addEventListener('click', () => this.undo());
        document.getElementById('markup-clear').addEventListener('click', () => this.clearDrawing());

        document.querySelectorAll('.markup-tool[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.markup-tool[data-tool]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTool = btn.dataset.tool;
            });
        });

        document.querySelectorAll('.markup-color').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.markup-color').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentColor = btn.dataset.color;
            });
        });

        document.getElementById('markup-size').addEventListener('input', (e) => {
            this.lineWidth = parseInt(e.target.value, 10);
        });

        this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        this.canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
        this.canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
        this.canvas.addEventListener('pointerleave', (e) => this.onPointerUp(e));
        this.canvas.style.touchAction = 'none';
    },

    open(imageUrl, itemIdx, mediaIdx) {
        this._callbackItemIdx = itemIdx;
        this._callbackMediaIdx = mediaIdx;
        this.history = [];
        this.drawing = false;

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            this.baseImage = img;
            this.overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
            requestAnimationFrame(() => {
                this.sizeCanvas();
                this.redraw();
            });
        };
        img.onerror = () => {
            showToast('Could not load image for markup', 'error');
        };
        img.src = imageUrl;
    },

    sizeCanvas() {
        const wrap = document.getElementById('markup-canvas-wrap');
        const maxW = wrap.clientWidth;
        const maxH = wrap.clientHeight;
        const imgW = this.baseImage.naturalWidth;
        const imgH = this.baseImage.naturalHeight;
        const scale = Math.min(maxW / imgW, maxH / imgH, 1);
        this.canvas.width = Math.round(imgW * scale);
        this.canvas.height = Math.round(imgH * scale);
    },

    close() {
        this.overlay.classList.remove('active');
        document.body.style.overflow = '';
        this.baseImage = null;
        this.history = [];
    },

    getPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
            y: (e.clientY - rect.top) * (this.canvas.height / rect.height)
        };
    },

    onPointerDown(e) {
        e.preventDefault();
        this.drawing = true;
        const pos = this.getPos(e);
        this.lastX = pos.x;
        this.lastY = pos.y;

        if (this.currentTool === 'pen' || this.currentTool === 'eraser') {
            this.history.push({
                tool: this.currentTool,
                color: this.currentColor,
                width: this.currentTool === 'eraser' ? this.lineWidth * 4 : this.lineWidth,
                points: [{ x: pos.x, y: pos.y }]
            });
        } else {
            this.shapeStart = { x: pos.x, y: pos.y };
        }
    },

    onPointerMove(e) {
        if (!this.drawing) return;
        e.preventDefault();
        const pos = this.getPos(e);

        if (this.currentTool === 'pen' || this.currentTool === 'eraser') {
            const stroke = this.history[this.history.length - 1];
            if (stroke) stroke.points.push({ x: pos.x, y: pos.y });
            this.redraw();
        } else if (this.shapeStart) {
            this.redraw();
            this.drawShapePreview(this.shapeStart, pos);
        }

        this.lastX = pos.x;
        this.lastY = pos.y;
    },

    onPointerUp(e) {
        if (!this.drawing) return;
        this.drawing = false;

        if ((this.currentTool === 'arrow' || this.currentTool === 'circle') && this.shapeStart) {
            const pos = this.getPos(e);
            this.history.push({
                tool: this.currentTool,
                color: this.currentColor,
                width: this.lineWidth,
                start: { ...this.shapeStart },
                end: { x: pos.x, y: pos.y }
            });
            this.shapeStart = null;
            this.redraw();
        }
    },

    drawShapePreview(start, end) {
        const ctx = this.ctx;
        ctx.save();
        ctx.strokeStyle = this.currentColor;
        ctx.lineWidth = this.lineWidth;
        ctx.lineCap = 'round';

        if (this.currentTool === 'arrow') {
            this.drawArrow(ctx, start.x, start.y, end.x, end.y);
        } else if (this.currentTool === 'circle') {
            const rx = Math.abs(end.x - start.x) / 2;
            const ry = Math.abs(end.y - start.y) / 2;
            const cx = (start.x + end.x) / 2;
            const cy = (start.y + end.y) / 2;
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    },

    drawArrow(ctx, x1, y1, x2, y2) {
        const headLen = Math.max(12, ctx.lineWidth * 4);
        const angle = Math.atan2(y2 - y1, x2 - x1);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
    },

    _renderStrokes(targetCtx, w, h, scaleX, scaleY) {
        const offscreen = document.createElement('canvas');
        offscreen.width = w;
        offscreen.height = h;
        const oc = offscreen.getContext('2d');

        for (const stroke of this.history) {
            oc.save();
            oc.lineCap = 'round';
            oc.lineJoin = 'round';
            oc.lineWidth = stroke.width * scaleX;

            if (stroke.tool === 'eraser') {
                oc.globalCompositeOperation = 'destination-out';
                oc.strokeStyle = 'rgba(0,0,0,1)';
            } else {
                oc.strokeStyle = stroke.color;
            }

            if (stroke.tool === 'pen' || stroke.tool === 'eraser') {
                if (stroke.points.length < 2) {
                    oc.beginPath();
                    oc.arc(stroke.points[0].x * scaleX, stroke.points[0].y * scaleY, (stroke.width * scaleX) / 2, 0, Math.PI * 2);
                    oc.fillStyle = stroke.tool === 'eraser' ? 'rgba(0,0,0,1)' : stroke.color;
                    oc.fill();
                } else {
                    oc.beginPath();
                    oc.moveTo(stroke.points[0].x * scaleX, stroke.points[0].y * scaleY);
                    for (let i = 1; i < stroke.points.length; i++) {
                        oc.lineTo(stroke.points[i].x * scaleX, stroke.points[i].y * scaleY);
                    }
                    oc.stroke();
                }
            } else if (stroke.tool === 'arrow') {
                this.drawArrow(oc, stroke.start.x * scaleX, stroke.start.y * scaleY, stroke.end.x * scaleX, stroke.end.y * scaleY);
            } else if (stroke.tool === 'circle') {
                const rx = Math.abs(stroke.end.x - stroke.start.x) / 2 * scaleX;
                const ry = Math.abs(stroke.end.y - stroke.start.y) / 2 * scaleY;
                const cx = (stroke.start.x + stroke.end.x) / 2 * scaleX;
                const cy = (stroke.start.y + stroke.end.y) / 2 * scaleY;
                oc.beginPath();
                oc.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
                oc.stroke();
            }
            oc.restore();
        }

        targetCtx.drawImage(offscreen, 0, 0);
    },

    redraw() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        ctx.clearRect(0, 0, w, h);
        if (this.baseImage) {
            ctx.drawImage(this.baseImage, 0, 0, w, h);
        }
        this._renderStrokes(ctx, w, h, 1, 1);
    },

    undo() {
        if (this.history.length === 0) return;
        this.history.pop();
        this.redraw();
    },

    clearDrawing() {
        this.history = [];
        this.redraw();
    },

    async save() {
        if (!this.baseImage) return;
        if (this.history.length === 0) {
            showToast('No annotations to save');
            this.close();
            return;
        }

        const saveBtn = document.getElementById('markup-save');
        saveBtn.textContent = 'Saving…';
        saveBtn.disabled = true;

        try {
            const fullW = this.baseImage.naturalWidth;
            const fullH = this.baseImage.naturalHeight;
            const fullCanvas = document.createElement('canvas');
            fullCanvas.width = fullW;
            fullCanvas.height = fullH;
            const fullCtx = fullCanvas.getContext('2d');
            fullCtx.drawImage(this.baseImage, 0, 0);

            const scaleX = fullW / this.canvas.width;
            const scaleY = fullH / this.canvas.height;
            this._renderStrokes(fullCtx, fullW, fullH, scaleX, scaleY);

            const blob = await new Promise(res => fullCanvas.toBlob(res, 'image/png'));
            const path = `${currentUser.id}/task-markup/${Date.now()}.png`;
            const { data, error } = await supabaseClient.storage
                .from(TASK_LIST_STORAGE_BUCKET)
                .upload(path, blob, { upsert: true, contentType: 'image/png' });

            if (error) throw error;

            const { data: urlData } = supabaseClient.storage
                .from(TASK_LIST_STORAGE_BUCKET)
                .getPublicUrl(data.path);

            const idx = this._callbackItemIdx;
            const mi = this._callbackMediaIdx;
            if (idx != null && mi != null && tlEditorItems[idx]?.media?.[mi]) {
                tlEditorItems[idx].media[mi].url = urlData.publicUrl;
                const activeListId = tlEditorMode === 'video' && document.getElementById('tl-generated-items').style.display !== 'none'
                    ? 'tl-generated-items-list' : 'tl-items-list';
                renderTlEditorItems(activeListId);
            }

            showToast('Marked-up image saved');
            this.close();
        } catch (err) {
            console.error('Markup save error:', err);
            showToast('Failed to save markup', 'error');
        } finally {
            saveBtn.textContent = 'Save';
            saveBtn.disabled = false;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => markup.init());

window.openImageMarkup = function(imageUrl, itemIdx, mediaIdx) {
    markup.open(imageUrl, itemIdx, mediaIdx);
};
