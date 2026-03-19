import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type {
  AccessPass,
  Announcement,
  AnnouncementRead,
  Building,
  ConsultantSiteAssignment,
  EmergencyAlert,
  GateEvent,
  GuestRequest,
  InvoiceRecord,
  LogEntry,
  ManagerSiteAssignment,
  NotificationItem,
  PackageEvent,
  PackageRecord,
  PaymentRecord,
  PortalAuthSession,
  PortalRole,
  PortalSessionUser,
  PortalState,
  Profile,
  ResidentPreference,
  ServiceProvider,
  Site,
  Unit
} from '@/lib/portal-types';

type ProfileRow = {
  id: string;
  unit_id: string | null;
  primary_building_id: string | null;
  full_name: string;
  role: PortalRole;
  phone: string;
  title: string;
  login_id: string;
  created_at?: string;
};

type SiteAssignmentRow = {
  site_id: string;
};

type ResidentPreferenceRow = {
  profile_id: string;
  away_mode_enabled: boolean;
  updated_at: string;
};

type BuildingRow = {
  id: string;
  site_id: string;
  name: string;
  address: string;
  api_key: string;
  door_label: string;
  kiosk_code: string;
  created_at?: string;
};

type UnitRow = {
  id: string;
  building_id: string;
  unit_number: string;
  floor: number;
  created_at?: string;
};

type GuestRequestRow = {
  id: string;
  building_id: string;
  unit_id: string;
  guest_name: string;
  type: GuestRequest['type'];
  status: GuestRequest['status'];
  created_at: string;
  expires_at: string;
  decided_at: string | null;
  created_by_profile_id: string | null;
  last_action_by: string | null;
};

type LogRow = {
  id: string;
  building_id: string;
  event_details: string;
  timestamp: string;
};

type AnnouncementRow = {
  id: string;
  site_id: string;
  title: string;
  summary: string;
  category: Announcement['category'];
  published_at: string;
  pinned: boolean;
};

type AnnouncementReadRow = {
  id: string;
  announcement_id: string;
  profile_id: string;
  read_at: string;
};

type InvoiceRow = {
  id: string;
  unit_id: string;
  period_label: string;
  amount: number | string;
  due_date: string;
  status: InvoiceRecord['status'];
  paid_at: string | null;
};

type PaymentRow = {
  id: string;
  invoice_id: string;
  unit_id: string;
  amount: number | string;
  recorded_at: string;
  recorded_by: string;
};

type PackageRow = {
  id: string;
  unit_id: string;
  courier_name: string;
  tracking_code: string;
  status: PackageRecord['status'];
  arrived_at: string;
  delivered_at: string | null;
};

type PackageEventRow = {
  id: string;
  package_id: string;
  note: string;
  created_at: string;
};

type ServiceProviderRow = {
  id: string;
  site_id: string;
  category: ServiceProvider['category'];
  full_name: string;
  phone: string;
  note: string;
  created_at?: string;
};

type ManagerSiteAssignmentRow = {
  id: string;
  profile_id: string;
  site_id: string;
  created_at: string;
};

type ConsultantSiteAssignmentRow = {
  id: string;
  profile_id: string;
  site_id: string;
  created_at: string;
};

type AccessPassRow = {
  id: string;
  unit_id: string;
  holder_name: string;
  type: AccessPass['type'];
  status: AccessPass['status'];
  expires_at: string;
};

type NotificationRow = {
  id: string;
  profile_id: string;
  title: string;
  body: string;
  tone: NotificationItem['tone'];
  created_at: string;
};

type GateEventRow = {
  id: string;
  building_id: string;
  request_id: string | null;
  source: GateEvent['source'];
  result: GateEvent['result'];
  created_at: string;
  actor_name: string;
};

type EmergencyAlertRow = {
  id: string;
  site_id: string;
  title: string;
  status: EmergencyAlert['status'];
  created_at: string;
};

