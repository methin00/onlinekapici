import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildUnitCodeMap } from '../src/lib/unit-code';
import { getSupabaseAdminClient } from '../src/lib/supabase/admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SUPER_ADMIN_EMAIL = 'admin@onlinekapici.com';
const SUPER_ADMIN_PASSWORD = 'onlinekapici';

type SiteRow = {
  id: string;
  name: string;
  district: string;
  city: string;
};

type BuildingRow = {
  id: string;
  site_id: string;
  name: string;
};

type UnitRow = {
  id: string;
  building_id: string;
  unit_number: string;
};

type ProfileRole = 'super_admin' | 'consultant' | 'manager' | 'resident' | 'kiosk_device';

type ProfileRow = {
  id: string;
  unit_id: string | null;
  primary_building_id: string | null;
  full_name: string;
  role: ProfileRole;
  phone: string;
  title: string;
  login_id: string;
};

type SiteAssignmentRow = {
  profile_id: string;
  site_id: string;
};

type AuthUserRow = {
  id: string;
  email?: string;
};

type CredentialResult = {
  role: ProfileRole;
  fullName: string;
  identifier: string;
  password: string;
  email: string;
  status: 'updated' | 'created';
};

function loadEnvFile() {
  const envPaths = [
    resolve(__dirname, '../.env.local'),
    resolve(__dirname, '../.env'),
    resolve(__dirname, '../../../.env.local'),
    resolve(__dirname, '../../../.env'),
    resolve(process.cwd(), '.env.local'),
    resolve(process.cwd(), '.env')
  ];

  for (const envPath of envPaths) {
    if (!existsSync(envPath)) {
      continue;
    }

    const rawValue = readFileSync(envPath, 'utf8');

    for (const line of rawValue.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '');
}

function createStableSecret(seed: string, length: number) {
  const digest = createHash('sha256').update(seed).digest();
  let result = '';

  for (let index = 0; index < length; index += 1) {
    result += PASSWORD_ALPHABET[digest[index % digest.length] % PASSWORD_ALPHABET.length];
  }

  return result;
}

function buildResidentAuthEmail(unitCode: string) {
  return `resident-${unitCode.toLowerCase()}@auth.onlinekapici.com`;
}

function buildConsultantAuthEmail(phone: string) {
  return `consultant-${normalizePhone(phone)}@auth.onlinekapici.com`;
}

function buildKioskAuthEmail(loginId: string) {
  return `kiosk-${loginId.toLowerCase()}@auth.onlinekapici.com`;
}

function buildPlaceholderResidentName(buildingName: string, unitNumber: string) {
  return `${buildingName} ${unitNumber} Daire Hesabı`;
}

function buildPlaceholderPhone(index: number) {
  return `555000${String(index).padStart(4, '0')}`;
}

function compareUnitOrder(
  left: UnitRow,
  right: UnitRow,
  buildingsById: Map<string, BuildingRow>,
  sitesById: Map<string, SiteRow>
) {
  const leftBuilding = buildingsById.get(left.building_id);
  const rightBuilding = buildingsById.get(right.building_id);
  const leftSite = leftBuilding ? sitesById.get(leftBuilding.site_id) : undefined;
  const rightSite = rightBuilding ? sitesById.get(rightBuilding.site_id) : undefined;

  return (
    (leftSite?.name ?? '').localeCompare(rightSite?.name ?? '', 'tr-TR') ||
    (leftBuilding?.name ?? '').localeCompare(rightBuilding?.name ?? '', 'tr-TR') ||
    left.unit_number.localeCompare(right.unit_number, 'tr-TR', { numeric: true }) ||
    left.id.localeCompare(right.id, 'tr-TR')
  );
}

async function listAllUsers() {
  const admin = getSupabaseAdminClient();
  const users: AuthUserRow[] = [];
  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200
    });

    if (error) {
      throw new Error(`Auth kullanıcıları alınamadı: ${error.message}`);
    }

    users.push(...data.users.map((user) => ({ id: user.id, email: user.email ?? undefined })));

    if (data.users.length < 200) {
      break;
    }

    page += 1;
  }

  return users;
}

