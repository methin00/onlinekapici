import { NextRequest, NextResponse } from 'next/server';
import type { ProviderCategory } from '@/lib/portal-types';
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

async function requireSuperAdmin(request: NextRequest) {
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
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== 'super_admin') {
    throw new HttpError('Bu işlem için süper yönetici yetkisi gerekiyor.', 403);
  }

  return admin;
}

async function ensureSuccess(error: { message: string } | null, fallbackMessage: string) {
  if (error) {
    throw new HttpError(error.message || fallbackMessage, 400);
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

export async function POST(request: NextRequest) {
  try {
    const admin = await requireSuperAdmin(request);
    const body = (await request.json().catch(() => null)) as
      | { action?: string; payload?: Record<string, unknown> }
      | null;

    if (!body?.action) {
      throw new HttpError('Yönetim işlemi tanınmadı.', 400);
    }

    const payload = body.payload ?? {};

    switch (body.action) {
      case 'createSite': {
        const name = readTrimmedString(payload.name, 'Site adı', 2);
        const address = readTrimmedString(payload.address, 'Adres', 6);
        const district = readTrimmedString(payload.district, 'İlçe', 2);
        const city = readTrimmedString(payload.city, 'Şehir', 2);

        const { error } = await admin.from('sites').insert({
          name,
          address,
          district,
          city
        });

        await ensureSuccess(error, 'Site oluşturulamadı.');
        break;
      }

      case 'deleteSite': {
        const siteId = readTrimmedString(payload.siteId, 'Site');
        const { error } = await admin.from('sites').delete().eq('id', siteId);
        await ensureSuccess(error, 'Site silinemedi.');
        break;
      }

      case 'createBuilding': {
        const siteId = readTrimmedString(payload.siteId, 'Site');
        const name = readTrimmedString(payload.name, 'Blok adı', 1);
        const address = readTrimmedString(payload.address, 'Blok adresi', 4);
        const apiKey = readTrimmedString(payload.apiKey, 'API anahtarı', 4);
        const doorLabel = readTrimmedString(payload.doorLabel, 'Kapı etiketi', 1);
        const kioskCode = readTrimmedString(payload.kioskCode, 'Terminal kodu', 2);

        const { error } = await admin.from('buildings').insert({
          site_id: siteId,
          name,
          address,
          api_key: apiKey,
          door_label: doorLabel,
          kiosk_code: kioskCode
        });

        await ensureSuccess(error, 'Blok oluşturulamadı.');
        break;
      }

      case 'deleteBuilding': {
        const buildingId = readTrimmedString(payload.buildingId, 'Blok');
        const { error } = await admin.from('buildings').delete().eq('id', buildingId);
        await ensureSuccess(error, 'Blok silinemedi.');
        break;
      }

      case 'createUnit': {
        const buildingId = readTrimmedString(payload.buildingId, 'Blok');
        const unitNumber = readTrimmedString(payload.unitNumber, 'Daire numarası', 1);
        const floor = readNumber(payload.floor, 'Kat');

        const { error } = await admin.from('units').insert({
          building_id: buildingId,
          unit_number: unitNumber,
          floor
        });

        await ensureSuccess(error, 'Daire oluşturulamadı.');
        break;
      }

      case 'updateUnit': {
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
        break;
      }

      case 'deleteUnit': {
        const unitId = readTrimmedString(payload.unitId, 'Daire');
        const { error } = await admin.from('units').delete().eq('id', unitId);
        await ensureSuccess(error, 'Daire silinemedi.');
        break;
      }

      case 'createResident': {
        const email = readTrimmedString(payload.email, 'E-posta', 6).toLocaleLowerCase('tr-TR');
        const password = readTrimmedString(payload.password, 'Şifre', 6);
        const fullName = readTrimmedString(payload.fullName, 'Ad soyad', 3);
        const phone = readTrimmedString(payload.phone, 'Telefon', 6);
        const title = readTrimmedString(payload.title, 'Unvan', 2);
        const loginId = readTrimmedString(payload.loginId, 'Giriş kimliği', 3);
        const unitId = readTrimmedString(payload.unitId, 'Daire');

        const { data: unit, error: unitError } = await admin
          .from('units')
          .select('id, building_id')
          .eq('id', unitId)
          .maybeSingle();

        if (unitError || !unit) {
          throw new HttpError('Seçilen daire bulunamadı.', 404);
        }

        const { data: authData, error: authError } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: fullName
          }
        });

        if (authError || !authData.user) {
          throw new HttpError(authError?.message || 'Sakin hesabı oluşturulamadı.', 400);
        }

        const { error: profileError } = await admin.from('profiles').insert({
          id: authData.user.id,
          unit_id: unitId,
          primary_building_id: unit.building_id,
          full_name: fullName,
          role: 'resident',
          phone,
          title,
          login_id: loginId
        });

        if (profileError) {
          await admin.auth.admin.deleteUser(authData.user.id);
          throw new HttpError(profileError.message || 'Sakin profil kaydı oluşturulamadı.', 400);
        }

        break;
      }

      case 'assignSiteManager': {
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

      case 'setConsultantAssignment': {
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
        const providerId = readTrimmedString(payload.providerId, 'Hizmet kaydı');
        const { error } = await admin.from('service_providers').delete().eq('id', providerId);
        await ensureSuccess(error, 'Hizmet kaydı silinemedi.');
        break;
      }

      default:
        throw new HttpError('Yönetim işlemi desteklenmiyor.', 400);
    }

    return NextResponse.json({ ok: true });
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
