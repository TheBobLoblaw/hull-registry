// Hull Registry viewer. Served by the EconSim host (Overseer) at /hulls/ straight from tools/hull-registry (Admin.cs).
// Data: /catalog.json (content/catalog.compact.json), /components.json (content/components.json: element types per hull),
// /slots.json, /assignments.json, /glb-index.json, /glb/<file>.glb.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { initKit } from './kit.js';
window.addEventListener('error', (e) => { if (/ResizeObserver/.test(e.message || '')) return; const n = document.getElementById('notice'); if (n) { n.hidden = false; n.textContent = 'script error: ' + e.message; } });

const $ = (s) => document.querySelector(s);
const state = {
  rows: [], glb: new Set(), picks: {}, slots: [], asg: {},
  comp: { types: [], hulls: {} }, compMap: {}, typeByLabel: new Map(),
  filters: { cat: new Set(), size: new Set(), role: new Set(), builder: '', q: '', onlyGlb: false, onlyPicked: false, sort: 'name', comp: [] },
  sel: null, shown: [],
};

// ---------- data ----------
async function load() {
  const [rows, glb, picks, slots, asg, comp] = await Promise.all([
    fetch('/catalog.json', { cache: 'no-store' }).then(r => r.json()),
    fetch((window.PUBLIC_REGISTRY || {}).index || '/glb-index.json', { cache: 'no-store' }).then(r => r.json()).catch(() => []),
    fetch('/picks.json', { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
    fetch('/slots.json', { cache: 'no-store' }).then(r => r.json()).catch(() => []),
    fetch('/assignments.json', { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
    fetch('/components.json', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ types: [], hulls: {} })),
  ]);
  state.rows = rows; state.glb = new Set(glb); state.picks = picks || {}; state.slots = slots || []; state.asg = asg || {};
  state.comp = comp && comp.types ? comp : { types: [], hulls: {} };
  for (const [file, pairs] of Object.entries(state.comp.hulls)) state.compMap[file] = new Map(pairs);
  state.comp.types.forEach((t, i) => state.typeByLabel.set(t.l.toLowerCase(), i));
  $('#countAll').textContent = rows.length;
  buildSlotSelect(); renderAssignments();
  buildChips(); buildCompUi(); render(); updateCounts(); loadPlayers(); loadPublished();
  const want = new URLSearchParams(location.search).get('sel');
  const first = (want && state.rows.find(r => r.f === want)) || state.shown.find(r => state.glb.has(r.f));
  if (first) select(first);
  setInterval(refreshGlb, 30000);
}
async function refreshGlb() {
  try { const glb = await fetch((window.PUBLIC_REGISTRY || {}).index || '/glb-index.json', { cache: 'no-store' }).then(r => r.json()); state.glb = new Set(glb); render(); updateCounts(); } catch (e) {}
}
function sizeLabel(sz) { return { 32: 'XS', 64: 'S', 128: 'M', 256: 'L', 512: 'XL' }[sz] || (sz ? String(sz) : '?'); }
function roleTags(r) { return r.role.split(',').filter(t => t && t !== 'ship' && t !== 'XS'); }

// ---------- import a blueprint from a URL (server side: saved under Imported/, catalogued, components too) ----------
$('#bpImport').onclick = async () => {
  const url = $('#bpUrl').value.trim(); if (!url) { $('#bpState').textContent = 'paste a URL first'; return; }
  $('#bpState').textContent = 'downloading and cataloguing…'; $('#bpImport').disabled = true;
  try {
    const res = await post('/api/blueprints/import', { url, name: $('#bpName').value.trim() || null });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { $('#bpState').textContent = 'failed: ' + (j.error || res.status); return; }
    $('#bpState').textContent = 'imported ' + j.file + ' · reloading…';
    location.href = location.pathname + '?sel=' + encodeURIComponent(j.file);
  } catch (e) { $('#bpState').textContent = 'failed: ' + e.message; }
  finally { $('#bpImport').disabled = false; }
};
$('#bpUrl').onkeydown = e => { if (e.key === 'Enter') $('#bpImport').click(); };

// ---------- give a hull to a player in game (a blueprint item in their inventory, through the AdminPanel queue) ----------
async function loadPlayers() {
  try {
    const list = await fetch('/api/players', { cache: 'no-store' }).then(r => r.json());
    const sel = $('#giveTo'); sel.innerHTML = '';
    list.filter(p => !p.bot).forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = (p.name || ('player ' + p.id)) + (p.online ? ' · online' : ''); sel.appendChild(o); });
  } catch (e) {}
}
$('#giveBtn').onclick = async () => {
  const r = state.sel; const pid = parseInt($('#giveTo').value, 10); if (!r || !pid) return;
  $('#giveState').textContent = 'queued…';
  const res = await post('/api/blueprints/give', { file: r.f, playerId: pid });
  $('#giveState').textContent = res.ok ? 'on its way: the blueprint lands in their inventory within about ten seconds' : 'refused: ' + (await res.text()).slice(0, 100);
};

