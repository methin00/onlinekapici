create extension if not exists "pgcrypto";

do $$ begin create type app_role as enum ('super_admin', 'consultant', 'manager', 'resident', 'kiosk_device'); exception when duplicate_object then null; end $$;
do $$ begin create type guest_request_type as enum ('guest', 'courier', 'service'); exception when duplicate_object then null; end $$;
do $$ begin create type guest_request_status as enum ('pending', 'approved', 'rejected', 'redirected'); exception when duplicate_object then null; end $$;
do $$ begin create type invoice_status as enum ('paid', 'unpaid', 'overdue'); exception when duplicate_object then null; end $$;
do $$ begin create type package_status as enum ('at_desk', 'on_the_way', 'delivered'); exception when duplicate_object then null; end $$;
do $$ begin create type provider_category as enum ('Temizlik', 'Elektrik', 'Tesisat', 'Asansör', 'Nakliyat', 'Peyzaj'); exception when duplicate_object then null; end $$;
do $$ begin create type access_pass_type as enum ('qr'); exception when duplicate_object then null; end $$;
do $$ begin create type access_pass_status as enum ('active', 'used', 'expired'); exception when duplicate_object then null; end $$;
do $$ begin create type notification_tone as enum ('info', 'success', 'warning', 'danger'); exception when duplicate_object then null; end $$;
do $$ begin create type emergency_status as enum ('open', 'closed'); exception when duplicate_object then null; end $$;

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  district text not null,
  city text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.buildings (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  name text not null,
  address text not null,
  api_key text not null,
  door_label text not null,
  kiosk_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  unit_code text not null,
  unit_number text not null,
  floor integer not null,
  created_at timestamptz not null default now(),
  unique (unit_code),
  unique (building_id, unit_number)
);

alter table public.units
  add column if not exists unit_code text;

create or replace function public.code_fragment(value text, fragment_length integer, fallback text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(
      left(
        regexp_replace(
          translate(upper(coalesce(value, '')), 'ÇĞİIÖŞÜ', 'CGIIOSU'),
          '[^A-Z0-9]+',
          '',
          'g'
        ),
        greatest(fragment_length, 1)
      ),
      ''
    ),
    fallback
  );
$$;

with base_codes as (
  select
    units.id,
    public.code_fragment(sites.city, 3, 'CTY')
    || '-' ||
    public.code_fragment(sites.district, 3, 'DST')
    || '-' ||
    public.code_fragment(sites.name, 4, 'SITE')
    || '-' ||
    public.code_fragment(buildings.name, 3, 'BLK')
    || '-' ||
    case
      when regexp_replace(units.unit_number, '[^0-9]+', '', 'g') <> '' then
        lpad(right(regexp_replace(units.unit_number, '[^0-9]+', '', 'g'), 3), 3, '0')
      else public.code_fragment(units.unit_number, 3, '001')
    end as base_code
  from public.units
  join public.buildings on buildings.id = units.building_id
  join public.sites on sites.id = buildings.site_id
),
numbered_codes as (
  select
    id,
    case
      when row_number() over (partition by base_code order by id) = 1 then base_code
      else base_code || '-' || row_number() over (partition by base_code order by id)
    end as generated_code
  from base_codes
)
update public.units
set unit_code = numbered_codes.generated_code
from numbered_codes
where public.units.id = numbered_codes.id
  and (
    public.units.unit_code is null
    or public.units.unit_code = ''
  );

alter table public.units
  alter column unit_code set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'units_unit_code_key'
      and conrelid = 'public.units'::regclass
  ) then
    alter table public.units
      add constraint units_unit_code_key unique (unit_code);
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  primary_building_id uuid references public.buildings(id) on delete set null,
  full_name text not null,
  role app_role not null,
  phone text not null,
  title text not null,
  login_id text not null unique,
  created_at timestamptz not null default now()
);

update public.profiles
set login_id = units.unit_code
from public.units
where public.profiles.unit_id = units.id
  and public.profiles.role in ('resident', 'manager')
  and public.profiles.login_id is distinct from units.unit_code;

create table if not exists public.resident_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  away_mode_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.manager_site_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, site_id)
);

create table if not exists public.consultant_site_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, site_id)
);

create table if not exists public.guest_requests (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  guest_name text not null,
  type guest_request_type not null,
  status guest_request_status not null default 'pending',
  expires_at timestamptz not null default (now() + interval '2 minutes'),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  last_action_by text
);

