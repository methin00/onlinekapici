import { NextRequest, NextResponse } from 'next/server';
import type { ProviderCategory } from '@/lib/portal-types';
import { buildUnitCodeMap } from '@/lib/unit-code';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

const PROVIDER_CATEGORIES: ProviderCategory[] = [
  'Temizlik',
  'Elektrik',
  'Tesisat',
  'Asansör',
  'Nakliyat',
  'Peyzaj'
];

function readTrimmedString(value: unknown, label: string, minimumLength = 1) {
  if (typeof value !== 'string') {
    throw new HttpError(`${label} bilgisi gerekli.`, 400);
  }

  const normalized = value.trim();

  if (normalized.length < minimumLength) {
    throw new HttpError(`${label} bilgisi eksik görünüyor.`, 400);
  }

  return normalized;
}

function readNumber(value: unknown, label: string) {
  const parsed = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    throw new HttpError(`${label} bilgisi geçerli değil.`, 400);
  }

  return parsed;
}

function readProviderCategory(value: unknown) {
  if (typeof value !== 'string' || !PROVIDER_CATEGORIES.includes(value as ProviderCategory)) {
    throw new HttpError('Hizmet kategorisi geçerli değil.', 400);
  }

  return value as ProviderCategory;
}

const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RESIDENT_PASSWORD_METADATA_KEY = 'resident_system_password';
const RESIDENT_PASSWORD_UPDATED_AT_KEY = 'resident_system_password_updated_at';

function createRandomSecret(length: number) {
  return Array.from({ length }, () => {
    const index = Math.floor(Math.random() * PASSWORD_ALPHABET.length);
    return PASSWORD_ALPHABET[index];
  }).join('');
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '');
}

function normalizeCodeFragment(value: string) {
  return value
    .toLocaleUpperCase('tr-TR')
    .replaceAll('Ç', 'C')
    .replaceAll('Ğ', 'G')
    .replaceAll('İ', 'I')
    .replaceAll('Ö', 'O')
    .replaceAll('Ş', 'S')
    .replaceAll('Ü', 'U')
    .replace(/[^A-Z0-9]+/g, '');
}

function codeFragment(value: string, length: number, fallback: string) {
  const normalized = normalizeCodeFragment(value).slice(0, length);
  return normalized || fallback;
}

function unitNumberCode(value: string) {
  const digits = value.replace(/\D/g, '');

  if (digits) {
    return digits.slice(-3).padStart(3, '0');
  }

  return codeFragment(value, 3, '001');
}

function buildBaseUnitCode(parts: {
  city: string;
  district: string;
  siteName: string;
  buildingName: string;
  unitNumber: string;
}) {
  return [
    codeFragment(parts.city, 3, 'CTY'),
    codeFragment(parts.district, 3, 'DST'),
    codeFragment(parts.siteName, 4, 'SITE'),
    codeFragment(parts.buildingName, 3, 'BLK'),
    unitNumberCode(parts.unitNumber)
  ].join('-');
}

type ActorProfile = {
  id: string;
  role: 'super_admin' | 'consultant' | 'manager' | 'resident' | 'kiosk_device';
  unit_id: string | null;
  primary_building_id: string | null;
};

async function requireActor(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;

  if (!token) {
    throw new HttpError('Bu işlem için yönetici oturumu gerekli.', 401);
  }

  const admin = getSupabaseAdminClient();
  const {
    data: { user },
    error: authError
  } = await admin.auth.getUser(token);

  if (authError || !user) {
    throw new HttpError('Oturum doğrulanamadı.', 401);
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, role, unit_id, primary_building_id')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    throw new HttpError('Oturum profili bulunamadı.', 403);
  }

  return {
    admin,
    actor: profile as ActorProfile
  };
}

function ensureSuperAdmin(actor: ActorProfile) {
  if (actor.role !== 'super_admin') {
    throw new HttpError('Bu işlem için süper yönetici yetkisi gerekiyor.', 403);
  }
}

async function ensureSuccess(error: { message: string } | null, fallbackMessage: string) {
  if (error) {
    throw new HttpError(error.message || fallbackMessage, 400);
  }
}

function isMissingColumnError(error: { code?: string; message: string } | null, columnName: string) {
  return error?.code === '42703' && error.message.includes(columnName);
}

async function getAccessibleSiteIds(admin: ReturnType<typeof getSupabaseAdminClient>, actor: ActorProfile) {
  if (actor.role === 'super_admin') {
    const { data, error } = await admin.from('sites').select('id');
    await ensureSuccess(error, 'Site listesi alınamadı.');
    return (data ?? []).map((row) => row.id);
  }

  if (actor.role === 'manager') {
    const { data, error } = await admin
      .from('manager_site_assignments')
      .select('site_id')
      .eq('profile_id', actor.id);

    await ensureSuccess(error, 'Yönetici site atamaları alınamadı.');
    return (data ?? []).map((row) => row.site_id);
  }

  if (actor.role === 'consultant') {
    const { data, error } = await admin
      .from('consultant_site_assignments')
      .select('site_id')
      .eq('profile_id', actor.id);

    await ensureSuccess(error, 'Danışman site atamaları alınamadı.');
    return (data ?? []).map((row) => row.site_id);
  }

  if (actor.role === 'resident' && actor.unit_id) {
    const { data: unit, error: unitError } = await admin
      .from('units')
      .select('id, building_id')
      .eq('id', actor.unit_id)
      .maybeSingle();

    await ensureSuccess(unitError, 'Daire bilgisi alınamadı.');

    if (!unit) {
      return [];
    }

    const { data: building, error: buildingError } = await admin
      .from('buildings')
      .select('site_id')
      .eq('id', unit.building_id)
      .maybeSingle();

    await ensureSuccess(buildingError, 'Site bilgisi alınamadı.');
    return building ? [building.site_id] : [];
  }

  if (actor.role === 'kiosk_device' && actor.primary_building_id) {
    const { data: building, error } = await admin
      .from('buildings')
      .select('site_id')
      .eq('id', actor.primary_building_id)
      .maybeSingle();

    await ensureSuccess(error, 'Terminal site bilgisi alınamadı.');
    return building ? [building.site_id] : [];
  }

  return [];
}