// ---------- publish: a public URL on the VPS that any myDU server's import box accepts ----------
async function loadPublished() { try { state.published = await fetch('/api/blueprints/published', { cache: 'no-store' }).then(r => r.json()); } catch (e) { state.published = {}; } }
function showPublished(r) {
  const p = (state.published || {})[r.f];
  $('#pubState').innerHTML = p ? `<a href="${p.url}" target="_blank" rel="noopener">${p.url}</a>` : '';
  $('#pubBtn').textContent = p ? 'publish again' : 'publish link';
}
$('#pubBtn').onclick = async () => {
  const r = state.sel; if (!r) return; $('#pubState').textContent = 'uploading…';
  const res = await post('/api/blueprints/publish', { file: r.f, playerId: 0 }); const j = await res.json().catch(() => ({}));
  if (!res.ok) { $('#pubState').textContent = 'failed: ' + (j.error || res.status); return; }
  await loadPublished(); showPublished(r);
  try { await navigator.clipboard.writeText(j.url); $('#pubState').innerHTML += ' <small>(copied)</small>'; } catch (e) {}
};

$('#pubPicked').onclick = async () => {
  const files = Object.keys(state.picks); if (!files.length) { $('#pubPickedState').textContent = 'star some hulls first'; return; }
  let n = 0;
  for (const f of files) {
    $('#pubPickedState').textContent = `publishing ${n + 1} of ${files.length}…`;
    const res = await post('/api/blueprints/publish', { file: f, playerId: 0 }); if (res.ok) n++;
  }
  await loadPublished(); if (state.sel) showPublished(state.sel);
  $('#pubPickedState').textContent = `${n} of ${files.length} published; the public list is up to date`;
};

// ---------- public (read-only) registry on the VPS: every hull's blueprint file is a link to paste into a server's import box ----------
const PUBLIC = window.PUBLIC_REGISTRY || null;
// public copies: `bp` and `glb` are either site-relative ('/bp/') or absolute (a standalone copy pointing at the VPS)
const pubBase = (p) => /^https?:\/\//.test(p) ? p : location.origin + p;
function bpLink(r) { return PUBLIC ? pubBase(PUBLIC.bp) + r.f.split('/').map(encodeURIComponent).join('/') : ((state.published || {})[r.f] || {}).url || ''; }
function glbUrl(r) { const rel = encodeURI(r.f.replace(/\.json$/, '.glb')); return PUBLIC && PUBLIC.glb ? pubBase(PUBLIC.glb) + rel : '/glb/' + rel; }
$('#copyBp').onclick = async () => {
  const r = state.sel; if (!r) return; const url = bpLink(r);
  if (!url) { $('#copyState').textContent = 'not published yet: press "publish link" first'; return; }
  try { await navigator.clipboard.writeText(url); $('#copyState').textContent = 'copied: paste it into the import box'; }
  catch (e) { $('#copyState').innerHTML = `<code style="word-break:break-all">${url}</code>`; }
};
if (PUBLIC) {
  // no server to write to: hide everything that assigns, imports, gives, publishes or spawns
  ['#bpUrl', '#bpName', '#bpImport', '#bpState', '#giveTo', '#giveBtn', '#giveState', '#pubBtn', '#pubState', '#pubPicked', '#pubPickedState', '#pubIndex', '#btnKit', '#btnSlots', '#asgHeld', '#asgSpawnSel', '#asgSpawn', '#asgState', '#asgSlots', '#note', '#saveState'].forEach(sel => { const el = $(sel); if (el) { const box = el.closest('.asgbar, .compbar, .picksbar') || el; box.hidden = true; } });
  const imp = $('#bpUrl'); if (imp) imp.closest('div').hidden = true;
  document.querySelectorAll('.details > div').forEach(d => { const h = d.querySelector('h3'); if (h && (h.textContent === 'Assignment' || h.textContent === 'Your pick')) d.hidden = true; });
  const sub = document.querySelector('header .sub'); if (sub) sub.innerHTML = 'Old Dominion blueprints · <span id="countAll">0</span> hulls · public copy: pick a hull, copy its link, paste it into your server import box';
}