create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  event_details text not null,
  timestamp timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  title text not null,
  summary text not null,
  category text not null,
  pinned boolean not null default false,
  published_at timestamptz not null default now()
);

create table if not exists public.announcement_reads (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  unique (announcement_id, profile_id)
);

create table if not exists public.site_invoice_plans (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  amount numeric(12, 2) not null,
  due_day integer not null check (due_day between 1 and 28),
  active boolean not null default true,
  start_month date not null default date_trunc('month', now())::date,
  last_generated_period date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id)
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  period_label text not null,
  amount numeric(12, 2) not null,
  due_date date not null,
  status invoice_status not null default 'unpaid',
  paid_at timestamptz
);

create table if not exists public.payment_records (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  amount numeric(12, 2) not null,
  recorded_at timestamptz not null default now(),
  recorded_by text not null
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'payment_records_invoice_id_key'
      and conrelid = 'public.payment_records'::regclass
  ) then
    alter table public.payment_records
      add constraint payment_records_invoice_id_key unique (invoice_id);
  end if;
end $$;

create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  courier_name text not null,
  tracking_code text not null,
  status package_status not null default 'at_desk',
  arrived_at timestamptz not null default now(),
  delivered_at timestamptz
);

create table if not exists public.package_events (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.service_providers (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  category provider_category not null,
  full_name text not null,
  phone text not null,
  note text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.access_passes (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  holder_name text not null,
  type access_pass_type not null,
  access_code text not null,
  status access_pass_status not null default 'active',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.access_passes
  add column if not exists access_code text;

update public.access_passes
set type = 'qr'
where type::text <> 'qr';

update public.access_passes
set access_code = upper(access_code)
where access_code is not null
  and access_code <> upper(access_code);

with numbered_passes as (
  select
    id,
    substring(upper(replace(gen_random_uuid()::text, '-', '')) from 1 for 6) as generated_code
  from public.access_passes
  where access_code is null
     or access_code !~ '^[A-Z0-9]{6}$'
)
update public.access_passes
set access_code = numbered_passes.generated_code
from numbered_passes
where public.access_passes.id = numbered_passes.id;

alter table public.access_passes
  alter column access_code set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'access_passes_access_code_key'
      and conrelid = 'public.access_passes'::regclass
  ) then
    alter table public.access_passes
      add constraint access_passes_access_code_key unique (access_code);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'access_passes_qr_only_check'
      and conrelid = 'public.access_passes'::regclass
  ) then
    alter table public.access_passes
      add constraint access_passes_qr_only_check check (type::text = 'qr');
  end if;
end $$;

alter table public.access_passes
  drop constraint if exists access_passes_access_code_check;

alter table public.access_passes
  add constraint access_passes_access_code_check check (access_code ~ '^[A-Z0-9]{6}$');

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  tone notification_tone not null default 'info',
  created_at timestamptz not null default now()
);

create table if not exists public.gate_events (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  request_id uuid references public.guest_requests(id) on delete set null,
  source text not null,
  result text not null,
  actor_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.emergency_alerts (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  title text not null,
  status emergency_status not null default 'open',
  created_at timestamptz not null default now()
);

alter table public.sites enable row level security;
alter table public.buildings enable row level security;
alter table public.units enable row level security;
alter table public.profiles enable row level security;
alter table public.resident_preferences enable row level security;
alter table public.manager_site_assignments enable row level security;
alter table public.consultant_site_assignments enable row level security;
alter table public.guest_requests enable row level security;
alter table public.logs enable row level security;
alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;
alter table public.site_invoice_plans enable row level security;
alter table public.invoices enable row level security;
alter table public.payment_records enable row level security;
alter table public.packages enable row level security;
alter table public.package_events enable row level security;
alter table public.service_providers enable row level security;
alter table public.access_passes enable row level security;
alter table public.notifications enable row level security;
alter table public.gate_events enable row level security;
alter table public.emergency_alerts enable row level security;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'super_admin'
  );
$$;

create or replace function public.is_resident_for_unit(target_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'resident'
      and unit_id = target_unit_id
  );
$$;

create or replace function public.is_resident_for_building(target_building_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    join public.units on units.id = profiles.unit_id
    where profiles.id = auth.uid()
      and profiles.role = 'resident'
      and units.building_id = target_building_id
  );
