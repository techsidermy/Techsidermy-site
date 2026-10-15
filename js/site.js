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
    const price = s.price ? money(s.price) : (s.kind === 'commission' ? 'Commission' : '—');
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
      out += last
        ? `<a class="slot rv" href="submit.html"><div class="media"><span class="cta">Reserve this drawer</span><span class="num">Nº ${num}</span><span class="ghost-num" aria-hidden="true">${num}</span></div>
             <div class="body"><span class="status">Unassigned</span><span class="name">Your device</span><span class="meta">Join the intake queue →</span></div></a>`
        : `<div class="slot rv" aria-label="Empty specimen drawer ${num}"><div class="media"><span class="num">Nº ${num}</span><span class="ghost-num" aria-hidden="true">${num}</span></div>
             <div class="body"><span class="status">Unassigned</span><span class="name">Awaiting specimen</span><span class="meta">—</span></div></div>`;
    }
    return out;
  }

  const grid = $('#archive-grid');
  if (grid && window.SPECIMENS) {
    const list = visible();
    const slots = window.ARCHIVE_SLOTS || 0;
    grid.innerHTML = list.map(([sp, i]) => cardHTML(sp, i)).join('') + slotsHTML(slots);
    const cnt = $('#archive-count');
    if (cnt) cnt.textContent = `${String(list.length).padStart(2, '0')} catalogued · ${String(slots).padStart(2, '0')} drawers open`;
    observeReveals();
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
          <div class="d-media"><div class="stage" id="d-stage"></div><div class="thumbs" id="d-thumbs"></div></div>
          <div class="d-info" id="d-info"></div>
        </div>
      </aside>`);
    $('#d-close').addEventListener('click', closeSpecimen);
    $('#scrim').addEventListener('click', closeSpecimen);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSpecimen(); });
  }
  function setStage(img) {
    $('#d-stage').innerHTML = img
      ? `<img src="${img.src}" alt="${img.alt}" class="${img.full ? 'full' : ''}">`
      : `<div class="schematic"><span class="label">Awaiting specimen</span></div>`;
  }
  function openSpecimen(i, fromEl) {
    ensureDialog();
    const s = window.SPECIMENS[i];
    lastFocus = fromEl;
    $('#d-num').textContent = `Specimen Nº ${s.num} · ${s.series}`;
    setStage(s.images[0]);
    $('#d-thumbs').innerHTML = s.images.length > 1 ? s.images.map((im, k) =>
      `<button aria-current="${k === 0}" data-k="${k}"><img src="${im.src}" alt=""></button>`).join('') : '';
    $$('#d-thumbs button').forEach((b) => b.addEventListener('click', () => {
      $$('#d-thumbs button').forEach((x) => x.setAttribute('aria-current', x === b));
      setStage(s.images[+b.dataset.k]);
    }));
    const rows = [['Device', s.device], ['Issued', s.issued], ['Origin', s.origin], ['Format', s.size], ['Edition', s.edition]]
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
      ${s.note ? `<div><span class="label">Client note</span><p class="note mt-1">“${s.note}”</p></div>` : ''}
      ${s.parts.length ? `<div><span class="label">Components · ${s.parts.length}</span>
        <ul class="parts mt-1">${s.parts.map((p, k) => `<li><b>${String(k + 1).padStart(2, '0')}</b>${p}</li>`).join('')}</ul></div>` : ''}
      ${buy}`;
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
    function buildPreview() {
      const rows = [
        ['Device', [v('device_type'), v('model')].filter(Boolean).join(' · ')],
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