type SiteRow = {
  id: string;
  name: string;
  address: string;
  district: string;
  city: string;
  created_at?: string;
};

function requireRows<T>(error: { message: string } | null, rows: T[] | null, fallbackMessage: string) {
  if (error) {
    throw new Error(error.message || fallbackMessage);
  }

  return rows ?? [];
}

function requireRow<T>(error: { message: string } | null, row: T | null, fallbackMessage: string) {
  if (error) {
    throw new Error(error.message || fallbackMessage);
  }

  if (!row) {
    throw new Error(fallbackMessage);
  }

  return row;
}

function mapSites(rows: SiteRow[]): Site[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    address: row.address,
    district: row.district,
    city: row.city,
    createdAt: row.created_at ?? new Date(0).toISOString()
  }));
}

function mapBuildings(rows: BuildingRow[]): Building[] {
  return rows.map((row) => ({
    id: row.id,
    siteId: row.site_id,
    name: row.name,
    address: row.address,
    apiKey: row.api_key,
    doorLabel: row.door_label,
    kioskCode: row.kiosk_code,
    createdAt: row.created_at ?? new Date(0).toISOString()
  }));
}

function mapUnits(rows: UnitRow[]): Unit[] {
  return rows.map((row) => ({
    id: row.id,
    buildingId: row.building_id,
    unitNumber: row.unit_number,
    floor: row.floor,
    createdAt: row.created_at ?? new Date(0).toISOString()
  }));
}

function mapProfiles(rows: ProfileRow[]): Profile[] {
  return rows.map((row) => ({
    id: row.id,
    unitId: row.unit_id ?? undefined,
    primaryBuildingId: row.primary_building_id ?? undefined,
    fullName: row.full_name,
    role: row.role,
    phone: row.phone,
    title: row.title,
    loginId: row.login_id,
    siteIds: [],
    buildingIds: [],
    createdAt: row.created_at ?? new Date(0).toISOString()
  }));
}

function mapResidentPreferences(rows: ResidentPreferenceRow[]): ResidentPreference[] {
  return rows.map((row) => ({
    profileId: row.profile_id,
    awayModeEnabled: row.away_mode_enabled,
    updatedAt: row.updated_at
  }));
}

function mapGuestRequests(rows: GuestRequestRow[]): GuestRequest[] {
  return rows.map((row) => ({
    id: row.id,
    buildingId: row.building_id,
    unitId: row.unit_id,
    guestName: row.guest_name,
    type: row.type,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    decidedAt: row.decided_at ?? undefined,
    createdByProfileId: row.created_by_profile_id ?? undefined,
    lastActionBy: row.last_action_by ?? undefined
  }));
}

function mapLogs(rows: LogRow[]): LogEntry[] {
  return rows.map((row) => ({
    id: row.id,
    buildingId: row.building_id,
    eventDetails: row.event_details,
    timestamp: row.timestamp
  }));
}

function mapAnnouncements(rows: AnnouncementRow[]): Announcement[] {
  return rows.map((row) => ({
    id: row.id,
    siteId: row.site_id,
    title: row.title,
    summary: row.summary,
    category: row.category,
    publishedAt: row.published_at,
    pinned: row.pinned
  }));
}

function mapAnnouncementReads(rows: AnnouncementReadRow[]): AnnouncementRead[] {
  return rows.map((row) => ({
    id: row.id,
    announcementId: row.announcement_id,
    profileId: row.profile_id,
    readAt: row.read_at
  }));
}

function mapInvoices(rows: InvoiceRow[]): InvoiceRecord[] {
  return rows.map((row) => ({
    id: row.id,
    unitId: row.unit_id,
    periodLabel: row.period_label,
    amount: Number(row.amount),
    dueDate: row.due_date,
    status: row.status,
    paidAt: row.paid_at ?? undefined
  }));
}