async function ensureCanManageSite(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  actor: ActorProfile,
  siteId: string
) {
  if (actor.role === 'super_admin') {
    return;
  }

  if (actor.role !== 'manager') {
    throw new HttpError('Bu işlem için site yöneticisi yetkisi gerekiyor.', 403);
  }

  const { data, error } = await admin
    .from('manager_site_assignments')
    .select('id')
    .eq('profile_id', actor.id)
    .eq('site_id', siteId)
    .maybeSingle();

  await ensureSuccess(error, 'Site yetkisi doğrulanamadı.');

  if (!data) {
    throw new HttpError('Bu site için yönetim yetkiniz bulunmuyor.', 403);
  }
}

function formatInvoicePeriodLabel(date: Date) {
  const label = new Intl.DateTimeFormat('tr-TR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(date);

  return label.charAt(0).toLocaleUpperCase('tr-TR') + label.slice(1);
}

function monthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date: Date, count: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1));
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function syncSiteInvoices(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  siteId: string
) {
  const { data: plan, error: planError } = await admin
    .from('site_invoice_plans')
    .select('id, site_id, amount, due_day, active, start_month, last_generated_period')
    .eq('site_id', siteId)
    .maybeSingle();

  if (planError) {
    const message = planError.message.toLocaleLowerCase('tr-TR');
    if (message.includes('does not exist') || message.includes('relation') || message.includes('column')) {
      return;
    }

    throw new HttpError(planError.message || 'Aidat planı alınamadı.', 400);
  }

  if (!plan?.active) {
    return;
  }

  const { data: buildings, error: buildingsError } = await admin
    .from('buildings')
    .select('id')
    .eq('site_id', siteId);

  await ensureSuccess(buildingsError, 'Site blokları alınamadı.');
  const buildingIds = (buildings ?? []).map((building) => building.id);

  if (!buildingIds.length) {
    return;
  }

  const { data: units, error: unitsError } = await admin
    .from('units')
    .select('id, created_at')
    .in('building_id', buildingIds);

  await ensureSuccess(unitsError, 'Site daireleri alınamadı.');
  const unitRows = (units ?? []) as Array<{ id: string; created_at: string }>;
  const unitIds = unitRows.map((unit) => unit.id);

  if (!unitIds.length) {
    return;
  }

  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const todayIso = isoDate(todayUtc);

  const { error: overdueError } = await admin
    .from('invoices')
    .update({ status: 'overdue' })
    .in('unit_id', unitIds)
    .eq('status', 'unpaid')
    .lt('due_date', todayIso);

  await ensureSuccess(overdueError, 'Gecikmiş aidatlar güncellenemedi.');

  const { data: existingInvoices, error: existingInvoicesError } = await admin
    .from('invoices')
    .select('unit_id, period_label')
    .in('unit_id', unitIds);

  await ensureSuccess(existingInvoicesError, 'Mevcut aidat kayıtları alınamadı.');
  const existingKeys = new Set(
    ((existingInvoices ?? []) as Array<{ unit_id: string; period_label: string }>).map(
      (invoice) => `${invoice.unit_id}:${invoice.period_label}`
    )
  );

  const startMonth = monthStart(new Date(plan.start_month));
  const currentMonth = monthStart(todayUtc);
  const nextCursorSource = plan.last_generated_period ? addMonths(new Date(plan.last_generated_period), 1) : startMonth;
  let cursor = monthStart(nextCursorSource < startMonth ? startMonth : nextCursorSource);
  let lastProcessedPeriod: string | null = plan.last_generated_period ?? null;
  const invoicesToInsert: Array<{
    unit_id: string;
    period_label: string;
    amount: number;
    due_date: string;
    status: 'unpaid' | 'overdue';
  }> = [];

  while (cursor <= currentMonth) {
    const dueDate = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), plan.due_day));

    if (dueDate > todayUtc) {
      break;
    }

    const periodLabel = formatInvoicePeriodLabel(cursor);

    for (const unit of unitRows) {
      if (new Date(unit.created_at) > dueDate) {
        continue;
      }

      const key = `${unit.id}:${periodLabel}`;
      if (existingKeys.has(key)) {
        continue;
      }

      invoicesToInsert.push({
        unit_id: unit.id,
        period_label: periodLabel,
        amount: Number(plan.amount),
        due_date: isoDate(dueDate),
        status: dueDate < todayUtc ? 'overdue' : 'unpaid'
      });
      existingKeys.add(key);
    }

    lastProcessedPeriod = isoDate(cursor);
    cursor = addMonths(cursor, 1);
  }

  if (invoicesToInsert.length) {
    const { error: insertError } = await admin.from('invoices').insert(invoicesToInsert);
    await ensureSuccess(insertError, 'Yeni aidat kayıtları oluşturulamadı.');
  }

  if (lastProcessedPeriod && lastProcessedPeriod !== plan.last_generated_period) {
    const { error: planUpdateError } = await admin
      .from('site_invoice_plans')
      .update({
        last_generated_period: lastProcessedPeriod,
        updated_at: new Date().toISOString()
      })
      .eq('id', plan.id);

    await ensureSuccess(planUpdateError, 'Aidat planı senkron bilgisi güncellenemedi.');
  }
}

