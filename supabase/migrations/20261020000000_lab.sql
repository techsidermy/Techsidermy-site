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
-- stage order: submitted, accepted, awaiting_device, received, dissection,
--              plate_ordered, mounting, framed, shipped, complete, declined
create table if not exists public.specimens (
  id            uuid primary key default gen_random_uuid(),
  num           text,                       -- Archive number, e.g. 0005 (set when accepted)
  device        text not null,              -- "Game Boy DMG-01"
  kind          text not null default 'commission' check (kind in ('commission','archive','series')),
  customer_name text,
  customer_email text,
  frame_size    text,                       -- S / M / L / XL
  device_type   text,                       -- from the intake form
  device_year   text,
  story         text,                       -- why it matters, from the intake form
  photo_url     text,
  submitted_on  date default current_date,
  accepted_on   date,
  stage         text not null default 'submitted' check (stage in (
                  'submitted','accepted','awaiting_device','received','dissection',
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
  -- Archive pieces (kind archive / series): sale + cost tracking
  sale_status   text not null default 'not_listed' check (sale_status in ('not_listed','available','reserved','sold','not_for_sale')),
  list_price    numeric(10,2),
  sold_price    numeric(10,2),
  sold_on       date,
  buyer         text,
  listed_on     date,
  edition       text,                       -- "1 of 1"
  location      text,                       -- studio, gallery, on loan
  checkout_url  text,                       -- Stripe Payment Link
  device_cost   numeric(10,2) not null default 0,  -- what the device cost you
  labor_hours   numeric(6,2)  not null default 0,
  overhead_override numeric(10,2),          -- leave empty to use the lab-wide overhead per piece
  ship_charged  numeric(10,2) not null default 0,  -- shipping the buyer paid
  ship_cost     numeric(10,2) not null default 0,  -- what shipping cost you
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Safe to re-run: bring an older specimens table up to date.
alter table public.specimens add column if not exists num text;
alter table public.specimens add column if not exists device text not null;
alter table public.specimens add column if not exists kind text not null default 'commission';
alter table public.specimens add column if not exists customer_name text;
alter table public.specimens add column if not exists customer_email text;
alter table public.specimens add column if not exists frame_size text;
alter table public.specimens add column if not exists device_type text;
alter table public.specimens add column if not exists device_year text;
alter table public.specimens add column if not exists story text;
alter table public.specimens add column if not exists photo_url text;
alter table public.specimens add column if not exists submitted_on date default current_date;
alter table public.specimens add column if not exists accepted_on date;
alter table public.specimens add column if not exists stage text not null default 'submitted';
alter table public.specimens add column if not exists price numeric(10,2);
alter table public.specimens add column if not exists paid numeric(10,2) not null default 0;
alter table public.specimens add column if not exists costs numeric(10,2) not null default 0;
alter table public.specimens add column if not exists due_on date;
alter table public.specimens add column if not exists received_on date;
alter table public.specimens add column if not exists shipped_on date;
alter table public.specimens add column if not exists tracking text;
alter table public.specimens add column if not exists note text;
alter table public.specimens add column if not exists internal text;
alter table public.specimens add column if not exists sale_status text not null default 'not_listed';
alter table public.specimens add column if not exists list_price numeric(10,2);
alter table public.specimens add column if not exists sold_price numeric(10,2);
alter table public.specimens add column if not exists sold_on date;
alter table public.specimens add column if not exists buyer text;
alter table public.specimens add column if not exists listed_on date;
alter table public.specimens add column if not exists edition text;
alter table public.specimens add column if not exists location text;
alter table public.specimens add column if not exists checkout_url text;
alter table public.specimens add column if not exists device_cost numeric(10,2) not null default 0;
alter table public.specimens add column if not exists labor_hours numeric(6,2)  not null default 0;
alter table public.specimens add column if not exists overhead_override numeric(10,2);
alter table public.specimens add column if not exists ship_charged numeric(10,2) not null default 0;
alter table public.specimens add column if not exists ship_cost numeric(10,2) not null default 0;
alter table public.specimens add column if not exists created_at timestamptz not null default now();
alter table public.specimens add column if not exists updated_at timestamptz not null default now();
alter table public.specimens drop constraint if exists specimens_stage_check;
update public.specimens set stage = 'submitted' where stage = 'queued';
update public.specimens set stage = 'accepted' where stage = 'confirmed';
alter table public.specimens add constraint specimens_stage_check check (stage in (
  'submitted','accepted','awaiting_device','received','dissection',
  'plate_ordered','mounting','framed','shipped','complete','declined'));
alter table public.specimens alter column stage set default 'submitted';
alter table public.specimens drop constraint if exists specimens_sale_status_check;
alter table public.specimens add constraint specimens_sale_status_check check (sale_status in ('not_listed','available','reserved','sold','not_for_sale'));

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

-- Lab-wide cost settings (one row).
create table if not exists public.lab_settings (
  id                int primary key default 1 check (id = 1),
  overhead_monthly  numeric(10,2) not null default 0,   -- rent, software, utilities, insurance…
  pieces_per_month  numeric(6,2)  not null default 4,   -- spreads overhead across pieces
  labor_rate        numeric(10,2) not null default 0,   -- your hourly rate, $0 to ignore labor
  fee_pct           numeric(5,2)  not null default 2.9, -- payment processing %
  fee_fixed         numeric(10,2) not null default 0.30 -- payment processing per sale
);
insert into public.lab_settings (id) values (1) on conflict do nothing;

-- Running list: things to buy and notes to self.
create table if not exists public.lab_notes (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'note' check (kind in ('buy','note')),
  body        text not null,
  done        boolean not null default false,
  created_at  timestamptz not null default now()
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
alter table public.lab_notes  enable row level security;
alter table public.lab_settings enable row level security;

drop policy if exists "lab only" on public.specimens;
create policy "lab only" on public.specimens for all to authenticated
  using (public.is_lab_admin()) with check (public.is_lab_admin());
drop policy if exists "lab only" on public.inventory;
create policy "lab only" on public.inventory for all to authenticated
  using (public.is_lab_admin()) with check (public.is_lab_admin());
drop policy if exists "lab only" on public.parts;
create policy "lab only" on public.parts for all to authenticated
  using (public.is_lab_admin()) with check (public.is_lab_admin());
drop policy if exists "lab only" on public.lab_notes;
create policy "lab only" on public.lab_notes for all to authenticated
  using (public.is_lab_admin()) with check (public.is_lab_admin());
drop policy if exists "lab only" on public.lab_settings;
create policy "lab only" on public.lab_settings for all to authenticated
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

-- ==========================================================================
-- CUSTOMER PORTAL (/status)
-- Clients sign in with an emailed link. They never touch the specimens table:
-- my_specimens() returns only safe columns for rows matching their email,
-- and they can read and add messages only on their own specimens.
-- ==========================================================================

create table if not exists public.specimen_messages (
  id           uuid primary key default gen_random_uuid(),
  specimen_id  uuid not null references public.specimens(id) on delete cascade,
  author       text not null check (author in ('client','lab')),
  body         text not null check (char_length(body) between 1 and 4000),
  seen         boolean not null default false,   -- lab has read a client message
  created_at   timestamptz not null default now()
);
create index if not exists specimen_messages_specimen on public.specimen_messages (specimen_id, created_at);

create or replace function public.owns_specimen(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.specimens
    where id = sid and stage <> 'declined'
      and lower(customer_email) = lower(auth.jwt() ->> 'email'));
$$;

create or replace function public.my_specimens()
returns table (id uuid, num text, device text, frame_size text, stage text, price numeric, paid numeric,
               submitted_on date, accepted_on date, received_on date, shipped_on date, due_on date, tracking text)
language sql stable security definer set search_path = public as $$
  select s.id, s.num, s.device, s.frame_size, s.stage, s.price, s.paid,
         s.submitted_on, s.accepted_on, s.received_on, s.shipped_on, s.due_on, s.tracking
  from public.specimens s
  where lower(s.customer_email) = lower(auth.jwt() ->> 'email') and s.stage <> 'declined'
  order by s.created_at desc;
$$;
revoke all on function public.my_specimens() from public, anon;
grant execute on function public.my_specimens() to authenticated;
revoke all on function public.owns_specimen(uuid) from public, anon;
grant execute on function public.owns_specimen(uuid) to authenticated;

alter table public.specimen_messages enable row level security;
drop policy if exists "lab only" on public.specimen_messages;
create policy "lab only" on public.specimen_messages for all to authenticated
  using (public.is_lab_admin()) with check (public.is_lab_admin());
drop policy if exists "client reads own" on public.specimen_messages;
create policy "client reads own" on public.specimen_messages for select to authenticated
  using (public.owns_specimen(specimen_id));
drop policy if exists "client writes own" on public.specimen_messages;
create policy "client writes own" on public.specimen_messages for insert to authenticated
  with check (author = 'client' and seen = false and public.owns_specimen(specimen_id));