// ---------- components ----------
function countOf(file, t) { const m = state.compMap[file]; return m ? (m.get(t) || 0) : 0; }
function compsOf(file) { const m = state.compMap[file]; return m ? [...m.entries()].map(([t, n]) => [state.comp.types[t], n, t]) : []; }
function buildCompUi() {
  const dl = $('#compList'); dl.innerHTML = '';
  const labels = state.comp.types.map(t => t.l).sort((a, b) => a.localeCompare(b));
  for (const l of labels) { const o = document.createElement('option'); o.value = l; dl.appendChild(o); }
  const add = () => {
    const q = $('#compQ').value.trim().toLowerCase(); if (!q) return;
    let t = state.typeByLabel.get(q);
    if (t === undefined) { const hit = state.comp.types.findIndex(x => x.l.toLowerCase().includes(q) || x.n.toLowerCase().includes(q)); if (hit < 0) { $('#compQ').setCustomValidity('no such component'); $('#compQ').reportValidity(); return; } t = hit; }
    addCompFilter(t, Math.max(1, parseInt($('#compMin').value, 10) || 1));
    $('#compQ').value = ''; $('#compQ').setCustomValidity('');
  };
  $('#compAdd').onclick = add;
  $('#compQ').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); add(); } };
  $('#compQ').oninput = () => $('#compQ').setCustomValidity('');
}
function addCompFilter(t, min) {
  const f = state.filters.comp; const cur = f.find(c => c.t === t);
  if (cur) cur.min = min; else f.push({ t, min });
  renderCompChips(); render();
}
function renderCompChips() {
  const el = $('#compChips'); el.innerHTML = '';
  for (const c of state.filters.comp) {
    const b = document.createElement('button'); b.className = 'chip on'; b.type = 'button';
    b.innerHTML = `${state.comp.types[c.t].l} ≥ ${c.min}<span class="x">×</span>`; b.title = 'remove this requirement';
    b.onclick = () => { state.filters.comp = state.filters.comp.filter(x => x !== c); renderCompChips(); render(); };
    el.appendChild(b);
  }
}