$$;

create or replace function public.is_kiosk_for_building(target_building_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'kiosk_device'
      and primary_building_id = target_building_id
  );
$$;

create or replace function public.can_manage_site(target_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_super_admin()
    or exists (
      select 1
      from public.manager_site_assignments
      where profile_id = auth.uid()
        and site_id = target_site_id
    )
    or exists (
      select 1
      from public.consultant_site_assignments
      where profile_id = auth.uid()
        and site_id = target_site_id
    );
$$;

create or replace function public.can_access_site(target_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.can_manage_site(target_site_id)
    or exists (
      select 1
      from public.profiles
      join public.units on units.id = profiles.unit_id
      join public.buildings on buildings.id = units.building_id
      where profiles.id = auth.uid()
        and profiles.role = 'resident'
        and buildings.site_id = target_site_id
    )
    or exists (
      select 1
      from public.profiles
      join public.buildings on buildings.id = profiles.primary_building_id
      where profiles.id = auth.uid()
        and profiles.role = 'kiosk_device'
        and buildings.site_id = target_site_id
    );
$$;

create or replace function public.can_manage_building(target_building_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.buildings
    where id = target_building_id
      and public.can_manage_site(site_id)
  );
$$;

create or replace function public.can_manage_unit(target_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.units
    join public.buildings on buildings.id = units.building_id
    where units.id = target_unit_id
      and public.can_manage_site(buildings.site_id)
  );
$$;

create or replace function public.can_access_resident_preference(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() = target_profile_id
    or public.is_super_admin()
    or exists (
      select 1
      from public.profiles
      join public.units on units.id = profiles.unit_id
      join public.buildings on buildings.id = units.building_id
      where profiles.id = target_profile_id
        and (
          public.can_manage_site(buildings.site_id)
          or public.is_kiosk_for_building(buildings.id)
        )
    );
$$;

drop policy if exists "sites_select_access" on public.sites;
create policy "sites_select_access"
on public.sites
for select
using (public.can_access_site(id));

drop policy if exists "sites_update_super_admin" on public.sites;
create policy "sites_update_super_admin"
on public.sites
for update
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "buildings_select_access" on public.buildings;
create policy "buildings_select_access"
on public.buildings
for select
using (
  public.can_manage_site(site_id)
  or public.is_resident_for_building(id)
  or public.is_kiosk_for_building(id)
);

drop policy if exists "buildings_update_super_admin" on public.buildings;
create policy "buildings_update_super_admin"
on public.buildings
for update
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "units_select_access" on public.units;
create policy "units_select_access"
on public.units
for select
using (
  public.can_manage_unit(id)
  or public.is_resident_for_unit(id)
  or public.is_kiosk_for_building(building_id)
);

drop policy if exists "profiles_select_access" on public.profiles;
create policy "profiles_select_access"
on public.profiles
for select
using (
  id = auth.uid()
  or public.is_super_admin()
  or exists (
    select 1
    from public.units
    join public.buildings on buildings.id = units.building_id
    where units.id = profiles.unit_id
      and (
        public.can_manage_site(buildings.site_id)
        or public.is_kiosk_for_building(buildings.id)
      )
  )
  or exists (
    select 1
    from public.manager_site_assignments
    where profile_id = profiles.id
      and public.can_manage_site(site_id)
  )
  or exists (
    select 1
    from public.consultant_site_assignments
    where profile_id = profiles.id
      and public.can_manage_site(site_id)
  )
  or exists (
    select 1
    from public.buildings
    where id = profiles.primary_building_id
      and public.can_manage_site(site_id)
  )
);

drop policy if exists "resident_preferences_select_access" on public.resident_preferences;
create policy "resident_preferences_select_access"
on public.resident_preferences
for select
using (public.can_access_resident_preference(profile_id));

drop policy if exists "resident_preferences_insert_self" on public.resident_preferences;
create policy "resident_preferences_insert_self"
on public.resident_preferences
for insert
with check (
  profile_id = auth.uid()
  and exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'resident'
  )
);

drop policy if exists "resident_preferences_update_self" on public.resident_preferences;
create policy "resident_preferences_update_self"
on public.resident_preferences
for update
using (
  profile_id = auth.uid()
  and exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'resident'
  )
)
with check (
  profile_id = auth.uid()
  and exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'resident'
  )
);

