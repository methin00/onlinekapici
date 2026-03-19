import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { portalSeedState } from '../src/lib/portal-seed';
import { getSupabaseAdminClient } from '../src/lib/supabase/admin';
import type { PortalRole } from '../src/lib/portal-types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const EMPTY_UUID = '00000000-0000-0000-0000-000000000000';
const TABLE_CLEAR_KEY: Record<string, string> = {
  resident_preferences: 'profile_id'
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

function stableUuid(seed: string) {
  const hash = createHash('md5').update(seed).digest('hex').split('');
  hash[12] = '4';
  hash[16] = ['8', '9', 'a', 'b'][Number.parseInt(hash[16], 16) % 4];

  return `${hash.slice(0, 8).join('')}-${hash.slice(8, 12).join('')}-${hash.slice(12, 16).join('')}-${hash
    .slice(16, 20)
    .join('')}-${hash.slice(20, 32).join('')}`;
}

async function clearTable(tableName: string) {
  const supabase = getSupabaseAdminClient();
  const clearKey = TABLE_CLEAR_KEY[tableName] ?? 'id';
  const { error } = await supabase.from(tableName).delete().neq(clearKey, EMPTY_UUID);

  if (error) {
    throw new Error(`${tableName} temizlenemedi: ${error.message}`);
  }
}

async function upsertRows(tableName: string, rows: Record<string, unknown>[], onConflict?: string) {
  if (!rows.length) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from(tableName).upsert(rows, onConflict ? { onConflict } : undefined);

  if (error) {
    throw new Error(`${tableName} yazılamadı: ${error.message}`);
  }
}

async function listAllUsers() {
  const supabase = getSupabaseAdminClient();
  const users = [];
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200
    });

    if (error) {
      throw new Error(`Auth kullanıcıları alınamadı: ${error.message}`);
    }

    users.push(...data.users);

    if (data.users.length < 200) {
      break;
    }

    page += 1;
  }

  return users;
}

async function ensureAuthUsers() {
  const supabase = getSupabaseAdminClient();
  const existingUsers = await listAllUsers();
  const existingUserMap = new Map(existingUsers.map((user) => [user.email ?? '', user]));
  const authUserIdBySeedProfileId = new Map<string, string>();

  for (const profile of portalSeedState.profiles) {
    const email = profile.email;
    const password = profile.password ?? '123456';
    const metadata = {
      full_name: profile.fullName,
      role: profile.role,
      login_id: profile.loginId
    };

    if (!email) {
      throw new Error(`${profile.fullName} için auth e-posta adresi tanımlı değil.`);
    }

    const existingUser =
      existingUserMap.get(email) ??
      existingUsers.find((user) => {
        const userMetadata = (user.user_metadata ?? {}) as {
          login_id?: string;
          role?: string;
        };

        return userMetadata.login_id === profile.loginId && userMetadata.role === profile.role;
      });

    if (!existingUser) {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: metadata
      });

      if (error || !data.user) {
        throw new Error(`${profile.fullName} için auth hesabı açılamadı: ${error?.message ?? 'Bilinmeyen hata'}`);
      }

      authUserIdBySeedProfileId.set(profile.id, data.user.id);
      existingUserMap.set(email, data.user);
      continue;
    }

    const { data, error } = await supabase.auth.admin.updateUserById(existingUser.id, {
      email,
      password,
      user_metadata: metadata
    });

    if (error || !data.user) {
      throw new Error(`${profile.fullName} için auth hesabı güncellenemedi: ${error?.message ?? 'Bilinmeyen hata'}`);
    }

    authUserIdBySeedProfileId.set(profile.id, data.user.id);
  }

  return authUserIdBySeedProfileId;
}

function toDateOnly(value: string) {
  return value.includes('T') ? value.split('T')[0] : value;
}

