// Public share page for a task list or a day's SOP checklist.
//
// The app generates links of the form:
//   {SUPABASE_URL}/functions/v1/share-task-list?t={share_token}       (task list)
//   {SUPABASE_URL}/functions/v1/share-task-list?t={token}&k=sop      (daily SOP)
// Anyone with the link can view the list and check items off — no account
// needed. State lives in task_list_anonymous_checks / sop_anonymous_checks (one
// row per checked item, shared by every viewer) and syncs live over Supabase
// Realtime, so a crew can split up a list and watch each other's progress.
//
// All data access goes through the token-gated SECURITY DEFINER functions from
// migrations 20260817130000_task_list_share_page.sql and
// 20260818090000_daily_sop_share_page.sql — the anon key alone can't enumerate
// lists. Both kinds return the same JSON shape, so the page below differs only
// in which RPCs and which realtime table it talks to.
//
// IMPORTANT — deploy with JWT verification off, since browsers hit this URL
// with no Authorization header:
//   supabase functions deploy share-task-list --no-verify-jwt
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

function pageHtml(supabaseUrl: string, anonKey: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Shared Task List</title>
<style>
  :root {
    --accent: #00d4aa;
    --bg: #0a0f1a;
    --panel: #1a2234;
    --elevated: #243047;
    --text: #f1f5f9;
    --text-secondary: #94a3b8;
    --text-muted: #64748b;
    --border: #2d3a4f;
    --danger: #f43f5e;
    --success: #10b981;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 560px; margin: 0 auto; padding: 24px 16px 64px; }
  .brand {
    display: flex; align-items: center; gap: 8px;
    font-size: 12px; color: var(--text-muted);
    text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px;
  }
  .live-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--text-muted); transition: background .3s;
  }
  .live .live-dot { background: var(--success); }
  .live-label { margin-left: auto; font-size: 12px; }
  h1 { font-size: 24px; font-weight: 600; }
  .desc { color: var(--text-secondary); font-size: 14px; margin-top: 4px; }
  .progress-track {
    height: 6px; background: var(--elevated); border-radius: 999px;
    margin: 20px 0 8px; overflow: hidden;
  }
  .progress-fill {
    height: 100%; width: 0%; background: var(--accent);
    border-radius: 999px; transition: width .25s ease;
  }
  .progress-text { font-size: 12px; color: var(--text-secondary); }
  .items { margin-top: 20px; display: flex; flex-direction: column; gap: 8px; }
  .section-label {
    font-size: 12px; color: var(--text-muted); text-transform: uppercase;
    letter-spacing: .5px; margin-top: 12px;
  }
  .card {
    background: var(--panel); border: 1px solid var(--border);
    border-radius: 10px; padding: 12px;
  }
  .card.checked { opacity: .6; }
  .main-row { display: flex; align-items: center; gap: 10px; }
  .thumb {
    width: 56px; height: 56px; border-radius: 6px; flex: none;
    object-fit: cover; background: var(--elevated); border: 0;
    padding: 0; cursor: pointer; display: block;
  }
  .thumb-empty {
    width: 56px; height: 56px; border-radius: 6px; flex: none;
    background: var(--elevated); display: flex; align-items: center;
    justify-content: center; color: var(--text-muted); font-size: 20px;
  }
  .body {
    flex: 1; min-width: 0; text-align: left; background: none;
    border: 0; padding: 0; cursor: pointer; color: inherit; font: inherit;
  }
  .title { font-size: 14px; font-weight: 500; }
  .checked .title { text-decoration: line-through; color: var(--text-secondary); }
  .hint {
    display: flex; align-items: center; gap: 4px; margin-top: 4px;
    font-size: 12px; color: var(--text-muted);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .chev { display: inline-block; transition: transform .15s; font-size: 10px; }
  .open .chev { transform: rotate(180deg); }
  .checkbox {
    width: 44px; height: 44px; flex: none; background: none; border: 0;
    display: flex; align-items: center; justify-content: center; cursor: pointer;
  }
  .box {
    width: 26px; height: 26px; border-radius: 6px;
    border: 2px solid var(--text-muted);
    display: flex; align-items: center; justify-content: center;
    color: transparent; font-size: 16px; font-weight: 700;
    transition: all .15s;
  }
  .checked .box { background: var(--accent); border-color: var(--accent); color: #fff; }
  .details { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border); }
  .details p { font-size: 13px; color: var(--text-secondary); }
  .meta-row {
    display: flex; align-items: center; gap: 6px; margin-top: 8px;
    font-size: 12px; color: var(--text-secondary);
  }
  .eq-list { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; }
  .eq-row { font-size: 12px; color: var(--text-secondary); }
  .eq-mode {
    font-size: 10px; font-weight: 700; letter-spacing: .5px;
    color: var(--accent); margin-right: 6px;
  }
  .eq-mode-return { color: #f59e0b; }
  .eq-name { color: var(--text); font-weight: 600; margin-right: 6px; }
  .eq-move { color: var(--text-secondary); }
  .extra-thumbs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .extra-thumbs .thumb { width: 64px; height: 64px; }
  .done-banner {
    margin-top: 20px; padding: 12px; border-radius: 10px;
    background: rgba(16,185,129,.15); color: var(--success);
    text-align: center; font-size: 14px; font-weight: 600;
  }
  .state { text-align: center; padding: 64px 16px; color: var(--text-secondary); }
  .state h2 { color: var(--text); font-size: 18px; margin-bottom: 8px; }
  #overlay {
    position: fixed; inset: 0; background: rgba(5,8,14,.95);
    display: none; align-items: center; justify-content: center; z-index: 10;
    cursor: pointer;
  }
  #overlay.show { display: flex; }
  #overlay img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .footer {
    margin-top: 32px; text-align: center;
    font-size: 12px; color: var(--text-muted);
  }
