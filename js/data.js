/* ==========================================================================
   THE ARCHIVE: every specimen lives here.
   To add a specimen, copy one block and edit it. The Archive page builds
   itself from this list.

   status:   available | reserve | dissection | transit | private | forthcoming
   checkout: paste a Stripe Payment Link (https://buy.stripe.com/...) for
             pieces that are for sale. Leave '' for anything not for sale.
   images:   first image is the card cover. Add `full: true` for photos that
             should fill the frame (wall shots, plates) instead of cut-outs.
   ========================================================================== */

window.SPECIMENS = [
  {
    num: '0004',
    hidden: true,            // ← set to false to show in the Archive
    name: 'Home Console',
    series: 'Series 01',
    device: 'Control Deck NES-001 · Controller NES-004 · Cartridge',
    issued: '1985',
    origin: 'Arizona, USA',
    status: 'reserve',
    statusLabel: 'Reservations open',
    kind: 'edition',
    price: 850,
    size: '24 × 36 in · white wood · 3 in deep',
    edition: '1 of 1',
    checkout: '',            // ← Stripe Payment Link for the reservation deposit
    note: 'Blow on it. Try again.',
    summary: 'A complete home console system (deck, controller and game) dissected to the last screw and preserved at 1:1 on a single plate. The first specimen in Series 01.',
    parts: ['Top shell', 'Base shell', 'Main board · RP2A03 / RP2C02', '72-pin tray', 'Power · RF', 'Cartridge door', 'Controller ports', 'Cartridge shell', 'Game board · PRG / CHR', 'Controller', 'Controller board · 4021', 'Screws · 24'],
    images: [
      { src: 'assets/img/0004-wall.jpg', alt: 'Series 01 Home Console specimen hanging above a sofa', full: true },
      { src: 'assets/img/0004-plate.webp', alt: 'Series 01 plate layout with all console parts', full: true }
    ]
  },
  {
    num: '0001',
    name: 'iPhone SE',
    series: 'Commission',
    device: 'iPhone SE · 2nd generation',
    issued: '2020',
    origin: 'Kansas, USA',
    status: 'dissection',
    statusLabel: 'In dissection',
    kind: 'commission',
    price: null,
    size: '11 × 14 in · white wood',
    edition: 'Private client',
    checkout: '',
    note: 'Some things are better off left behind.',
    summary: 'Received from a private client in Kansas. Twelve components, mounted at 1:1.',
    parts: ['Display', 'Housing', 'Logic board', 'Battery', 'Taptic engine', 'Loudspeaker', 'Rear camera', 'Front camera', 'Touch ID', 'Lightning flex', 'SIM tray', 'Screws'],
    images: [
      { src: 'assets/img/0001-blueprint.webp', alt: 'Specimen 0001 blueprint: every component outlined at 1:1' },
      { src: 'assets/img/0001-plate.webp', alt: 'Specimen 0001 plate with mounted iPhone components' },
      { src: 'assets/img/0001-device.webp', alt: 'The iPhone SE as received' }
    ]
  },
  {
    num: '0002',
    hidden: true,            // ← set to false to show in the Archive
    name: 'N64 Controller',
    series: 'Commission',
    device: 'Controller NUS-005 · Atomic Purple',
    issued: '1996',
    origin: 'Michigan, USA',
    status: 'transit',
    statusLabel: 'In transit',
    kind: 'commission',
    price: null,
    size: '11 × 14 in · white wood',
    edition: 'Private client',
    checkout: '',
    note: '',
    summary: 'A translucent Atomic Purple controller en route from Michigan. Up next on the bench.',
    parts: ['L button', 'D-pad', 'Start', 'Control stick', 'R button', 'C buttons', 'A / B buttons', 'Shell'],
    images: [ { src: 'assets/img/0002-device.webp', alt: 'Nintendo 64 controller, translucent purple' } ]
  },
  {
    num: '0003',
    hidden: true,            // ← set to false to show in the Archive
    name: 'Game Boy',
    series: 'Commission',
    device: 'Game Boy DMG-01',
    issued: '1989',
    origin: 'Michigan, USA',
    status: 'transit',
    statusLabel: 'Awaiting intake',
    kind: 'commission',
    price: null,
    size: '11 × 14 in · white wood',
    edition: 'Private client',
    checkout: '',
    note: '',
    summary: 'The original handheld. Awaiting arrival from Michigan.',
    parts: ['Power switch', 'Power LED', 'Dot matrix display', 'D-pad', 'A / B buttons', 'Select / Start', 'Speaker grille'],
    images: [ { src: 'assets/img/0003-device.webp', alt: 'Original Game Boy DMG-01' } ]
  },
  {
    num: '00XX',
    hidden: true,
    name: 'Handheld',
    series: 'Series 02',
    device: 'Forthcoming',
    issued: '',
    origin: '',
    status: 'forthcoming',
    statusLabel: 'Forthcoming',
    kind: 'edition',
    price: null,
    size: '11 × 14 in',
    edition: 'Small run',
    checkout: '',
    note: '',
    summary: 'A run of special-edition handhelds, catalogued as a set.',
    parts: [],
    images: []
  },
  {
    num: '00XX',
    hidden: true,
    name: 'Sport',
    series: 'Series 03',
    device: 'Forthcoming',
    issued: '',
    origin: '',
    status: 'forthcoming',
    statusLabel: 'Forthcoming',
    kind: 'edition',
    price: null,
    size: '11 × 14 in',
    edition: 'Small run',
    checkout: '',
    note: '',
    summary: 'Waterproof, shockproof, yellow. Portable audio built for the outdoors, preserved.',
    parts: [],
    images: []
  }
];

/* Empty, numbered drawers shown after the real specimens: the Archive's
   "still being filled" state. Lower this as real specimens are added. */
window.ARCHIVE_SLOTS = 5;

/* Commission pricing, shown on the Submit page */
window.COMMISSION = {
  price: 249,
  regular: 375,
  founding: 'Founding rate · first 10 specimens',
  returnShipping: 'Insured return shipping billed separately',
  turnaround: '3–4 weeks from intake',
  queue: 'Intake queue open · spots held in order received',
  checkout: ''   // ← optional Stripe Payment Link for the 50% deposit
};