drop policy if exists "manager_assignments_select_self" on public.manager_site_assignments;
create policy "manager_assignments_select_self"
on public.manager_site_assignments
for select
using (
  profile_id = auth.uid()
  or public.can_manage_site(site_id)
);

drop policy if exists "consultant_assignments_select_self" on public.consultant_site_assignments;
create policy "consultant_assignments_select_self"
on public.consultant_site_assignments
for select
using (
  profile_id = auth.uid()
  or public.can_manage_site(site_id)
);

drop policy if exists "guest_requests_select_access" on public.guest_requests;
create policy "guest_requests_select_access"
on public.guest_requests
for select
using (
  public.is_super_admin()
  or public.is_resident_for_unit(unit_id)
  or public.is_kiosk_for_building(building_id)
  or public.can_manage_building(building_id)
);

drop policy if exists "guest_requests_insert_kiosk" on public.guest_requests;
create policy "guest_requests_insert_kiosk"
on public.guest_requests
for insert
with check (
  public.is_kiosk_for_building(building_id)
);

drop policy if exists "guest_requests_update_access" on public.guest_requests;
create policy "guest_requests_update_access"
on public.guest_requests
for update
using (
  public.is_super_admin()
  or public.is_resident_for_unit(unit_id)
  or public.can_manage_building(building_id)
)
with check (
  public.is_super_admin()
  or public.is_resident_for_unit(unit_id)
  or public.can_manage_building(building_id)
);

drop policy if exists "logs_select_access" on public.logs;
create policy "logs_select_access"
on public.logs
for select
using (
  public.is_super_admin()
  or public.can_manage_building(building_id)
  or public.is_kiosk_for_building(building_id)
);

drop policy if exists "logs_insert_access" on public.logs;
create policy "logs_insert_access"
on public.logs
for insert
with check (
  public.is_super_admin()
  or public.can_manage_building(building_id)
  or public.is_kiosk_for_building(building_id)
  or public.is_resident_for_building(building_id)
);

drop policy if exists "announcements_select_access" on public.announcements;
create policy "announcements_select_access"
on public.announcements
for select
using (public.can_access_site(site_id));

drop policy if exists "announcements_manage_access" on public.announcements;
create policy "announcements_manage_access"
on public.announcements
for insert
with check (public.can_manage_site(site_id));

drop policy if exists "announcements_update_access" on public.announcements;
create policy "announcements_update_access"
on public.announcements
for update
using (public.can_manage_site(site_id))
with check (public.can_manage_site(site_id));

drop policy if exists "announcement_reads_select_self" on public.announcement_reads;
create policy "announcement_reads_select_self"
on public.announcement_reads
for select
using (profile_id = auth.uid());

drop policy if exists "announcement_reads_insert_self" on public.announcement_reads;
create policy "announcement_reads_insert_self"
on public.announcement_reads
for insert
with check (profile_id = auth.uid());

drop policy if exists "site_invoice_plans_select_access" on public.site_invoice_plans;
create policy "site_invoice_plans_select_access"
on public.site_invoice_plans
for select
using (public.can_manage_site(site_id));

drop policy if exists "site_invoice_plans_manage_access" on public.site_invoice_plans;
create policy "site_invoice_plans_manage_access"
on public.site_invoice_plans
for insert
with check (public.can_manage_site(site_id));

drop policy if exists "site_invoice_plans_update_access" on public.site_invoice_plans;
create policy "site_invoice_plans_update_access"
on public.site_invoice_plans
for update
using (public.can_manage_site(site_id))
with check (public.can_manage_site(site_id));

drop policy if exists "invoices_select_access" on public.invoices;
create policy "invoices_select_access"
on public.invoices
for select
using (
  public.is_super_admin()
  or public.can_manage_unit(unit_id)
  or public.is_resident_for_unit(unit_id)
);

drop policy if exists "invoices_update_access" on public.invoices;
create policy "invoices_update_access"
on public.invoices
for update
using (
  public.is_super_admin()
  or public.can_manage_unit(unit_id)
)
with check (
  public.is_super_admin()
  or public.can_manage_unit(unit_id)
);

drop policy if exists "payment_records_select_access" on public.payment_records;
create policy "payment_records_select_access"
on public.payment_records
for select
using (
  public.is_super_admin()
  or public.can_manage_unit(unit_id)
  or public.is_resident_for_unit(unit_id)
);