function mapPayments(rows: PaymentRow[]): PaymentRecord[] {
  return rows.map((row) => ({
    id: row.id,
    invoiceId: row.invoice_id,
    unitId: row.unit_id,
    amount: Number(row.amount),
    recordedAt: row.recorded_at,
    recordedBy: row.recorded_by
  }));
}

function mapPackages(rows: PackageRow[]): PackageRecord[] {
  return rows.map((row) => ({
    id: row.id,
    unitId: row.unit_id,
    courierName: row.courier_name,
    trackingCode: row.tracking_code || undefined,
    status: row.status,
    arrivedAt: row.arrived_at,
    deliveredAt: row.delivered_at ?? undefined
  }));
}

function mapPackageEvents(rows: PackageEventRow[]): PackageEvent[] {
  return rows.map((row) => ({
    id: row.id,
    packageId: row.package_id,
    note: row.note,
    createdAt: row.created_at
  }));
}

function mapServiceProviders(rows: ServiceProviderRow[]): ServiceProvider[] {
  return rows.map((row) => ({
    id: row.id,
    siteId: row.site_id,
    category: row.category,
    fullName: row.full_name,
    phone: row.phone,
    note: row.note,
    createdAt: row.created_at ?? new Date(0).toISOString()
  }));
}

function mapManagerSiteAssignments(rows: ManagerSiteAssignmentRow[]): ManagerSiteAssignment[] {
  return rows.map((row) => ({
    id: row.id,
    profileId: row.profile_id,
    siteId: row.site_id,
    createdAt: row.created_at
  }));
}

function mapConsultantSiteAssignments(rows: ConsultantSiteAssignmentRow[]): ConsultantSiteAssignment[] {
  return rows.map((row) => ({
    id: row.id,
    profileId: row.profile_id,
    siteId: row.site_id,
    createdAt: row.created_at
  }));
}

function mapAccessPasses(rows: AccessPassRow[]): AccessPass[] {
  return rows.map((row) => ({
    id: row.id,
    unitId: row.unit_id,
    holderName: row.holder_name,
    type: row.type,
    status: row.status,
    expiresAt: row.expires_at
  }));
}

function mapNotifications(rows: NotificationRow[]): NotificationItem[] {
  return rows.map((row) => ({
    id: row.id,
    profileId: row.profile_id,
    title: row.title,
    body: row.body,
    tone: row.tone,
    createdAt: row.created_at
  }));
}

function mapGateEvents(rows: GateEventRow[]): GateEvent[] {
  return rows.map((row) => ({
    id: row.id,
    buildingId: row.building_id,
    requestId: row.request_id ?? undefined,
    source: row.source,
    result: row.result,
    createdAt: row.created_at,
    actorName: row.actor_name
  }));
}

function mapEmergencyAlerts(rows: EmergencyAlertRow[]): EmergencyAlert[] {
  return rows.map((row) => ({
    id: row.id,
    siteId: row.site_id,
    title: row.title,
    status: row.status,
    createdAt: row.created_at
  }));
}

export function createEmptyPortalState(): PortalState {
  return {
    sites: [],
    buildings: [],
    units: [],
    profiles: [],
    residentPreferences: [],
    managerSiteAssignments: [],
    consultantSiteAssignments: [],
    guestRequests: [],
    logs: [],
    announcements: [],
    announcementReads: [],
    invoices: [],
    payments: [],
    packages: [],
    packageEvents: [],
    serviceProviders: [],
    accessPasses: [],
    notifications: [],
    gateEvents: [],
    emergencyAlerts: []
  };
}