async function getProfileSiteId(admin: ReturnType<typeof getSupabaseAdminClient>, profileId: string) {
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, role, unit_id')
    .eq('id', profileId)
    .maybeSingle();

  if (profileError || !profile) {
    throw new HttpError('Seçilen kullanıcı bulunamadı.', 404);
  }

  if (!profile.unit_id) {
    throw new HttpError('Seçilen kullanıcı bir daireye bağlı değil.', 400);
  }

  const { data: unit, error: unitError } = await admin
    .from('units')
    .select('id, building_id')
    .eq('id', profile.unit_id)
    .maybeSingle();

  if (unitError || !unit) {
    throw new HttpError('Kullanıcının daire kaydı bulunamadı.', 404);
  }

  const { data: building, error: buildingError } = await admin
    .from('buildings')
    .select('id, site_id')
    .eq('id', unit.building_id)
    .maybeSingle();

  if (buildingError || !building) {
    throw new HttpError('Kullanıcının blok kaydı bulunamadı.', 404);
  }

  return {
    role: profile.role,
    unitId: profile.unit_id,
    siteId: building.site_id
  };
}

async function clearFormerManagerRoles(admin: ReturnType<typeof getSupabaseAdminClient>, formerProfileIds: string[]) {
  for (const profileId of formerProfileIds) {
    const { count, error } = await admin
      .from('manager_site_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', profileId);

    if (error) {
      throw new HttpError(error.message || 'Eski yönetici atamaları kontrol edilemedi.', 400);
    }

    if ((count ?? 0) === 0) {
      const { error: profileError } = await admin
        .from('profiles')
        .update({ role: 'resident' })
        .eq('id', profileId);

      if (profileError) {
        throw new HttpError(profileError.message || 'Eski yönetici rolü güncellenemedi.', 400);
      }
    }
  }
}

async function ensureUniqueUnitCode(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  baseCode: string,
  unitId: string
) {
  let candidate = baseCode;
  let suffix = 2;

  while (true) {
    const { data, error } = await admin
      .from('units')
      .select('id')
      .eq('unit_code', candidate)
      .neq('id', unitId)
      .maybeSingle();

    if (error) {
      throw new HttpError(error.message || 'Daire kimliği benzersizliği doğrulanamadı.', 400);
    }

    if (!data) {
      return candidate;
    }

    candidate = `${baseCode}-${suffix}`;
    suffix += 1;
  }
}

async function syncUnitProfileLoginIds(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  unitId: string,
  unitCode: string
) {
  const { error } = await admin
    .from('profiles')
    .update({ login_id: unitCode })
    .eq('unit_id', unitId)
    .in('role', ['resident', 'manager']);

  if (error) {
    throw new HttpError(error.message || 'Daire giriş kimliği profillere işlenemedi.', 400);
  }
}

async function refreshUnitCode(admin: ReturnType<typeof getSupabaseAdminClient>, unitId: string) {
  const { data: unit, error: unitError } = await admin
    .from('units')
    .select('id, unit_number, building_id')
    .eq('id', unitId)
    .maybeSingle();

  if (unitError || !unit) {
    throw new HttpError('Daire kaydı bulunamadı.', 404);
  }

  const { data: building, error: buildingError } = await admin
    .from('buildings')
    .select('id, name, site_id')
    .eq('id', unit.building_id)
    .maybeSingle();

  if (buildingError || !building) {
    throw new HttpError('Blok kaydı bulunamadı.', 404);
  }

  const { data: site, error: siteError } = await admin
    .from('sites')
    .select('id, name, district, city')
    .eq('id', building.site_id)
    .maybeSingle();

  if (siteError || !site) {
    throw new HttpError('Site kaydı bulunamadı.', 404);
  }

  const { data: siteBuildings, error: siteBuildingsError } = await admin
    .from('buildings')
    .select('id, site_id, name')
    .eq('site_id', site.id);

  if (siteBuildingsError) {
    throw new HttpError(siteBuildingsError.message || 'Site blokları alınamadı.', 400);
  }

  const siteBuildingIds = (siteBuildings ?? []).map((entry) => entry.id);

  const { data: siteUnits, error: siteUnitsError } = await admin
    .from('units')
    .select('id, building_id, unit_number')
    .in('building_id', siteBuildingIds);

  if (siteUnitsError) {
    throw new HttpError(siteUnitsError.message || 'Site daireleri alınamadı.', 400);
  }

  const nextUnitCode =
    buildUnitCodeMap(
      (siteUnits ?? []).map((entry) => ({
        id: entry.id,
        buildingId: entry.building_id,
        unitNumber: entry.unit_number
      })),
      (siteBuildings ?? []).map((entry) => ({
        id: entry.id,
        siteId: entry.site_id,
        name: entry.name
      })),
      [
        {
          id: site.id,
          name: site.name,
          district: site.district,
          city: site.city
        }
      ]
    ).get(unit.id) ??
    buildBaseUnitCode({
      city: site.city,
      district: site.district,
      siteName: site.name,
      buildingName: building.name,
      unitNumber: unit.unit_number
    });

  const { error: updateError } = await admin
    .from('units')
    .update({ unit_code: nextUnitCode })
    .eq('id', unit.id);

  if (updateError && !isMissingColumnError(updateError, 'unit_code')) {
    throw new HttpError(updateError.message || 'Daire kimliği güncellenemedi.', 400);
  }

  await syncUnitProfileLoginIds(admin, unit.id, nextUnitCode);
  return nextUnitCode;
}

