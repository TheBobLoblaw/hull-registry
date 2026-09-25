// Kit assembly editor for the Hull Registry: several blueprints laid out as one thing (a pad set, an exchange hall in halves).
// A set = {id, name, kind, surface, pieces:[{file, name, off:[x,y,z], yaw}], note}; pieces[0] is the anchor. Offsets are
// origin-to-origin in the anchor's construct frame (metres, corner origin, Z-up), yaw in degrees about the piece's own
// origin: exactly what the AdminPanel mod deploys (pos_i = pos_a + Rot(rot_a, off_i), rot_i = rot_a x Qz(yaw_i)).
// The GLBs are centred on size/2 and Z-up -> Y-up as (x, z, -y) (assemble_glb.py), so a piece's group sits at
// Yup(off + Rz(yaw) * half_piece - half_anchor) with rotation.y = yaw.
export function initKit(ctx) {
  const { THREE, scene, loader, state, $, post, reloadAsg, clearModel, fit, refreshAssignments } = ctx;
  const kit = { on: false, set: null, sel: 0, snap: 1, boundsOnly: false, aboutCentre: true, group: null, cache: new Map(), sets: [] };
  const rad = d => d * Math.PI / 180;
  const Yup = v => new THREE.Vector3(v[0], v[2], -v[1]);
  const Rz = (v, deg) => { const c = Math.cos(rad(deg)), s = Math.sin(rad(deg)); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]]; };
  const rowOf = file => state.rows.find(r => r.f === file);
  const half = r => (r && r.sz ? r.sz / 2 : 64);
  const bounds = r => (r && r.bx) ? r.bx : [0, 0, 0, r ? r.sz : 128, r ? r.sz : 128, r ? r.sz : 128];
  const panel = $('#kitPanel');

  // ---------- sets ----------
  async function loadSets() { kit.sets = await fetch('/sets.json', { cache: 'no-store' }).then(r => r.json()).catch(() => []); renderSetSelect(); }
  function renderSetSelect() {
    const sel = $('#kitSets'); sel.innerHTML = '<option value="">load a saved kit…</option>';
    kit.sets.forEach(s => { const o = document.createElement('option'); o.value = s.id; o.textContent = `${s.name || s.id} (${s.pieces.length})`; sel.appendChild(o); });
  }
  function newSet() { kit.set = { id: '', name: '', kind: 'building', surface: true, pieces: [], note: '' }; kit.sel = 0; renderPanel(); rebuild(); }
  function openSet(id) { const s = kit.sets.find(x => x.id === id); if (!s) return; kit.set = JSON.parse(JSON.stringify(s)); kit.sel = 0; renderPanel(); rebuild(); }
  async function saveSet() {
    const s = kit.set; if (!s) return;
    s.id = ($('#kitId').value.trim() || slug(s.name || (s.pieces[0] && s.pieces[0].name) || 'kit')); $('#kitId').value = s.id;
    s.name = $('#kitName').value.trim() || s.id; s.kind = $('#kitKind').value; s.surface = $('#kitSurface').checked; s.note = $('#kitNote').value;
    if (!s.pieces.length) { $('#kitState').textContent = 'add a piece first'; return; }
    const res = await post('/sets', { set: s }); $('#kitState').textContent = res.ok ? `saved as ${s.id}` : 'save failed: ' + (await res.text()).slice(0, 100);
    await loadSets(); $('#kitSets').value = s.id;
  }
  async function deleteSet() { const s = kit.set; if (!s || !s.id) return; if (!confirm(`delete kit ${s.id}?`)) return; await post('/sets', { id: s.id, delete: true }); await loadSets(); newSet(); }
  const slug = t => t.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

  // ---------- pieces ----------
  function addPiece(r) {
    if (!kit.set) newSet();
    const p = { file: r.f, name: r.n, off: [0, 0, 0], yaw: 0 };
    if (kit.set.pieces.length) { const a = rowOf(kit.set.pieces[0].file); p.off = [half(a) * 2, 0, 0]; }   // next to the anchor, one core along x
    kit.set.pieces.push(p); kit.sel = kit.set.pieces.length - 1; renderPanel(); rebuild();
  }
  function removePiece(i) { kit.set.pieces.splice(i, 1); kit.sel = Math.max(0, Math.min(kit.sel, kit.set.pieces.length - 1)); renderPanel(); rebuild(); }
  function makeAnchor(i) {
    if (i === 0) return; const ps = kit.set.pieces; const a = ps.splice(i, 1)[0]; const o = a.off.slice();
    ps.unshift(a); ps.forEach(p => { p.off = [p.off[0] - o[0], p.off[1] - o[1], p.off[2] - o[2]]; });   // offsets stay origin-to-origin from the new anchor
    kit.sel = 0; renderPanel(); rebuild();
  }
  function nudge(axis, dir) {
    const p = kit.set && kit.set.pieces[kit.sel]; if (!p || kit.sel === 0) return;
    p.off[axis] = Math.round((p.off[axis] + dir * kit.snap) / kit.snap) * kit.snap; renderPanel(); place();
  }
  function turn(dir) {
    const p = kit.set && kit.set.pieces[kit.sel]; if (!p) return; const r = rowOf(p.file); const h = [half(r), half(r), half(r)];
    const before = kit.aboutCentre ? Rz(h, p.yaw).map((v, k) => v + p.off[k]) : null;   // centre of the piece in the anchor frame
    p.yaw = ((p.yaw + dir * 90) % 360 + 360) % 360;
    if (before && kit.sel !== 0) { const c = Rz(h, p.yaw); p.off = before.map((v, k) => v - c[k]); }
    renderPanel(); place();
  }

  // ---------- panel ----------
  function renderPanel() {
    const s = kit.set; if (!s) return;
    $('#kitId').value = s.id || ''; $('#kitName').value = s.name || ''; $('#kitKind').value = s.kind || 'building'; $('#kitSurface').checked = s.surface !== false; $('#kitNote').value = s.note || '';
    const el = $('#kitPieces'); el.innerHTML = '';
    s.pieces.forEach((p, i) => {
      const r = rowOf(p.file); const row = document.createElement('div'); row.className = 'kitrow' + (i === kit.sel ? ' sel' : '');
      row.innerHTML = `<span class="ki">${i === 0 ? 'anchor' : i}</span><span class="kn" title="${p.file}">${p.name}<small>${r ? (r.sz / 2 * 2) + ' m core' : ''}</small></span>`
        + ['x', 'y', 'z'].map((a, k) => `<label>${a}<input type="number" step="${kit.snap}" value="${p.off[k]}" data-k="${k}" ${i === 0 ? 'disabled' : ''}></label>`).join('')
        + `<span class="ky"><button type="button" data-turn="-1">↺</button><b>${p.yaw}°</b><button type="button" data-turn="1">↻</button></span>`
        + `<span class="kb"><button type="button" data-anchor title="make this the anchor" ${i === 0 ? 'disabled' : ''}>anchor</button><button type="button" data-rm title="remove">×</button></span>`;
      row.onclick = e => { if (e.target.matches('input,button')) return; kit.sel = i; renderPanel(); place(); };
      row.querySelectorAll('input[data-k]').forEach(inp => { inp.onchange = () => { p.off[+inp.dataset.k] = parseFloat(inp.value) || 0; place(); }; });
      row.querySelectorAll('button[data-turn]').forEach(b => { b.onclick = () => { kit.sel = i; turn(+b.dataset.turn); }; });
      row.querySelector('button[data-anchor]').onclick = () => makeAnchor(i);
      row.querySelector('button[data-rm]').onclick = () => removePiece(i);
      el.appendChild(row);
    });
    if (!s.pieces.length) el.innerHTML = '<div class="kitempty">no pieces yet: select a hull in the list and press "add selected hull"</div>';
    const sel = $('#kitSlot'); const cur = sel.value; sel.innerHTML = '<option value="">assign this kit to a slot…</option>';
    state.slots.filter(x => !x.pool).forEach(x => { const o = document.createElement('option'); o.value = x.id; o.textContent = `${x.group} · ${x.name}` + (state.asg[x.id] && state.asg[x.id].set === s.id ? ' ✓' : ''); sel.appendChild(o); });
    sel.value = cur;
  }

  // ---------- stage ----------
  function tune(scene3) { scene3.traverse(o => { if (o.isMesh) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { if (!m) return; if ('roughness' in m) m.roughness = Math.max(m.roughness ?? 1, 0.45); if ('metalness' in m) m.metalness = Math.min(m.metalness ?? 0, 0.6); m.side = THREE.DoubleSide; m.needsUpdate = true; }); } }); }
  function boxOf(r, colour) {
    const b = bounds(r), h = half(r); const pts = [];
    for (const x of [b[0], b[3]]) for (const y of [b[1], b[4]]) for (const z of [b[2], b[5]]) pts.push(Yup([x - h, y - h, z - h]));
    const box = new THREE.Box3().setFromPoints(pts); const helper = new THREE.Box3Helper(box, colour); helper.userData.isBox = true; return helper;
  }
  async function rebuild() {
    if (kit.group) { scene.remove(kit.group); kit.group = null; }
    if (!kit.on || !kit.set) return;
    kit.group = new THREE.Group(); scene.add(kit.group);
    const s = kit.set; const notice = $('#notice'); let pending = 0;
    s.pieces.forEach((p, i) => {
      const r = rowOf(p.file); const g = new THREE.Group(); g.userData.i = i; kit.group.add(g);
      g.add(boxOf(r, i === kit.sel ? 0xf5b52e : 0x46c2b8));
      if (!kit.boundsOnly && state.glb.has(p.file)) {
        const done = sc => { const c = sc.clone(); c.userData.isModel = true; g.add(c); };
        if (kit.cache.has(p.file)) done(kit.cache.get(p.file));
        else {
          pending++; notice.hidden = false; notice.textContent = `loading ${pending} piece model(s)…`;
          loader.load('/glb/' + encodeURI(p.file.replace(/\.json$/, '.glb')), gltf => { tune(gltf.scene); kit.cache.set(p.file, gltf.scene); if (kit.group && g.parent === kit.group) done(gltf.scene); if (--pending === 0) notice.hidden = true; }, undefined, () => { if (--pending === 0) notice.hidden = true; });
        }
      }
    });
    place(); fit(kit.group);
  }
  function place() {
    if (!kit.group || !kit.set) return; const s = kit.set; const a = rowOf(s.pieces[0] && s.pieces[0].file); const ha = half(a); const ba = bounds(a);
    kit.group.children.forEach(g => {
      const i = g.userData.i; const p = s.pieces[i]; if (!p) return; const r = rowOf(p.file); const h = half(r);
      const c = Rz([h, h, h], p.yaw); const v = [p.off[0] + c[0] - ha, p.off[1] + c[1] - ha, p.off[2] + c[2] - ha];
      g.position.copy(Yup(v)); g.rotation.set(0, rad(p.yaw), 0);
      const box = g.children.find(o => o.userData.isBox); if (box) box.material.color.set(i === kit.sel ? 0xf5b52e : 0x46c2b8);
    });
    kit.group.position.set(0, -(ba[2] - ha), 0);   // the anchor's floor on the grid
  }

  // ---------- mode ----------
  function setMode(on) {
    kit.on = on; panel.hidden = !on; $('#btnKit').classList.toggle('on', on);
    if (on) { clearModel(); if (!kit.set) newSet(); loadSets(); rebuild(); } else { if (kit.group) { scene.remove(kit.group); kit.group = null; } }
  }
  $('#btnKit').onclick = () => setMode(!kit.on);
  $('#kitClose').onclick = () => setMode(false);
  $('#kitNew').onclick = newSet; $('#kitSave').onclick = saveSet; $('#kitDelete').onclick = deleteSet;
  $('#kitSets').onchange = e => { if (e.target.value) openSet(e.target.value); };
  $('#kitAdd').onclick = () => { if (state.sel) addPiece(state.sel); };
  $('#kitSnap').onchange = e => { kit.snap = parseFloat(e.target.value) || 1; renderPanel(); };
  $('#kitBounds').onchange = e => { kit.boundsOnly = e.target.checked; rebuild(); };
  $('#kitCentre').onchange = e => { kit.aboutCentre = e.target.checked; };
  $('#kitAssign').onclick = async () => {
    const s = kit.set; const slot = $('#kitSlot').value; if (!s || !slot) return;
    if (!s.id || !kit.sets.find(x => x.id === s.id)) await saveSet();
    const res = await post('/assign', { slot, set: s.id }); $('#kitState').textContent = res.ok ? `kit ${s.id} assigned to ${slot}; spawn it from the anchor hull's Assignment pane` : 'assign failed: ' + (await res.text()).slice(0, 100);
    await reloadAsg(); refreshAssignments(); renderPanel();
  };
  document.addEventListener('keydown', e => {
    if (!kit.on || e.target.matches('input,select,textarea') || !kit.set) return;
    const n = kit.set.pieces.length;
    if (e.key === 'ArrowLeft') { nudge(0, -1); e.preventDefault(); } if (e.key === 'ArrowRight') { nudge(0, 1); e.preventDefault(); }
    if (e.key === 'ArrowDown') { nudge(1, -1); e.preventDefault(); } if (e.key === 'ArrowUp') { nudge(1, 1); e.preventDefault(); }
    if (e.key === 'PageDown') { nudge(2, -1); e.preventDefault(); } if (e.key === 'PageUp') { nudge(2, 1); e.preventDefault(); }
    if (e.key === 'q') turn(-1); if (e.key === 'e') turn(1);
    if (e.key === '[' && n) { kit.sel = (kit.sel - 1 + n) % n; renderPanel(); place(); } if (e.key === ']' && n) { kit.sel = (kit.sel + 1) % n; renderPanel(); place(); }
    if (e.key === 'g') { const steps = [1, 8, 16, 32, 64, 128, 256]; kit.snap = steps[(steps.indexOf(kit.snap) + 1) % steps.length]; $('#kitSnap').value = kit.snap; renderPanel(); }
  });
  return { isOn: () => kit.on, addPiece };
}