export async function buildPortalSessionUser(client: SupabaseClient, authUserId: string) {
  const { data: profileData, error: profileError } = await client
    .from('profiles')
    .select('id, unit_id, primary_building_id, full_name, role, phone, title, login_id')
    .eq('id', authUserId)
    .maybeSingle();

  const profile = requireRow<ProfileRow>(profileError, profileData, 'Profil kaydı bulunamadı.');

  let siteIds: string[] = [];
  let buildingIds: string[] = [];

  if (profile.role === 'super_admin') {
    const [{ data: siteRows, error: siteError }, { data: buildingRows, error: buildingError }] = await Promise.all([
      client.from('sites').select('id'),
      client.from('buildings').select('id')
    ]);

    siteIds = requireRows(siteError, siteRows as Array<{ id: string }> | null, 'Site kayıtları alınamadı.').map((row) => row.id);
    buildingIds = requireRows(
      buildingError,
      buildingRows as Array<{ id: string }> | null,
      'Bina kayıtları alınamadı.'
    ).map((row) => row.id);
  }

  if (profile.role === 'manager') {
    const { data: siteAssignments, error: siteAssignmentError } = await client
      .from('manager_site_assignments')
      .select('site_id')
      .eq('profile_id', profile.id);

    siteIds = requireRows(
      siteAssignmentError,
      siteAssignments as SiteAssignmentRow[] | null,
      'Yönetici atamaları alınamadı.'
    ).map((row) => row.site_id);

    if (siteIds.length) {
      const { data: buildingRows, error: buildingError } = await client
        .from('buildings')
        .select('id')
        .in('site_id', siteIds);

      buildingIds = requireRows(
        buildingError,
        buildingRows as Array<{ id: string }> | null,
        'Site binaları alınamadı.'
      ).map((row) => row.id);
    }
  }

  if (profile.role === 'consultant') {
    const { data: siteAssignments, error: siteAssignmentError } = await client
      .from('consultant_site_assignments')
      .select('site_id')
      .eq('profile_id', profile.id);

    siteIds = requireRows(
      siteAssignmentError,
      siteAssignments as SiteAssignmentRow[] | null,
      'Danışma atamaları alınamadı.'
    ).map((row) => row.site_id);

    if (siteIds.length) {
      const { data: buildingRows, error: buildingError } = await client
        .from('buildings')
        .select('id')
        .in('site_id', siteIds);

      buildingIds = requireRows(
        buildingError,
        buildingRows as Array<{ id: string }> | null,
        'Bina kayıtları alınamadı.'
      ).map((row) => row.id);
    }
  }

  if (profile.role === 'resident' && profile.unit_id) {
    const { data: unitRow, error: unitError } = await client
      .from('units')
      .select('id, building_id')
      .eq('id', profile.unit_id)
      .maybeSingle();

    const unit = requireRow<UnitRow>(unitError, unitRow as UnitRow | null, 'Daire bilgisi alınamadı.');
    buildingIds = [unit.building_id];

    const { data: buildingRow, error: buildingError } = await client
      .from('buildings')
      .select('id, site_id')
      .eq('id', unit.building_id)
      .maybeSingle();

    const building = requireRow<{ id: string; site_id: string }>(
      buildingError,
      buildingRow as { id: string; site_id: string } | null,
      'Bina bilgisi alınamadı.'
    );
    siteIds = [building.site_id];
  }

  if (profile.role === 'kiosk_device' && profile.primary_building_id) {
    buildingIds = [profile.primary_building_id];

    const { data: buildingRow, error: buildingError } = await client
      .from('buildings')
      .select('id, site_id')
      .eq('id', profile.primary_building_id)
      .maybeSingle();

    const building = requireRow<{ id: string; site_id: string }>(
      buildingError,
      buildingRow as { id: string; site_id: string } | null,
      'Terminal bina kaydı alınamadı.'
    );
    siteIds = [building.site_id];
  }

  return {
    id: profile.id,
    fullName: profile.full_name,
    role: profile.role,
    phone: profile.phone,
    title: profile.title,
    loginId: profile.login_id,
    siteIds,
    buildingIds,
    unitId: profile.unit_id ?? undefined
  } satisfies PortalSessionUser;
}