</style>
</head>
<body>
  <div class="wrap">
    <div class="brand" id="brand">
      <span class="live-dot"></span><span>Shared checklist</span>
      <span class="live-label" id="liveLabel">connecting&hellip;</span>
    </div>
    <div id="app"><div class="state">Loading&hellip;</div></div>
    <div class="footer">Shared from TimeTrack Pro &mdash; checking items updates everyone in real time.</div>
  </div>
  <div id="overlay"><img alt=""></div>
<script type="module">
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = ${JSON.stringify(supabaseUrl)};
const ANON_KEY = ${JSON.stringify(anonKey)};
const PARAMS = new URLSearchParams(location.search);
const TOKEN = PARAMS.get('t') || '';
// 'sop' links point at one day's SOP run; anything else is a task list.
// Older links carry no k= at all, so task list stays the default.
const KIND = PARAMS.get('k') === 'sop' ? 'sop' : 'list';
const API = KIND === 'sop'
  ? {
      read: 'get_shared_daily_sop',
      write: 'set_shared_sop_check',
      table: 'sop_anonymous_checks',
      idColumn: 'sop_item_id',
      filterColumn: 'daily_sop_id',
    }
  : {
      read: 'get_shared_task_list',
      write: 'set_shared_task_check',
      table: 'task_list_anonymous_checks',
      idColumn: 'task_list_item_id',
      filterColumn: 'task_list_id',
    };

// Mirrors features/locations/zones.ts — zone ids are stored verbatim in the DB.
const ZONES = {
  'back-closet': 'Back Closet', 'big-room': 'Big Room', 'loft': 'Loft',
  'office': 'Office', 'av-closet': 'AV Closet', 'sauna': 'Sauna',
  'basement': 'Basement', 'lounge': 'Lounge', 'lobby': 'Lobby',
  'bar-closet': 'Bar Closet',
};
const zoneLabel = (id) => ZONES[id] || id;

const supabase = createClient(SUPABASE_URL, ANON_KEY);
const app = document.getElementById('app');
const overlay = document.getElementById('overlay');
const overlayImg = overlay.querySelector('img');

let list = null;
let items = [];
let equipmentNames = new Map();
let checked = new Set();
const expanded = new Set();

overlay.addEventListener('click', () => overlay.classList.remove('show'));
function showImage(url) {
  overlayImg.src = url;
  overlay.classList.add('show');
}

function imagesOf(item) {
  const media = Array.isArray(item.media) ? item.media : [];
  return media
    .filter((m) => m && m.url && !String(m.type || '').startsWith('video'))
    .map((m) => m.url);
}

