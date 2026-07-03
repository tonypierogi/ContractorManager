// ==================== LOCATIONS PAGE ====================

const LOCATION_ZONES = {
    upstairs: [
        { id: 'back-closet', label: 'Back Closet' },
        { id: 'big-room',    label: 'Big Room' },
        { id: 'loft',        label: 'Loft' },
    ],
    downstairs: [
        { id: 'office',      label: 'Office' },
        { id: 'av-closet',   label: 'AV Closet' },
        { id: 'sauna',       label: 'Sauna' },
        { id: 'basement',    label: 'Basement' },
        { id: 'lounge',      label: 'Lounge' },
        { id: 'lobby',       label: 'Lobby' },
        { id: 'bar-closet',  label: 'Bar Closet' },
    ],
};

const ZONE_OVERLAYS = {
    upstairs: [
        { id: 'back-closet', top: 0,  left: 0,  width: 100, height: 24 },
        { id: 'big-room',    top: 24, left: 0,  width: 100, height: 45 },
        { id: 'loft',        top: 74, left: 0,  width: 100, height: 26 },
    ],
    downstairs: [
        // top = % from top, left = % from left, width/height = % size
        // Adjust these values to reposition overlay zones on the floor plan
        { id: 'office',      top: 1,  left: 55, width: 45,  height: 16 },
        { id: 'av-closet',   top: 20, left: 62, width: 30,  height: 4 },
        { id: 'sauna',       top: 40, left: 55, width: 38,  height: 8 },
        { id: 'basement',    top: 0,  left: 0,  width: 65,  height: 45 },
        { id: 'lounge',      top: 52, left: 0,  width: 100, height: 28 },
        { id: 'lobby',       top: 80, left: 0,  width: 100,  height: 18 },
        { id: 'bar-closet',  top: 94, left: 62, width: 38,  height: 10 },
    ],
};

const locationsState = {};

function initLocationsView(prefix) {
    if (locationsState[prefix]?.initialized) return;
    locationsState[prefix] = { initialized: true, currentFloor: 'upstairs', activeZone: null };

    const container = prefix === 'admin'
        ? document.getElementById('admin-locations-view')
        : document.getElementById('locations-view');
    if (!container) return;

    const tabs = container.querySelectorAll('.locations-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            locationsState[prefix].currentFloor = tab.dataset.floor;
            locationsState[prefix].activeZone = null;
            renderLocationsFloor(prefix);
        });
    });

    renderLocationsFloor(prefix);
}

function renderLocationsFloor(prefix) {
    const state = locationsState[prefix];
    const floor = state.currentFloor;
    const zones = LOCATION_ZONES[floor];
    const overlays = ZONE_OVERLAYS[floor];
    const floorPrefix = floor === 'upstairs' ? 'up' : 'down';

    const floorplanEl = document.getElementById(`${prefix}-floorplan`);
    const imgEl = document.getElementById(`${prefix}-floorplan-img`);
    const zoneListEl = document.getElementById(`${prefix}-zone-list`);
    const photoEl = document.getElementById(`${prefix}-photo-preview`);

    imgEl.src = `images/locations/fp-${floorPrefix}-default.png`;
    imgEl.alt = `${floor} floor plan`;

    floorplanEl.querySelectorAll('.zone-overlay').forEach(el => el.remove());

    overlays.forEach(ov => {
        const zone = zones.find(z => z.id === ov.id);
        if (!zone) return;
        const div = document.createElement('div');
        div.className = 'zone-overlay';
        div.dataset.zone = ov.id;
        div.style.top = ov.top + '%';
        div.style.left = ov.left + '%';
        div.style.width = ov.width + '%';
        div.style.height = ov.height + '%';
        div.innerHTML = `<span class="zone-overlay-label">${zone.label}</span>`;

        div.addEventListener('mouseenter', () => {
            highlightZone(prefix, ov.id, floorPrefix);
            const btn = zoneListEl.querySelector(`.zone-btn[data-zone="${ov.id}"]`);
            if (btn) btn.classList.add('hover');
        });
        div.addEventListener('mouseleave', () => {
            clearZone(prefix, floorPrefix);
            zoneListEl.querySelectorAll('.zone-btn').forEach(b => b.classList.remove('hover'));
        });
        div.addEventListener('click', () => {
            const wasActive = state.activeZone === ov.id;
            state.activeZone = wasActive ? null : ov.id;
            zoneListEl.querySelectorAll('.zone-btn').forEach(b => b.classList.remove('active'));
            floorplanEl.querySelectorAll('.zone-overlay').forEach(o => o.classList.remove('active'));
            if (!wasActive) {
                div.classList.add('active');
                const btn = zoneListEl.querySelector(`.zone-btn[data-zone="${ov.id}"]`);
                if (btn) btn.classList.add('active');
                highlightZone(prefix, ov.id, floorPrefix);
                loadLinkedTasks(prefix, ov.id);
            } else {
                clearZone(prefix, floorPrefix);
            }
        });

        floorplanEl.appendChild(div);
    });

    resetPhotoPreview(photoEl);

    zoneListEl.innerHTML = zones.map(z => `
        <button class="zone-btn" data-zone="${z.id}">
            <span class="zone-dot"></span>
            ${z.label}
        </button>
    `).join('');

    zoneListEl.querySelectorAll('.zone-btn').forEach(btn => {
        const zoneId = btn.dataset.zone;

        btn.addEventListener('mouseenter', () => {
            highlightZone(prefix, zoneId, floorPrefix);
            const ov = floorplanEl.querySelector(`.zone-overlay[data-zone="${zoneId}"]`);
            if (ov) ov.classList.add('hover');
        });
        btn.addEventListener('mouseleave', () => {
            clearZone(prefix, floorPrefix);
            floorplanEl.querySelectorAll('.zone-overlay').forEach(o => o.classList.remove('hover'));
        });
        btn.addEventListener('click', () => {
            const wasActive = state.activeZone === zoneId;
            state.activeZone = wasActive ? null : zoneId;

            zoneListEl.querySelectorAll('.zone-btn').forEach(b => b.classList.remove('active'));
            floorplanEl.querySelectorAll('.zone-overlay').forEach(o => o.classList.remove('active'));
            if (!wasActive) {
                btn.classList.add('active');
                const ov = floorplanEl.querySelector(`.zone-overlay[data-zone="${zoneId}"]`);
                if (ov) ov.classList.add('active');
                highlightZone(prefix, zoneId, floorPrefix);
                loadLinkedTasks(prefix, zoneId);
            } else {
                clearZone(prefix, floorPrefix);
            }
        });
    });
}