drop policy if exists "payment_records_insert_access" on public.payment_records;
create policy "payment_records_insert_access"
on public.payment_records
for insert
with check (
  public.is_super_admin()
  or public.can_manage_unit(unit_id)
);

drop policy if exists "payment_records_update_access" on public.payment_records;
create policy "payment_records_update_access"
on public.payment_records
for update
using (
  public.is_super_admin()
  or public.can_manage_unit(unit_id)
)
with check (
  public.is_super_admin()
  or public.can_manage_unit(unit_id)
);

drop policy if exists "payment_records_delete_access" on public.payment_records;
create policy "payment_records_delete_access"
on public.payment_records
for delete
using (
  public.is_super_admin()
  or public.can_manage_unit(unit_id)
);

drop policy if exists "packages_select_access" on public.packages;
create policy "packages_select_access"
on public.packages
for select
using (
  public.is_super_admin()
  or public.can_manage_unit(unit_id)
  or public.is_resident_for_unit(unit_id)
  or exists (
    select 1
    from public.units
    where units.id = packages.unit_id
      and public.is_kiosk_for_building(units.building_id)
  )
);

drop policy if exists "packages_insert_access" on public.packages;
create policy "packages_insert_access"
on public.packages
for insert
with check (
  public.is_super_admin()
  or public.can_manage_unit(unit_id)
  or exists (
    select 1
    from public.units
    where units.id = packages.unit_id
      and public.is_kiosk_for_building(units.building_id)
  )
);

drop policy if exists "packages_update_access" on public.packages;
create policy "packages_update_access"
on public.packages
for update
using (
  public.is_super_admin()
  or public.can_manage_unit(unit_id)
  or public.is_resident_for_unit(unit_id)
)
with check (
  public.is_super_admin()
  or public.can_manage_unit(unit_id)
  or public.is_resident_for_unit(unit_id)
);

drop policy if exists "package_events_select_access" on public.package_events;
create policy "package_events_select_access"
on public.package_events
for select
using (
  public.is_super_admin()
  or exists (
    select 1
    from public.packages
    where packages.id = package_events.package_id
      and (
        public.can_manage_unit(packages.unit_id)
        or public.is_resident_for_unit(packages.unit_id)
      )
  )
);

drop policy if exists "package_events_insert_access" on public.package_events;
create policy "package_events_insert_access"
on public.package_events
for insert
with check (
  public.is_super_admin()
  or exists (
    select 1
    from public.packages
    where packages.id = package_events.package_id
      and public.can_manage_unit(packages.unit_id)
  )
);

drop policy if exists "service_providers_select_access" on public.service_providers;
create policy "service_providers_select_access"
on public.service_providers
for select
using (public.can_access_site(site_id));

drop policy if exists "service_providers_manage_access" on public.service_providers;
create policy "service_providers_manage_access"
on public.service_providers
for insert
with check (public.can_manage_site(site_id));

drop policy if exists "service_providers_update_access" on public.service_providers;
create policy "service_providers_update_access"
on public.service_providers
for update
using (public.can_manage_site(site_id))
with check (public.can_manage_site(site_id));

drop policy if exists "access_passes_select_access" on public.access_passes;
create policy "access_passes_select_access"
on public.access_passes
for select
using (
  public.is_super_admin()
  or public.can_manage_unit(unit_id)
  or public.is_resident_for_unit(unit_id)
  or exists (
    select 1
    from public.units
    where units.id = access_passes.unit_id
      and public.is_kiosk_for_building(units.building_id)
  )
);

drop policy if exists "access_passes_insert_access" on public.access_passes;
create policy "access_passes_insert_access"
on public.access_passes
for insert
with check (
  public.is_super_admin()
  or public.can_manage_unit(unit_id)
  or public.is_resident_for_unit(unit_id)
);

drop policy if exists "access_passes_update_access" on public.access_passes;
create policy "access_passes_update_access"
on public.access_passes
for update
using (
  public.is_super_admin()
  or public.can_manage_unit(unit_id)
  or public.is_resident_for_unit(unit_id)
  or exists (
    select 1
    from public.units
    where units.id = access_passes.unit_id
      and public.is_kiosk_for_building(units.building_id)
  )
)
with check (
  public.is_super_admin()
  or public.can_manage_unit(unit_id)
  or public.is_resident_for_unit(unit_id)
  or exists (
    select 1
    from public.units
    where units.id = access_passes.unit_id
      and public.is_kiosk_for_building(units.building_id)
  )
);