// Mirrors features/equipment/refs.ts — the equipment column stores bare id
// strings (legacy), {id, from, to} objects from before link modes, or full
// {id, mode, from, to} refs. A pre-mode row with only a dropoff zone reads as
// a return, everything else as a use.
function equipmentRefs(item) {
  const raw = Array.isArray(item.equipment) ? item.equipment : [];
  const refs = [];
  for (const entry of raw) {
    if (typeof entry === 'string') {
      if (entry) refs.push({ id: entry, mode: 'use', from: null, to: null });
    } else if (entry && typeof entry === 'object' && typeof entry.id === 'string' && entry.id) {
      const from = entry.from || null;
      const to = entry.to || null;
      const mode = entry.mode === 'use' || entry.mode === 'return'
        ? entry.mode
        : (to && !from ? 'return' : 'use');
      refs.push({ id: entry.id, mode, from, to });
    }
  }
  return refs;
}

// Equipment-level zones win; unset ones inherit the task's own from/to. A
// return names where it goes back to, a use names where to grab it.
function placementLabel(ref, item) {
  const from = ref.from || item.location_from || null;
  const to = ref.to || item.location_to || null;
  if (ref.mode === 'return') {
    if (to) return 'Back to ' + zoneLabel(to);
    return from ? 'From ' + zoneLabel(from) : null;
  }
  if (from && to) return zoneLabel(from) + ' \\u2192 ' + zoneLabel(to);
  if (from || to) return zoneLabel(from || to);
  return null;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

async function toggle(item) {
  const next = !checked.has(item.id);
  // Optimistic — realtime (or the error path) reconciles.
  if (next) checked.add(item.id); else checked.delete(item.id);
  render();
  const { error } = await supabase.rpc(API.write, {
    p_token: TOKEN, p_item_id: item.id, p_checked: next,
  });
  if (error) {
    if (next) checked.delete(item.id); else checked.add(item.id);
    render();
  }
}

function renderItem(item) {
  const isChecked = checked.has(item.id);
  const isOpen = expanded.has(item.id);
  const images = imagesOf(item);
  const eqRefs = equipmentRefs(item);
  const location = item.location_from && item.location_to
    ? zoneLabel(item.location_from) + ' \\u2192 ' + zoneLabel(item.location_to)
    : (item.location_from || item.location_to)
      ? zoneLabel(item.location_from || item.location_to)
      : null;
  const hasDetails = !!item.description || !!location || eqRefs.length > 0 || images.length > 1;

  const card = el('div', 'card' + (isChecked ? ' checked' : '') + (isOpen ? ' open' : ''));
  const main = el('div', 'main-row');

  if (images.length > 0) {
    const img = el('img', 'thumb');
    img.src = images[0];
    img.alt = 'Photo for ' + item.title;
    img.addEventListener('click', () => showImage(images[0]));
    main.appendChild(img);
  } else {
    main.appendChild(el('div', 'thumb-empty', '\\uD83D\\uDDBC'));
  }

  const body = el('button', 'body');
  body.appendChild(el('div', 'title', item.title));
  if (hasDetails) {
    const hint = el('div', 'hint');
    hint.appendChild(el('span', 'chev', '\\u25BC'));
    const parts = [];
    if (location) parts.push(location);
    if (images.length > 1) parts.push(images.length + ' photos');
    if (eqRefs.length) parts.push(eqRefs.length + ' equipment');
    hint.appendChild(el('span', null, isOpen ? 'Hide details' : (parts.join(' \\u00B7 ') || 'Details')));
    body.appendChild(hint);
    body.addEventListener('click', () => {
      if (expanded.has(item.id)) expanded.delete(item.id); else expanded.add(item.id);
      render();
    });
  }
  main.appendChild(body);

  const check = el('button', 'checkbox');
  check.setAttribute('role', 'checkbox');
  check.setAttribute('aria-checked', String(isChecked));
  check.setAttribute('aria-label', item.title);
  check.appendChild(el('span', 'box', '\\u2713'));
  check.addEventListener('click', () => toggle(item));
  main.appendChild(check);
  card.appendChild(main);

  if (isOpen && hasDetails) {
    const details = el('div', 'details');
    if (item.description) details.appendChild(el('p', null, item.description));
    if (location) {
      const row = el('div', 'meta-row');
      row.appendChild(el('span', null, '\\uD83D\\uDCCD ' + location));
      details.appendChild(row);
    }
    if (eqRefs.length) {
      const eqWrap = el('div', 'eq-list');
      eqRefs.forEach((ref) => {
        const row = el('div', 'eq-row');
        row.appendChild(
          el('span', 'eq-mode' + (ref.mode === 'return' ? ' eq-mode-return' : ''),
            ref.mode === 'return' ? 'RETURN' : 'USE'),
        );
        row.appendChild(el('span', 'eq-name', equipmentNames.get(ref.id) || 'Equipment'));
        const move = placementLabel(ref, item);
        if (move) row.appendChild(el('span', 'eq-move', move));
        eqWrap.appendChild(row);
      });
      details.appendChild(eqWrap);
    }
    if (images.length > 1) {
      const extra = el('div', 'extra-thumbs');
      images.slice(1).forEach((url) => {
        const img = el('img', 'thumb');
        img.src = url;
        img.alt = 'Photo for ' + item.title;
        img.addEventListener('click', () => showImage(url));
        extra.appendChild(img);
      });
      details.appendChild(extra);
    }
    card.appendChild(details);
  }
  return card;
}

function render() {
  app.textContent = '';
  if (!list) return;
  app.appendChild(el('h1', null, list.title));
  if (list.description) app.appendChild(el('div', 'desc', list.description));

  const checkable = items.filter((i) => i.item_type !== 'section' && i.item_type !== 'header');
  const done = checkable.filter((i) => checked.has(i.id)).length;
  const pct = checkable.length ? Math.round((done / checkable.length) * 100) : 0;

  const track = el('div', 'progress-track');
  const fill = el('div', 'progress-fill');
  fill.style.width = pct + '%';
  track.appendChild(fill);
  app.appendChild(track);
  app.appendChild(el('div', 'progress-text', done + ' of ' + checkable.length + ' complete (' + pct + '%)'));

  const wrap = el('div', 'items');
  items.forEach((item) => {
    if (item.item_type === 'section' || item.item_type === 'header') {
      wrap.appendChild(el('div', 'section-label', item.title));
    } else {
      wrap.appendChild(renderItem(item));
    }
  });
  app.appendChild(wrap);

  if (checkable.length > 0 && done === checkable.length) {
    app.appendChild(el('div', 'done-banner', 'All items complete \\u2713'));
  }
}

function renderError(title, message) {
  app.textContent = '';
  const state = el('div', 'state');
  state.appendChild(el('h2', null, title));
  state.appendChild(el('p', null, message));
  app.appendChild(state);
}

async function refresh() {
  const { data, error } = await supabase.rpc(API.read, { p_token: TOKEN });
  if (error) {
    // A transient failure must not replace a working checklist; realtime and
    // the next visibility refresh will catch us up.
    if (!list) {
      renderError('Something went wrong', 'Could not load this checklist. Check your connection and reopen this page.');
    }
    return;
  }
  if (!data) {
    renderError('Checklist not found', 'This share link is invalid or has been removed.');
    return;
  }
  list = data.list;
  items = data.items || [];
  checked = new Set(data.checked_item_ids || []);
  equipmentNames = new Map((data.equipment || []).map((e) => [e.id, e.name]));
  render();
  subscribe();
}

let channel = null;
function subscribe() {
  if (channel || !list) return;
  channel = supabase
    .channel('shared-' + KIND + '-' + list.id)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: API.table,
      filter: API.filterColumn + '=eq.' + list.id,
    }, (payload) => {
      if (payload.eventType === 'INSERT' && payload.new) {
        checked.add(payload.new[API.idColumn]);
      } else if (payload.eventType === 'DELETE' && payload.old) {
        checked.delete(payload.old[API.idColumn]);
      }
      render();
    })
    .subscribe((status) => {
      const live = status === 'SUBSCRIBED';
      document.getElementById('brand').classList.toggle('live', live);
      document.getElementById('liveLabel').textContent = live ? 'live' : 'offline';
    });
}

// Catch anything missed while the tab was backgrounded (mobile browsers
// suspend websockets aggressively). Also retries a failed initial load.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && TOKEN) refresh();
});

if (!TOKEN) {
  renderError('Missing link token', 'This link is incomplete. Ask for a fresh share link.');
} else {
  refresh();
}
</script>
</body>
</html>`;
}

serve((req: Request) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  return new Response(pageHtml(supabaseUrl, anonKey), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
});