async function getUnitAuthContext(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  unitId: string
) {
  const { data: unitWithCode, error: unitWithCodeError } = await admin
    .from('units')
    .select('id, building_id, unit_code')
    .eq('id', unitId)
    .maybeSingle();

  if (!unitWithCodeError && unitWithCode) {
    return {
      id: unitWithCode.id,
      buildingId: unitWithCode.building_id,
      unitCode: unitWithCode.unit_code ?? (await refreshUnitCode(admin, unitWithCode.id))
    };
  }

  if (unitWithCodeError && !isMissingColumnError(unitWithCodeError, 'unit_code')) {
    throw new HttpError(unitWithCodeError.message || 'Seçilen daire bulunamadı.', 404);
  }

  const { data: unit, error: unitError } = await admin
    .from('units')
    .select('id, building_id')
    .eq('id', unitId)
    .maybeSingle();

  if (unitError || !unit) {
    throw new HttpError(unitError?.message || 'Seçilen daire bulunamadı.', 404);
  }

  return {
    id: unit.id,
    buildingId: unit.building_id,
    unitCode: await refreshUnitCode(admin, unit.id)
  };
}

async function refreshBuildingUnitCodes(admin: ReturnType<typeof getSupabaseAdminClient>, buildingId: string) {
  const { data: units, error } = await admin.from('units').select('id').eq('building_id', buildingId);

  if (error) {
    throw new HttpError(error.message || 'Bloktaki daireler alınamadı.', 400);
  }

  for (const unit of units ?? []) {
    await refreshUnitCode(admin, unit.id);
  }
}

async function refreshSiteUnitCodes(admin: ReturnType<typeof getSupabaseAdminClient>, siteId: string) {
  const { data: buildings, error } = await admin.from('buildings').select('id').eq('site_id', siteId);

  if (error) {
    throw new HttpError(error.message || 'Sitedeki bloklar alınamadı.', 400);
  }

  for (const building of buildings ?? []) {
    await refreshBuildingUnitCodes(admin, building.id);
  }
}

function buildResidentAuthEmail(unitCode: string) {
  return `resident-${unitCode.toLowerCase()}@auth.onlinekapici.com`;
}

function buildConsultantAuthEmail(phone: string) {
  return `consultant-${normalizePhone(phone)}@auth.onlinekapici.com`;
}

type ResidentAuthSnapshot = {
  systemPassword: string | null;
  passwordUpdatedAt: string | null;
};

function readResidentAuthSnapshot(metadata: unknown): ResidentAuthSnapshot {
  const source =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};

  return {
    systemPassword:
      typeof source[RESIDENT_PASSWORD_METADATA_KEY] === 'string'
        ? source[RESIDENT_PASSWORD_METADATA_KEY]
        : null,
    passwordUpdatedAt:
      typeof source[RESIDENT_PASSWORD_UPDATED_AT_KEY] === 'string'
        ? source[RESIDENT_PASSWORD_UPDATED_AT_KEY]
        : null
  };
}

async function requireResidentAccountProfile(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  profileId: string
) {
  const { data: profile, error } = await admin
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', profileId)
    .maybeSingle();

  if (error || !profile || !['resident', 'manager'].includes(profile.role)) {
    throw new HttpError('Seçilen kullanıcı daire sakini değil.', 400);
  }

  return profile as {
    id: string;
    role: 'resident' | 'manager';
    full_name: string;
  };
}

async function getResidentAccountSnapshotForProfile(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  profileId: string
) {
  const profile = await requireResidentAccountProfile(admin, profileId);
  const { data, error } = await admin.auth.admin.getUserById(profile.id);

  if (error || !data.user) {
    throw new HttpError(error?.message || 'Sakin oturum bilgisi alınamadı.', 400);
  }

  return readResidentAuthSnapshot(data.user.user_metadata);
}