drop policy if exists "notifications_select_self" on public.notifications;
create policy "notifications_select_self"
on public.notifications
for select
using (profile_id = auth.uid());

drop policy if exists "gate_events_select_access" on public.gate_events;
create policy "gate_events_select_access"
on public.gate_events
for select
using (
  public.is_super_admin()
  or public.can_manage_building(building_id)
  or public.is_resident_for_building(building_id)
  or public.is_kiosk_for_building(building_id)
);

drop policy if exists "gate_events_insert_access" on public.gate_events;
create policy "gate_events_insert_access"
on public.gate_events
for insert
with check (
  public.is_super_admin()
  or public.can_manage_building(building_id)
  or public.is_resident_for_building(building_id)
  or public.is_kiosk_for_building(building_id)
);

drop policy if exists "emergency_alerts_select_access" on public.emergency_alerts;
create policy "emergency_alerts_select_access"
on public.emergency_alerts
for select
using (public.can_access_site(site_id));

drop policy if exists "emergency_alerts_manage_access" on public.emergency_alerts;
create policy "emergency_alerts_manage_access"
on public.emergency_alerts
for insert
with check (public.can_manage_site(site_id));

drop policy if exists "emergency_alerts_update_access" on public.emergency_alerts;
create policy "emergency_alerts_update_access"
on public.emergency_alerts
for update
using (public.can_manage_site(site_id))
with check (public.can_manage_site(site_id));

create or replace function public.handle_guest_request_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resident_profile_id uuid;
  request_label text;
