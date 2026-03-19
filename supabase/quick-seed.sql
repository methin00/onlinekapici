-- Online Kapıcı hızlı demo kurulumu
-- Ön koşul:
-- 1. Authentication > Users altında şu kullanıcılar oluşturulmuş olmalı
--    merkez@onlinekapici.app
--    danisma@onlinekapici.app
--    yonetim.atlas@onlinekapici.app
--    ahmet.yilmaz@onlinekapici.app
--    elif.aksoy@onlinekapici.app
--    terminal.atlas.a@onlinekapici.app
-- 2. Hepsinin şifresi: 123456
-- 3. Bu dosyayı schema.sql çalıştıktan sonra SQL Editor içinde çalıştırın

begin;

insert into public.sites (id, name, address, district, city)
values
  ('11111111-1111-4111-8111-111111111111', 'Atlas Yaşam Evleri', 'Çamlıca Mahallesi Vadi Caddesi No:18', 'Ümraniye', 'İstanbul')
on conflict (id) do update
set
  name = excluded.name,
  address = excluded.address,
  district = excluded.district,
  city = excluded.city;

insert into public.buildings (id, site_id, name, address, api_key, door_label, kiosk_code)
values
  ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'A Blok', 'Atlas Yaşam Evleri A Blok', 'atlas-a-01', 'A Blok Giriş', 'atlas-a'),
  ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'B Blok', 'Atlas Yaşam Evleri B Blok', 'atlas-b-01', 'B Blok Giriş', 'atlas-b')
on conflict (id) do update
set
  site_id = excluded.site_id,
  name = excluded.name,
  address = excluded.address,
  api_key = excluded.api_key,
  door_label = excluded.door_label,
  kiosk_code = excluded.kiosk_code;

insert into public.units (id, building_id, unit_number, floor)
values
  ('44444444-4444-4444-8444-444444444444', '22222222-2222-4222-8222-222222222222', '12', 3),
  ('55555555-5555-4555-8555-555555555555', '22222222-2222-4222-8222-222222222222', '18', 4),
  ('66666666-6666-4666-8666-666666666666', '33333333-3333-4333-8333-333333333333', '5', 1),
  ('77777777-7777-4777-8777-777777777777', '33333333-3333-4333-8333-333333333333', '22', 6)
on conflict (id) do update
set
  building_id = excluded.building_id,
  unit_number = excluded.unit_number,
  floor = excluded.floor;

insert into public.profiles (id, unit_id, primary_building_id, full_name, role, phone, title, login_id)
select
  u.id,
  null,
  null,
  'Mert Aydın',
  'super_admin'::app_role,
  '05320000001',
  'Merkez Yönetim',
  'merkez'
from auth.users u
where u.email = 'merkez@onlinekapici.app'
on conflict (id) do update
set
  unit_id = excluded.unit_id,
  primary_building_id = excluded.primary_building_id,
  full_name = excluded.full_name,
  role = excluded.role,
  phone = excluded.phone,
  title = excluded.title,
  login_id = excluded.login_id;

insert into public.resident_preferences (profile_id, away_mode_enabled, updated_at)
select
  u.id,
  true,
  now() - interval '30 minutes'
from auth.users u
where u.email = 'ahmet.yilmaz@onlinekapici.app'
on conflict (profile_id) do update
set
  away_mode_enabled = excluded.away_mode_enabled,
  updated_at = excluded.updated_at;

insert into public.resident_preferences (profile_id, away_mode_enabled, updated_at)
select
  u.id,
  false,
  now() - interval '4 hours'
from auth.users u
where u.email = 'elif.aksoy@onlinekapici.app'
on conflict (profile_id) do update
set
  away_mode_enabled = excluded.away_mode_enabled,
  updated_at = excluded.updated_at;

insert into public.profiles (id, unit_id, primary_building_id, full_name, role, phone, title, login_id)
select
  u.id,
  null,
  null,
  'Ceren Korkmaz',
  'consultant'::app_role,
  '05320000002',
  'Danışma Merkezi',
  'danisma'
from auth.users u
where u.email = 'danisma@onlinekapici.app'
on conflict (id) do update
set
  unit_id = excluded.unit_id,
  primary_building_id = excluded.primary_building_id,
  full_name = excluded.full_name,
  role = excluded.role,
  phone = excluded.phone,
  title = excluded.title,
  login_id = excluded.login_id;

insert into public.profiles (id, unit_id, primary_building_id, full_name, role, phone, title, login_id)
select
  u.id,
  null,
  null,
  'Selin Demir',
  'manager'::app_role,
  '05320000003',
  'Site Yöneticisi',
  'atlasyonetim'
