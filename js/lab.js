/* ==========================================================================
   TECHSIDERMY LAB: command center (/lab)
   Pages (by link): /lab (overview) · #submissions · #bench · #due ·
                    #inventory · #books · #parts
   Data lives in Supabase. Row level security only lets lab admins in,
   so this page holds no secrets of its own.
   ========================================================================== */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (v, cents = false) => (v < 0 ? '−' : '') + '$' + Math.abs(Number(v || 0)).toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2 });
  const fmtDate = (d) => d ? new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  const today = () => new Date().toISOString().slice(0, 10);
  const daysFrom = (d) => Math.round((new Date(d.slice(0, 10) + 'T12:00:00') - new Date(today() + 'T12:00:00')) / 864e5);
  const ago = (d) => { const n = -daysFrom(d); return n <= 0 ? 'today' : n === 1 ? 'yesterday' : n + ' days ago'; };
  const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

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

  const state = { specimens: [], inventory: [], parts: [], loaded: false };

  /* ---------- auth: username + password ---------- */
  $('#login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = $('#login-user').value.trim().toLowerCase();
    const password = $('#login-pass').value;
    const msg = $('#login-msg');
    if (!user || !password) { msg.textContent = 'Enter your username and password.'; return; }
    const email = (cfg.users || {})[user] || (user.includes('@') ? user : null);
    if (!email) { msg.textContent = 'Wrong username or password.'; return; }
    msg.textContent = 'Signing in…';
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) { msg.textContent = 'Wrong username or password.'; $('#login-pass').select(); return; }
    msg.textContent = '';
    show(data.session);
  });
  $('#signout').addEventListener('click', async () => { await db.auth.signOut(); location.hash = ''; location.reload(); });
  db.auth.onAuthStateChange((_e, session) => show(session));
  db.auth.getSession().then(({ data }) => show(data.session));

  let booted = false;
  function show(session) {
    $('#gate').hidden = !!session; $('#app').hidden = !session; $('#signout').hidden = !session;
    if (!session) setTimeout(() => $('#login-user').focus(), 30);
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
    state.specimens = s.data; state.inventory = i.data; state.parts = p.data; state.loaded = true;
    render();
  }

  /* ---------- derived numbers (shared by nav and pages) ---------- */
  const byId = (id) => state.specimens.find((s) => s.id === id);
  const submissions = () => state.specimens.filter((x) => x.stage === 'submitted')
    .sort((a, b) => (a.submitted_on || a.created_at).localeCompare(b.submitted_on || b.created_at));
  const onBench = () => state.specimens.filter((x) => BENCH.includes(x.stage));
  const lowStock = () => state.inventory.filter((x) => x.reorder_at != null && Number(x.qty) <= Number(x.reorder_at));
  const dated = () => onBench().filter((x) => x.due_on).sort((a, b) => a.due_on.localeCompare(b.due_on));
  const dueWeek = () => dated().filter((x) => daysFrom(x.due_on) <= 7);
  const live = () => state.specimens.filter((x) => !['submitted', 'declined'].includes(x.stage));
  function books() {
    const L = live();
    const booked = L.reduce((a, x) => a + Number(x.price || 0), 0);
    const received = L.reduce((a, x) => a + Number(x.paid || 0), 0);
    const pieceCosts = L.reduce((a, x) => a + Number(x.costs || 0), 0);
    const supplies = state.parts.filter((x) => x.bought).reduce((a, x) => a + Number(x.price || 0), 0);
    const spent = supplies + pieceCosts;
    return { booked, received, outstanding: booked - received, pieceCosts, supplies, spent, net: received - spent };
  }
  function nextNum() {
    const nums = state.specimens.map((x) => parseInt(x.num, 10)).filter((n) => !isNaN(n));
    return String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0');
  }

  /* ---------- pages + nav ---------- */
  const PAGES = [
    ['overview',    'Overview',    () => ''],
    ['submissions', 'Submissions', () => submissions().length, 'to review'],
    ['bench',       'Bench',       () => onBench().length, 'in progress'],
    ['due',         'Due',         () => dueWeek().length, 'this week'],
    ['inventory',   'Inventory',   () => lowStock().length, 'low'],
    ['books',       'Books',       () => money(books().outstanding), 'owed'],
    ['parts',       'Parts',       () => `${state.parts.filter((x) => x.bought).length}/${state.parts.length}`, 'bought']
  ];
  const ALERT = { submissions: () => submissions().length > 0, due: () => dueWeek().length > 0, inventory: () => lowStock().length > 0 };
  const route = () => { const h = location.hash.replace('#', ''); return PAGES.some((p) => p[0] === h) ? h : 'overview'; };
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

  function nav() {
    const cur = route();
    $('#lab-nav').innerHTML = PAGES.map(([key, label, num, unit]) => {
      const n = num();
      return `<a href="${key === 'overview' ? '#' : '#' + key}" class="nav-btn${ALERT[key] && ALERT[key]() ? ' hot' : ''}" ${key === cur ? 'aria-current="page"' : ''}>
        <span class="nav-label">${label}</span>${n !== '' ? `<span class="nav-num">${n}</span><span class="nav-unit">${unit}</span>` : '<span class="nav-num nav-home">■</span><span class="nav-unit">today</span>'}</a>`;
    }).join('');
    $$('#lab-nav a[href="#"]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); history.pushState('', '', location.pathname + location.search); render(); }));
  }

  function render() {
    if (!state.loaded) return;
    nav();
    const page = route();
    ({ overview, submissions: pageSubmissions, bench: pageBench, due: pageDue, inventory: pageInventory, books: pageBooks, parts: pageParts })[page]();
    bindCommon();
  }
  const head = (eyebrow, title, right = '') => `<div class="block-head">
    <div><span class="label">${eyebrow}</span><h1 class="h2 mt-1">${title}<span class="dot">.</span></h1></div>${right}</div>`;

  /* ---------- OVERVIEW: money, today, stock, bench at a glance ---------- */
  function overview() {
    const b = books(), low = lowStock(), Q = submissions(), B = onBench();
    const todo = todayList();
    $('#view').innerHTML = `
      ${head(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }), 'Overview')}

      <section class="ov-money" aria-label="Money">
        <div class="ov-big"><span class="label">Received</span><b>${money(b.received)}</b><span class="sub">of ${money(b.booked)} booked</span>
          <span class="meter" aria-hidden="true"><i style="width:${b.booked ? Math.min(100, (b.received / b.booked) * 100) : 0}%"></i></span></div>
        <div><span class="label">Owed to you</span><b>${money(b.outstanding)}</b><span class="sub">on ${plural(live().filter((x) => Number(x.price || 0) > Number(x.paid || 0)).length, 'piece')}</span></div>
        <div><span class="label">Spent</span><b>${money(b.spent)}</b><span class="sub">${money(b.supplies)} supplies · ${money(b.pieceCosts)} on pieces</span></div>
        <div><span class="label">Net so far</span><b class="${b.net < 0 ? 'neg' : ''}">${money(b.net)}</b><span class="sub">received minus spent</span></div>
      </section>

      <div class="ov-grid">
        <section class="ov-panel ov-today" aria-labelledby="ov-today-h">
          <div class="ov-panel-head"><h2 class="label" id="ov-today-h">Needs you today</h2><span class="label">${todo.length || ''}</span></div>
          ${todo.length ? `<ol class="todo">${todo.map((t) => `<li class="${t.hot ? 'hot' : ''}">
              <a href="${t.href}" ${t.edit ? `data-edit="${t.edit}"` : ''}><span class="todo-t">${t.text}</span><span class="todo-s">${t.sub || ''}</span><span class="todo-go">→</span></a></li>`).join('')}</ol>`
            : '<p class="empty">Nothing urgent. The bench is on schedule.</p>'}
        </section>

        <section class="ov-panel" aria-labelledby="ov-inv-h">
          <div class="ov-panel-head"><h2 class="label" id="ov-inv-h">Inventory</h2><a class="lab-link" href="#inventory">All ${state.inventory.length} →</a></div>
          ${state.inventory.length ? `<ul class="ov-inv">${[...state.inventory].sort((x, y) => ratio(x) - ratio(y)).slice(0, 6).map((x) => {
              const isLow = x.reorder_at != null && Number(x.qty) <= Number(x.reorder_at);
              const pct = x.reorder_at ? Math.min(100, (Number(x.qty) / (Number(x.reorder_at) * 3)) * 100) : 100;
              return `<li class="${isLow ? 'low' : ''}"><span class="ov-inv-name">${esc(x.item)}</span>
                <span class="meter" aria-hidden="true"><i style="width:${pct}%"></i></span>
                <span class="ov-inv-q">${Number(x.qty)} <small>${esc(x.unit)}</small></span></li>`; }).join('')}</ul>`
            : '<p class="empty">No inventory yet.</p>'}
          ${low.length ? `<p class="sub">${plural(low.length, 'item')} at or below reorder point.</p>` : ''}
        </section>
      </div>

      <section class="ov-panel" aria-labelledby="ov-bench-h">
        <div class="ov-panel-head"><h2 class="label" id="ov-bench-h">The bench</h2><a class="lab-link" href="#bench">${plural(B.length, 'piece')} →</a></div>
        <ol class="strip">${BENCH.map((s) => { const n = B.filter((x) => x.stage === s).length;
          return `<li class="${n ? 'has' : ''}"><span class="strip-n">${n}</span><span class="strip-l">${LABEL[s]}</span></li>`; }).join('')}</ol>
        ${Q.length ? `<a class="strip-q" href="#submissions"><span class="pad"></span>${plural(Q.length, 'submission')} waiting in the queue, oldest ${ago(Q[0].submitted_on || Q[0].created_at)} →</a>` : ''}
      </section>`;
  }
  const ratio = (x) => x.reorder_at ? Number(x.qty) / Math.max(1, Number(x.reorder_at)) : 99;

  function todayList() {
    const out = [];
    const Q = submissions();
    if (Q.length) out.push({ text: `Review ${plural(Q.length, 'submission')}`, sub: `oldest ${ago(Q[0].submitted_on || Q[0].created_at)}`, href: '#submissions', hot: true });
    dated().forEach((x) => {
      const d = daysFrom(x.due_on), name = (x.num ? 'Nº ' + x.num + ' ' : '') + esc(x.device);
      if (d < 0) out.push({ text: `${name} is ${plural(-d, 'day')} late`, sub: LABEL[x.stage], href: '#bench', edit: x.id, hot: true });
      else if (d <= 3) out.push({ text: `${name} due ${d === 0 ? 'today' : d === 1 ? 'tomorrow' : 'in ' + d + ' days'}`, sub: LABEL[x.stage], href: '#bench', edit: x.id, hot: d <= 1 });
    });
    state.specimens.filter((x) => x.stage === 'accepted' && x.price && !Number(x.paid))
      .forEach((x) => out.push({ text: `Collect deposit for ${esc(x.device)}`, sub: `${money(x.price / 2)} · 50%`, href: '#books', edit: x.id }));
    state.specimens.filter((x) => x.stage === 'awaiting_device' && x.accepted_on && daysFrom(x.accepted_on) <= -14)
      .forEach((x) => out.push({ text: `Nudge ${esc(x.customer_name || 'client')} to ship ${esc(x.device)}`, sub: `accepted ${ago(x.accepted_on)}`, href: '#bench', edit: x.id }));
    state.specimens.filter((x) => ['shipped', 'complete'].includes(x.stage) && Number(x.price || 0) > Number(x.paid || 0))
      .forEach((x) => out.push({ text: `Collect balance on ${esc(x.device)}`, sub: money(x.price - x.paid), href: '#books', edit: x.id, hot: true }));
    lowStock().forEach((x) => out.push({ text: `Reorder ${esc(x.item)}`, sub: `${Number(x.qty)} ${esc(x.unit)} left`, href: '#inventory' }));
    return out;
  }

  /* ---------- SUBMISSIONS ---------- */
  function pageSubmissions() {
    const Q = submissions();
    $('#view').innerHTML = `
      ${head('Intake queue', 'Submissions', '<button class="lab-link" type="button" id="new-sub">+ Log a submission</button>')}
      ${Q.length ? `<div class="subs">${Q.map((x) => `
        <article class="sub-card">
          <header><span class="label">Received ${ago(x.submitted_on || x.created_at)}</span>${x.frame_size ? `<span class="tag">${esc(x.frame_size)}</span>` : ''}</header>
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
      : '<p class="empty">No submissions waiting. New ones from the intake form land here for review.</p>'}`;
    $('#new-sub').addEventListener('click', () => edit(null, { stage: 'submitted', submitted_on: today() }));
    $$('[data-accept]').forEach((b) => b.addEventListener('click', () => {
      const x = byId(b.dataset.accept);
      save('specimens', x.id, { stage: 'accepted', accepted_on: today(), num: x.num || nextNum() });
    }));
    $$('[data-decline]').forEach((b) => twoTap(b, 'Tap again to decline', () => save('specimens', b.dataset.decline, { stage: 'declined' })));
  }

  /* ---------- BENCH ---------- */
  function pageBench() {
    const B = onBench();
    const done = state.specimens.filter((x) => ['complete', 'declined'].includes(x.stage));
    $('#view').innerHTML = `
      ${head('Production', 'The bench', `<span class="label">${B.length} in progress</span>`)}
      <ol class="flow">
        ${BENCH.map((stage) => {
          const here = B.filter((x) => x.stage === stage).sort((a, b) => (a.due_on || '9').localeCompare(b.due_on || '9'));
          return `<li class="flow-step${here.length ? ' has' : ''}">
            <div class="flow-node"><span class="pad"></span><span class="flow-name">${LABEL[stage]}</span>${here.length ? `<span class="flow-n">${here.length}</span>` : ''}</div>
            ${here.length ? `<div class="flow-cards">${here.map(card).join('')}</div>` : ''}
          </li>`; }).join('')}
      </ol>
      ${done.length ? `<details class="drawer-sec"><summary><span class="label">Delivered & declined · ${done.length}</span></summary>
        <ul class="mini">${done.map((x) => `<li><button type="button" data-edit="${x.id}"><span>${x.num ? 'Nº ' + esc(x.num) + ' · ' : ''}${esc(x.device)}</span><span class="tag${x.stage === 'complete' ? ' ok' : ''}">${LABEL[x.stage]}</span></button></li>`).join('')}</ul></details>` : ''}`;
    $$('[data-next]').forEach((b) => b.addEventListener('click', () => {
      const x = byId(b.dataset.next), stage = NEXT[x.stage], patch = { stage };
      if (stage === 'received' && !x.received_on) patch.received_on = today();
      if (stage === 'shipped' && !x.shipped_on) patch.shipped_on = today();
      save('specimens', x.id, patch);
    }));
  }
  function card(x) {
    const step = BENCH.indexOf(x.stage);
    const due = x.due_on ? daysFrom(x.due_on) : null;
    const dueTxt = due == null ? '' : due < 0 ? `${-due}d late` : due === 0 ? 'Due today' : `Due ${fmtDate(x.due_on)}`;
    return `<article class="spec-card">
      <button type="button" class="spec-open" data-edit="${x.id}">
        <span class="spec-top"><span class="label">${x.num ? 'Nº ' + esc(x.num) : 'No number'}</span>${dueTxt ? `<span class="due${due <= 3 ? ' soon' : ''}">${dueTxt}</span>` : ''}</span>
        <span class="spec-name">${esc(x.device)}</span>
        <span class="spec-meta">${esc(x.customer_name || (x.kind === 'archive' ? 'Archive piece' : x.kind === 'series' ? 'Series piece' : ''))}</span>
        <span class="track" aria-label="Step ${step + 1} of ${BENCH.length}">${BENCH.map((_, i) => `<i class="${i < step ? 'past' : i === step ? 'now' : ''}"></i>`).join('')}</span>
      </button>
      ${NEXT[x.stage] ? `<button type="button" class="next" data-next="${x.id}">Move to ${LABEL[NEXT[x.stage]]} →</button>` : ''}
    </article>`;
  }

  /* ---------- DUE ---------- */
  function pageDue() {
    const D = dated(), none = onBench().filter((x) => !x.due_on);
    const groups = [
      ['Late', D.filter((x) => daysFrom(x.due_on) < 0)],
      ['This week', D.filter((x) => { const d = daysFrom(x.due_on); return d >= 0 && d <= 7; })],
      ['Later', D.filter((x) => daysFrom(x.due_on) > 7)],
      ['No due date', none]
    ].filter((g) => g[1].length);
    $('#view').innerHTML = `
      ${head('Schedule', 'Due')}
      ${groups.length ? groups.map(([name, list]) => `<section class="due-group"><h2 class="label">${name} · ${list.length}</h2>
        <ul class="rows">${list.map((x) => { const d = x.due_on ? daysFrom(x.due_on) : null;
          return `<li><button type="button" data-edit="${x.id}">
            <span class="row-date ${d != null && d <= 3 ? 'soon' : ''}">${x.due_on ? fmtDate(x.due_on) : '—'}</span>
            <span class="row-main"><b>${x.num ? 'Nº ' + esc(x.num) + ' · ' : ''}${esc(x.device)}</b><span class="sub">${esc(x.customer_name || x.kind)}</span></span>
            <span class="tag">${LABEL[x.stage]}</span>
            <span class="row-rel">${d == null ? '' : d < 0 ? -d + 'd late' : d === 0 ? 'today' : 'in ' + d + 'd'}</span>
          </button></li>`; }).join('')}</ul></section>`).join('')
        : '<p class="empty">Nothing on the bench yet.</p>'}`;
  }

  /* ---------- INVENTORY ---------- */
  function pageInventory() {
    const I = state.inventory, cats = [...new Set(I.map((x) => x.category))];
    $('#view').innerHTML = `
      ${head('Supplies on hand', 'Inventory', '<button class="lab-link" type="button" id="new-inv">+ Add item</button>')}
      ${I.length ? cats.map((c) => `<section class="due-group"><h2 class="label">${esc(c)}</h2><ul class="inv">${I.filter((x) => x.category === c).map((x) => {
          const isLow = x.reorder_at != null && Number(x.qty) <= Number(x.reorder_at);
          return `<li class="${isLow ? 'low' : ''}">
            <button type="button" class="inv-name" data-inv="${x.id}"><b>${esc(x.item)}</b><span class="sub">${x.location ? esc(x.location) + ' · ' : ''}${x.reorder_at != null ? 'reorder at ' + Number(x.reorder_at) : 'no reorder point'}${isLow ? ' · <em>low</em>' : ''}</span></button>
            <span class="qty"><button type="button" class="qty-btn" data-qty="${x.id}" data-d="-1" aria-label="Use one ${esc(x.item)}">−</button><span class="qty-n">${Number(x.qty)} <small>${esc(x.unit)}</small></span><button type="button" class="qty-btn" data-qty="${x.id}" data-d="1" aria-label="Add one ${esc(x.item)}">+</button></span>
          </li>`; }).join('')}</ul></section>`).join('')
        : '<p class="empty">Nothing tracked yet. Add what’s on the shelf: rods, plates, frames, boxes, epoxy.</p>'}`;
    $('#new-inv').addEventListener('click', () => editInv(null));
    $$('[data-inv]').forEach((b) => b.addEventListener('click', () => editInv(b.dataset.inv)));
    $$('[data-qty]').forEach((b) => b.addEventListener('click', () => {
      const x = state.inventory.find((i) => i.id === b.dataset.qty);
      save('inventory', x.id, { qty: Math.max(0, Number(x.qty) + Number(b.dataset.d)) });
    }));
  }

  /* ---------- BOOKS ---------- */
  function pageBooks() {
    const b = books();
    const L = live().filter((x) => x.price || Number(x.paid) || Number(x.costs));
    $('#view').innerHTML = `
      ${head('Money', 'Books')}
      <dl class="books">
        <div><dt class="label">Booked</dt><dd>${money(b.booked, true)}</dd></div>
        <div><dt class="label">Received</dt><dd>${money(b.received, true)}</dd></div>
        <div><dt class="label">Owed to you</dt><dd>${money(b.outstanding, true)}</dd></div>
        <div><dt class="label">Spent</dt><dd>${money(b.spent, true)}</dd><span class="sub">${money(b.supplies, true)} supplies · ${money(b.pieceCosts, true)} on pieces</span></div>
      </dl>
      <section class="due-group"><h2 class="label">By piece</h2>
      ${L.length ? `<div class="table-wrap"><table class="ledger">
        <thead><tr><th>Piece</th><th>Stage</th><th class="r">Price</th><th class="r">Paid</th><th class="r">Owed</th><th class="r">Costs</th><th class="r">Margin</th></tr></thead>
        <tbody>${L.map((x) => { const owed = Number(x.price || 0) - Number(x.paid || 0), margin = Number(x.price || 0) - Number(x.costs || 0);
          return `<tr data-edit="${x.id}"><td><b>${x.num ? 'Nº ' + esc(x.num) + ' · ' : ''}${esc(x.device)}</b><span class="sub">${esc(x.customer_name || x.kind)}</span></td>
            <td><span class="tag">${LABEL[x.stage]}</span></td>
            <td class="r">${x.price != null ? money(x.price, true) : '—'}</td><td class="r">${money(x.paid, true)}</td>
            <td class="r ${owed > 0 ? 'owed' : ''}">${owed > 0 ? money(owed, true) : '—'}</td><td class="r">${money(x.costs, true)}</td>
            <td class="r">${x.price != null ? money(margin, true) : '—'}</td></tr>`; }).join('')}</tbody></table></div>`
        : '<p class="empty">No prices or payments logged yet. Add them on each specimen.</p>'}</section>
      <p class="sub">Supplies come from parts you’ve checked off as bought. Per-piece costs come from each specimen’s “Costs on this piece”.</p>`;
    $$('.ledger [data-edit]').forEach((tr) => tr.addEventListener('click', () => edit(tr.dataset.edit)));
  }

  /* ---------- PARTS ---------- */
  function pageParts() {
    const P = state.parts, sections = [...new Set(P.map((x) => x.section))];
    const left = P.filter((x) => !x.bought).reduce((a, x) => a + Number(x.price || 0), 0);
    $('#view').innerHTML = `
      ${head(`${P.filter((x) => x.bought).length} of ${P.length} bought · ${money(left, true)} to go`, 'Parts list', '<button class="lab-link" type="button" id="new-part">+ Add part</button>')}
      ${sections.map((sec) => `<section class="due-group"><h2 class="label">${esc(sec)}</h2><ul class="parts">
        ${P.filter((x) => x.section === sec).map((x) => `<li class="${x.bought ? 'done' : ''}">
          <input type="checkbox" id="pt-${x.id}" data-bought="${x.id}" ${x.bought ? 'checked' : ''}>
          <div><label for="pt-${x.id}" class="pt-name">${esc(x.item)}${x.per_piece ? ' <span class="tag">per piece</span>' : ''}</label>
            <span class="sub">${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.pick || 'Link')}</a>` : esc(x.pick || '')}</span></div>
          <span class="mono r">${x.price != null ? money(x.price, true) : 'check'}</span>
          <button type="button" class="lab-link" data-part="${x.id}">Edit</button>
        </li>`).join('')}</ul></section>`).join('') || '<p class="empty">No parts yet.</p>'}`;
    $('#new-part').addEventListener('click', () => editPart(null));
    $$('[data-bought]').forEach((c) => c.addEventListener('change', () => save('parts', c.dataset.bought, { bought: c.checked })));
    $$('[data-part]').forEach((b) => b.addEventListener('click', () => editPart(b.dataset.part)));
  }

  function bindCommon() {
    $$('#view button[data-edit], #view a[data-edit]').forEach((el) => el.addEventListener('click', (e) => {
      if (el.tagName === 'A') e.preventDefault();
      edit(el.dataset.edit);
    }));
  }

  /* ---------- editors ---------- */
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