async function main() {
  loadEnvFile();

  const admin = getSupabaseAdminClient();
  const credentials: CredentialResult[] = [];

  const [
    sitesResponse,
    buildingsResponse,
    unitsResponse,
    profilesResponse,
    managerAssignmentsResponse,
    authUsers
  ] = await Promise.all([
    admin.from('sites').select('id, name, district, city'),
    admin.from('buildings').select('id, site_id, name'),
    admin.from('units').select('id, building_id, unit_number'),
    admin
      .from('profiles')
      .select('id, unit_id, primary_building_id, full_name, role, phone, title, login_id'),
    admin.from('manager_site_assignments').select('profile_id, site_id'),
    listAllUsers()
  ]);

  if (sitesResponse.error) {
    throw new Error(`Site kayıtları alınamadı: ${sitesResponse.error.message}`);
  }

  if (buildingsResponse.error) {
    throw new Error(`Blok kayıtları alınamadı: ${buildingsResponse.error.message}`);
  }

  if (unitsResponse.error) {
    throw new Error(`Daire kayıtları alınamadı: ${unitsResponse.error.message}`);
  }

  if (profilesResponse.error) {
    throw new Error(`Profil kayıtları alınamadı: ${profilesResponse.error.message}`);
  }

  if (managerAssignmentsResponse.error) {
    throw new Error(`Yönetici atamaları alınamadı: ${managerAssignmentsResponse.error.message}`);
  }

  const sites = (sitesResponse.data ?? []) as SiteRow[];
  const buildings = (buildingsResponse.data ?? []) as BuildingRow[];
  const units = (unitsResponse.data ?? []) as UnitRow[];
  const profiles = (profilesResponse.data ?? []) as ProfileRow[];
  const managerAssignments = (managerAssignmentsResponse.data ?? []) as SiteAssignmentRow[];

  const sitesById = new Map(sites.map((site) => [site.id, site]));
  const buildingsById = new Map(buildings.map((building) => [building.id, building]));
  const unitsById = new Map(units.map((unit) => [unit.id, unit]));
  const authUsersById = new Map(authUsers.map((user) => [user.id, user]));
  const unitCodeMap = buildUnitCodeMap(
    units.map((unit) => ({
      id: unit.id,
      buildingId: unit.building_id,
      unitNumber: unit.unit_number
    })),
    buildings.map((building) => ({
      id: building.id,
      siteId: building.site_id,
      name: building.name
    })),
    sites.map((site) => ({
      id: site.id,
      name: site.name,
      district: site.district,
      city: site.city
    }))
  );

  const managerSiteIds = new Map<string, string[]>();
  for (const assignment of managerAssignments) {
    const ids = managerSiteIds.get(assignment.profile_id) ?? [];
    ids.push(assignment.site_id);
    managerSiteIds.set(assignment.profile_id, ids);
  }

  const occupiedUnitIds = new Set(
    profiles
      .filter((profile) => ['resident', 'manager'].includes(profile.role) && profile.unit_id)
      .map((profile) => profile.unit_id as string)
  );

  for (const profile of profiles.filter((item) => item.role === 'manager' && !item.unit_id)) {
    const assignedSiteIds = managerSiteIds.get(profile.id) ?? [];
    const candidateUnit = units
      .filter((unit) => {
        const building = buildingsById.get(unit.building_id);
        return building && assignedSiteIds.includes(building.site_id) && !occupiedUnitIds.has(unit.id);
      })
      .sort((left, right) => compareUnitOrder(left, right, buildingsById, sitesById))[0];

    if (!candidateUnit) {
      throw new Error(`${profile.full_name} için atanabilecek boş bir daire bulunamadı.`);
    }

    const { error } = await admin
      .from('profiles')
      .update({
        unit_id: candidateUnit.id,
        primary_building_id: candidateUnit.building_id
      })
      .eq('id', profile.id);

    if (error) {
      throw new Error(`${profile.full_name} daire ataması yapılamadı: ${error.message}`);
    }

    profile.unit_id = candidateUnit.id;
    profile.primary_building_id = candidateUnit.building_id;
    occupiedUnitIds.add(candidateUnit.id);
  }

  const syncExistingAuthUser = async (params: {
    profile: ProfileRow;
    email: string;
    password: string;
    loginId: string;
  }) => {
    const existingUser = authUsersById.get(params.profile.id);

    if (!existingUser) {
      throw new Error(`${params.profile.full_name} için mevcut auth kullanıcısı bulunamadı.`);
    }

    const { error: profileError } = await admin
      .from('profiles')
      .update({
        login_id: params.loginId,
        unit_id: params.profile.unit_id,
        primary_building_id: params.profile.primary_building_id
      })
      .eq('id', params.profile.id);

    if (profileError) {
      throw new Error(`${params.profile.full_name} profili güncellenemedi: ${profileError.message}`);
    }

    const { error: authError } = await admin.auth.admin.updateUserById(params.profile.id, {
      email: params.email,
      password: params.password,
      email_confirm: true,
      user_metadata: {
        full_name: params.profile.full_name,
        role: params.profile.role,
        login_id: params.loginId
      }
    });

    if (authError) {
      throw new Error(`${params.profile.full_name} auth hesabı güncellenemedi: ${authError.message}`);
    }
  };

  for (const profile of profiles) {
    if (profile.role === 'super_admin') {
      await syncExistingAuthUser({
        profile,
        email: SUPER_ADMIN_EMAIL,
        password: SUPER_ADMIN_PASSWORD,
        loginId: SUPER_ADMIN_EMAIL
      });

      credentials.push({
        role: profile.role,
        fullName: profile.full_name,
        identifier: SUPER_ADMIN_EMAIL,
        password: SUPER_ADMIN_PASSWORD,
        email: SUPER_ADMIN_EMAIL,
        status: 'updated'
      });
      continue;
    }

    if (profile.role === 'consultant') {
      const normalizedPhone = normalizePhone(profile.phone || profile.login_id);

      if (normalizedPhone.length < 10) {
        throw new Error(`${profile.full_name} için geçerli bir danışman telefonu bulunamadı.`);
      }

      const password = createStableSecret(`consultant:${normalizedPhone}`, 8);
      await syncExistingAuthUser({
        profile,
        email: buildConsultantAuthEmail(normalizedPhone),
        password,
        loginId: normalizedPhone
      });

      credentials.push({
        role: profile.role,
        fullName: profile.full_name,
        identifier: normalizedPhone,
        password,
        email: buildConsultantAuthEmail(normalizedPhone),
        status: 'updated'
      });
      continue;
    }

    if (profile.role === 'manager' || profile.role === 'resident') {
      if (!profile.unit_id) {
        throw new Error(`${profile.full_name} için daire kaydı bulunamadı.`);
      }

      const unitCode = unitCodeMap.get(profile.unit_id);
      const unit = unitsById.get(profile.unit_id);

      if (!unitCode || !unit) {
        throw new Error(`${profile.full_name} için daire kimliği üretilemedi.`);
      }

      const password = createStableSecret(`${profile.role}:${unitCode}`, 8);
      await syncExistingAuthUser({
        profile,
        email: buildResidentAuthEmail(unitCode),
        password,
        loginId: unitCode
      });

      credentials.push({
        role: profile.role,
        fullName: profile.full_name,
        identifier: unitCode,
        password,
        email: buildResidentAuthEmail(unitCode),
        status: 'updated'
      });

      profile.login_id = unitCode;
      profile.primary_building_id = unit.building_id;
      continue;
    }

    if (profile.role === 'kiosk_device') {
      const password = '123456';
      const loginId = profile.login_id.trim();

      await syncExistingAuthUser({
        profile,
        email: buildKioskAuthEmail(loginId),
        password,
        loginId
      });

      credentials.push({
        role: profile.role,
        fullName: profile.full_name,
        identifier: loginId,
        password,
        email: buildKioskAuthEmail(loginId),
        status: 'updated'
      });
    }
  }

  const accountedUnitIds = new Set(
    profiles
      .filter((profile) => profile.role === 'resident' || profile.role === 'manager')
      .map((profile) => profile.unit_id)
      .filter((value): value is string => Boolean(value))
  );

  let placeholderIndex = 1;

  for (const unit of units
    .filter((item) => !accountedUnitIds.has(item.id))
    .sort((left, right) => compareUnitOrder(left, right, buildingsById, sitesById))) {
    const unitCode = unitCodeMap.get(unit.id);
    const building = buildingsById.get(unit.building_id);

    if (!unitCode || !building) {
      throw new Error(`${unit.id} için eksik daire bilgisi bulundu.`);
    }

    const fullName = buildPlaceholderResidentName(building.name, unit.unit_number);
    const phone = buildPlaceholderPhone(placeholderIndex);
    const password = createStableSecret(`resident:${unitCode}`, 8);
    const email = buildResidentAuthEmail(unitCode);

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: 'resident',
        login_id: unitCode
      }
    });

    if (authError || !authData.user) {
      throw new Error(`${unitCode} için auth hesabı oluşturulamadı: ${authError?.message ?? 'Bilinmeyen hata'}`);
    }

    const { error: profileError } = await admin.from('profiles').insert({
      id: authData.user.id,
      unit_id: unit.id,
      primary_building_id: unit.building_id,
      full_name: fullName,
      role: 'resident',
      phone,
      title: 'Daire Sakini',
      login_id: unitCode
    });

    if (profileError) {
      await admin.auth.admin.deleteUser(authData.user.id);
      throw new Error(`${unitCode} için profil oluşturulamadı: ${profileError.message}`);
    }

    credentials.push({
      role: 'resident',
      fullName,
      identifier: unitCode,
      password,
      email,
      status: 'created'
    });

    placeholderIndex += 1;
  }

  const orderedCredentials = credentials.sort((left, right) => {
    const roleOrder: Record<ProfileRole, number> = {
      super_admin: 0,
      consultant: 1,
      manager: 2,
      resident: 3,
      kiosk_device: 4
    };

    return (
      roleOrder[left.role] - roleOrder[right.role] ||
      left.fullName.localeCompare(right.fullName, 'tr-TR') ||
      left.identifier.localeCompare(right.identifier, 'tr-TR')
    );
  });

  console.log('Canlı auth senkronu tamamlandı.\n');

  for (const item of orderedCredentials) {
    console.log(
      [
        `[${item.status.toUpperCase()}]`,
        item.role,
        item.fullName,
        `kimlik=${item.identifier}`,
        `şifre=${item.password}`,
        `email=${item.email}`
      ].join(' | ')
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
