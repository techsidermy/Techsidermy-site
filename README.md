# Techsidermy Lab: website

Plain HTML, CSS and JavaScript. No build step and nothing to install.

```
index.html      Home: premise, featured specimens, the object, commission CTA
archive.html    The Archive (store): filterable specimen grid + detail panels
submit.html     Submissions: pricing, 6-step process, 4-step intake form, protocols
practice.html   The story, method, exhibition (Sedona) and series
css/site.css    The whole design system (colors, type, circuit components)
js/data.js      ← EDIT THIS to add specimens, prices, Stripe links
js/site.js      Shared header/footer, popups, connector traces, form logic
assets/img/     Images
```

## Preview on your Mac

```bash
cd ~/Documents/techsidermy-site
python3 -m http.server 8000
```
Then open http://localhost:8000. Press Ctrl+C in the terminal to stop.

## Put it online (Netlify, free)

**Easiest:** go to https://app.netlify.com/drop and drag the `techsidermy-site` folder onto the page.

**From the terminal:**
```bash
cd ~/Documents/techsidermy-site
npx netlify-cli deploy --prod
```
Then connect your domain (e.g. techsidermy.com) under Site settings → Domain management.

## The intake form

The form is set up for **Netlify Forms**. Once deployed on Netlify, submissions (including the photo
upload) appear under *Forms* in your Netlify dashboard. Turn on email notifications there so each new
submission lands in your inbox. Previewing locally shows the confirmation screen, but nothing is sent.

## Selling from the Archive (Stripe)

1. In Stripe, create a **Payment Link** for the piece (or for a deposit).
2. Paste it into that specimen's `checkout: ''` field in `js/data.js`.
3. Set `status: 'available'` (or `'reserve'`) and a `price`.

Until a link is added, the button opens an email to techsidermy@gmail.com.

## Adding a specimen

Copy any block in `js/data.js`, change the number, name, status and images, and drop the images
into `assets/img/`. The Archive, the home page and the detail panels update automatically.

- `hidden: true` keeps a specimen out of the Archive until it's ready (0002, 0003, the NES set and
  the forthcoming series are already in the file, hidden). Flip it to `false` to publish one.
- `window.ARCHIVE_SLOTS` sets how many empty numbered drawers follow the real specimens. The last
  one always links to the intake queue. Lower it as the Archive fills.

## Before launch: placeholders to replace

- Contact email is techsidermy@gmail.com (search the files to change it)
- Stripe Payment Links in `js/data.js`
- Specimen Nº 0004 (Home Console) uses concept images; swap in real photos once it's built
- Pricing lives in `window.COMMISSION` at the bottom of `js/data.js`
