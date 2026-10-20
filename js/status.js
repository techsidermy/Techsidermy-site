/* ==========================================================================
   TECHSIDERMY LAB: customer status portal (/status)
   Clients sign in with an emailed one-time link and see only their own
   specimens, through my_specimens() (safe columns only), plus a message
   thread per specimen. Nothing private from the lab ever reaches this page.
   ========================================================================== */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (v) => '$' + Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const fmtDate = (d) => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const fmtTime = (d) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  /* The six public steps match the process on the Submit page. */
  const STEPS = [
    ['Queue', ['submitted']],
    ['Confirm', ['accepted']],
    ['Ship', ['awaiting_device']],
    ['Intake', ['received']],
    ['Dissect', ['dissection', 'plate_ordered', 'mounting', 'framed']],
    ['Return', ['shipped', 'complete']]
  ];
  const stepOf = (stage) => STEPS.findIndex(([, s]) => s.includes(stage));
  const DETAIL = {
    submitted:       ['In review', 'We read every submission by hand. Spots open in the order received, and we’ll email you when yours does.'],
    accepted:        ['Accepted', 'Your spot is open. Payment in full locks it in, and packing instructions follow.'],
    awaiting_device: ['Ready for your device', 'Ship it to the lab using the packing instructions in your email. Factory-reset it first.'],
    received:        ['Arrived at the lab', 'Measured, photographed and numbered. It’s queued for the bench.'],
    dissection:      ['On the bench', 'Being taken apart by hand, one component at a time.'],
    plate_ordered:   ['Plate in print', 'Your 1:1 plate is being printed and mounted to its backing.'],
    mounting:        ['Mounting', 'Each component is going onto its clear standoff above the plate.'],
    framed:          ['Framed', 'Sealed behind glass and getting ready to ship home.'],
    shipped:         ['On its way home', 'Shipped insured, double-boxed and corner-protected.'],
    complete:        ['Home', 'Delivered and preserved. Thank you for trusting us with it.']
  };

  const cfg = window.LAB_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) { $('#st-setup').hidden = false; return; }
  const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  const state = { specimens: [], messages: [], email: '' };

  /* ---------- sign in with an emailed link ---------- */
  $('#st-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#st-email').value.trim();
    const msg = $('#st-msg');
    if (!/^\S+@\S+\.\S+$/.test(email)) { msg.textContent = 'Enter the email you submitted with.'; return; }
    msg.textContent = 'Sending…';
    const { error } = await db.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: location.origin + '/status' } });
    msg.textContent = error ? 'Couldn’t send the link. Try again in a minute.' : `Check ${email} for your sign-in link. It works once.`;
  });
  $('#st-out').addEventListener('click', async () => { await db.auth.signOut(); location.reload(); });
  db.auth.onAuthStateChange((_e, session) => show(session));
  db.auth.getSession().then(({ data }) => show(data.session));

  let booted = false;
  function show(session) {
    $('#st-gate').hidden = !!session; $('#st-app').hidden = !session;
    if (session && !booted) { booted = true; state.email = session.user?.email || ''; load(); }
  }

  async function load() {
    const { data, error } = await db.rpc('my_specimens');
    if (error) return fail();
    state.specimens = data || [];
    if (state.specimens.length) {
      const m = await db.from('specimen_messages').select('*').in('specimen_id', state.specimens.map((x) => x.id)).order('created_at');
      if (m.error) return fail();
      state.messages = m.data || [];
    }
    render();
  }
  function fail() {
    const el = $('#st-err'); el.hidden = false;
    el.textContent = 'We couldn’t load your specimens right now. Refresh in a moment, or email techsidermy@gmail.com.';
  }

  function render() {
    $('#st-who').textContent = 'Signed in as ' + state.email;
    const S = state.specimens;
    if (!S.length) {
      $('#st-list').innerHTML = `<div class="st-empty">
        <h2 class="h3">Nothing under this email yet<span class="dot">.</span></h2>
        <p class="mono-sm">Specimens appear here once we’ve logged your submission. Signed in with a different email than the one on your form? Sign out and use that one.</p>
        <a class="btn btn--ghost" href="submit.html#intake-start">Submit a specimen</a></div>`;
      return;
    }
    $('#st-list').innerHTML = S.map(card).join('');

    $$('.st-thread form').forEach((f) => f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ta = $('textarea', f), body = ta.value.trim(), btn = $('button', f), note = $('.st-sent', f);
      if (!body) { ta.focus(); return; }
      btn.disabled = true; note.textContent = 'Sending…';
      const { data, error } = await db.from('specimen_messages').insert({ specimen_id: f.dataset.sid, author: 'client', body }).select().single();
      btn.disabled = false;
      if (error) { note.textContent = 'Didn’t send. Try again, or email techsidermy@gmail.com.'; return; }
      state.messages.push(data);
      const open = f.closest('.st-card').dataset.sid;
      render();
      const again = $(`.st-card[data-sid="${open}"] .st-sent`); if (again) again.textContent = 'Sent. We reply from the bench, usually within a day.';
    }));
  }

  function card(x) {
    const step = stepOf(x.stage);
    const [title, text] = DETAIL[x.stage] || ['', ''];
    const owed = Math.max(0, Number(x.price || 0) - Number(x.paid || 0));
    const paidFull = x.price != null && Number(x.price) > 0 && owed === 0;
    const pay = (window.COMMISSION || {}).checkout;
    const msgs = state.messages.filter((m) => m.specimen_id === x.id);
    const dates = [
      ['Submitted', x.submitted_on], ['Accepted', x.accepted_on], ['Arrived', x.received_on], ['Shipped', x.shipped_on]
    ].filter(([, d]) => d);

    return `<article class="st-card" data-sid="${x.id}">
      <header class="st-head">
        <div><span class="label">${x.num ? 'Specimen Nº ' + esc(x.num) : 'Submission'}${x.frame_size ? ' · Size ' + esc(x.frame_size) : ''}</span>
          <h2 class="h2 mt-1">${esc(x.device)}<span class="dot">.</span></h2></div>
        <div class="st-pay">${x.stage === 'submitted' ? '<span class="label">Nothing charged yet</span>'
          : paidFull ? '<span class="tag-ok">Paid in full</span>'
          : owed > 0 ? `<span class="label label--accent">Payment due · ${money(owed)}</span>${pay ? `<a class="btn btn--sm" href="${esc(pay)}" target="_blank" rel="noopener">Pay in full</a>` : '<span class="mono-sm">Your payment link is in your email.</span>'}` : ''}</div>
      </header>

      <ol class="st-steps" aria-label="Progress: step ${step + 1} of ${STEPS.length}">
        ${STEPS.map(([name], i) => `<li class="${i < step ? 'past' : i === step ? 'now' : ''}"><span class="node">${String(i + 1).padStart(2, '0')}</span><span class="t">${name}</span></li>`).join('')}
      </ol>

      <div class="st-now">
        <span class="label label--accent">Now</span>
        <h3 class="h3">${title}</h3>
        <p>${text}</p>
        ${x.stage === 'shipped' && x.tracking ? `<p class="st-track"><span class="label">Tracking</span> <span class="mono">${esc(x.tracking)}</span></p>` : ''}
        ${x.due_on && !['shipped', 'complete'].includes(x.stage) ? `<p class="mono-sm">Expected to ship by ${fmtDate(x.due_on)}.</p>` : ''}
        ${dates.length ? `<dl class="st-dates">${dates.map(([l, d]) => `<div><dt class="label">${l}</dt><dd>${fmtDate(d)}</dd></div>`).join('')}</dl>` : ''}
      </div>

      <section class="st-thread" aria-label="Messages with the lab">
        <span class="label">Ask the bench</span>
        ${msgs.length ? `<ol class="st-msgs">${msgs.map((m) => `<li class="${m.author}">
            <span class="who">${m.author === 'lab' ? 'Techsidermy Lab' : 'You'} · ${fmtTime(m.created_at)}</span>
            <p>${esc(m.body)}</p></li>`).join('')}</ol>`
          : '<p class="mono-sm">No messages yet. Ask anything about your specimen and we’ll reply here.</p>'}
        <form data-sid="${x.id}">
          <label class="sr" for="msg-${x.id}">Your message</label>
          <textarea id="msg-${x.id}" rows="3" maxlength="4000" placeholder="Ask about your specimen…"></textarea>
          <div class="st-send"><span class="st-sent mono-sm" role="status"></span><button class="btn btn--sm" type="submit">Send</button></div>
        </form>
      </section>
    </article>`;
  }
})();