async function resetResidentAccountPassword(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  profileId: string
) {
  const profile = await requireResidentAccountProfile(admin, profileId);
  const generatedPassword = createRandomSecret(8);

  const { data: authData, error: authError } = await admin.auth.admin.getUserById(profile.id);

  if (authError || !authData.user) {
    throw new HttpError(authError?.message || 'Sakin oturum bilgisi alınamadı.', 400);
  }

  const userMetadata = {
    ...(authData.user.user_metadata ?? {}),
    full_name: profile.full_name,
    [RESIDENT_PASSWORD_METADATA_KEY]: generatedPassword,
    [RESIDENT_PASSWORD_UPDATED_AT_KEY]: new Date().toISOString()
  };

  const { data: updatedUser, error: updateError } = await admin.auth.admin.updateUserById(
    profile.id,
    {
      password: generatedPassword,
      user_metadata: userMetadata
    }
  );

  if (updateError || !updatedUser.user) {
    throw new HttpError(updateError?.message || 'Sakin şifresi güncellenemedi.', 400);
  }

  return readResidentAuthSnapshot(updatedUser.user.user_metadata ?? userMetadata);
}

function createBuildingApiKey() {
  return crypto.randomUUID().replaceAll('-', '');
}

function createKioskCodeBase(name: string) {
  const fragment = normalizeCodeFragment(name).slice(0, 6).toLowerCase();
  return fragment || 'kiosk';
}

