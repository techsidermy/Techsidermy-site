/* ==========================================================================
   TECHSIDERMY LAB: command center (/lab)
   Data lives in Supabase. Row level security only lets lab admins in,
   so this page holds no secrets of its own.
   ========================================================================== */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (v) => '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

  const STAGES = [
    ['queued', 'Queued'], ['confirmed', 'Confirmed'], ['awaiting_device', 'Awaiting device'],
    ['received', 'Received'], ['dissection', 'Dissection'], ['plate_ordered', 'Plate ordered'],
    ['mounting', 'Mounting'], ['framed', 'Framed'], ['shipped', 'Shipped'], ['complete', 'Complete'],
    ['declined', 'Declined']
  ];
  const STAGE_LABEL = Object.fromEntries(STAGES);
  const FLOW = STAGES.slice(0, 10).map((s) => s[0]);           // declined sits outside the flow
  const ACTIVE = FLOW.slice(0, 8);                               // still on the bench or in the queue

  const cfg = window.LAB_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) { $('#setup').hidden = false; return; }
  const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

  const state = { specimens: [], inventory: [], parts: [], tab: 'overview', stageFilter: 'active' };

  /* ---------- auth ---------- */
  $('#login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#login-email').value.trim();
    const msg = $('#login-msg');
    if (!email) { msg.textContent = 'Enter your email.'; return; }
    msg.textContent = 'Sending…';
    const { error } = await db.auth.signInWithOtp({
      email, options: { shouldCreateUser: false, emailRedirectTo: location.origin + '/lab' }
    });
    msg.textContent = error ? 'That email can’t sign in here.' : 'Check your inbox for the sign-in link.';
  });
  $('#signout').addEventListener('click', async () => { await db.auth.signOut(); location.reload(); });

  db.auth.onAuthStateChange((_e, session) => show(session));
  db.auth.getSession().then(({ data }) => show(data.session));

  let booted = false;
  function show(session) {
    $('#gate').hidden = !!session;
    $('#app').hidden = !session;
    $('#signout').hidden = !session;
    if (session && !booted) { booted = true; loadAll(); }
  }

  function fail(error) {
    const el = $('#err');
    if (!error) { el.hidden = true; return false; }
    el.hidden = false;
    el.textContent = /row-level|permission/i.test(error.message)
      ? 'This account isn’t on the lab list. Add its email to lab_admins in Supabase.'
      : 'Couldn’t reach the database: ' + error.message;
    return true;
  }

  async function loadAll() {
    const [s, i, p] = await Promise.all([
      db.from('specimens').select('*').order('created_at', { ascending: false }),
      db.from('inventory').select('*').order('category').order('item'),
      db.from('parts').select('*').order('sort')
    ]);
    if (fail(s.error || i.error || p.error)) return;
    state.specimens = s.data; state.inventory = i.data; state.parts = p.data;
    render();
  }

  /* ---------- tabs ---------- */
  $$('.lab-tabs [role=tab]').forEach((b) => b.addEventListener('click', () => {
    state.tab = b.dataset.tab;
    $$('.lab-tabs [role=tab]').forEach((x) => x.setAttribute('aria-selected', x === b));
    $$('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== state.tab; });
    render();
  }));

  function render() {
    ({ overview, specimens, inventory, parts })[state.tab]();
  }

  /* ---------- progress report ---------- */
  function overview() {
    const S = state.specimens;
    const active = S.filter((x) => ACTIVE.includes(x.stage));
    const counts = Object.fromEntries(FLOW.map((k) => [k, S.filter((x) => x.stage === k).length]));
    const soon = new Date(); soon.setDate(soon.getDate() + 14);
    const due = active.filter((x) => x.due_on && new Date(x.due_on) <= soon).sort((a, b) => a.due_on.localeCompare(b.due_on));
    const low = state.inventory.filter((x) => x.reorder_at != null && Number(x.qty) <= Number(x.reorder_at));
    const live = S.filter((x) => x.stage !== 'declined');
    const booked = live.reduce((a, x) => a + Number(x.price || 0), 0);
    const paid = live.reduce((a, x) => a + Number(x.paid || 0), 0);
    const pieceCosts = live.reduce((a, x) => a + Number(x.costs || 0), 0);
    const supplies = state.parts.filter((x) => x.bought).reduce((a, x) => a + Number(x.price || 0), 0);
    const max = Math.max(1, ...Object.values(counts));

    $('[data-panel=overview]').innerHTML = `
      <div class="lab-sec-head"><h1 class="h2">Progress<span class="dot">.</span></h1>
        <span class="label">${active.length} active · ${counts.queued} in queue</span></div>

      <div class="kpis">
        <div><span class="label">Booked</span><b>${money(booked)}</b></div>
        <div><span class="label">Received</span><b>${money(paid)}</b></div>
        <div><span class="label">Outstanding</span><b>${money(booked - paid)}</b></div>
        <div><span class="label">Spent</span><b>${money(supplies + pieceCosts)}</b><small>${money(supplies)} supplies · ${money(pieceCosts)} per piece</small></div>
      </div>

      <h2 class="label lab-h">Pipeline</h2>
      <ol class="pipeline">
        ${FLOW.map((k) => `<li><button type="button" data-stage-jump="${k}">
          <span class="pl-name">${STAGE_LABEL[k]}</span>
          <span class="pl-bar"><i style="width:${(counts[k] / max) * 100}%"></i></span>
          <span class="pl-n">${counts[k]}</span></button></li>`).join('')}
      </ol>

      <div class="two">
        <div><h2 class="label lab-h">Due in the next 14 days</h2>
          ${due.length ? `<ul class="mini">${due.map((x) => `<li><button type="button" data-edit-spec="${x.id}">
            <span>${x.num ? 'Nº ' + esc(x.num) + ' · ' : ''}${esc(x.device)}</span><span class="tag">${STAGE_LABEL[x.stage]}</span><span class="when">${fmtDate(x.due_on)}</span></button></li>`).join('')}</ul>`
          : '<p class="empty">Nothing due. Set a due date on a specimen to see it here.</p>'}</div>
        <div><h2 class="label lab-h">Low stock</h2>
          ${low.length ? `<ul class="mini">${low.map((x) => `<li><span>${esc(x.item)}</span><span class="tag warn">${Number(x.qty)} ${esc(x.unit)}</span><span class="when">reorder at ${Number(x.reorder_at)}</span></li>`).join('')}</ul>`
          : '<p class="empty">Everything above its reorder point.</p>'}</div>
      </div>`;

    $$('[data-stage-jump]').forEach((b) => b.addEventListener('click', () => { state.stageFilter = b.dataset.stageJump; tab('specimens'); }));
    $$('[data-edit-spec]').forEach((b) => b.addEventListener('click', () => editSpecimen(b.dataset.editSpec)));
  }
  function tab(name) { $(`.lab-tabs [data-tab=${name}]`).click(); }

  /* ---------- specimens ---------- */
  function specimens() {
    const f = state.stageFilter;
    const rows = state.specimens.filter((x) => f === 'all' ? true : f === 'active' ? ACTIVE.includes(x.stage) : x.stage === f);
    const chips = [['active', 'Active'], ['all', 'All'], ...STAGES];
    $('[data-panel=specimens]').innerHTML = `
      <div class="lab-sec-head"><h1 class="h2">Specimens<span class="dot">.</span></h1>
        <button class="btn" type="button" id="new-spec">New specimen</button></div>
      <div class="chips">${chips.map(([k, l]) => `<button type="button" data-filter="${k}" aria-pressed="${k === f}">${l}</button>`).join('')}</div>
      ${rows.length ? `<div class="table-wrap"><table class="lab-table">
        <thead><tr><th>Nº</th><th>Device</th><th>Client</th><th>Stage</th><th>Due</th><th class="r">Price</th><th class="r">Paid</th><th></th></tr></thead>
        <tbody>${rows.map((x) => {
          const next = FLOW[FLOW.indexOf(x.stage) + 1];
          return `<tr data-row="${x.id}">
            <td class="mono">${esc(x.num || '—')}</td>
            <td><b>${esc(x.device)}</b><div class="sub">${esc(x.kind)}${x.frame_size ? ' · ' + esc(x.frame_size) : ''}</div></td>
            <td>${esc(x.customer_name || '')}</td>
            <td><span class="tag stage-${x.stage}">${STAGE_LABEL[x.stage]}</span></td>
            <td class="mono">${fmtDate(x.due_on)}</td>
            <td class="r mono">${x.price != null ? money(x.price) : ''}</td>
            <td class="r mono">${Number(x.paid) ? money(x.paid) : ''}</td>
            <td class="r">${next ? `<button type="button" class="lab-link" data-advance="${x.id}">→ ${STAGE_LABEL[next]}</button>` : ''}</td>
          </tr>`; }).join('')}</tbody></table></div>`
      : `<p class="empty">No specimens ${f === 'all' ? 'yet' : 'at this stage'}. Use “New specimen” to log the first one from the intake queue.</p>`}`;

    $('#new-spec').addEventListener('click', () => editSpecimen(null));
    $$('[data-filter]').forEach((b) => b.addEventListener('click', () => { state.stageFilter = b.dataset.filter; specimens(); }));
    $$('[data-row]').forEach((tr) => tr.addEventListener('click', (e) => { if (!e.target.closest('[data-advance]')) editSpecimen(tr.dataset.row); }));
    $$('[data-advance]').forEach((b) => b.addEventListener('click', async () => {
      const x = state.specimens.find((s) => s.id === b.dataset.advance);
      const stage = FLOW[FLOW.indexOf(x.stage) + 1];
      const patch = { stage };
      if (stage === 'received' && !x.received_on) patch.received_on = today();
      if (stage === 'shipped' && !x.shipped_on) patch.shipped_on = today();
      await save('specimens', x.id, patch);
    }));
  }
  const today = () => new Date().toISOString().slice(0, 10);

  const SPEC_FIELDS = [
    ['device', 'Device', 'text', { required: true, ph: 'Game Boy DMG-01' }],
    ['num', 'Archive Nº', 'text', { ph: '0005' }],
    ['kind', 'Kind', 'select', { options: [['commission', 'Commission'], ['archive', 'Archive piece'], ['series', 'Series']] }],
    ['stage', 'Stage', 'select', { options: STAGES }],
    ['customer_name', 'Client name', 'text'],
    ['customer_email', 'Client email', 'email'],
    ['frame_size', 'Frame size', 'select', { options: [['', '—'], ['S', 'S · 8 × 10'], ['M', 'M · 11 × 14'], ['L', 'L · 16 × 20'], ['XL', 'XL · 22 × 28']] }],
    ['price', 'Price', 'number'], ['paid', 'Paid so far', 'number'], ['costs', 'Costs on this piece', 'number'],
    ['due_on', 'Due', 'date'], ['received_on', 'Device received', 'date'], ['shipped_on', 'Shipped', 'date'],
    ['tracking', 'Tracking Nº', 'text'],
    ['note', 'Client’s plate note', 'textarea'], ['internal', 'Lab notes (private)', 'textarea']
  ];
  function editSpecimen(id) {
    const x = state.specimens.find((s) => s.id === id) || { kind: 'commission', stage: 'queued', paid: 0, costs: 0 };
    drawer(id ? 'Specimen' + (x.num ? ' Nº ' + x.num : '') : 'New specimen', SPEC_FIELDS, x, 'specimens', id);
  }

  /* ---------- inventory ---------- */
  function inventory() {
    const rows = state.inventory;
    $('[data-panel=inventory]').innerHTML = `
      <div class="lab-sec-head"><h1 class="h2">Inventory<span class="dot">.</span></h1>
        <button class="btn" type="button" id="new-inv">Add item</button></div>
      ${rows.length ? `<div class="table-wrap"><table class="lab-table">
        <thead><tr><th>Item</th><th>Category</th><th>Where</th><th class="r">On hand</th><th></th></tr></thead>
        <tbody>${rows.map((x) => {
          const low = x.reorder_at != null && Number(x.qty) <= Number(x.reorder_at);
          return `<tr data-inv="${x.id}">
            <td><b>${esc(x.item)}</b>${low ? ' <span class="tag warn">Low</span>' : ''}${x.notes ? `<div class="sub">${esc(x.notes)}</div>` : ''}</td>
            <td>${esc(x.category)}</td><td>${esc(x.location || '')}</td>
            <td class="r mono">${Number(x.qty)} ${esc(x.unit)}</td>
            <td class="r nowrap"><button type="button" class="qty-btn" data-qty="${x.id}" data-d="-1" aria-label="Use one ${esc(x.item)}">−</button><button type="button" class="qty-btn" data-qty="${x.id}" data-d="1" aria-label="Add one ${esc(x.item)}">+</button></td>
          </tr>`; }).join('')}</tbody></table></div>`
      : '<p class="empty">Nothing tracked yet. Add what’s on the shelf: rods, plates, frames, boxes, epoxy.</p>'}`;
    $('#new-inv').addEventListener('click', () => editInventory(null));
    $$('[data-inv]').forEach((tr) => tr.addEventListener('click', (e) => { if (!e.target.closest('[data-qty]')) editInventory(tr.dataset.inv); }));
    $$('[data-qty]').forEach((b) => b.addEventListener('click', async () => {
      const x = state.inventory.find((i) => i.id === b.dataset.qty);
      await save('inventory', x.id, { qty: Math.max(0, Number(x.qty) + Number(b.dataset.d)) });
    }));
  }
  const INV_FIELDS = [
    ['item', 'Item', 'text', { required: true, ph: '3mm acrylic rod' }],
    ['category', 'Category', 'select', { options: [['Supplies', 'Supplies'], ['Plates', 'Plates'], ['Frames', 'Frames'], ['Packaging', 'Packaging'], ['Tools', 'Tools'], ['Devices', 'Devices']] }],
    ['qty', 'On hand', 'number'], ['unit', 'Unit', 'text', { ph: 'ea, pcs, sheets' }],
    ['reorder_at', 'Flag low at', 'number'], ['location', 'Where it lives', 'text'], ['notes', 'Notes', 'textarea']
  ];
  function editInventory(id) {
    const x = state.inventory.find((i) => i.id === id) || { category: 'Supplies', qty: 0, unit: 'ea' };
    drawer(id ? x.item : 'Add item', INV_FIELDS, x, 'inventory', id);
  }

  /* ---------- parts list ---------- */
  function parts() {
    const P = state.parts;
    const sections = [...new Set(P.map((x) => x.section))];
    const total = P.reduce((a, x) => a + Number(x.price || 0), 0);
    const left = P.filter((x) => !x.bought).reduce((a, x) => a + Number(x.price || 0), 0);
    const perPiece = P.filter((x) => x.per_piece).reduce((a, x) => a + Number(x.price || 0), 0);
    $('[data-panel=parts]').innerHTML = `
      <div class="lab-sec-head"><h1 class="h2">Parts list<span class="dot">.</span></h1>
        <button class="btn" type="button" id="new-part">Add part</button></div>
      <div class="kpis">
        <div><span class="label">Priced total</span><b>${money(total)}</b></div>
        <div><span class="label">Still to buy</span><b>${money(left)}</b></div>
        <div><span class="label">Bought</span><b>${P.filter((x) => x.bought).length}/${P.length}</b></div>
        <div><span class="label">Per piece (priced)</span><b>${money(perPiece)}</b></div>
      </div>
      ${sections.map((sec) => `<h2 class="label lab-h">${esc(sec)}</h2><ul class="parts">
        ${P.filter((x) => x.section === sec).map((x) => `<li class="${x.bought ? 'done' : ''}">
          <input type="checkbox" id="pt-${x.id}" data-bought="${x.id}" ${x.bought ? 'checked' : ''}>
          <div><label for="pt-${x.id}" class="pt-name">${esc(x.item)}${x.per_piece ? ' <span class="tag">per piece</span>' : ''}</label>
            <div class="sub">${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.pick || 'Link')}</a>` : esc(x.pick || '')}</div></div>
          <span class="mono r">${x.price != null ? money(x.price) : 'check'}</span>
          <button type="button" class="lab-link" data-edit-part="${x.id}">Edit</button>
        </li>`).join('')}</ul>`).join('') || '<p class="empty">No parts yet.</p>'}`;
    $('#new-part').addEventListener('click', () => editPart(null));
    $$('[data-bought]').forEach((c) => c.addEventListener('change', () => save('parts', c.dataset.bought, { bought: c.checked })));
    $$('[data-edit-part]').forEach((b) => b.addEventListener('click', () => editPart(b.dataset.editPart)));
  }
  const PART_FIELDS = [
    ['section', 'Section', 'select', { options: [['Teardown', 'Teardown'], ['Plate', 'Plate'], ['Mounting', 'Mounting'], ['Frame', 'Frame'], ['Finishing', 'Finishing'], ['Packaging', 'Packaging']] }],
    ['item', 'Item', 'text', { required: true }], ['pick', 'Pick / notes', 'textarea'],
    ['price', 'Price', 'number'], ['url', 'Link', 'url'],
    ['per_piece', 'Repeats with every piece', 'checkbox'], ['bought', 'Bought', 'checkbox'], ['sort', 'Sort order', 'number']
  ];
  function editPart(id) {
    const x = state.parts.find((p) => p.id === id) || { section: 'Teardown', sort: (state.parts.length + 1) * 10 };
    drawer(id ? x.item : 'Add part', PART_FIELDS, x, 'parts', id);
  }

  /* ---------- shared: save + drawer ---------- */
  async function save(table, id, patch) {
    const q = id ? db.from(table).update(patch).eq('id', id).select().single()
                 : db.from(table).insert(patch).select().single();
    const { data, error } = await q;
    if (fail(error)) return false;
    const list = state[table];
    const i = list.findIndex((r) => r.id === data.id);
    if (i >= 0) list[i] = data; else list.unshift(data);
    render();
    return true;
  }

  const dr = $('#drawer');
  let current = null;
  function drawer(title, fields, rec, table, id) {
    current = { table, id, fields };
    $('#drawer-title').textContent = title;
    $('#drawer-delete').hidden = !id;
    $('#drawer-fields').innerHTML = fields.map(([k, label, type, o = {}]) => {
      const v = rec[k] ?? '';
      const fid = 'f-' + k;
      if (type === 'select') return `<label class="field"><span class="label">${label}</span><select id="${fid}" name="${k}">${o.options.map(([ov, ol]) => `<option value="${esc(ov)}" ${String(v) === String(ov) ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select></label>`;
      if (type === 'textarea') return `<label class="field"><span class="label">${label}</span><textarea id="${fid}" name="${k}" rows="3">${esc(v)}</textarea></label>`;
      if (type === 'checkbox') return `<label class="field check"><input type="checkbox" id="${fid}" name="${k}" ${v ? 'checked' : ''}><span>${label}</span></label>`;
      return `<label class="field"><span class="label">${label}</span><input id="${fid}" name="${k}" type="${type}" ${type === 'number' ? 'step="0.01" inputmode="decimal"' : ''} value="${esc(v)}" ${o.required ? 'required' : ''} placeholder="${esc(o.ph || '')}"></label>`;
    }).join('');
    dr.classList.add('open'); dr.setAttribute('aria-hidden', 'false');
    setTimeout(() => $('#drawer-fields input, #drawer-fields select')?.focus(), 50);
  }
  function close() { dr.classList.remove('open'); dr.setAttribute('aria-hidden', 'true'); current = null; }
  $('[data-close]', dr).addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) close(); });

  $('#drawer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!e.target.reportValidity()) return;
    const patch = {};
    current.fields.forEach(([k, , type]) => {
      const el = $('#f-' + k);
      if (type === 'checkbox') patch[k] = el.checked;
      else if (type === 'number') patch[k] = el.value === '' ? (['paid', 'costs', 'qty'].includes(k) ? 0 : null) : Number(el.value);
      else patch[k] = el.value.trim() === '' ? null : el.value.trim();
    });
    if (await save(current.table, current.id, patch)) close();
  });

  // two-tap delete, no confirm() dialogs
  const del = $('#drawer-delete');
  del.addEventListener('click', async () => {
    if (!del.dataset.armed) { del.dataset.armed = '1'; del.textContent = 'Tap again to delete'; setTimeout(() => { delete del.dataset.armed; del.textContent = 'Delete'; }, 3000); return; }
    const { table, id } = current;
    const { error } = await db.from(table).delete().eq('id', id);
    if (fail(error)) return;
    state[table] = state[table].filter((r) => r.id !== id);
    delete del.dataset.armed; del.textContent = 'Delete';
    close(); render();
  });
})();
