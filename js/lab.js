/* ==========================================================================
   TECHSIDERMY LAB: command center (/lab)
   One page that reads top to bottom: submissions → the bench → the shelf.
   Data lives in Supabase. Row level security only lets lab admins in,
   so this page holds no secrets of its own.
   ========================================================================== */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (v, cents = false) => '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2 });
  const fmtDate = (d) => d ? new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  const today = () => new Date().toISOString().slice(0, 10);
  const daysFrom = (d) => Math.round((new Date(d.slice(0, 10) + 'T12:00:00') - new Date(today() + 'T12:00:00')) / 864e5);
  const ago = (d) => { const n = -daysFrom(d); return n <= 0 ? 'today' : n === 1 ? 'yesterday' : n + ' days ago'; };

  const STAGES = [
    ['submitted', 'Submitted'], ['accepted', 'Accepted'], ['awaiting_device', 'Awaiting device'],
    ['received', 'Received'], ['dissection', 'Dissection'], ['plate_ordered', 'Plate ordered'],
    ['mounting', 'Mounting'], ['framed', 'Framed'], ['shipped', 'Shipped'], ['complete', 'Delivered'],
    ['declined', 'Declined']
  ];
  const LABEL = Object.fromEntries(STAGES);
  const BENCH = ['accepted', 'awaiting_device', 'received', 'dissection', 'plate_ordered', 'mounting', 'framed', 'shipped'];
  const NEXT = { accepted: 'awaiting_device', awaiting_device: 'received', received: 'dissection', dissection: 'plate_ordered',
                 plate_ordered: 'mounting', mounting: 'framed', framed: 'shipped', shipped: 'complete' };

  const cfg = window.LAB_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) { $('#setup').hidden = false; return; }
  const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

  const state = { specimens: [], inventory: [], parts: [] };
  const open = new Set();   // which shelf drawers are open, kept across re-renders

  /* ---------- auth ---------- */
  $('#login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#login-email').value.trim();
    const msg = $('#login-msg');
    if (!email) { msg.textContent = 'Enter your email.'; return; }
    msg.textContent = 'Sending…';
    const { error } = await db.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: location.origin + '/lab' } });
    msg.textContent = error ? 'That email can’t sign in here.' : 'Check your inbox for the sign-in link.';
  });
  $('#signout').addEventListener('click', async () => { await db.auth.signOut(); location.reload(); });
  db.auth.onAuthStateChange((_e, session) => show(session));
  db.auth.getSession().then(({ data }) => show(data.session));

  let booted = false;
  function show(session) {
    $('#gate').hidden = !!session; $('#app').hidden = !session; $('#signout').hidden = !session;
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

  function render() { summary(); queue(); bench(); shelf(); }

  /* ---------- derived ---------- */
  const submissions = () => state.specimens.filter((x) => x.stage === 'submitted')
    .sort((a, b) => (a.submitted_on || a.created_at).localeCompare(b.submitted_on || b.created_at));
  const onBench = () => state.specimens.filter((x) => BENCH.includes(x.stage));
  const lowStock = () => state.inventory.filter((x) => x.reorder_at != null && Number(x.qty) <= Number(x.reorder_at));
  const dueSoon = () => onBench().filter((x) => x.due_on && daysFrom(x.due_on) <= 7);
  function nextNum() {
    const nums = state.specimens.map((x) => parseInt(x.num, 10)).filter((n) => !isNaN(n));
    return String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0');
  }

  /* ---------- summary line ---------- */
  function summary() {
    const live = state.specimens.filter((x) => !['submitted', 'declined'].includes(x.stage));
    const outstanding = live.reduce((a, x) => a + Number(x.price || 0) - Number(x.paid || 0), 0);
    const items = [
      [submissions().length, 'to review', '#queue', submissions().length > 0],
      [onBench().length, 'on the bench', '#bench'],
      [dueSoon().length, 'due this week', '#bench', dueSoon().length > 0],
      [lowStock().length, 'low on stock', '#shelf', lowStock().length > 0, 'inventory'],
      [money(outstanding), 'outstanding', '#shelf', false, 'books']
    ];
    $('#summary').innerHTML = `<span class="label">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
      <div class="sum-row">${items.map(([n, l, href, hot, drawer]) =>
        `<a href="${href}" class="sum${hot ? ' hot' : ''}" ${drawer ? `data-open="${drawer}"` : ''}><b>${n}</b> ${l}</a>`).join('')}</div>`;
    $$('#summary [data-open]').forEach((a) => a.addEventListener('click', () => { open.add(a.dataset.open); shelf(); }));
  }

  /* ---------- 1 · intake queue ---------- */
  function queue() {
    const Q = submissions();
    $('#queue').innerHTML = `
      <div class="block-head">
        <div><span class="label">01 · Intake</span><h2 class="h2 mt-1" id="queue-h">Submissions<span class="dot">.</span></h2></div>
        <button class="lab-link" type="button" id="new-sub">+ Log a submission</button>
      </div>
      ${Q.length ? `<div class="subs">${Q.map((x) => `
        <article class="sub-card" data-sub="${x.id}">
          <header>
            <span class="label">Received ${ago(x.submitted_on || x.created_at)}</span>
            ${x.frame_size ? `<span class="tag">${esc(x.frame_size)}</span>` : ''}
          </header>
          <h3 class="h3">${esc(x.device)}</h3>
          <p class="sub-meta">${[x.device_type, x.device_year].filter(Boolean).map(esc).join(' · ')}${x.customer_name ? `<br>${esc(x.customer_name)}${x.customer_email ? ' · ' + esc(x.customer_email) : ''}` : ''}</p>
          ${x.story ? `<p class="client-note">“${esc(x.story)}”</p>` : ''}
          ${x.note ? `<p class="sub-meta"><span class="label">For the plate</span><br>${esc(x.note)}</p>` : ''}
          <footer>
            <button class="btn btn--sm" type="button" data-accept="${x.id}">Accept</button>
            <button class="lab-link" type="button" data-edit="${x.id}">Details</button>
            <button class="lab-link danger" type="button" data-decline="${x.id}">Decline</button>
          </footer>
        </article>`).join('')}</div>`
      : `<p class="empty">No submissions waiting. New ones from the intake form land here for review.</p>`}`;

    $('#new-sub').addEventListener('click', () => edit(null, { stage: 'submitted', submitted_on: today() }));
    $$('#queue [data-edit]').forEach((b) => b.addEventListener('click', () => edit(b.dataset.edit)));
    $$('#queue [data-accept]').forEach((b) => b.addEventListener('click', () => {
      const x = byId(b.dataset.accept);
      save('specimens', x.id, { stage: 'accepted', accepted_on: today(), num: x.num || nextNum() });
    }));
    $$('#queue [data-decline]').forEach((b) => twoTap(b, 'Tap again to decline', () => save('specimens', b.dataset.decline, { stage: 'declined' })));
  }

  /* ---------- 2 · the bench (a flow, top to bottom) ---------- */
  function bench() {
    const B = onBench();
    const done = state.specimens.filter((x) => ['complete', 'declined'].includes(x.stage));
    $('#bench').innerHTML = `
      <div class="block-head">
        <div><span class="label">02 · Production</span><h2 class="h2 mt-1" id="bench-h">The bench<span class="dot">.</span></h2></div>
        <span class="label">${B.length} in progress</span>
      </div>
      <ol class="flow">
        ${BENCH.map((stage) => {
          const here = B.filter((x) => x.stage === stage).sort((a, b) => (a.due_on || '9').localeCompare(b.due_on || '9'));
          return `<li class="flow-step${here.length ? ' has' : ''}">
            <div class="flow-node"><span class="pad"></span><span class="flow-name">${LABEL[stage]}</span>${here.length ? `<span class="flow-n">${here.length}</span>` : ''}</div>
            ${here.length ? `<div class="flow-cards">${here.map(card).join('')}</div>` : ''}
          </li>`;
        }).join('')}
      </ol>
      ${done.length ? `<details class="drawer-sec"${open.has('done') ? ' open' : ''} data-sec="done"><summary><span class="label">Delivered & declined · ${done.length}</span></summary>
        <ul class="mini">${done.map((x) => `<li><button type="button" data-edit="${x.id}"><span>${x.num ? 'Nº ' + esc(x.num) + ' · ' : ''}${esc(x.device)}</span><span class="tag${x.stage === 'complete' ? ' ok' : ''}">${LABEL[x.stage]}</span></button></li>`).join('')}</ul></details>` : ''}`;

    $$('#bench [data-edit]').forEach((b) => b.addEventListener('click', () => edit(b.dataset.edit)));
    $$('#bench [data-next]').forEach((b) => b.addEventListener('click', () => {
      const x = byId(b.dataset.next), stage = NEXT[x.stage], patch = { stage };
      if (stage === 'received' && !x.received_on) patch.received_on = today();
      if (stage === 'shipped' && !x.shipped_on) patch.shipped_on = today();
      save('specimens', x.id, patch);
    }));
    bindDetails('#bench');
  }
  function card(x) {
    const step = BENCH.indexOf(x.stage);
    const due = x.due_on ? daysFrom(x.due_on) : null;
    const dueTxt = due == null ? '' : due < 0 ? `${-due}d late` : due === 0 ? 'Due today' : `Due ${fmtDate(x.due_on)}`;
    return `<article class="spec-card">
      <button type="button" class="spec-open" data-edit="${x.id}">
        <span class="spec-top"><span class="label">${x.num ? 'Nº ' + esc(x.num) : 'No number'}</span>${dueTxt ? `<span class="due${due != null && due <= 3 ? ' soon' : ''}">${dueTxt}</span>` : ''}</span>
        <span class="spec-name">${esc(x.device)}</span>
        <span class="spec-meta">${esc(x.customer_name || (x.kind === 'archive' ? 'Archive piece' : x.kind === 'series' ? 'Series piece' : ''))}</span>
        <span class="track" aria-label="Step ${step + 1} of ${BENCH.length}">${BENCH.map((_, i) => `<i class="${i < step ? 'past' : i === step ? 'now' : ''}"></i>`).join('')}</span>
      </button>
      <button type="button" class="next" data-next="${x.id}">Move to ${LABEL[NEXT[x.stage]]} →</button>
    </article>`;
  }

  /* ---------- 3 · the shelf: inventory, parts, books ---------- */
  function shelf() {
    const I = state.inventory, P = state.parts, low = lowStock();
    const live = state.specimens.filter((x) => !['submitted', 'declined'].includes(x.stage));
    const booked = live.reduce((a, x) => a + Number(x.price || 0), 0);
    const paid = live.reduce((a, x) => a + Number(x.paid || 0), 0);
    const pieceCosts = live.reduce((a, x) => a + Number(x.costs || 0), 0);
    const supplies = P.filter((x) => x.bought).reduce((a, x) => a + Number(x.price || 0), 0);
    const left = P.filter((x) => !x.bought).reduce((a, x) => a + Number(x.price || 0), 0);
    const sections = [...new Set(P.map((x) => x.section))];

    $('#shelf').innerHTML = `
      <div class="block-head">
        <div><span class="label">03 · Supplies</span><h2 class="h2 mt-1" id="shelf-h">The shelf<span class="dot">.</span></h2></div>
      </div>

      <details class="drawer-sec" data-sec="inventory"${open.has('inventory') ? ' open' : ''}>
        <summary><span class="label">Inventory</span><span class="sec-note">${I.length} items${low.length ? ` · <em>${low.length} low</em>` : ''}</span></summary>
        <div class="sec-body">
          ${I.length ? `<ul class="inv">${I.map((x) => {
            const isLow = x.reorder_at != null && Number(x.qty) <= Number(x.reorder_at);
            return `<li class="${isLow ? 'low' : ''}">
              <button type="button" class="inv-name" data-inv="${x.id}"><b>${esc(x.item)}</b><span class="sub">${esc(x.category)}${x.location ? ' · ' + esc(x.location) : ''}${isLow ? ' · reorder' : ''}</span></button>
              <span class="qty"><button type="button" class="qty-btn" data-qty="${x.id}" data-d="-1" aria-label="Use one ${esc(x.item)}">−</button><span class="qty-n">${Number(x.qty)} <small>${esc(x.unit)}</small></span><button type="button" class="qty-btn" data-qty="${x.id}" data-d="1" aria-label="Add one ${esc(x.item)}">+</button></span>
            </li>`; }).join('')}</ul>` : '<p class="empty">Nothing tracked yet. Add what’s on the shelf.</p>'}
          <button class="lab-link" type="button" id="new-inv">+ Add item</button>
        </div>
      </details>

      <details class="drawer-sec" data-sec="parts"${open.has('parts') ? ' open' : ''}>
        <summary><span class="label">Parts list</span><span class="sec-note">${P.filter((x) => x.bought).length}/${P.length} bought · ${money(left, true)} to go</span></summary>
        <div class="sec-body">
          ${sections.map((sec) => `<h3 class="label sec-h">${esc(sec)}</h3><ul class="parts">
            ${P.filter((x) => x.section === sec).map((x) => `<li class="${x.bought ? 'done' : ''}">
              <input type="checkbox" id="pt-${x.id}" data-bought="${x.id}" ${x.bought ? 'checked' : ''}>
              <div><label for="pt-${x.id}" class="pt-name">${esc(x.item)}${x.per_piece ? ' <span class="tag">per piece</span>' : ''}</label>
                <div class="sub">${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.pick || 'Link')}</a>` : esc(x.pick || '')}</div></div>
              <span class="mono r">${x.price != null ? money(x.price, true) : 'check'}</span>
              <button type="button" class="lab-link" data-part="${x.id}">Edit</button>
            </li>`).join('')}</ul>`).join('')}
          <button class="lab-link" type="button" id="new-part">+ Add part</button>
        </div>
      </details>

      <details class="drawer-sec" data-sec="books"${open.has('books') ? ' open' : ''}>
        <summary><span class="label">Books</span><span class="sec-note">${money(paid)} received · ${money(booked - paid)} outstanding</span></summary>
        <div class="sec-body">
          <dl class="books">
            <div><dt class="label">Booked</dt><dd>${money(booked, true)}</dd></div>
            <div><dt class="label">Received</dt><dd>${money(paid, true)}</dd></div>
            <div><dt class="label">Outstanding</dt><dd>${money(booked - paid, true)}</dd></div>
            <div><dt class="label">Spent</dt><dd>${money(supplies + pieceCosts, true)}</dd><span class="sub">${money(supplies, true)} supplies · ${money(pieceCosts, true)} on pieces</span></div>
          </dl>
        </div>
      </details>`;

    $$('#shelf [data-inv]').forEach((b) => b.addEventListener('click', () => editInv(b.dataset.inv)));
    $$('#shelf [data-qty]').forEach((b) => b.addEventListener('click', () => {
      const x = state.inventory.find((i) => i.id === b.dataset.qty);
      save('inventory', x.id, { qty: Math.max(0, Number(x.qty) + Number(b.dataset.d)) });
    }));
    $('#new-inv').addEventListener('click', () => editInv(null));
    $$('#shelf [data-bought]').forEach((c) => c.addEventListener('change', () => save('parts', c.dataset.bought, { bought: c.checked })));
    $$('#shelf [data-part]').forEach((b) => b.addEventListener('click', () => editPart(b.dataset.part)));
    $('#new-part').addEventListener('click', () => editPart(null));
    bindDetails('#shelf');
  }
  function bindDetails(root) {
    $$(root + ' details[data-sec]').forEach((d) => d.addEventListener('toggle', () => { d.open ? open.add(d.dataset.sec) : open.delete(d.dataset.sec); }));
  }

  /* ---------- editors ---------- */
  const byId = (id) => state.specimens.find((s) => s.id === id);
  const SPEC_FIELDS = [
    ['device', 'Device', 'text', { required: true, ph: 'Game Boy DMG-01' }],
    ['num', 'Archive Nº', 'text', { ph: 'Assigned when accepted' }],
    ['stage', 'Stage', 'select', { options: STAGES }],
    ['kind', 'Kind', 'select', { options: [['commission', 'Commission'], ['archive', 'Archive piece'], ['series', 'Series']] }],
    ['customer_name', 'Client name', 'text'], ['customer_email', 'Client email', 'email'],
    ['device_type', 'Device type', 'text'], ['device_year', 'Year', 'text'],
    ['frame_size', 'Frame size', 'select', { options: [['', '—'], ['S', 'S · 8 × 10'], ['M', 'M · 11 × 14'], ['L', 'L · 16 × 20'], ['XL', 'XL · 22 × 28']] }],
    ['price', 'Price', 'number'], ['paid', 'Paid so far', 'number'], ['costs', 'Costs on this piece', 'number'],
    ['due_on', 'Due', 'date'], ['received_on', 'Device received', 'date'],
    ['shipped_on', 'Shipped', 'date'], ['tracking', 'Tracking Nº', 'text'],
    ['story', 'Their story', 'textarea'], ['note', 'Note for the plate', 'textarea'],
    ['photo_url', 'Photo link', 'url'], ['internal', 'Lab notes (private)', 'textarea']
  ];
  function edit(id, defaults) {
    const x = byId(id) || { kind: 'commission', paid: 0, costs: 0, ...defaults };
    drawer(id ? (x.num ? 'Nº ' + x.num + ' · ' : '') + x.device : 'Log a submission', SPEC_FIELDS, x, 'specimens', id);
  }
  const INV_FIELDS = [
    ['item', 'Item', 'text', { required: true, ph: '3mm acrylic rod' }],
    ['category', 'Category', 'select', { options: [['Supplies', 'Supplies'], ['Plates', 'Plates'], ['Frames', 'Frames'], ['Packaging', 'Packaging'], ['Tools', 'Tools'], ['Devices', 'Devices']] }],
    ['qty', 'On hand', 'number'], ['unit', 'Unit', 'text', { ph: 'ea, pcs, sheets' }],
    ['reorder_at', 'Flag low at', 'number'], ['location', 'Where it lives', 'text'], ['notes', 'Notes', 'textarea']
  ];
  function editInv(id) {
    const x = state.inventory.find((i) => i.id === id) || { category: 'Supplies', qty: 0, unit: 'ea' };
    drawer(id ? x.item : 'Add item', INV_FIELDS, x, 'inventory', id);
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

  /* ---------- shared: save, drawer, two-tap ---------- */
  async function save(table, id, patch) {
    const q = id ? db.from(table).update(patch).eq('id', id).select().single()
                 : db.from(table).insert(patch).select().single();
    const { data, error } = await q;
    if (fail(error)) return false;
    const list = state[table], i = list.findIndex((r) => r.id === data.id);
    if (i >= 0) list[i] = data; else list.unshift(data);
    render();
    return true;
  }

  function twoTap(btn, armedText, action) {
    const label = btn.textContent;
    btn.addEventListener('click', () => {
      if (!btn.dataset.armed) {
        btn.dataset.armed = '1'; btn.textContent = armedText;
        setTimeout(() => { delete btn.dataset.armed; btn.textContent = label; }, 3000);
        return;
      }
      action();
    });
  }

  const dr = $('#drawer');
  let current = null;
  function drawer(title, fields, rec, table, id) {
    current = { table, id, fields };
    $('#drawer-title').textContent = title;
    $('#drawer-delete').hidden = !id;
    $('#drawer-fields').innerHTML = fields.map(([k, label, type, o = {}]) => {
      const v = rec[k] ?? '', fid = 'f-' + k;
      if (type === 'select') return `<label class="field"><span class="label">${label}</span><select id="${fid}" name="${k}">${o.options.map(([ov, ol]) => `<option value="${esc(ov)}" ${String(v) === String(ov) ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select></label>`;
      if (type === 'textarea') return `<label class="field full"><span class="label">${label}</span><textarea id="${fid}" name="${k}" rows="3">${esc(v)}</textarea></label>`;
      if (type === 'checkbox') return `<label class="field check full"><input type="checkbox" id="${fid}" name="${k}" ${v ? 'checked' : ''}><span>${label}</span></label>`;
      return `<label class="field"><span class="label">${label}</span><input id="${fid}" name="${k}" type="${type}" ${type === 'number' ? 'step="0.01" inputmode="decimal"' : ''} value="${esc(v)}" ${o.required ? 'required' : ''} placeholder="${esc(o.ph || '')}"></label>`;
    }).join('');
    dr.classList.add('open'); dr.setAttribute('aria-hidden', 'false');
    setTimeout(() => $('#drawer-fields input, #drawer-fields select')?.focus(), 50);
  }
  function close() { dr.classList.remove('open'); dr.setAttribute('aria-hidden', 'true'); current = null; }
  $('[data-close]', dr).addEventListener('click', close);
  dr.addEventListener('click', (e) => { if (e.target === dr) close(); });
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

  twoTap($('#drawer-delete'), 'Tap again to delete', async () => {
    const { table, id } = current;
    const { error } = await db.from(table).delete().eq('id', id);
    if (fail(error)) return;
    state[table] = state[table].filter((r) => r.id !== id);
    close(); render();
  });
})();