from auth.users u
where u.email = 'yonetim.atlas@onlinekapici.app'
on conflict (id) do update
set
  unit_id = excluded.unit_id,
  primary_building_id = excluded.primary_building_id,
  full_name = excluded.full_name,
  role = excluded.role,
  phone = excluded.phone,
  title = excluded.title,
  login_id = excluded.login_id;

insert into public.profiles (id, unit_id, primary_building_id, full_name, role, phone, title, login_id)
select
  u.id,
  '44444444-4444-4444-8444-444444444444'::uuid,
  null,
  'Ahmet Yılmaz',
  'resident'::app_role,
  '05551234567',
  'Daire Sakini',
  '05551234567'
from auth.users u
where u.email = 'ahmet.yilmaz@onlinekapici.app'
on conflict (id) do update
set
  unit_id = excluded.unit_id,
  primary_building_id = excluded.primary_building_id,
  full_name = excluded.full_name,
  role = excluded.role,
  phone = excluded.phone,
  title = excluded.title,
  login_id = excluded.login_id;

insert into public.profiles (id, unit_id, primary_building_id, full_name, role, phone, title, login_id)
select
  u.id,
  '66666666-6666-4666-8666-666666666666'::uuid,
  null,
  'Elif Aksoy',
  'resident'::app_role,
  '05557654321',
  'Daire Sakini',
  '05557654321'
from auth.users u
where u.email = 'elif.aksoy@onlinekapici.app'
on conflict (id) do update
set
  unit_id = excluded.unit_id,
  primary_building_id = excluded.primary_building_id,
  full_name = excluded.full_name,
  role = excluded.role,
  phone = excluded.phone,
  title = excluded.title,
  login_id = excluded.login_id;

insert into public.profiles (id, unit_id, primary_building_id, full_name, role, phone, title, login_id)
select
  u.id,
  null,
  '22222222-2222-4222-8222-222222222222'::uuid,
  'Atlas A Giriş Terminali',
  'kiosk_device'::app_role,
  '00000000000',
  'Giriş Terminali',
  'atlas-a'
from auth.users u
where u.email = 'terminal.atlas.a@onlinekapici.app'
on conflict (id) do update
set
  unit_id = excluded.unit_id,
  primary_building_id = excluded.primary_building_id,
  full_name = excluded.full_name,
  role = excluded.role,
  phone = excluded.phone,
  title = excluded.title,
  login_id = excluded.login_id;

insert into public.manager_site_assignments (id, profile_id, site_id)
select
  '88888888-8888-4888-8888-888888888888'::uuid,
  u.id,
  '11111111-1111-4111-8111-111111111111'::uuid
from auth.users u
where u.email = 'yonetim.atlas@onlinekapici.app'
on conflict (profile_id, site_id) do nothing;

insert into public.consultant_site_assignments (id, profile_id, site_id)
select
  '99999999-9999-4999-8999-999999999999'::uuid,
  u.id,
  '11111111-1111-4111-8111-111111111111'::uuid
from auth.users u
where u.email = 'danisma@onlinekapici.app'
on conflict (profile_id, site_id) do nothing;

insert into public.announcements (id, site_id, title, summary, category, pinned, published_at)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'Su kesintisi bildirimi', 'Yarın 10.00 ile 14.00 arasında planlı su kesintisi uygulanacaktır.', 'Operasyon', true, now() - interval '6 hours'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '11111111-1111-4111-8111-111111111111', 'Yönetim toplantısı', 'Cumartesi günü sosyal tesiste aylık toplantı yapılacaktır.', 'Yönetim', false, now() - interval '1 day')
on conflict (id) do update
set
  site_id = excluded.site_id,
  title = excluded.title,
  summary = excluded.summary,
  category = excluded.category,
  pinned = excluded.pinned,
  published_at = excluded.published_at;

insert into public.site_invoice_plans (id, site_id, amount, due_day, active, start_month, last_generated_period)
values
  (
    'abababab-abab-4bab-8bab-abababababab',
    '11111111-1111-4111-8111-111111111111',
    1850,
    10,
    true,
    date_trunc('month', current_date)::date,
    date_trunc('month', current_date)::date
  )
on conflict (site_id) do update
set
  amount = excluded.amount,
  due_day = excluded.due_day,
  active = excluded.active,
  start_month = excluded.start_month,
  last_generated_period = excluded.last_generated_period;