function highlightZone(prefix, zoneId, floorPrefix) {
    const imgEl = document.getElementById(`${prefix}-floorplan-img`);
    const photoEl = document.getElementById(`${prefix}-photo-preview`);

    imgEl.src = `images/locations/fp-${floorPrefix}-${zoneId}.png`;

    const zone = [...LOCATION_ZONES.upstairs, ...LOCATION_ZONES.downstairs].find(z => z.id === zoneId);
    photoEl.innerHTML = `
        <img src="images/locations/photo-${zoneId}.png" alt="${zone?.label || zoneId}">
        <div class="photo-caption">${zone?.label || zoneId}</div>
    `;
    photoEl.classList.add('has-photo');

    const state = locationsState[prefix];
    if (state.activeZone === zoneId) {
        loadLinkedTasks(prefix, zoneId);
    }
}

function clearZone(prefix, floorPrefix) {
    const state = locationsState[prefix];
    if (state.activeZone) return;

    const imgEl = document.getElementById(`${prefix}-floorplan-img`);
    const photoEl = document.getElementById(`${prefix}-photo-preview`);

    imgEl.src = `images/locations/fp-${floorPrefix}-default.png`;
    resetPhotoPreview(photoEl);

    const tasksEl = document.getElementById(`${prefix}-linked-tasks`);
    if (tasksEl) tasksEl.innerHTML = '';
}

function getLocationLabel(zoneId) {
    const all = [...LOCATION_ZONES.upstairs, ...LOCATION_ZONES.downstairs];
    const z = all.find(z => z.id === zoneId);
    return z ? z.label : zoneId;
}

async function loadLinkedTasks(prefix, zoneId) {
    const container = document.getElementById(`${prefix}-linked-tasks`);
    if (!container) return;

    if (!zoneId) {
        container.innerHTML = '';
        return;
    }

    const zone = [...LOCATION_ZONES.upstairs, ...LOCATION_ZONES.downstairs].find(z => z.id === zoneId);
    const label = zone?.label || zoneId;

    container.innerHTML = `<div class="linked-tasks-loading">Loading tasks...</div>`;

    try {
        const { data, error } = await supabaseClient
            .from('task_lists')
            .select('id, title, is_sop, task_list_items(id), task_list_assignments(id, status)')
            .eq('location', zoneId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="linked-tasks-empty">
                    <p>No tasks linked to <strong>${escapeHtml(label)}</strong></p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="linked-tasks-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="16 3 16 8 21 8"></polyline>
                </svg>
                Tasks for ${escapeHtml(label)}
            </div>
            ${data.map(t => {
                const count = (t.task_list_items || []).length;
                const assigned = (t.task_list_assignments || []).length;
                return `
                <div class="linked-task-item" onclick="openTaskListDetail('${t.id}')">
                    <span class="linked-task-title">${escapeHtml(t.title)}</span>
                    <span class="tl-badge ${t.is_sop ? 'sop' : 'task'}">${t.is_sop ? 'SOP' : 'Task'}</span>
                    <span class="linked-task-meta">${count} item${count !== 1 ? 's' : ''}${assigned ? ` · ${assigned} assigned` : ''}</span>
                </div>`;
            }).join('')}
        `;
    } catch (err) {
        container.innerHTML = '';
    }
}

function resetPhotoPreview(photoEl) {
    photoEl.innerHTML = `
        <div class="photo-placeholder">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <p>Hover a zone to preview</p>
        </div>
    `;
    photoEl.classList.remove('has-photo');
}
