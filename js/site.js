/* ==========================================================================
   TECHSIDERMY LAB: site behaviour
   ========================================================================== */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const page = document.body.dataset.page;

  /* ---------- shared header + footer ---------- */
  const NAV = [
    ['index.html', 'Index', 'home'],
    ['archive.html', 'Archive', 'archive'],
    ['submit.html', 'Submit', 'submit'],
    ['practice.html', 'Practice', 'practice']
  ];
  const head = $('[data-site-head]');
  if (head) {
    head.className = 'site-head';
    head.innerHTML = `
      <div class="wrap">
        <a href="index.html" class="wordmark" aria-label="Techsidermy Lab, home"><b>TECHSIDERMY</b><i>LAB</i></a>
        <button class="menu-btn" aria-expanded="false" aria-controls="bus">Menu</button>
        <nav class="bus" id="bus" aria-label="Primary">
          ${NAV.map(([href, label, key]) => `<a class="pin" href="${href}" ${key === page ? 'aria-current="page"' : ''}>${label}</a>`).join('')}
        </nav>
      </div>
      <div class="head-rule"></div>`;
    const btn = $('.menu-btn', head), bus = $('.bus', head);
    btn.addEventListener('click', () => {
      const open = bus.classList.toggle('open');
      btn.setAttribute('aria-expanded', open);
    });
  }
  const foot = $('[data-site-foot]');
  if (foot) {
    foot.className = 'site-foot';
    foot.innerHTML = `
      <div class="wrap">
        <div class="foot-grid">
          <div>
            <a href="index.html" class="wordmark"><b>TECHSIDERMY</b><i>LAB</i></a>
            <p class="mt-2">Specimens of obsolete technology.<br>Dissected, catalogued and preserved by hand in Sedona, Arizona.</p>
          </div>
          <div><h4>Collection</h4><a href="archive.html">The Archive</a><a href="submit.html#intake-start">Intake queue</a><a href="practice.html#exhibition">Exhibition</a></div>
          <div><h4>Submissions</h4><a href="submit.html">Submit a specimen</a><a href="submit.html#process">The process</a><a href="submit.html#protocols">Protocols</a></div>
          <div><h4>Contact</h4><a href="https://instagram.com/techsidermy.lab" target="_blank" rel="noopener">@techsidermy.lab</a><a href="mailto:techsidermy@gmail.com">techsidermy@gmail.com</a><p>Sedona, Arizona</p></div>
        </div>
        <div class="foot-base"><span class="label">© ${new Date().getFullYear()} Techsidermy Lab</span><span class="label">Specimens of obsolete technology</span></div>
      </div>`;
  }

  /* ---------- route trace: a line draws across the top before navigating ---------- */
  const trace = document.createElement('div');
  trace.className = 'route-trace';
  document.body.appendChild(trace);
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || /^https?:/.test(href)) return;
    if (href.split('#')[0] === location.pathname.split('/').pop()) return;
    e.preventDefault();
    trace.classList.add('go');
    setTimeout(() => { location.href = href; }, 380);
  });
  window.addEventListener('pageshow', () => trace.classList.remove('go'));

  /* ---------- reveal on scroll ---------- */
  const io = new IntersectionObserver((es) => es.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }), { threshold: 0.12 });
  const observeReveals = () => $$('.rv:not(.in)').forEach((el) => io.observe(el));
  observeReveals();

  /* ---------- connector wire (90° trace from trigger to panel) ---------- */
  function wire(fromEl, toX, toY) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const r = fromEl.getBoundingClientRect();
    const x1 = Math.min(r.right, window.innerWidth - 8), y1 = r.top + Math.min(r.height / 2, 120);
    const midX = x1 + (toX - x1) * 0.5;
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'wire');
    svg.setAttribute('width', window.innerWidth); svg.setAttribute('height', window.innerHeight);
    const p = document.createElementNS(svgNS, 'path');
    p.setAttribute('d', `M${x1} ${y1} H${midX} V${toY} H${toX}`);
    const pad1 = document.createElementNS(svgNS, 'rect');
    const pad2 = document.createElementNS(svgNS, 'rect');
    [[pad1, x1, y1], [pad2, toX, toY]].forEach(([el, x, y]) => {
      el.setAttribute('x', x - 5); el.setAttribute('y', y - 5); el.setAttribute('width', 10); el.setAttribute('height', 10);
    });
    svg.append(p, pad1, pad2);
    document.body.appendChild(svg);
    const len = p.getTotalLength();
    p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
    p.getBoundingClientRect();
    p.style.transition = 'stroke-dashoffset .5s cubic-bezier(.2,.7,.1,1)';
    p.style.strokeDashoffset = 0;
    setTimeout(() => { svg.style.transition = 'opacity .45s'; svg.style.opacity = 0; }, 900);
    setTimeout(() => svg.remove(), 1400);
  }

  /* ---------- ARCHIVE ---------- */
  const money = (n) => '$' + n.toLocaleString('en-US');
  function cardHTML(s, i) {
    const img = s.images[0];
    const media = img
      ? `<img src="${img.src}" alt="${img.alt}" loading="lazy" class="${img.full ? 'full' : ''}">`
      : `<div class="schematic"><span class="label">Awaiting specimen</span></div>`;
    const price = s.price ? money(s.price) : (s.kind === 'commission' ? 'Private' : '');
    return `
      <button class="card rv" data-i="${i}" aria-haspopup="dialog">
        <div class="media">${media}<span class="num">Nº ${s.num}</span><span class="ghost-num" aria-hidden="true">${s.num}</span></div>
        <div class="body">
          <div class="row"><span class="status" data-s="${s.status}">${s.statusLabel}</span><span class="meta">${s.series}</span></div>
          <div class="row"><span class="name">${s.name}</span><span class="price">${price}</span></div>
          <div class="meta">${s.device}${s.issued ? ' · ' + s.issued : ''}</div>
        </div>
      </button>`;
  }

  const visible = () => (window.SPECIMENS || []).map((sp, i) => [sp, i]).filter(([sp]) => !sp.hidden);
  function slotsHTML(count) {
    const nums = visible().map(([sp]) => parseInt(sp.num, 10)).filter((n) => !isNaN(n));
    let n = (nums.length ? Math.max(...nums) : 0) + 1;
    let out = '';
    for (let k = 0; k < count; k++, n++) {
      const num = String(n).padStart(4, '0');
      const last = k === count - 1;
      out += `<a class="slot rv${last ? ' slot--cta' : ''}" href="submit.html#intake-start" aria-label="Submit a specimen for drawer ${num}">
          <div class="media"><span class="cta">Submit a specimen</span><span class="num">Nº ${num}</span><span class="ghost-num" aria-hidden="true">${num}</span></div>
          <div class="body"><span class="status">Unassigned</span><span class="name">${last ? 'Your device' : 'Awaiting specimen'}</span><span class="meta">Join the intake queue →</span></div></a>`;
    }
    return out;
  }

  const reservedHTML = (num) => `<div class="slot slot--reserved rv" aria-label="Drawer ${num}, reserved">
      <div class="media"><span class="num">Nº ${num}</span><span class="ghost-num" aria-hidden="true">${num}</span></div>
      <div class="body"><span class="status" data-s="transit">Reserved</span><span class="name">In the queue</span><span class="meta">Specimen assigned</span></div></div>`;

  const grid = $('#archive-grid');
  if (grid && window.SPECIMENS) {
    const forSale = (sp) => !!sp.price && (sp.status === 'available' || sp.status === 'reserve');
    const toggle = $('#avail-toggle');
    const note = $('#avail-note');
    const render = () => {
      const first = toggle && toggle.getAttribute('aria-pressed') === 'true';
      let list = visible().sort((a, b) => parseInt(a[0].num, 10) - parseInt(b[0].num, 10));
      if (first) list = list.filter(([sp]) => forSale(sp)).concat(list.filter(([sp]) => !forSale(sp)));
      const slots = window.ARCHIVE_SLOTS || 0;
      // numbers already assigned to specimens still in the queue show as reserved drawers
      const have = new Set(list.map(([sp]) => parseInt(sp.num, 10)));
      const maxN = Math.max(0, ...have);
      const cells = list.map(([sp, i]) => [parseInt(sp.num, 10), cardHTML(sp, i)]);
      for (let k = 1; k < maxN; k++) if (!have.has(k)) cells.push([k, reservedHTML(String(k).padStart(4, '0'))]);
      if (!first) cells.sort((a, b) => a[0] - b[0]);
      grid.innerHTML = cells.map((c) => c[1]).join('') + slotsHTML(slots);
      const n = list.filter(([sp]) => forSale(sp)).length;
      if (note) note.hidden = !(first && n === 0);
      const cnt = $('#archive-count');
      if (cnt) cnt.textContent = `${String(list.length).padStart(2, '0')} catalogued · ${String(n).padStart(2, '0')} available`;
      observeReveals();
    };
    if (toggle) toggle.addEventListener('click', () => {
      toggle.setAttribute('aria-pressed', toggle.getAttribute('aria-pressed') !== 'true');
      render();
    });
    if (toggle && location.hash === '#available') toggle.setAttribute('aria-pressed', 'true');
    render();
    grid.addEventListener('click', (e) => {
      const card = e.target.closest('.card');
      if (card) openSpecimen(+card.dataset.i, card);
    });
  }

  // home: featured strip (real specimens first, then open drawers to fill three)
  const feat = $('#featured-grid');
  if (feat && window.SPECIMENS) {
    const list = visible().filter(([sp]) => sp.images.length).slice(0, 3);
    feat.innerHTML = list.map(([sp, i]) => cardHTML(sp, i)).join('') + slotsHTML(Math.max(0, 3 - list.length));
    observeReveals();
    feat.addEventListener('click', (e) => {
      const card = e.target.closest('.card');
      if (card) openSpecimen(+card.dataset.i, card);
    });
  }

  /* ---------- specimen dialog ---------- */
  let lastFocus = null;
  function ensureDialog() {
    if ($('#spec-dialog')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="scrim" id="scrim"></div>
      <aside class="dialog" id="spec-dialog" role="dialog" aria-modal="true" aria-labelledby="d-title">
        <div class="d-head"><span class="label label--accent" id="d-num"></span><button class="close" id="d-close">Close</button></div>
        <div class="d-body">
          <div class="d-media"><div class="stage" id="d-stage"></div><span class="label" id="d-groups"></span><div class="thumbs" id="d-thumbs"></div></div>
          <div class="d-info" id="d-info"></div>
        </div>
      </aside>`);
    $('#d-close').addEventListener('click', closeSpecimen);
    $('#scrim').addEventListener('click', closeSpecimen);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSpecimen(); });
  }
  function setStage(img, cap) {
    $('#d-stage').innerHTML = (img
      ? `<img src="${img.src}" alt="${img.alt || ''}" class="${img.full ? 'full' : ''}">`
      : `<div class="schematic"><span class="label">Awaiting specimen</span></div>`)
      + (cap ? `<div class="stage-cap"><span class="label label--accent">${cap.n} · ${cap.name}</span><span class="mono-sm">${cap.spec} · ${cap.note}</span></div>` : '');
  }
  function openSpecimen(i, fromEl) {
    ensureDialog();
    const s = window.SPECIMENS[i];
    lastFocus = fromEl;
    $('#d-num').textContent = `Specimen Nº ${s.num} · ${s.series}`;
    setStage(s.images[0]);
    $('#d-thumbs').innerHTML = s.images.length > 1 ? s.images.map((im, k) =>
      `<button aria-current="${k === 0}" data-k="${k}" title="${im.alt || ''}"><img src="${im.src}" alt=""></button>`).join('') : '';
    const groups = [...new Set(s.images.map((im) => im.group).filter(Boolean))];
    $('#d-groups').textContent = groups.length ? groups.join(' · ') : '';
    $$('#d-thumbs button').forEach((b) => b.addEventListener('click', () => {
      $$('#d-thumbs button, .comp').forEach((x) => x.setAttribute('aria-current', x === b));
      setStage(s.images[+b.dataset.k]);
    }));
    const rows = [['Device', s.device], ['Issued', s.issued], ['Origin', s.origin], ['Received', s.received], ['Format', s.size], ['Edition', s.edition]]
      .filter(([, v]) => v);
    let buy = '';
    if (s.price && (s.status === 'available' || s.status === 'reserve')) {
      const href = s.checkout || 'mailto:techsidermy@gmail.com?subject=' + encodeURIComponent('Specimen Nº ' + s.num);
      buy = `<div class="buy"><span class="label">${s.status === 'reserve' ? 'Reserve this specimen' : 'Acquire'}</span>
        <span class="price-lg">${money(s.price)}</span>
        <a class="btn" href="${href}" ${s.checkout ? 'target="_blank" rel="noopener"' : ''}>${s.status === 'reserve' ? 'Reserve' : 'Acquire'} Nº ${s.num}</a>
        <span class="mono-sm">Ships framed and ready to hang. Insured, signature required.</span></div>`;
    } else if (s.kind === 'commission') {
      buy = `<div class="buy"><span class="label">Private commission · not for sale</span>
        <a class="btn btn--ghost" href="submit.html">Submit your own specimen</a></div>`;
    } else {
      buy = `<div class="buy"><span class="label">Forthcoming</span><span class="mono-sm">Follow <a href="https://instagram.com/techsidermy.lab" target="_blank" rel="noopener"><u>@techsidermy.lab</u></a> for the release.</span></div>`;
    }
    $('#d-info').innerHTML = `
      <div><span class="status" data-s="${s.status}">${s.statusLabel}</span>
        <h2 class="h2 mt-1" id="d-title">${s.name}</h2>
        <p class="mono-sm mt-1">${s.summary}</p></div>
      <div class="record"><header><span class="label">Specimen record</span><span class="label label--accent">Nº ${s.num}</span></header>
        <dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></div>
      ${s.note ? `<div><span class="label">${s.kind === 'commission' ? 'Client note' : 'Lab note'}</span><p class="note mt-1">“${s.note}”</p></div>` : ''}
      ${s.components ? `<div><div class="row-between"><span class="label">Components · ${s.components.length}</span><span class="label">Tap to inspect</span></div>
        <div class="comp-grid mt-1">${s.components.map((c, k) => `<button class="comp" data-c="${k}" aria-current="false">
          <img src="${c.img}" alt="${c.name}" loading="lazy"><span class="cn">${c.n}</span><span class="ct">${c.name}</span><span class="cs">${c.spec}</span></button>`).join('')}</div></div>`
      : (s.parts.length ? `<div><span class="label">Components · ${s.parts.length}</span>
        <ul class="parts mt-1">${s.parts.map((p, k) => `<li><b>${String(k + 1).padStart(2, '0')}</b>${p}</li>`).join('')}</ul></div>` : '')}
      ${buy}`;
    $$('.comp', $('#d-info')).forEach((b) => b.addEventListener('click', () => {
      const c = s.components[+b.dataset.c];
      $$('#d-thumbs button, .comp').forEach((x) => x.setAttribute('aria-current', x === b));
      setStage({ src: c.img, alt: c.name, full: true }, c);
      if (window.innerWidth <= 860) $('#d-stage').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }));
    $('#scrim').classList.add('on');
    const dlg = $('#spec-dialog');
    dlg.classList.add('on');
    document.body.style.overflow = 'hidden';
    dlg.scrollTop = 0;
    setTimeout(() => {
      const left = dlg.getBoundingClientRect().left;
      if (fromEl && window.innerWidth > 860) wire(fromEl, left, 34);
      $('#d-close').focus();
    }, 460);
  }
  function closeSpecimen() {
    const dlg = $('#spec-dialog');
    if (!dlg || !dlg.classList.contains('on')) return;
    dlg.classList.remove('on');
    $('#scrim').classList.remove('on');
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }

  /* ---------- SUBMIT: process board (each step opens downward) ---------- */
  const steps = $$('.step');
  if (steps.length) {
    const fill = $('.process .fill');
    const show = (k) => {
      steps.forEach((st, j) => {
        const open = j === k && !st.classList.contains('open');
        st.classList.toggle('open', open);
        $('.step-btn', st).setAttribute('aria-expanded', open);
      });
      const cur = steps.findIndex((st) => st.classList.contains('open'));
      if (fill) fill.style.width = cur < 0 ? '0' : `${(cur / (steps.length - 1)) * 100}%`;
    };
    steps.forEach((st, k) => $('.step-btn', st).addEventListener('click', () => show(k)));
  }

  /* ---------- SUBMIT: commission price from data.js ---------- */
  if (window.COMMISSION) {
    $$('[data-c]').forEach((el) => {
      const k = el.dataset.c, v = window.COMMISSION[k];
      if (v == null) return;
      el.textContent = (k === 'price' || k === 'regular') ? money(v) : v;
    });
    const T = window.COMMISSION.tiers || {};
    const tiersEl = $('#tiers');
    if (tiersEl) tiersEl.innerHTML = Object.entries(T).map(([z, t]) => `
      <div class="tier"><span class="tz">${z}</span><span class="tf">${t.frame}</span>
        <span class="tp">${money(t.price)}<s>${money(t.regular)}</s></span></div>`).join('');
    $$('[data-z]').forEach((el) => { const t = T[el.dataset.z]; if (t) el.textContent = `${t.frame} · ${money(t.price)}`; });
  }

  /* ---------- SUBMIT: multi-step intake form ---------- */
  const form = $('#intake');
  if (form) {
    const panes = $$('.panel-step', form);
    const rail = $$('.form-rail li');
    const back = $('#f-back'), next = $('#f-next'), err = $('#f-err');
    let at = 0;
    const go = (k) => {
      at = k;
      panes.forEach((p, j) => p.classList.toggle('on', j === k));
      rail.forEach((li, j) => { li.classList.toggle('on', j === k); li.classList.toggle('done', j < k); });
      back.disabled = k === 0;
      next.textContent = k === panes.length - 1 ? 'Join the queue' : 'Continue';
      err.textContent = '';
      if (k === panes.length - 1) buildPreview();
      const top = form.getBoundingClientRect().top + scrollY - 100;
      if (scrollY > top) scrollTo({ top, behavior: 'smooth' });
    };
    const valid = () => {
      const req = $$('[required]', panes[at]);
      for (const el of req) {
        if (el.type === 'radio') {
          if (!$(`[name="${el.name}"]:checked`, form)) { err.textContent = 'Select one option to continue.'; return false; }
        } else if (el.type === 'checkbox') {
          if (!el.checked) { err.textContent = 'Please confirm each protocol to continue.'; el.focus(); return false; }
        } else if (!el.value.trim() || (el.type === 'email' && !/^\S+@\S+\.\S+$/.test(el.value))) {
          err.textContent = `Please complete: ${el.closest('.field').querySelector('label').textContent.toLowerCase()}.`;
          el.focus(); return false;
        }
      }
      return true;
    };
    const v = (n) => { const el = form.elements[n]; if (!el) return ''; if (el instanceof RadioNodeList) return el.value; return el.value.trim(); };

    /* frame size: suggested from device type, customer can override */
    const C = window.COMMISSION || {}, TIERS = C.tiers || {}, TYPES = C.types || {};
    const ORDER = Object.keys(TIERS);
    const pick = $('#size-pick'), sug = $('#size-sug'), note = $('#size-note'), sugIn = $('#suggested_size');
    let touched = false;
    const sizeNote = () => {
      const s = sugIn.value, c = v('frame_size');
      $$('.choices--size label', form).forEach((l) => l.classList.toggle('sug', !!s && l.previousElementSibling.value === s));
      note.classList.remove('warn');
      if (!c) { note.textContent = ''; return; }
      if (!s || c === s) { note.textContent = 'Final size is confirmed at intake, once we see every part.'; return; }
      if (ORDER.indexOf(c) < ORDER.indexOf(s)) {
        note.classList.add('warn');
        note.textContent = 'Going smaller means curating. If not every part fits, we choose the ones that tell its story best, and you approve the selection on your plate proof.';
      } else {
        note.textContent = 'Going bigger gives the parts more room to breathe: a gallery-style float with open space around the specimen.';
      }
    };
    if (pick) {
      $$('[name="device_type"]', form).forEach((r) => r.addEventListener('change', () => {
        const t = TYPES[r.value] || { tier: null, hint: '' };
        pick.hidden = false;
        sugIn.value = t.tier || '';
        sug.innerHTML = t.tier
          ? `Suggested: <b>${t.tier} · ${TIERS[t.tier].frame}</b> ${t.hint ? `<br><span class="hint">${t.hint}</span>` : ''}`
          : t.hint;
        if (!touched) $$('[name="frame_size"]', form).forEach((z) => { z.checked = !!t.tier && z.value === t.tier; });
        sizeNote();
      }));
      $$('[name="frame_size"]', form).forEach((z) => z.addEventListener('change', () => { touched = true; sizeNote(); }));
    }
    const sizeLine = () => {
      const c = v('frame_size'); if (!c || !TIERS[c]) return '';
      const s = sugIn ? sugIn.value : '';
      return `${c} · ${TIERS[c].frame} · ${money(TIERS[c].price)}${s && s !== c ? ` (suggested ${s})` : ''}`;
    };
    const shipLine = () => (v('frame_size') ? 'Quoted when your spot opens' : '');

    function buildPreview() {
      const rows = [
        ['Device', [v('device_type'), v('model')].filter(Boolean).join(' · ')],
        ['Frame', sizeLine()],
        ['Return ship', shipLine()],
        ['Issued', v('year')],
        ['Condition', [v('powers_on'), v('battery')].filter(Boolean).join(' · ')],
        ['Origin', v('ship_from')],
        ['From', v('name')],
        ['For', v('recipient')]
      ].filter(([, x]) => x);
      $('#preview').innerHTML = `
        <header><span class="label">Queue record · draft</span><span class="label label--accent">Nº pending</span></header>
        <dl>${rows.map(([k, x]) => `<dt>${k}</dt><dd>${x.replace(/</g, '&lt;')}</dd>`).join('')}</dl>
        ${v('note') ? `<div class="pnote"><span class="label">Client note</span><p class="note mt-1">“${v('note').replace(/</g, '&lt;')}”</p></div>` : ''}`;
    }
    back.addEventListener('click', () => go(Math.max(0, at - 1)));
    next.addEventListener('click', async () => {
      if (!valid()) return;
      if (at < panes.length - 1) return go(at + 1);
      // submit: works with Netlify Forms when deployed; otherwise shows the confirmation
      next.disabled = true; next.textContent = 'Sending…';
      try {
        const data = new FormData(form);
        await fetch('/', { method: 'POST', body: data });
      } catch (e) { /* offline preview: fall through to confirmation */ }
      $('.form-nav', form).style.display = 'none';
      panes.forEach((p) => p.classList.remove('on'));
      rail.forEach((li) => { li.classList.remove('on'); li.classList.add('done'); });
      $('#done-name').textContent = v('name').split(' ')[0] || 'there';
      $('#done').classList.add('on');
    });
    go(0);
  }
})();