// ---------- filters ----------
function chip(parent, label, set, key) {
  const b = document.createElement('button'); b.className = 'chip'; b.textContent = label; b.type = 'button';
  b.onclick = () => { set.has(key) ? set.delete(key) : set.add(key); b.classList.toggle('on', set.has(key)); render(); };
  parent.appendChild(b);
}
function buildChips() {
  const cats = [...new Set(state.rows.map(r => r.cat))];
  cats.forEach(c => chip($('#cat'), c, state.filters.cat, c));
  [32, 64, 128, 256, 512].forEach(s => chip($('#size'), sizeLabel(s), state.filters.size, s));
  ['hauler', 'armed', 'warp', 'factory', 'mining', 'market', 'static'].forEach(t => chip($('#role'), t, state.filters.role, t));
  const builders = [...new Set(state.rows.map(r => r.b).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  builders.forEach(b => { const o = document.createElement('option'); o.value = b; o.textContent = b; $('#builder').appendChild(o); });
  $('#q').oninput = e => { state.filters.q = e.target.value.trim().toLowerCase(); render(); };
  $('#builder').onchange = e => { state.filters.builder = e.target.value; render(); };
  $('#sort').onchange = e => { state.filters.sort = e.target.value; render(); };
  $('#onlyGlb').onchange = e => { state.filters.onlyGlb = e.target.checked; render(); };
  $('#onlyPicked').onchange = e => { state.filters.onlyPicked = e.target.checked; render(); };
}
function passes(r) {
  const f = state.filters;
  if (f.cat.size && !f.cat.has(r.cat)) return false;
  if (f.size.size && !f.size.has(r.sz)) return false;
  if (f.role.size && ![...f.role].every(t => r.role.includes(t))) return false;
  if (f.builder && r.b !== f.builder) return false;
  if (f.onlyGlb && !state.glb.has(r.f)) return false;
  if (f.onlyPicked && !state.picks[r.f]) return false;
  if (f.comp.length && !f.comp.every(c => countOf(r.f, c.t) >= c.min)) return false;
  if (f.q && !(r.n.toLowerCase().includes(f.q) || r.b.toLowerCase().includes(f.q) || compsOf(r.f).some(([t]) => t.l.toLowerCase().includes(f.q)))) return false;
  return true;
}
function sorted(rows) {
  const k = state.filters.sort; const c0 = state.filters.comp[0];
  const key = { name: r => r.n.toLowerCase(), mass: r => -r.t, elements: r => -r.el, containers: r => -r.ct, weapons: r => -r.wp, engines: r => -(r.ae + r.se),
                component: r => c0 ? -countOf(r.f, c0.t) : r.n.toLowerCase() }[k];
  return rows.slice().sort((a, b) => key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);
}

// ---------- list ----------
function render() {
  state.shown = sorted(state.rows.filter(passes));
  const list = $('#list'); list.innerHTML = '';
  const frag = document.createDocumentFragment();
  for (const r of state.shown) {
    const row = document.createElement('div'); row.className = 'row' + (state.sel === r ? ' sel' : ''); row.dataset.i = r.i;
    const pick = document.createElement('button'); pick.className = 'pick' + (state.picks[r.f] ? ' on' : ''); pick.textContent = state.picks[r.f] ? '★' : '☆'; pick.title = 'pick';
    pick.onclick = (e) => { e.stopPropagation(); togglePick(r); };
    const mid = document.createElement('div');
    const name = document.createElement('div'); name.className = 'name'; name.textContent = r.n;
    const meta = document.createElement('div'); meta.className = 'meta';
    const bits = [r.b || 'unknown builder', r.el + ' el', r.t ? r.t + ' t' : null, r.wp ? r.wp + ' guns' : null, r.ct ? r.ct + ' cont' : null].filter(Boolean);
    meta.textContent = bits.join(' · ');
    mid.append(name, meta);
    if (state.filters.comp.length) { const h = document.createElement('div'); h.className = 'comphit'; h.textContent = state.filters.comp.map(c => `${state.comp.types[c.t].l} ×${countOf(r.f, c.t)}`).join(' · '); mid.append(h); }
    const held = slotsHeldBy(r.f); if (held.length) { const a = document.createElement('div'); a.className = 'asg'; a.textContent = held.map(s => s.name).join(' · '); mid.append(a); }
    const size = document.createElement('div'); size.className = 'size' + (state.glb.has(r.f) ? '' : ' nomodel'); size.textContent = r.st ? sizeLabel(r.sz) + '·S' : sizeLabel(r.sz);
    size.title = state.glb.has(r.f) ? '3D model ready' : '3D model not converted yet';
    row.append(pick, mid, size);
    row.onclick = () => select(r);
    frag.appendChild(row);
  }
  list.appendChild(frag);
  $('#countShown').textContent = state.shown.length;
}
function updateCounts() {
  $('#countGlb').textContent = state.glb.size;
  $('#countPicked').textContent = Object.keys(state.picks).length;
  $('#countSlots').textContent = state.slots.filter(s => hullsOf(state.asg[s.id]).length).length;
  const names = Object.keys(state.picks).map(f => { const r = state.rows.find(x => x.f === f); return r ? r.n : f; });
  $('#pickList').textContent = names.length ? names.join(' · ') : 'nothing picked yet';
}

// ---------- picks ----------
let saveTimer = null;
function togglePick(r) {
  if (state.picks[r.f]) delete state.picks[r.f]; else state.picks[r.f] = { name: r.n, builder: r.b, category: r.cat, size: sizeLabel(r.sz), note: '' };
  render(); updateCounts(); if (state.sel === r) showDetails(r); schedulePicksSave();
}
function schedulePicksSave() {
  $('#saveState').textContent = 'saving…'; $('#saveState').className = '';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try { localStorage.setItem('hull-picks', JSON.stringify(state.picks)); } catch (e) {}
    try {
      const res = await fetch('/picks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state.picks, null, 1) });
      $('#saveState').textContent = res.ok ? 'saved' : 'save failed'; $('#saveState').className = res.ok ? 'saved' : '';
    } catch (e) { $('#saveState').textContent = 'server not reachable, kept in browser'; }
  }, 400);
}
$('#note').oninput = e => { if (state.sel && state.picks[state.sel.f]) { state.picks[state.sel.f].note = e.target.value; schedulePicksSave(); } };

// ---------- details ----------
let compsExpanded = false;
function showDetails(r) {
  $('#hudTitle').textContent = r.n; $('#hudBy').textContent = (r.b || 'unknown builder') + ' · ' + r.cat + (r.sub ? ' · ' + r.sub : '');
  const kv = [['core', sizeLabel(r.sz) + (r.st ? ' static' : ' dynamic')], ['elements', r.el], ['voxel cells', r.vx], ['est. mass', r.t ? r.t + ' t' : '—'], ['file', r.mb + ' MB'], ['free deploy', r.fd ? 'yes (magic BP)' : 'no']];
  if (r.bx) kv.push(['box', `${(r.bx[3] - r.bx[0]).toFixed(0)}×${(r.bx[4] - r.bx[1]).toFixed(0)}×${(r.bx[5] - r.bx[2]).toFixed(0)} m`]);
  $('#kv').innerHTML = kv.map(([k, v]) => `<div class="k">${k}</div><div class="v">${v}</div>`).join('');
  const tags = roleTags(r); $('#tags').innerHTML = tags.map(t => `<span class="tag ${t}">${t}</span>`).join('');
  const bars = [['atmo engines', r.ae], ['space engines', r.se], ['hover', r.hv], ['vert. boosters', r.vb], ['rockets', r.rk], ['wings', r.wg], ['adjustors', r.adj], ['brakes', r.br], ['weapons', r.wp], ['radar', r.rd], ['shield', r.sh], ['containers', r.ct], ['fuel tanks', r.ft], ['warp', r.wr], ['industry', r.ind], ['mining units', r.mu], ['seats', r.seat], ['gunner', r.gun], ['market', r.mk], ['res. node', r.rn], ['screens', r.scr], ['lights', r.lt], ['doors', r.dr]].filter(b => b[1]);
  const max = Math.max(1, ...bars.map(b => b[1]));
  $('#barsA').innerHTML = bars.map(([k, n]) => `<div class="k">${k}</div><div class="bar"><i style="width:${Math.round(n / max * 100)}%"></i></div><div class="n">${n}</div>`).join('') || '<div class="k">no elements</div>';
  renderComps(r);
  syncAssignUi(r); showPublished(r); $('#copyState').textContent = '';
  const p = state.picks[r.f]; $('#note').disabled = !p; $('#note').value = p ? (p.note || '') : ''; $('#note').placeholder = p ? 'intended use, e.g. Free Miners freighter, station shell, starter ship' : 'pick this hull (★) to add a note';
}
function renderComps(r) {
  const el = $('#comps'); const all = compsOf(r.f);
  if (!all.length) { el.innerHTML = '<div class="c" style="color:var(--dim)">no component data (run add_blueprint.py --all)</div>'; return; }
  const show = compsExpanded ? all : all.slice(0, 20);
  el.innerHTML = show.map(([t, n]) => `<div class="c" data-t="${t ? all.find(x => x[0] === t)[2] : ''}" data-n="${n}" title="filter: hulls with at least ${n} of these">${t.l}<span class="g">${t.g}</span></div><div class="n">${n}</div>`).join('')
    + (all.length > 20 ? `<div class="more">${compsExpanded ? 'show fewer' : `and ${all.length - 20} more types…`}</div>` : '');
  el.querySelectorAll('.c').forEach(d => { d.onclick = () => addCompFilter(parseInt(d.dataset.t, 10), parseInt(d.dataset.n, 10)); });
  const more = el.querySelector('.more'); if (more) more.onclick = () => { compsExpanded = !compsExpanded; renderComps(r); };
}

// ---------- assignments: a hull can hold many slots; ship slots are weighted pools ----------
function hullsOf(a) { return a ? (a.hulls && a.hulls.length ? a.hulls : (a.file ? [{ file: a.file, name: a.name, weight: 1 }] : [])) : []; }
function slotsHeldBy(file) { return state.slots.filter(s => hullsOf(state.asg[s.id]).some(h => h.file === file)); }
function fixedSlot(s) { return s.kind === 'station' || s.kind === 'landmark' || s.spawn === 'fixed'; }
async function post(url, body) { return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
async function reloadAsg() { state.asg = await fetch('/assignments.json', { cache: 'no-store' }).then(x => x.json()).catch(() => state.asg); }
async function setSlot(r, s, on, weight) {
  await post('/assign', on ? { slot: s.id, file: r.f, name: r.n, weight: weight || 1, op: s.pool ? 'add' : 'set' } : { slot: s.id, file: r.f, op: 'remove' });
  await reloadAsg(); render(); renderAssignments(); syncAssignUi(r); updateCounts();
}
function buildSlotSelect() { renderSlotChecklist(); }
function renderSlotChecklist() {
  const r = state.sel; const el = $('#asgSlots'); el.innerHTML = '';
  const groups = {}; state.slots.forEach(s => (groups[s.group] = groups[s.group] || []).push(s));
  for (const [g, list] of Object.entries(groups)) {
    const d = document.createElement('details'); const held = r ? list.filter(s => slotsHeldBy(r.f).includes(s)).length : 0; d.open = held > 0;
    const sum = document.createElement('summary'); sum.textContent = g; if (held) { const b = document.createElement('b'); b.textContent = held; sum.appendChild(b); } d.appendChild(sum);
    for (const s of list) {
      const a = state.asg[s.id]; const mine = r ? hullsOf(a).find(h => h.file === r.f) : null;
      const row = document.createElement('label'); row.className = 'slotrow';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!mine; cb.disabled = !r;
      const nm = document.createElement('span'); nm.className = 'sn'; nm.innerHTML = s.name + (s.pool ? '<small>pool</small>' : s.spawn === 'class' ? '<small>class</small>' : s.parent ? '<small>on body</small>' : '');
      const right = document.createElement('span'); right.style.display = 'flex'; right.style.gap = '6px'; right.style.alignItems = 'center';
      const others = hullsOf(a).filter(h => !r || h.file !== r.f);
      if (others.length) { const h = document.createElement('span'); h.className = 'held'; h.textContent = (s.pool ? '' : 'held by ') + others.map(x => x.name + (s.pool ? ' ×' + x.weight : '') + (a && a.set ? ' (kit)' : '')).join(', '); h.title = h.textContent; right.appendChild(h); }
      if (s.pool) { const w = document.createElement('input'); w.className = 'w'; w.type = 'number'; w.min = '0.1'; w.step = '0.5'; w.value = mine ? mine.weight : 1; w.title = 'weight in the pool'; w.disabled = !mine;
        w.onchange = () => { if (r && mine) setSlot(r, s, true, parseFloat(w.value) || 1); }; w.onclick = e => e.preventDefault(); right.appendChild(w); }
      cb.onchange = () => { if (r) setSlot(r, s, cb.checked, s.pool ? parseFloat(right.querySelector('.w')?.value) || 1 : 1); };
      row.append(cb, nm, right); d.appendChild(row);
    }
    el.appendChild(d);
  }
}
function syncAssignUi(r) {
  const held = slotsHeldBy(r.f);
  $('#asgHeld').innerHTML = held.length ? 'this hull holds ' + held.map(s => `<b>${s.name}</b>${s.pool ? ' <small>(×' + (hullsOf(state.asg[s.id]).find(h => h.file === r.f) || {}).weight + ')</small>' : ''}`).join(', ') : 'not assigned: tick a slot below';
  const fixed = held.filter(fixedSlot); const sel = $('#asgSpawnSel'); sel.innerHTML = '';
  fixed.forEach(s => { const o = document.createElement('option'); o.value = s.id; o.textContent = s.name; sel.appendChild(o); });
  sel.hidden = fixed.length < 2; $('#asgSpawn').disabled = fixed.length === 0;
  const s0 = fixed[0]; const a = s0 ? state.asg[s0.id] : null;
  $('#asgState').textContent = s0 ? (a && a.constructId ? `spawned as construct #${a.constructId}` : a && a.error ? 'spawn failed: ' + a.error : 'assigned, not spawned yet') : (held.some(s => s.kind === 'ship') ? 'ships are spawned by the sim when needed' : '');
  renderSlotChecklist();
}
function renderAssignments() { renderSlotsView(); }
$('#asgSpawn').onclick = async () => {
  const r = state.sel; if (!r) return; const fixed = slotsHeldBy(r.f).filter(fixedSlot); if (!fixed.length) return;
  const slot = fixed.find(s => s.id === $('#asgSpawnSel').value) || fixed[0];
  $('#asgSpawn').disabled = true; $('#asgState').textContent = `queued for ${slot.name}, the server deploys it within about ten seconds…`;
  const res = await fetch('/api/spawn/' + encodeURIComponent(slot.id), { method: 'POST' });
  if (!res.ok) { $('#asgState').textContent = 'spawn refused: ' + (await res.text()).slice(0, 120); $('#asgSpawn').disabled = false; return; }
  for (let i = 0; i < 12; i++) { await new Promise(x => setTimeout(x, 5000)); await reloadAsg(); const a = state.asg[slot.id]; if (a && (a.constructId || a.error)) break; }
  renderAssignments(); syncAssignUi(r); render();
};

// ---------- slots view: every slot, what it holds, what still wants a hull ----------
function renderSlotsView() {
  const only = $('#slotsUnassigned').checked; const body = $('#slotsBody'); body.innerHTML = '';
  const groups = {}; state.slots.forEach(s => (groups[s.group] = groups[s.group] || []).push(s));
  let filled = 0, total = state.slots.length;
  for (const [g, list] of Object.entries(groups)) {
    const rows = list.filter(s => !only || !hullsOf(state.asg[s.id]).length); if (!rows.length) continue;
    const gd = document.createElement('div'); gd.className = 'slotgroup'; const h = document.createElement('h3'); h.textContent = g; gd.appendChild(h);
    for (const s of rows) {
      const a = state.asg[s.id]; const hulls = hullsOf(a); if (hulls.length) filled++;
      const c = document.createElement('div'); c.className = 'slotcard' + (hulls.length ? '' : ' empty');
      c.innerHTML = `<div class="sn">${s.name}</div><div class="kind">${s.kind}${s.pool ? ' · pool' : ''}${s.spawn === 'class' ? ' · applied by a tool' : s.spawn === 'fixed' ? ' · spawn from here' : ' · sim'}</div>`
        + (hulls.length ? `<div class="hulls">${hulls.map(x => `<a data-f="${x.file}">${x.name}</a>${s.pool ? `<span class="w">×${x.weight}</span>` : ''}${a && a.set ? `<span class="w">kit ${a.set}${a.constructIds ? ' · ' + a.constructIds.length + ' pieces up' : ''}</span>` : ''}`).join('')}</div>` : `<div class="want">${s.wants || 'wants a hull'}</div>`)
        + (a && a.constructId ? `<div class="st">spawned as construct #${a.constructId}</div>` : a && a.error ? `<div class="st err">${a.error}</div>` : '');
      c.querySelectorAll('a[data-f]').forEach(x => { x.onclick = () => { const r = state.rows.find(y => y.f === x.dataset.f); if (r) { closeSlots(); select(r); scrollTo(r); } }; });
      gd.appendChild(c);
    }
    body.appendChild(gd);
  }
  if (only) filled = state.slots.filter(s => hullsOf(state.asg[s.id]).length).length;
  $('#slotsStat').textContent = `${filled} of ${total} slots have a hull`; $('#countSlots').textContent = filled;
}
function closeSlots() { $('#slotsView').hidden = true; $('#btnSlots').classList.remove('on'); }
$('#btnSlots').onclick = () => { const v = $('#slotsView'); v.hidden = !v.hidden; $('#btnSlots').classList.toggle('on', !v.hidden); if (!v.hidden) renderSlotsView(); };
$('#btnSlotsClose').onclick = closeSlots;
$('#slotsUnassigned').onchange = renderSlotsView;

// ---------- 3D ----------
const vp = $('#viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
vp.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100000);
const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.autoRotate = true; controls.autoRotateSpeed = 0.8;
scene.add(new THREE.HemisphereLight(0xdfe8f2, 0x1a1f26, 1.1));
const key = new THREE.DirectionalLight(0xfff2d6, 2.2); key.position.set(1, 1.2, 0.8); scene.add(key);
const fill = new THREE.DirectionalLight(0x9fc5ff, 0.8); fill.position.set(-1, 0.3, -0.6); scene.add(fill);
const grid = new THREE.GridHelper(200, 40, 0x2e3b46, 0x1f2830); grid.material.transparent = true; grid.material.opacity = 0.35; scene.add(grid);
let model = null, wire = false;
const loader = new GLTFLoader();
// packed models (tools/hull-registry/pack_models.sh: WebP textures, meshopt-compressed meshes) need the meshopt decoder; plain ones ignore it
import('three/addons/libs/meshopt_decoder.module.js').then(m => loader.setMeshoptDecoder(m.MeshoptDecoder)).catch(() => {});
function resize() { const w = vp.clientWidth, h = vp.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(vp); resize();
function frame() { requestAnimationFrame(frame); controls.update(); renderer.render(scene, camera); }
frame();
function fit(obj) {
  const box = new THREE.Box3().setFromObject(obj); const size = box.getSize(new THREE.Vector3()); const center = box.getCenter(new THREE.Vector3());
  obj.position.sub(center); obj.position.y += size.y / 2; // sit on grid
  const r = Math.max(size.x, size.y, size.z) || 10;
  grid.scale.setScalar(Math.max(0.2, r / 60));
  camera.near = r / 100; camera.far = r * 50; camera.updateProjectionMatrix();
  camera.position.set(r * 1.4, r * 0.9, r * 1.6); controls.target.set(0, size.y / 2, 0); controls.update();
}
function setWire(on) { wire = on; if (model) model.traverse(o => { if (o.isMesh) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => m.wireframe = on); } }); $('#btnWire').classList.toggle('on', on); }
let loadToken = 0;
function clearModel() { if (model) { scene.remove(model); model = null; } }
const kit = initKit({ THREE, scene, loader, state, $, post, reloadAsg, clearModel, fit, refreshAssignments: () => { renderAssignments(); if (state.sel) syncAssignUi(state.sel); } });
async function select(r) {
  state.sel = r; compsExpanded = false; render(); showDetails(r);
  const token = ++loadToken;
  if (kit.isOn()) return;   // the kit editor owns the stage; the list still drives "add selected hull"
  clearModel();
  const notice = $('#notice');
  if (!state.glb.has(r.f)) { notice.hidden = false; notice.textContent = PUBLIC ? 'no 3D model for this hull yet — copy the blueprint link below and import it to see the ship' : '3D model not converted yet — the batch is still running. Stats on this hull are below.'; return; }
  notice.hidden = false; notice.textContent = 'loading model…';
  const url = glbUrl(r);
  loader.load(url, (gltf) => {
    if (token !== loadToken) return;
    model = gltf.scene;
    let meshes = 0;
    model.traverse(o => {
      if (o.isMesh) {
        meshes++;
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach(m => {
          if (!m) return;
          if ('roughness' in m) m.roughness = Math.max(m.roughness ?? 1, 0.45);
          if ('metalness' in m) m.metalness = Math.min(m.metalness ?? 0, 0.6);
          m.side = THREE.DoubleSide; m.needsUpdate = true;
        });
      }
    });
    scene.add(model); fit(model); setWire(wire);
    const box = new THREE.Box3().setFromObject(model); const s = box.getSize(new THREE.Vector3());
    if (meshes === 0 || !isFinite(s.x)) { notice.hidden = false; notice.textContent = 'model loaded but contains no drawable meshes'; return; }
    notice.hidden = true;
    $('#hudBy').textContent += ` · ${meshes} meshes · ${s.x.toFixed(0)}×${s.y.toFixed(0)}×${s.z.toFixed(0)} m`;
  }, (xhr) => {
    if (token === loadToken && xhr.total) { notice.textContent = `loading model… ${Math.round(xhr.loaded / xhr.total * 100)}% of ${(xhr.total / 1048576).toFixed(0)} MB`; }
  }, (err) => { if (token === loadToken) { notice.hidden = false; notice.textContent = PUBLIC ? 'could not load this model (' + (err.message || err) + ') — is the models folder complete? See README.md' : 'could not load model: ' + (err.message || err); } });
}
$('#btnReset').onclick = () => { if (model) fit(model); };
$('#btnRotate').onclick = () => { controls.autoRotate = !controls.autoRotate; $('#btnRotate').classList.toggle('on', controls.autoRotate); };
$('#btnWire').onclick = () => setWire(!wire);

// ---------- keys ----------
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input,select,textarea')) return;
  const i = state.shown.indexOf(state.sel);
  if (e.key === 'j') { const n = state.shown[Math.min(state.shown.length - 1, i + 1)]; if (n) { select(n); scrollTo(n); } }
  if (e.key === 'k') { const n = state.shown[Math.max(0, i - 1)]; if (n) { select(n); scrollTo(n); } }
  if (e.key === ' ' && state.sel) { e.preventDefault(); togglePick(state.sel); }
  if (e.key === 'r' && model) fit(model);
  if (e.key === 'Escape') closeSlots();
});
function scrollTo(r) { const el = document.querySelector(`.row[data-i="${r.i}"]`); if (el) el.scrollIntoView({ block: 'nearest' }); }

load();