export async function buildPortalAuthSession(client: SupabaseClient, authSession: Session) {
  const user = await buildPortalSessionUser(client, authSession.user.id);

  return {
    token: authSession.access_token,
    mode: 'supabase',
    user
  } satisfies PortalAuthSession;
}

export async function fetchPortalState(client: SupabaseClient, user: PortalSessionUser) {
  const [
    sitesResponse,
    buildingsResponse,
    unitsResponse,
    profilesResponse,
    residentPreferencesResponse,
    managerAssignmentsResponse,
    consultantAssignmentsResponse,
    guestRequestsResponse,
    logsResponse,
    announcementsResponse,
    announcementReadsResponse,
    invoicesResponse,
    paymentsResponse,
    packagesResponse,
    packageEventsResponse,
    serviceProvidersResponse,
    accessPassesResponse,
    notificationsResponse,
    gateEventsResponse,
    emergencyAlertsResponse
  ] = await Promise.all([
    client.from('sites').select('id, name, address, district, city, created_at').order('name'),
    client
      .from('buildings')
      .select('id, site_id, name, address, api_key, door_label, kiosk_code, created_at')
      .order('name'),
    client
      .from('units')
      .select('id, building_id, unit_number, floor, created_at')
      .order('floor')
      .order('unit_number'),
    client
      .from('profiles')
      .select('id, unit_id, primary_building_id, full_name, role, phone, title, login_id, created_at')
      .order('full_name'),
    client
      .from('resident_preferences')
      .select('profile_id, away_mode_enabled, updated_at')
      .order('updated_at', { ascending: false }),
    client
      .from('manager_site_assignments')
      .select('id, profile_id, site_id, created_at')
      .order('created_at', { ascending: false }),
    client
      .from('consultant_site_assignments')
      .select('id, profile_id, site_id, created_at')
      .order('created_at', { ascending: false }),
    client
      .from('guest_requests')
      .select('id, building_id, unit_id, guest_name, type, status, created_at, expires_at, decided_at, created_by_profile_id, last_action_by')
      .order('created_at', { ascending: false }),
    client.from('logs').select('id, building_id, event_details, timestamp').order('timestamp', { ascending: false }),
    client
      .from('announcements')
      .select('id, site_id, title, summary, category, pinned, published_at')
      .order('published_at', { ascending: false }),
    client
      .from('announcement_reads')
      .select('id, announcement_id, profile_id, read_at')
      .eq('profile_id', user.id),
    client
      .from('invoices')
      .select('id, unit_id, period_label, amount, due_date, status, paid_at')
      .order('due_date', { ascending: false }),
    client
      .from('payment_records')
      .select('id, invoice_id, unit_id, amount, recorded_at, recorded_by')
      .order('recorded_at', { ascending: false }),
    client
      .from('packages')
      .select('id, unit_id, courier_name, tracking_code, status, arrived_at, delivered_at')
      .order('arrived_at', { ascending: false }),
    client
      .from('package_events')
      .select('id, package_id, note, created_at')
      .order('created_at', { ascending: false }),
    client
      .from('service_providers')
      .select('id, site_id, category, full_name, phone, note, created_at')
      .order('full_name'),
    client
      .from('access_passes')
      .select('id, unit_id, holder_name, type, status, expires_at')
      .order('expires_at', { ascending: false }),
    client
      .from('notifications')
      .select('id, profile_id, title, body, tone, created_at')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false }),
    client
      .from('gate_events')
      .select('id, building_id, request_id, source, result, actor_name, created_at')
      .order('created_at', { ascending: false }),
    client
      .from('emergency_alerts')
      .select('id, site_id, title, status, created_at')
      .order('created_at', { ascending: false })
  ]);

  return {
    sites: mapSites(requireRows(sitesResponse.error, sitesResponse.data as SiteRow[] | null, 'Site listesi alınamadı.')),
    buildings: mapBuildings(
      requireRows(buildingsResponse.error, buildingsResponse.data as BuildingRow[] | null, 'Bina listesi alınamadı.')
    ),
    units: mapUnits(requireRows(unitsResponse.error, unitsResponse.data as UnitRow[] | null, 'Daire listesi alınamadı.')),
    profiles: mapProfiles(
      requireRows(profilesResponse.error, profilesResponse.data as ProfileRow[] | null, 'Profil listesi alınamadı.')
    ),
    residentPreferences: mapResidentPreferences(
      requireRows(
        residentPreferencesResponse.error,
        residentPreferencesResponse.data as ResidentPreferenceRow[] | null,
        'Sakin tercihleri alınamadı.'
      )
    ),
    managerSiteAssignments: mapManagerSiteAssignments(
      requireRows(
        managerAssignmentsResponse.error,
        managerAssignmentsResponse.data as ManagerSiteAssignmentRow[] | null,
        'Site yöneticisi atamaları alınamadı.'
      )
    ),
    consultantSiteAssignments: mapConsultantSiteAssignments(
      requireRows(
        consultantAssignmentsResponse.error,
        consultantAssignmentsResponse.data as ConsultantSiteAssignmentRow[] | null,
        'Danışman atamaları alınamadı.'
      )
    ),
    guestRequests: mapGuestRequests(
      requireRows(
        guestRequestsResponse.error,
        guestRequestsResponse.data as GuestRequestRow[] | null,
        'Çağrı listesi alınamadı.'
      )
    ),
    logs: mapLogs(requireRows(logsResponse.error, logsResponse.data as LogRow[] | null, 'Kayıt akışı alınamadı.')),
    announcements: mapAnnouncements(
      requireRows(
        announcementsResponse.error,
        announcementsResponse.data as AnnouncementRow[] | null,
        'Duyurular alınamadı.'
      )
    ),
    announcementReads: mapAnnouncementReads(
      requireRows(
        announcementReadsResponse.error,
        announcementReadsResponse.data as AnnouncementReadRow[] | null,
        'Duyuru okuma kayıtları alınamadı.'
      )
    ),
    invoices: mapInvoices(
      requireRows(invoicesResponse.error, invoicesResponse.data as InvoiceRow[] | null, 'Aidat kayıtları alınamadı.')
    ),
    payments: mapPayments(
      requireRows(paymentsResponse.error, paymentsResponse.data as PaymentRow[] | null, 'Ödeme hareketleri alınamadı.')
    ),
    packages: mapPackages(
      requireRows(packagesResponse.error, packagesResponse.data as PackageRow[] | null, 'Kargo kayıtları alınamadı.')
    ),
    packageEvents: mapPackageEvents(
      requireRows(
        packageEventsResponse.error,
        packageEventsResponse.data as PackageEventRow[] | null,
        'Kargo hareketleri alınamadı.'
      )
    ),
    serviceProviders: mapServiceProviders(
      requireRows(
        serviceProvidersResponse.error,
        serviceProvidersResponse.data as ServiceProviderRow[] | null,
        'Servis rehberi alınamadı.'
      )
    ),
    accessPasses: mapAccessPasses(
      requireRows(
        accessPassesResponse.error,
        accessPassesResponse.data as AccessPassRow[] | null,
        'Geçiş kayıtları alınamadı.'
      )
    ),
    notifications: mapNotifications(
      requireRows(
        notificationsResponse.error,
        notificationsResponse.data as NotificationRow[] | null,
        'Bildirim listesi alınamadı.'
      )
    ),
    gateEvents: mapGateEvents(
      requireRows(
        gateEventsResponse.error,
        gateEventsResponse.data as GateEventRow[] | null,
        'Kapı hareketleri alınamadı.'
      )
    ),
    emergencyAlerts: mapEmergencyAlerts(
      requireRows(
        emergencyAlertsResponse.error,
        emergencyAlertsResponse.data as EmergencyAlertRow[] | null,
        'Acil durum kayıtları alınamadı.'
      )
    )
  } satisfies PortalState;
}
