// ==========================================================================
// TECHSIDERMY LAB: search build (Netlify runs this on every deploy)
// No dependencies. Reads js/data.js and writes:
//   specimen-<num>.html   one crawlable page per public specimen
//   archive.html          refreshes the catalogue index between its markers
//   sitemap.xml           every public page
// Run locally with:  node tools/build.mjs
// ==========================================================================
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://techsidermy.store';
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const write = (f, s) => fs.writeFileSync(path.join(root, f), s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// load the site's data the same way the browser does
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(read('js/data.js'), ctx);
const all = ctx.window.SPECIMENS || [];
const specimens = all.filter((s) => !s.hidden && /^\d+$/.test(s.num))
  .sort((a, b) => parseInt(a.num, 10) - parseInt(b.num, 10));
const forSale = (s) => !!s.price && (s.status === 'available' || s.status === 'reserve');
const today = new Date().toISOString().slice(0, 10);

// remove pages for specimens that were hidden or removed
for (const f of fs.readdirSync(root)) {
  if (/^specimen-\d+\.html$/.test(f) && !specimens.some((s) => f === `specimen-${s.num}.html`)) fs.unlinkSync(path.join(root, f));
}

/* ---------- one page per specimen ---------- */
for (const s of specimens) {
  const url = `${BASE}/specimen-${s.num}`;
  const title = `${s.name}, framed and dissected · Specimen Nº ${s.num} | Techsidermy Lab`;
  const what = [s.device, s.issued].filter(Boolean).join(', ');
  const desc = `${s.summary} ${what ? what + '.' : ''} ${forSale(s) ? 'Available framed and ready to hang.' : 'Preserved at 1:1 in a shadowbox.'}`.replace(/\s+/g, ' ').trim().slice(0, 158);
  const img0 = s.images[0];
  const imgUrl = (im) => `${BASE}/${im.src}`;
  const record = [['Device', s.device], ['Issued', s.issued], ['Origin', s.origin], ['Received', s.received], ['Format', s.size], ['Edition', s.edition], ['Series', s.series]]
    .filter(([, v]) => v);

  const art = {
    '@type': 'VisualArtwork', '@id': url + '#work', name: `${s.name} · Specimen Nº ${s.num}`, url,
    description: s.summary, artform: 'Shadowbox assemblage', artMedium: 'Disassembled electronic device mounted on acrylic standoffs over a printed plate',
    creator: { '@id': BASE + '/#org' }, ...(s.issued ? { about: `${s.device} (${s.issued})` } : {}),
    ...(s.images.length ? { image: s.images.map(imgUrl) } : {})
  };
  const graph = [art, {
    '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Techsidermy Lab', item: BASE + '/' },
      { '@type': 'ListItem', position: 2, name: 'The Archive', item: BASE + '/archive' },
      { '@type': 'ListItem', position: 3, name: `Nº ${s.num} ${s.name}`, item: url }]
  }];
  if (forSale(s)) {
    graph.push({
      '@type': 'Product', name: `${s.name} · Techsidermy Specimen Nº ${s.num}`, description: s.summary, url,
      ...(s.images.length ? { image: s.images.map(imgUrl) } : {}), brand: { '@type': 'Brand', name: 'Techsidermy Lab' },
      offers: { '@type': 'Offer', price: String(s.price), priceCurrency: 'USD', url,
        availability: s.status === 'available' ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder',
        itemCondition: 'https://schema.org/NewCondition' }
    });
  }

  const buy = forSale(s)
    ? `<div class="buy"><span class="label">${s.status === 'reserve' ? 'Reserve this specimen' : 'Acquire'}</span>
        <span class="price-lg">$${Number(s.price).toLocaleString('en-US')}</span>
        <a class="btn" href="${esc(s.checkout || 'mailto:techsidermy@gmail.com?subject=' + encodeURIComponent('Specimen Nº ' + s.num))}"${s.checkout ? ' target="_blank" rel="noopener"' : ''}>${s.status === 'reserve' ? 'Reserve' : 'Acquire'} Nº ${s.num}</a>
        <span class="mono-sm">Ships framed and ready to hang. Insured, signature required.</span></div>`
    : `<div class="buy"><span class="label">${s.kind === 'commission' ? 'Private commission · not for sale' : 'Not currently available'}</span>
        <a class="btn btn--ghost" href="submit.html">Commission your own specimen</a></div>`;

  const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#F7F7F5">