async function createUniqueKioskCode(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  buildingName: string
) {
  while (true) {
    const candidate = `${createKioskCodeBase(buildingName)}-${createRandomSecret(6).toLowerCase()}`;
    const { data, error } = await admin
      .from('buildings')
      .select('id')
      .eq('kiosk_code', candidate)
      .maybeSingle();

    if (error) {
      throw new HttpError(error.message || 'Terminal kodu üretilemedi.', 400);
    }

    if (!data) {
      return candidate;
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { admin, actor } = await requireActor(request);
    const body = (await request.json().catch(() => null)) as
      | { action?: string; payload?: Record<string, unknown> }
      | null;

    if (!body?.action) {
      throw new HttpError('Yönetim işlemi tanınmadı.', 400);
    }

    const payload = body.payload ?? {};
    const responsePayload: Record<string, unknown> = {};

    switch (body.action) {
      case 'createSite': {
        ensureSuperAdmin(actor);
        const name = readTrimmedString(payload.name, 'Site adı', 2);
        const address = readTrimmedString(payload.address, 'Adres', 6);
        const district = readTrimmedString(payload.district, 'İlçe', 2);
        const city = readTrimmedString(payload.city, 'Şehir', 2);

        const { data, error } = await admin
          .from('sites')
          .insert({
            name,
            address,
            district,
            city
          })
          .select('id')
          .single();

        await ensureSuccess(error, 'Site oluşturulamadı.');
        responsePayload.siteId = data?.id ?? null;
        break;
      }

      case 'updateSite': {
        ensureSuperAdmin(actor);
        const siteId = readTrimmedString(payload.siteId, 'Site');
        const name = readTrimmedString(payload.name, 'Site adı', 2);
        const address = readTrimmedString(payload.address, 'Adres', 6);
        const district = readTrimmedString(payload.district, 'İlçe', 2);
        const city = readTrimmedString(payload.city, 'Şehir', 2);

        const { error } = await admin
          .from('sites')
          .update({
            name,
            address,
            district,
            city
          })
          .eq('id', siteId);

        await ensureSuccess(error, 'Site güncellenemedi.');
        await refreshSiteUnitCodes(admin, siteId);
        break;
      }

      case 'deleteSite': {
        ensureSuperAdmin(actor);
        const siteId = readTrimmedString(payload.siteId, 'Site');
        const { error } = await admin.from('sites').delete().eq('id', siteId);
        await ensureSuccess(error, 'Site silinemedi.');
        break;
      }

      case 'createBuilding': {
        ensureSuperAdmin(actor);
        const siteId = readTrimmedString(payload.siteId, 'Site');
        const name = readTrimmedString(payload.name, 'Blok adı', 1);
        const address = readTrimmedString(payload.address, 'Blok adresi', 4);
        const doorLabel = readTrimmedString(payload.doorLabel, 'Kapı etiketi', 1);
        const apiKey =
          typeof payload.apiKey === 'string' && payload.apiKey.trim().length >= 4
            ? payload.apiKey.trim()
            : createBuildingApiKey();
        const kioskCode =
          typeof payload.kioskCode === 'string' && payload.kioskCode.trim().length >= 2
            ? payload.kioskCode.trim()
            : await createUniqueKioskCode(admin, name);

        const { data, error } = await admin
          .from('buildings')
          .insert({
            site_id: siteId,
            name,
            address,
            api_key: apiKey,
            door_label: doorLabel,
            kiosk_code: kioskCode
          })
          .select('id')
          .single();

        await ensureSuccess(error, 'Blok oluşturulamadı.');
        responsePayload.buildingId = data?.id ?? null;
        break;
      }

      case 'updateBuilding': {
        ensureSuperAdmin(actor);
        const buildingId = readTrimmedString(payload.buildingId, 'Blok');
        const name = readTrimmedString(payload.name, 'Blok adı', 1);
        const address = readTrimmedString(payload.address, 'Blok adresi', 4);
        const apiKey = readTrimmedString(payload.apiKey, 'API anahtarı', 4);
        const doorLabel = readTrimmedString(payload.doorLabel, 'Kapı etiketi', 1);
        const kioskCode = readTrimmedString(payload.kioskCode, 'Terminal kodu', 2);

        const { error } = await admin
          .from('buildings')
          .update({
            name,
            address,
            api_key: apiKey,
            door_label: doorLabel,
            kiosk_code: kioskCode
          })
          .eq('id', buildingId);

        await ensureSuccess(error, 'Blok güncellenemedi.');
        await refreshBuildingUnitCodes(admin, buildingId);
        break;
      }

      case 'deleteBuilding': {
        ensureSuperAdmin(actor);
        const buildingId = readTrimmedString(payload.buildingId, 'Blok');
        const { error } = await admin.from('buildings').delete().eq('id', buildingId);
        await ensureSuccess(error, 'Blok silinemedi.');
        break;
      }

      case 'createUnit': {
        ensureSuperAdmin(actor);
        const buildingId = readTrimmedString(payload.buildingId, 'Blok');
        const unitNumber = readTrimmedString(payload.unitNumber, 'Daire numarası', 1);
        const floor = readNumber(payload.floor, 'Kat');
        let createdUnit: { id: string } | null = null;

        const { data: createdUnitWithCode, error: createWithCodeError } = await admin
          .from('units')
          .insert({
            building_id: buildingId,
            unit_number: unitNumber,
            floor,
            unit_code: `TEMP-${Date.now()}`
          })
          .select('id')
          .single();

        if (createWithCodeError && isMissingColumnError(createWithCodeError, 'unit_code')) {
          const { data: createdUnitWithoutCode, error: createWithoutCodeError } = await admin
            .from('units')
            .insert({
              building_id: buildingId,
              unit_number: unitNumber,
              floor
            })
            .select('id')
            .single();

          await ensureSuccess(createWithoutCodeError, 'Daire oluşturulamadı.');
          createdUnit = createdUnitWithoutCode;
        } else {
          await ensureSuccess(createWithCodeError, 'Daire oluşturulamadı.');
          createdUnit = createdUnitWithCode;
        }

        if (!createdUnit?.id) {
          throw new HttpError('Daire kaydı tamamlanamadı.', 400);
        }

        responsePayload.unitId = createdUnit.id;
        responsePayload.unitCode = await refreshUnitCode(admin, createdUnit.id);
        break;
      }
      case 'updateUnit': {
        ensureSuperAdmin(actor);
        const unitId = readTrimmedString(payload.unitId, 'Daire');
        const unitNumber = readTrimmedString(payload.unitNumber, 'Daire numarası', 1);
        const floor = readNumber(payload.floor, 'Kat');
        const { error } = await admin
          .from('units')
          .update({
            unit_number: unitNumber,
            floor
          })
          .eq('id', unitId);
        await ensureSuccess(error, 'Daire güncellenemedi.');
        responsePayload.unitCode = await refreshUnitCode(admin, unitId);
        break;
      }

      case 'deleteUnit': {
        ensureSuperAdmin(actor);
        const unitId = readTrimmedString(payload.unitId, 'Daire');
        const { error } = await admin.from('units').delete().eq('id', unitId);
        await ensureSuccess(error, 'Daire silinemedi.');
        break;
      }

      case 'createResident': {
        ensureSuperAdmin(actor);
        const fullName = readTrimmedString(payload.fullName, 'Ad soyad', 3);
        const phone = readTrimmedString(payload.phone, 'Telefon', 6);
        const title = typeof payload.title === 'string' && payload.title.trim().length >= 2
          ? payload.title.trim()
          : 'Daire Sakini';
        const unitId = readTrimmedString(payload.unitId, 'Daire');
        const unit = await getUnitAuthContext(admin, unitId);
        const { count: existingCount, error: existingError } = await admin
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('unit_id', unitId)
          .in('role', ['resident', 'manager']);
        if (existingError) {
          throw new HttpError(existingError.message || 'Daire hesabı kontrol edilemedi.', 400);
        }
        if ((existingCount ?? 0) > 0) {
          throw new HttpError('Bu daire için zaten bir hesap bulunuyor.', 400);
        }
        const generatedPassword = createRandomSecret(8);
        const authEmail = buildResidentAuthEmail(unit.unitCode);
        const { data: authData, error: authError } = await admin.auth.admin.createUser({
          email: authEmail,
          password: generatedPassword,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
            [RESIDENT_PASSWORD_METADATA_KEY]: generatedPassword,
            [RESIDENT_PASSWORD_UPDATED_AT_KEY]: new Date().toISOString()
          }
        });
        if (authError || !authData.user) {
          throw new HttpError(authError?.message || 'Daire hesabı oluşturulamadı.', 400);
        }
        const { error: profileError } = await admin.from('profiles').insert({
          id: authData.user.id,
          unit_id: unitId,
          primary_building_id: unit.buildingId,
          full_name: fullName,
          role: 'resident',
          phone,
          title,
          login_id: unit.unitCode
        });
        if (profileError) {
          await admin.auth.admin.deleteUser(authData.user.id);
          throw new HttpError(profileError.message || 'Sakin profil kaydı oluşturulamadı.', 400);
        }
        responsePayload.credentials = {
          fullName,
          identifier: unit.unitCode,
          password: generatedPassword,
          role: 'resident'
        };
        break;
      }
      case 'getResidentAccountSnapshot': {
        ensureSuperAdmin(actor);
        const profileId = readTrimmedString(payload.profileId, 'Sakin');
        responsePayload.snapshot = await getResidentAccountSnapshotForProfile(admin, profileId);
        break;
      }
      case 'resetResidentPassword': {
        ensureSuperAdmin(actor);
        const profileId = readTrimmedString(payload.profileId, 'Sakin');
        responsePayload.snapshot = await resetResidentAccountPassword(admin, profileId);
        break;
      }
      case 'updateResident': {
        ensureSuperAdmin(actor);
        const profileId = readTrimmedString(payload.profileId, 'Sakin');
        const fullName = readTrimmedString(payload.fullName, 'Ad soyad', 3);
        const phone = readTrimmedString(payload.phone, 'Telefon', 6);
        const title =
          typeof payload.title === 'string' && payload.title.trim().length >= 2
            ? payload.title.trim()
            : 'Daire Sakini';

        const { data: profile, error: profileError } = await admin
          .from('profiles')
          .select('id, role')
          .eq('id', profileId)
          .maybeSingle();

        if (profileError || !profile || !['resident', 'manager'].includes(profile.role)) {
          throw new HttpError('Seçilen kullanıcı daire sakini değil.', 400);
        }

        const { error } = await admin
          .from('profiles')
          .update({
            full_name: fullName,
            phone,
            title
          })
          .eq('id', profileId);

        await ensureSuccess(error, 'Sakin bilgileri güncellenemedi.');
        break;
      }
      case 'deleteResident': {
        ensureSuperAdmin(actor);
        const profileId = readTrimmedString(payload.profileId, 'Sakin');

        const { data: profile, error: profileError } = await admin
          .from('profiles')
          .select('id, role')
          .eq('id', profileId)
          .maybeSingle();

        if (profileError || !profile || !['resident', 'manager'].includes(profile.role)) {
          throw new HttpError('Seçilen kullanıcı daire sakini değil.', 400);
        }

        const { error: managerAssignmentError } = await admin
          .from('manager_site_assignments')
          .delete()
          .eq('profile_id', profileId);

        await ensureSuccess(managerAssignmentError, 'Yönetici ataması temizlenemedi.');

        const { error: authDeleteError } = await admin.auth.admin.deleteUser(profileId);
        if (authDeleteError) {
          throw new HttpError(authDeleteError.message || 'Sakin hesabı silinemedi.', 400);
        }

        break;
      }
      case 'assignSiteManager': {
        ensureSuperAdmin(actor);
        const siteId = readTrimmedString(payload.siteId, 'Site');
        const profileId = typeof payload.profileId === 'string' ? payload.profileId.trim() : '';

        const { data: formerAssignments, error: formerAssignmentsError } = await admin
          .from('manager_site_assignments')
          .select('id, profile_id')
          .eq('site_id', siteId);

        if (formerAssignmentsError) {
          throw new HttpError(formerAssignmentsError.message || 'Mevcut yönetici bilgisi alınamadı.', 400);
        }

        const formerProfileIds = (formerAssignments ?? []).map((assignment) => assignment.profile_id);

        const { error: clearError } = await admin.from('manager_site_assignments').delete().eq('site_id', siteId);
        await ensureSuccess(clearError, 'Eski site yöneticisi kaydı temizlenemedi.');

        if (profileId) {
          const membership = await getProfileSiteId(admin, profileId);

          if (!['resident', 'manager'].includes(membership.role)) {
            throw new HttpError('Site yöneticisi yalnızca sakinler arasından seçilebilir.', 400);
          }

          if (membership.siteId !== siteId) {
            throw new HttpError('Seçilen sakin bu siteye bağlı değil.', 400);
          }

          const { error: roleError } = await admin
            .from('profiles')
            .update({ role: 'manager' })
            .eq('id', profileId);

          await ensureSuccess(roleError, 'Seçilen sakin yönetici rolüne geçirilemedi.');

          const { error: assignmentError } = await admin.from('manager_site_assignments').insert({
            profile_id: profileId,
            site_id: siteId
          });

          await ensureSuccess(assignmentError, 'Site yöneticisi ataması yapılamadı.');
        }

        await clearFormerManagerRoles(
          admin,
          formerProfileIds.filter((formerProfileId) => formerProfileId !== profileId)
        );
        break;
      }

      case 'createConsultant': {
        ensureSuperAdmin(actor);
        const fullName = readTrimmedString(payload.fullName, 'Ad soyad', 3);
        const phone = readTrimmedString(payload.phone, 'Telefon', 6);
        const normalizedPhone = normalizePhone(phone);
        if (normalizedPhone.length < 10) {
          throw new HttpError('Telefon bilgisi geçerli görünmüyor.', 400);
        }
        const { count: existingConsultantCount, error: existingConsultantError } = await admin
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'consultant')
          .eq('login_id', normalizedPhone);
        if (existingConsultantError) {
          throw new HttpError(existingConsultantError.message || 'Danışman kaydı kontrol edilemedi.', 400);
        }
        if ((existingConsultantCount ?? 0) > 0) {
          throw new HttpError('Bu telefon numarasıyla kayıtlı bir danışman zaten var.', 400);
        }
        const generatedPassword = createRandomSecret(8);
        const authEmail = buildConsultantAuthEmail(phone);
        const { data: authData, error: authError } = await admin.auth.admin.createUser({
          email: authEmail,
          password: generatedPassword,
          email_confirm: true,
          user_metadata: {
            full_name: fullName
          }
        });
        if (authError || !authData.user) {
          throw new HttpError(authError?.message || 'Danışman hesabı oluşturulamadı.', 400);
        }
        const { error: profileError } = await admin.from('profiles').insert({
          id: authData.user.id,
          unit_id: null,
          primary_building_id: null,
          full_name: fullName,
          role: 'consultant',
          phone,
          title: 'Danışman',
          login_id: normalizedPhone
        });
        if (profileError) {
          await admin.auth.admin.deleteUser(authData.user.id);
          throw new HttpError(profileError.message || 'Danışman profil kaydı oluşturulamadı.', 400);
        }
        responsePayload.credentials = {
          fullName,
          identifier: phone,
          password: generatedPassword,
          role: 'consultant'
        };
        break;
      }
      case 'setConsultantAssignment': {
        ensureSuperAdmin(actor);
        const siteId = readTrimmedString(payload.siteId, 'Site');
        const profileId = readTrimmedString(payload.profileId, 'Danışman');
        const assigned = Boolean(payload.assigned);

        const { data: profile, error: profileError } = await admin
          .from('profiles')
          .select('id, role')
          .eq('id', profileId)
          .maybeSingle();

        if (profileError || !profile || profile.role !== 'consultant') {
          throw new HttpError('Seçilen kullanıcı danışman değil.', 400);
        }

        if (assigned) {
          const { error } = await admin.from('consultant_site_assignments').upsert(
            {
              profile_id: profileId,
              site_id: siteId
            },
            {
              onConflict: 'profile_id,site_id'
            }
          );

          await ensureSuccess(error, 'Danışman siteye atanamadı.');
        } else {
          const { error } = await admin
            .from('consultant_site_assignments')
            .delete()
            .eq('site_id', siteId)
            .eq('profile_id', profileId);

          await ensureSuccess(error, 'Danışman ataması kaldırılamadı.');
        }

        break;
      }

      case 'updateServiceProvider': {
        ensureSuperAdmin(actor);
        const providerId = readTrimmedString(payload.providerId, 'Hizmet kaydı');
        const category = readProviderCategory(payload.category);
        const fullName = readTrimmedString(payload.fullName, 'Hizmet adı', 2);
        const phone = readTrimmedString(payload.phone, 'Telefon', 6);
        const note = readTrimmedString(payload.note, 'Not', 2);

        const { error } = await admin
          .from('service_providers')
          .update({
            category,
            full_name: fullName,
            phone,
            note
          })
          .eq('id', providerId);

        await ensureSuccess(error, 'Hizmet kaydı güncellenemedi.');
        break;
      }

      case 'deleteServiceProvider': {
        ensureSuperAdmin(actor);
        const providerId = readTrimmedString(payload.providerId, 'Hizmet kaydı');
        const { error } = await admin.from('service_providers').delete().eq('id', providerId);
        await ensureSuccess(error, 'Hizmet kaydı silinemedi.');
        break;
      }

      case 'upsertSiteInvoicePlan': {
        const siteId = readTrimmedString(payload.siteId, 'Site');
        const amount = readNumber(payload.amount, 'Aidat tutarı');
        const dueDay = readNumber(payload.dueDay, 'Aidat günü');
        const active = Boolean(payload.active);

        if (amount <= 0) {
          throw new HttpError('Aidat tutarı sıfırdan büyük olmalı.', 400);
        }

        if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) {
          throw new HttpError('Aidat günü 1 ile 28 arasında olmalı.', 400);
        }

        await ensureCanManageSite(admin, actor, siteId);

        const { data: existingPlan, error: existingPlanError } = await admin
          .from('site_invoice_plans')
          .select('start_month')
          .eq('site_id', siteId)
          .maybeSingle();

        if (existingPlanError) {
          const message = existingPlanError.message.toLocaleLowerCase('tr-TR');

          if (!message.includes('does not exist') && !message.includes('relation') && !message.includes('column')) {
            throw new HttpError(existingPlanError.message || 'Aidat planı kontrol edilemedi.', 400);
          }
        }

        const { error } = await admin.from('site_invoice_plans').upsert(
          {
            site_id: siteId,
            amount,
            due_day: dueDay,
            active,
            start_month: existingPlan?.start_month ?? new Date().toISOString().slice(0, 7) + '-01',
            updated_at: new Date().toISOString()
          },
          {
            onConflict: 'site_id'
          }
        );

        await ensureSuccess(error, 'Aidat planı kaydedilemedi.');
        await syncSiteInvoices(admin, siteId);
        break;
      }

      case 'syncInvoicePlans': {
        const allowedSiteIds = new Set(await getAccessibleSiteIds(admin, actor));
        const requestedSiteIds = Array.isArray(payload.siteIds)
          ? payload.siteIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          : [];

        const targetSiteIds = (requestedSiteIds.length ? requestedSiteIds : [...allowedSiteIds]).filter((siteId) =>
          allowedSiteIds.has(siteId)
        );

        for (const siteId of targetSiteIds) {
          await syncSiteInvoices(admin, siteId);
        }

        break;
      }

      default:
        throw new HttpError('Yönetim işlemi desteklenmiyor.', 400);
    }

    return NextResponse.json({ ok: true, ...responsePayload });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu.' },
      { status: 500 }
    );
  }
}

