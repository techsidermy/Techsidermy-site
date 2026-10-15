# Techsidermy Lab: notes for Claude Code

Techsidermy dissects obsolete devices and preserves them as framed, numbered specimens (11 × 14 in white
wood shadowboxes; larger series pieces at 24 × 36). Tagline: "Specimens of obsolete technology."
Tone: clinical, museum-meets-gallery, quiet confidence. Based in Sedona, Arizona.

## Stack
Static HTML/CSS/JS. No framework, no build. Keep it that way unless asked.
Shared header and footer are injected by `js/site.js` (`data-site-head`, `data-site-foot`).
All specimen/store content comes from `js/data.js`.

## Design rules (keep consistent)
- White, low contrast. Tokens in `:root` of `css/site.css`. Accent `--accent: #E4531B` is a signal
  color: use it for one small mark per area (pads, the trailing period, active states), never large fills.
- Geometry is a circuit board: 90° traces only (no curves, no diagonals except short 45° jogs),
  square pads (never circles), 1–1.5 px hairlines, corner brackets for "inspection" framing.
- Type: IBM Plex Sans Condensed 600 uppercase for headings; IBM Plex Mono for UI/body;
  Courier Prime italic only for client notes.
- Headlines end with an orange period: `<span class="dot">.</span>`.
- Labels are small mono caps with wide tracking (`.label`).
- Popups slide in from the right and are linked to their trigger by an animated connector trace (`wire()`).
- Never use third-party brand logos or character art (Nintendo, Pokémon, Apple) in site graphics.

## Pages
index (home) · archive (store) · submit (commission intake) · practice (story/exhibition)