insert into public.invoices (id, unit_id, period_label, amount, due_date, status, paid_at)
values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '44444444-4444-4444-8444-444444444444', 'Mart 2026', 1850, current_date + 6, 'paid', now() - interval '3 days'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', '55555555-5555-4555-8555-555555555555', 'Mart 2026', 1850, current_date + 6, 'unpaid', null),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', '66666666-6666-4666-8666-666666666666', 'Mart 2026', 1850, current_date - 1, 'overdue', null),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4', '77777777-7777-4777-8777-777777777777', 'Mart 2026', 1850, current_date + 6, 'paid', now() - interval '2 days')
on conflict (id) do update
set
  unit_id = excluded.unit_id,
  period_label = excluded.period_label,
  amount = excluded.amount,
  due_date = excluded.due_date,
  status = excluded.status,
  paid_at = excluded.paid_at;

insert into public.payment_records (id, invoice_id, unit_id, amount, recorded_at, recorded_by)
values
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '44444444-4444-4444-8444-444444444444', 1850, now() - interval '3 days', 'Selin Demir'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc2', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4', '77777777-7777-4777-8777-777777777777', 1850, now() - interval '2 days', 'Selin Demir')
on conflict (id) do update
set
  invoice_id = excluded.invoice_id,
  unit_id = excluded.unit_id,
  amount = excluded.amount,
  recorded_at = excluded.recorded_at,
  recorded_by = excluded.recorded_by;

insert into public.packages (id, unit_id, courier_name, tracking_code, status, arrived_at, delivered_at)
values
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd1', '44444444-4444-4444-8444-444444444444', 'Trendyol Express', '', 'at_desk', now() - interval '48 minutes', null),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd2', '66666666-6666-4666-8666-666666666666', 'Yurtiçi Kargo', '', 'delivered', now() - interval '1 day', now() - interval '8 hours')
on conflict (id) do update
set
  unit_id = excluded.unit_id,
  courier_name = excluded.courier_name,
  tracking_code = excluded.tracking_code,
  status = excluded.status,
  arrived_at = excluded.arrived_at,
  delivered_at = excluded.delivered_at;

insert into public.service_providers (id, site_id, category, full_name, phone, note)
values
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', '11111111-1111-4111-8111-111111111111', 'Temizlik', 'Parlak Temizlik', '02160000001', 'Günlük ortak alan temizliği'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2', '11111111-1111-4111-8111-111111111111', 'Elektrik', 'Bora Elektrik', '05390000002', 'Acil arıza müdahalesi'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3', '11111111-1111-4111-8111-111111111111', 'Tesisat', 'Mavi Tesisat', '05380000003', 'Su kaçağı ve bakım')
on conflict (id) do update
set
  site_id = excluded.site_id,
  category = excluded.category,
  full_name = excluded.full_name,
  phone = excluded.phone,
  note = excluded.note;

insert into public.access_passes (id, unit_id, holder_name, type, status, expires_at)
values
  ('ffffffff-ffff-4fff-8fff-fffffffffff1', '44444444-4444-4444-8444-444444444444', 'Ayşe Yıldız', 'qr', 'active', now() + interval '1 day'),
  ('ffffffff-ffff-4fff-8fff-fffffffffff2', '44444444-4444-4444-8444-444444444444', 'NFC Kart 04', 'nfc', 'used', now() - interval '1 day')
on conflict (id) do update
set
  unit_id = excluded.unit_id,
  holder_name = excluded.holder_name,
  type = excluded.type,
  status = excluded.status,
  expires_at = excluded.expires_at;

insert into public.guest_requests (id, building_id, unit_id, guest_name, type, status, expires_at, created_at, decided_at, last_action_by)
values
  ('12121212-1212-4212-8212-121212121212', '22222222-2222-4222-8222-222222222222', '44444444-4444-4444-8444-444444444444', 'Mehmet Kaya', 'guest', 'pending', now() + interval '2 minutes', now() - interval '2 minutes', null, null),
  ('13131313-1313-4313-8313-131313131313', '33333333-3333-4333-8333-333333333333', '66666666-6666-4666-8666-666666666666', 'Asansör Teknik', 'service', 'redirected', now() - interval '14 minutes', now() - interval '19 minutes', now() - interval '14 minutes', 'Danışma Merkezi')
on conflict (id) do update
set
  building_id = excluded.building_id,
  unit_id = excluded.unit_id,
  guest_name = excluded.guest_name,
  type = excluded.type,
  status = excluded.status,
  expires_at = excluded.expires_at,
  created_at = excluded.created_at,
  decided_at = excluded.decided_at,
  last_action_by = excluded.last_action_by;

insert into public.emergency_alerts (id, site_id, title, status, created_at)
values
  ('14141414-1414-4414-8414-141414141414', '11111111-1111-4111-8111-111111111111', 'Otopark yangın alarmı kontrol ediliyor', 'closed', now() - interval '4 days')
on conflict (id) do update
set
  site_id = excluded.site_id,
  title = excluded.title,
  status = excluded.status,
  created_at = excluded.created_at;

commit;