begin
  select id
  into resident_profile_id
  from public.profiles
  where role = 'resident'
    and unit_id = new.unit_id
  limit 1;

  request_label := case new.type
    when 'guest' then 'Misafir'
    when 'courier' then 'Kurye'
    else 'Teknik servis'
  end;

  if tg_op = 'INSERT' then
    insert into public.logs (building_id, event_details, timestamp)
    values (new.building_id, new.guest_name || ' için yeni çağrı bırakıldı.', new.created_at);

    if resident_profile_id is not null then
      insert into public.notifications (profile_id, title, body, tone, created_at)
      values (
        resident_profile_id,
        'Kapıda sizi bekleyen biri var',
        request_label || ' için ' || new.guest_name || ' adına onay bekleniyor.',
        'warning'::public.notification_tone,
        new.created_at
      );
    end if;

    return new;
  end if;

  if old.status is distinct from new.status then
    insert into public.logs (building_id, event_details, timestamp)
    values (
      new.building_id,
      case new.status
        when 'approved' then new.guest_name || ' için kapı açıldı.'
        when 'rejected' then new.guest_name || ' çağrısı sonlandırıldı.'
        else new.guest_name || ' çağrısı danışmaya aktarıldı.'
      end,
      coalesce(new.decided_at, now())
    );

    if resident_profile_id is not null then
      insert into public.notifications (profile_id, title, body, tone, created_at)
      values (
        resident_profile_id,
        case new.status
          when 'approved' then 'Kapı açıldı'
          when 'rejected' then 'Çağrı kapatıldı'
          else 'Çağrı danışmaya aktarıldı'
        end,
        case new.status
          when 'approved' then new.guest_name || ' için giriş onayı verildi.'
          when 'rejected' then new.guest_name || ' için çağrı kapatıldı.'
          else new.guest_name || ' için çağrı danışma ekibine devredildi.'
        end,
        case new.status
          when 'approved' then 'success'::public.notification_tone
          when 'rejected' then 'danger'::public.notification_tone
          else 'info'::public.notification_tone
        end,
        coalesce(new.decided_at, now())
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guest_request_events_trigger on public.guest_requests;
create trigger guest_request_events_trigger
after insert or update on public.guest_requests
for each row
execute function public.handle_guest_request_events();

create or replace function public.handle_package_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resident_profile_id uuid;
  note_text text;
begin
  select profiles.id
  into resident_profile_id
  from public.profiles
  where profiles.role = 'resident'
    and profiles.unit_id = new.unit_id
  limit 1;

  if tg_op = 'INSERT' then
    insert into public.package_events (package_id, note, created_at)
    values (new.id, 'Paket danışma masasına alındı.', new.arrived_at);

    if resident_profile_id is not null then
      insert into public.notifications (profile_id, title, body, tone, created_at)
      values (
        resident_profile_id,
        'Kargonuz girişte',
        new.courier_name || ' gönderiniz teslim alınmayı bekliyor.',
        'info'::public.notification_tone,
        new.arrived_at
      );
    end if;

    return new;
  end if;

  if old.status is distinct from new.status then
    note_text := case new.status
      when 'delivered' then 'Paket teslim edildi.'
      when 'on_the_way' then 'Paket yola çıktı olarak işlendi.'
      else 'Paket teslim noktasına geri alındı.'
    end;

    insert into public.package_events (package_id, note, created_at)
    values (new.id, note_text, now());

    if resident_profile_id is not null and new.status = 'delivered' then
      insert into public.notifications (profile_id, title, body, tone, created_at)
      values (
        resident_profile_id,
        'Kargo teslim edildi',
        new.courier_name || ' gönderiniz teslim edildi olarak işlendi.',
        'success'::public.notification_tone,
        coalesce(new.delivered_at, now())
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists package_events_trigger on public.packages;
create trigger package_events_trigger
after insert or update on public.packages
for each row
execute function public.handle_package_events();

create or replace function public.handle_announcement_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (profile_id, title, body, tone, created_at)
  select distinct profile_id, 'Yeni duyuru', new.title || ' duyurusu yayınlandı.', 'info'::public.notification_tone, new.published_at
  from (
    select profiles.id as profile_id
    from public.profiles
    join public.units on units.id = profiles.unit_id
    join public.buildings on buildings.id = units.building_id
    where profiles.role = 'resident'
      and buildings.site_id = new.site_id

    union

    select manager_site_assignments.profile_id
    from public.manager_site_assignments
    where manager_site_assignments.site_id = new.site_id

    union

    select consultant_site_assignments.profile_id
    from public.consultant_site_assignments
    where consultant_site_assignments.site_id = new.site_id

    union

    select profiles.id
    from public.profiles
    where profiles.role = 'super_admin'
  ) recipients;

  return new;
end;
$$;

drop trigger if exists announcement_notifications_trigger on public.announcements;
create trigger announcement_notifications_trigger
after insert on public.announcements
for each row
execute function public.handle_announcement_notifications();

create or replace function public.handle_invoice_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resident_profile_id uuid;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  select id
  into resident_profile_id
  from public.profiles
  where role = 'resident'
    and unit_id = new.unit_id
  limit 1;

  if resident_profile_id is null then
    return new;
  end if;

  if new.status = 'paid' then
    insert into public.notifications (profile_id, title, body, tone, created_at)
    values (
      resident_profile_id,
      'Aidat kaydınız işlendi',
      new.period_label || ' dönemi aidat kaydı ödendi olarak işlendi.',
      'success'::public.notification_tone,
      coalesce(new.paid_at, now())
    );
  elsif new.status = 'overdue' then
    insert into public.notifications (profile_id, title, body, tone, created_at)
    values (
      resident_profile_id,
      'Aidat kaydınız gecikmiş görünüyor',
      new.period_label || ' dönemi aidat kaydınız için kontrol önerilir.',
      'warning'::public.notification_tone,
      now()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists invoice_notifications_trigger on public.invoices;
create trigger invoice_notifications_trigger
after update on public.invoices
for each row
execute function public.handle_invoice_notifications();

create or replace function public.handle_gate_event_logs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.logs (building_id, event_details, timestamp)
  values (new.building_id, new.actor_name || ' kapı açma komutu gönderdi.', new.created_at);

  return new;
end;
$$;

drop trigger if exists gate_event_logs_trigger on public.gate_events;
create trigger gate_event_logs_trigger
after insert on public.gate_events
for each row
execute function public.handle_gate_event_logs();

do $$ begin alter publication supabase_realtime add table public.sites; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.buildings; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.units; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.resident_preferences; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.guest_requests; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.logs; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.announcements; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.announcement_reads; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.site_invoice_plans; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.invoices; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.payment_records; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.packages; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.package_events; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.service_providers; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.access_passes; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.gate_events; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.emergency_alerts; exception when duplicate_object then null; end $$;