<meta property="og:site_name" content="Techsidermy Lab">
<meta property="og:type" content="${forSale(s) ? 'product' : 'article'}">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(`${s.name} · Specimen Nº ${s.num}`)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${img0 ? imgUrl(img0) : BASE + '/assets/img/social-card.jpg'}">
${img0 ? `<meta property="og:image:alt" content="${esc(img0.alt)}">\n` : ''}<meta name="twitter:card" content="summary_large_image">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })}</script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Courier+Prime:ital@0;1&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+Condensed:wght@500;600&display=swap">
<link rel="stylesheet" href="css/site.css?v=16">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/assets/favicon-192.png" type="image/png" sizes="192x192">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
</head>
<body data-page="archive">
<header data-site-head></header>
<main>
  <section class="hero" style="padding-bottom:32px">
    <div class="wrap">
      <nav class="mono-sm crumbs" aria-label="Breadcrumb"><a href="archive.html"><u>The Archive</u></a> · Nº ${s.num}</nav>
      <span class="label label--accent mt-2">Specimen Nº ${s.num} · ${esc(s.series)}</span>
      <div class="row-between">
        <h1 class="display">${esc(s.name)}<span class="dot">.</span></h1>
        <p class="lede" style="max-width:44ch">${esc(s.summary)}</p>
      </div>
    </div>
  </section>
  <section style="padding-bottom:120px">
    <div class="wrap spec-page">
      <div class="spec-figs">
        ${s.images.map((im, k) => `<figure><img src="${esc(im.src)}" alt="${esc(im.alt)}"${k ? ' loading="lazy"' : ' fetchpriority="high"'} class="${im.full ? 'full' : ''}"><figcaption class="mono-sm">${esc(im.alt)}</figcaption></figure>`).join('\n        ')}
      </div>
      <div class="spec-info">
        <div><span class="status" data-s="${esc(s.status)}">${esc(s.statusLabel)}</span></div>
        <div class="record"><header><span class="label">Specimen record</span><span class="label label--accent">Nº ${s.num}</span></header>
          <dl>${record.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div>
        ${s.note ? `<div><span class="label">${s.kind === 'commission' ? 'Client note' : 'Lab note'}</span><p class="note mt-1">“${esc(s.note)}”</p></div>` : ''}
        ${s.parts.length ? `<div><span class="label">Components · ${s.parts.length}</span>
          <ul class="parts mt-1">${s.parts.map((p, k) => `<li><b>${String(k + 1).padStart(2, '0')}</b>${esc(p)}</li>`).join('')}</ul></div>` : ''}
        ${buy}
      </div>
    </div>
  </section>
</main>
<footer data-site-foot></footer>
<script src="js/data.js?v=16"></script>
<script src="js/site.js?v=16"></script>
</body>
</html>
`;
  write(`specimen-${s.num}.html`, page);
}

/* ---------- catalogue index on the Archive (plain links crawlers can follow) ---------- */
const archive = read('archive.html');
const START = '<!-- catalogue:start -->', END = '<!-- catalogue:end -->';
if (archive.includes(START) && archive.includes(END)) {
  const list = specimens.length ? `
      <section class="catalogue mt-4" aria-labelledby="cat-h">
        <h2 class="label" id="cat-h">Catalogue index</h2>
        <ol>${specimens.map((s) => `
          <li><a href="specimen-${s.num}.html"><span class="c-num">Nº ${s.num}</span><span class="c-name">${esc(s.name)}</span><span class="c-meta">${esc([s.device, s.issued].filter(Boolean).join(' · '))}</span><span class="c-stat">${esc(s.statusLabel)}</span></a></li>`).join('')}
        </ol>
      </section>
      ` : '';
  write('archive.html', archive.slice(0, archive.indexOf(START) + START.length) + list + archive.slice(archive.indexOf(END)));
}

/* ---------- sitemap ---------- */
const urls = [['/', '1.0'], ['/archive', '0.9'], ['/submit', '0.9'], ['/practice', '0.6'],
  ...specimens.map((s) => [`/specimen-${s.num}`, forSale(s) ? '0.8' : '0.6'])];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, p]) => `  <url><loc>${BASE}${u}</loc><lastmod>${today}</lastmod><priority>${p}</priority></url>`).join('\n')}
</urlset>
`);
console.log(`search build: ${specimens.length} specimen page(s), sitemap with ${urls.length} URLs`);