async function main() {
  loadEnvFile();

  const authUserMap = await ensureAuthUsers();
  const siteIdMap = new Map(portalSeedState.sites.map((site) => [site.id, stableUuid(`site:${site.id}`)]));
  const buildingIdMap = new Map(
    portalSeedState.buildings.map((building) => [building.id, stableUuid(`building:${building.id}`)])
  );
  const unitIdMap = new Map(portalSeedState.units.map((unit) => [unit.id, stableUuid(`unit:${unit.id}`)]));

  const resetOrder = [
    'announcement_reads',
    'notifications',
    'package_events',
    'payment_records',
    'gate_events',
    'guest_requests',
    'packages',
    'access_passes',
    'logs',
    'announcements',
    'invoices',
    'service_providers',
    'emergency_alerts',
    'manager_site_assignments',
    'consultant_site_assignments',
    'resident_preferences',
    'profiles',
    'units',
    'buildings',
    'sites'
  ];

  for (const tableName of resetOrder) {
    await clearTable(tableName);
  }

  await upsertRows(
    'sites',
    portalSeedState.sites.map((site) => ({
      id: siteIdMap.get(site.id),
      name: site.name,
      address: site.address,
      district: site.district,
      city: site.city
    })),
    'id'
  );

  await upsertRows(
    'buildings',
    portalSeedState.buildings.map((building) => ({
      id: buildingIdMap.get(building.id),
      site_id: siteIdMap.get(building.siteId),
      name: building.name,
      address: building.address,
      api_key: building.apiKey,
      door_label: building.doorLabel,
      kiosk_code: building.kioskCode
    })),
    'id'
  );

  await upsertRows(
    'units',
    portalSeedState.units.map((unit) => ({
      id: unitIdMap.get(unit.id),
      building_id: buildingIdMap.get(unit.buildingId),
      unit_number: unit.unitNumber,
      floor: unit.floor
    })),
    'id'
  );

  await upsertRows(
    'profiles',
    portalSeedState.profiles.map((profile) => ({
      id: authUserMap.get(profile.id),
      unit_id: profile.unitId ? unitIdMap.get(profile.unitId) : null,
      primary_building_id:
        profile.role === 'kiosk_device' && profile.buildingIds[0] ? buildingIdMap.get(profile.buildingIds[0]) : null,
      full_name: profile.fullName,
      role: profile.role as PortalRole,
      phone: profile.phone,
      title: profile.title,
      login_id: profile.loginId
    })),
    'id'
  );

  await upsertRows(
    'resident_preferences',
    portalSeedState.residentPreferences.map((item) => ({
      profile_id: authUserMap.get(item.profileId),
      away_mode_enabled: item.awayModeEnabled,
      updated_at: item.updatedAt
    })),
    'profile_id'
  );

  await upsertRows(
    'manager_site_assignments',
    portalSeedState.profiles
      .filter((profile) => profile.role === 'manager')
      .flatMap((profile) =>
        profile.siteIds.map((siteId) => ({
          id: stableUuid(`manager-assignment:${profile.id}:${siteId}`),
          profile_id: authUserMap.get(profile.id),
          site_id: siteIdMap.get(siteId)
        }))
      ),
    'profile_id,site_id'
  );

  await upsertRows(
    'consultant_site_assignments',
    portalSeedState.profiles
      .filter((profile) => profile.role === 'consultant')
      .flatMap((profile) =>
        profile.siteIds.map((siteId) => ({
          id: stableUuid(`consultant-assignment:${profile.id}:${siteId}`),
          profile_id: authUserMap.get(profile.id),
          site_id: siteIdMap.get(siteId)
        }))
      ),
    'profile_id,site_id'
  );

  await upsertRows(
    'guest_requests',
    portalSeedState.guestRequests.map((request) => ({
      id: stableUuid(`guest-request:${request.id}`),
      building_id: buildingIdMap.get(request.buildingId),
      unit_id: unitIdMap.get(request.unitId),
      guest_name: request.guestName,
      type: request.type,
      status: request.status === 'expired' ? 'redirected' : request.status,
      created_at: request.createdAt,
      expires_at: request.expiresAt,
      decided_at: request.decidedAt ?? null,
      created_by_profile_id: request.createdByProfileId ? authUserMap.get(request.createdByProfileId) : null,
      last_action_by: request.lastActionBy ?? null
    })),
    'id'
  );

  await upsertRows(
    'announcements',
    portalSeedState.announcements.map((announcement) => ({
      id: stableUuid(`announcement:${announcement.id}`),
      site_id: siteIdMap.get(announcement.siteId),
      title: announcement.title,
      summary: announcement.summary,
      category: announcement.category,
      pinned: announcement.pinned,
      published_at: announcement.publishedAt
    })),
    'id'
  );

  await upsertRows(
    'invoices',
    portalSeedState.invoices.map((invoice) => ({
      id: stableUuid(`invoice:${invoice.id}`),
      unit_id: unitIdMap.get(invoice.unitId),
      period_label: invoice.periodLabel,
      amount: invoice.amount,
      due_date: toDateOnly(invoice.dueDate),
      status: invoice.status,
      paid_at: invoice.paidAt ?? null
    })),
    'id'
  );

  await upsertRows(
    'payment_records',
    portalSeedState.payments.map((payment) => ({
      id: stableUuid(`payment:${payment.id}`),
      invoice_id: stableUuid(`invoice:${payment.invoiceId}`),
      unit_id: unitIdMap.get(payment.unitId),
      amount: payment.amount,
      recorded_at: payment.recordedAt,
      recorded_by: payment.recordedBy
    })),
    'id'
  );

  await upsertRows(
    'packages',
    portalSeedState.packages.map((item) => ({
      id: stableUuid(`package:${item.id}`),
      unit_id: unitIdMap.get(item.unitId),
      courier_name: item.courierName,
      tracking_code: item.trackingCode ?? '',
      status: item.status,
      arrived_at: item.arrivedAt,
      delivered_at: item.deliveredAt ?? null
    })),
    'id'
  );

  await upsertRows(
    'service_providers',
    portalSeedState.serviceProviders.map((provider) => ({
      id: stableUuid(`service-provider:${provider.id}`),
      site_id: siteIdMap.get(provider.siteId),
      category: provider.category,
      full_name: provider.fullName,
      phone: provider.phone,
      note: provider.note
    })),
    'id'
  );

  await upsertRows(
    'access_passes',
    portalSeedState.accessPasses.map((pass) => ({
      id: stableUuid(`access-pass:${pass.id}`),
      unit_id: unitIdMap.get(pass.unitId),
      holder_name: pass.holderName,
      type: pass.type,
      status: pass.status,
      expires_at: pass.expiresAt
    })),
    'id'
  );

  await upsertRows(
    'gate_events',
    portalSeedState.gateEvents.map((event) => ({
      id: stableUuid(`gate-event:${event.id}`),
      building_id: buildingIdMap.get(event.buildingId),
      request_id: event.requestId ? stableUuid(`guest-request:${event.requestId}`) : null,
      source: event.source,
      result: event.result,
      actor_name: event.actorName,
      created_at: event.createdAt
    })),
    'id'
  );

  await upsertRows(
    'emergency_alerts',
    portalSeedState.emergencyAlerts.map((alert) => ({
      id: stableUuid(`emergency-alert:${alert.id}`),
      site_id: siteIdMap.get(alert.siteId),
      title: alert.title,
      status: alert.status,
      created_at: alert.createdAt
    })),
    'id'
  );

  await clearTable('logs');
  await clearTable('package_events');
  await clearTable('notifications');
  await clearTable('announcement_reads');

  await upsertRows(
    'logs',
    portalSeedState.logs.map((log) => ({
      id: stableUuid(`log:${log.id}`),
      building_id: buildingIdMap.get(log.buildingId),
      event_details: log.eventDetails,
      timestamp: log.timestamp
    })),
    'id'
  );

  await upsertRows(
    'package_events',
    portalSeedState.packageEvents.map((event) => ({
      id: stableUuid(`package-event:${event.id}`),
      package_id: stableUuid(`package:${event.packageId}`),
      note: event.note,
      created_at: event.createdAt
    })),
    'id'
  );

  await upsertRows(
    'notifications',
    portalSeedState.notifications.map((notification) => ({
      id: stableUuid(`notification:${notification.id}`),
      profile_id: authUserMap.get(notification.profileId),
      title: notification.title,
      body: notification.body,
      tone: notification.tone,
      created_at: notification.createdAt
    })),
    'id'
  );

  await upsertRows(
    'announcement_reads',
    portalSeedState.announcementReads.map((item) => ({
      id: stableUuid(`announcement-read:${item.id}`),
      announcement_id: stableUuid(`announcement:${item.announcementId}`),
      profile_id: authUserMap.get(item.profileId),
      read_at: item.readAt
    })),
    'id'
  );

  const credentialSummary = portalSeedState.profiles.map((profile) => ({
    rol: profile.role,
    kullanici: profile.email ?? '-',
    sifre: profile.password ?? '123456',
    loginKodu: profile.loginId
  }));

  console.table(credentialSummary);
  console.log('Supabase örnek verileri ve kullanıcı hesapları hazır.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
