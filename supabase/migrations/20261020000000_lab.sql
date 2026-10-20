-- ==========================================================================
-- TECHSIDERMY LAB: command center schema
-- Private tables for the /lab page. Only emails listed in lab_admins can
-- read or write anything. Customers get nothing yet; a customer status view
-- comes later (see the note at the bottom).
-- ==========================================================================

-- Who counts as the lab. Add or change emails here.
create table if not exists public.lab_admins (
  email text primary key
);
insert into public.lab_admins (email) values ('techsidermy@gmail.com')
  on conflict do nothing;

create or replace function public.is_lab_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.lab_admins where lower(email) = lower(auth.jwt() ->> 'email'));
$$;

-- Specimens: one row per piece, from intake queue to shipped.
-- stage order: queued, confirmed, awaiting_device, received, dissection,
--              plate_ordered, mounting, framed, shipped, complete, declined
create table if not exists public.specimens (
  id            uuid primary key default gen_random_uuid(),
  num           text,                       -- Archive number, e.g. 0005 (set when accepted)
  device        text not null,              -- "Game Boy DMG-01"
  kind          text not null default 'commission' check (kind in ('commission','archive','series')),
  customer_name text,
  customer_email text,
  frame_size    text,                       -- S / M / L / XL
  stage         text not null default 'queued' check (stage in (
                  'queued','confirmed','awaiting_device','received','dissection',
                  'plate_ordered','mounting','framed','shipped','complete','declined')),
  price         numeric(10,2),              -- agreed price
  paid          numeric(10,2) not null default 0,  -- money received so far
  costs         numeric(10,2) not null default 0,  -- materials + shipping spent on this piece
  due_on        date,
  received_on   date,
  shipped_on    date,
  tracking      text,
  note          text,                       -- client's note for the plate
  internal      text,                       -- private lab notes, never shown to customers
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Inventory: what's on the shelf.
create table if not exists public.inventory (
  id          uuid primary key default gen_random_uuid(),
  item        text not null,
  category    text not null default 'Supplies',
  qty         numeric(10,2) not null default 0,
  unit        text not null default 'ea',
  reorder_at  numeric(10,2),                -- flag low stock at or below this
  location    text,
  notes       text,
  updated_at  timestamptz not null default now()
);

-- Parts list: what to buy to build a plate.
create table if not exists public.parts (
  id          uuid primary key default gen_random_uuid(),
  section     text not null,
  item        text not null,
  pick        text,
  price       numeric(10,2),
  per_piece   boolean not null default false,
  url         text,
  bought      boolean not null default false,
  sort        int not null default 0,
  updated_at  timestamptz not null default now()
);

-- keep updated_at current
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists specimens_touch on public.specimens;
create trigger specimens_touch before update on public.specimens for each row execute function public.touch_updated_at();
drop trigger if exists inventory_touch on public.inventory;
create trigger inventory_touch before update on public.inventory for each row execute function public.touch_updated_at();
drop trigger if exists parts_touch on public.parts;
create trigger parts_touch before update on public.parts for each row execute function public.touch_updated_at();

-- Row level security: lab admins only.
alter table public.lab_admins enable row level security;
alter table public.specimens  enable row level security;
alter table public.inventory  enable row level security;
alter table public.parts      enable row level security;

drop policy if exists "lab only" on public.specimens;
create policy "lab only" on public.specimens for all to authenticated
  using (public.is_lab_admin()) with check (public.is_lab_admin());
drop policy if exists "lab only" on public.inventory;
create policy "lab only" on public.inventory for all to authenticated
  using (public.is_lab_admin()) with check (public.is_lab_admin());
drop policy if exists "lab only" on public.parts;
create policy "lab only" on public.parts for all to authenticated
  using (public.is_lab_admin()) with check (public.is_lab_admin());
drop policy if exists "lab reads admins" on public.lab_admins;
create policy "lab reads admins" on public.lab_admins for select to authenticated
  using (public.is_lab_admin());

-- Seed the parts list (only if empty).
insert into public.parts (section, item, pick, price, per_piece, url, sort)
select * from (values
  ('Teardown','Precision driver + bits','iFixit Mako, 64 bits incl. Tri-wing and 3.8 / 4.5mm Gamebit. Lid doubles as the parts tray.',40.00,false,null,10),
  ('Teardown','Spudgers + pry tools','iFixit Prying & Opening Tool Assortment',9.99,false,'https://sandbox.injuredgadgets.com/ifixit-prying-opening-tool-assortment/',20),
  ('Teardown','Anti-static mat + wrist strap','iFixit Portable Anti-Static Mat, strap included',34.95,false,'https://www.ifixit.com/Store/Tools/Portable-Anti-Static-Mat/IF145-202',30),
  ('Teardown','Isopropyl alcohol 99%','ForPro 99% IPA, 32 oz',9.99,false,'https://www.walmart.com/c/kp/ipa-for-cleaning',40),
  ('Plate','Plate print on 2mm styrene','Bay Photo 11×14 Lustre + 2mm white styrene mount',15.55,true,'https://bayphoto.com/prints/photographic-prints',50),
  ('Plate','Tempered hardboard','1/8" × 2×4 ft panel, cuts 6 plates',14.57,false,'https://homedepot.com/p/1-8-in-x-2-ft-x-4-ft-Hardboard-Tempered-7005015/203444173',60),
  ('Plate','Sheet adhesive','Pressure-sensitive mounting adhesive sheets, 25/box',null,true,'https://www.mybinding.com/products/pressure-sensitive-mounting-adhesive-sheets',70),
  ('Mounting','Acrylic rod, 3mm','Uxcell clear round rod, 25 × 300mm',9.99,false,'https://www.walmart.com/ip/17500005781',80),
  ('Mounting','Acrylic rod, 6mm','Uxcell clear round rod, 30 × 300mm',20.69,false,'https://www.walmart.com/ip/6mmx6mmx10-Acrylic-plexiglass-rod-Square-Clear-Acrylic-Plastic-Rod-PMMA-Bar-3-pcs/605636309',90),
  ('Mounting','Rod cutter or fine-tooth saw + sandpaper','Razor saw or flush cutter, 400–600 grit',null,false,null,100),
  ('Mounting','Clear 2-part epoxy','Gorilla Epoxy, clear, 0.85 oz',5.13,true,'https://www.bluedogink.com/gorilla-epoxy-0-85-oz-dries-clear-4200101.html',110),
  ('Mounting','Mixing cups, toothpicks, nitrile gloves','Any hardware or craft store',null,false,null,120),
  ('Mounting','Steel ruler + fine pencil','For marking part positions',null,false,null,130),
  ('Frame','11×14 shadowbox, 2.5" usable depth','Acrylic front, hanging hardware included. Not settled yet.',null,true,null,140),
  ('Finishing','Acrylic cleaner + microfiber','NOVUS #1 Clean & Shine, 8 oz',8.81,false,'https://marketingholders.com/products/novus-1-clean-shine-8-oz-bottle-of-plastic-polish',150),
  ('Finishing','Specimen ID label','Printed label for the frame back',null,true,null,160)
) as v(section,item,pick,price,per_piece,url,sort)
where not exists (select 1 from public.parts);

-- LATER: customer status. Add a view that exposes only safe columns
-- (num, device, stage, shipped_on, tracking) filtered to
-- lower(customer_email) = lower(auth.jwt() ->> 'email'), and grant select on it.
-- Never expose the specimens table itself (it holds internal notes and money).
