import type {
  Building,
  GuestRequest,
  InvoiceRecord,
  PackageRecord,
  PortalSessionUser,
  PortalState,
  Profile,
  Site,
  Unit
} from './portal-types';

export function getSiteById(state: PortalState, siteId: string) {
  return state.sites.find((site) => site.id === siteId) ?? null;
}

export function getBuildingById(state: PortalState, buildingId: string) {
  return state.buildings.find((building) => building.id === buildingId) ?? null;
}

export function getUnitById(state: PortalState, unitId: string) {
  return state.units.find((unit) => unit.id === unitId) ?? null;
}

export function getResidentProfileByUnitId(state: PortalState, unitId: string) {
  return state.profiles.find((profile) => profile.role === 'resident' && profile.unitId === unitId) ?? null;
}

export function getUnitsForBuildings(state: PortalState, buildingIds: string[]) {
  const buildingIdSet = new Set(buildingIds);
  return state.units.filter((unit) => buildingIdSet.has(unit.buildingId));
}

export function getVisibleSites(state: PortalState, user: PortalSessionUser) {
  const siteIdSet = new Set(user.siteIds);
  return state.sites.filter((site) => siteIdSet.has(site.id));
}

export function getVisibleBuildings(state: PortalState, user: PortalSessionUser) {
  if (user.role === 'resident' && user.unitId) {
    const unit = getUnitById(state, user.unitId);
    return unit ? state.buildings.filter((building) => building.id === unit.buildingId) : [];
  }

  const buildingIdSet = new Set(user.buildingIds);
  return state.buildings.filter((building) => buildingIdSet.has(building.id));
}

export function getVisibleUnits(state: PortalState, user: PortalSessionUser) {
  if (user.role === 'resident' && user.unitId) {
    const unit = getUnitById(state, user.unitId);
    return unit ? [unit] : [];
  }

  return getUnitsForBuildings(state, user.buildingIds);
}

export function getRequestsForUser(state: PortalState, user: PortalSessionUser) {
  if (user.role === 'resident' && user.unitId) {
    return state.guestRequests.filter((request) => request.unitId === user.unitId);
  }

  const visibleBuildings = new Set(getVisibleBuildings(state, user).map((building) => building.id));
  return state.guestRequests.filter((request) => visibleBuildings.has(request.buildingId));
}

export function getInvoicesForUser(state: PortalState, user: PortalSessionUser) {
  if (user.role === 'resident' && user.unitId) {
    return state.invoices.filter((invoice) => invoice.unitId === user.unitId);
  }

  const unitIds = new Set(getVisibleUnits(state, user).map((unit) => unit.id));
  return state.invoices.filter((invoice) => unitIds.has(invoice.unitId));
}

export function getPackagesForUser(state: PortalState, user: PortalSessionUser) {
  if (user.role === 'resident' && user.unitId) {
    return state.packages.filter((item) => item.unitId === user.unitId);
  }

  const unitIds = new Set(getVisibleUnits(state, user).map((unit) => unit.id));
  return state.packages.filter((item) => unitIds.has(item.unitId));
}

export function getAnnouncementsForUser(state: PortalState, user: PortalSessionUser) {
  const siteIds = new Set(user.siteIds);
  return state.announcements.filter((announcement) => siteIds.has(announcement.siteId));
}

export function getServiceProvidersForUser(state: PortalState, user: PortalSessionUser) {
  const siteIds = new Set(user.siteIds);
  return state.serviceProviders.filter((provider) => siteIds.has(provider.siteId));
}

export function getUnreadAnnouncementCount(state: PortalState, user: PortalSessionUser) {
  const announcements = getAnnouncementsForUser(state, user);
  const readIds = new Set(
    state.announcementReads
      .filter((entry) => entry.profileId === user.id)
      .map((entry) => entry.announcementId)
  );

  return announcements.filter((announcement) => !readIds.has(announcement.id)).length;
}

export function getPendingRequest(requests: GuestRequest[]) {
  return requests.find((request) => request.status === 'pending') ?? null;
}

export function getOpenRequests(requests: GuestRequest[]) {
  return requests.filter((request) => request.status === 'pending');
}

export function getFallenRequests(requests: GuestRequest[]) {
  return requests.filter((request) => request.status === 'rejected' || request.status === 'redirected');
}

export function countInvoiceStatus(invoices: InvoiceRecord[]) {
  return invoices.reduce(
    (accumulator, invoice) => {
      accumulator.total += 1;
      accumulator[invoice.status] += 1;
      return accumulator;
    },
    {
      total: 0,
      paid: 0,
      unpaid: 0,
      overdue: 0
    }
  );
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'long'
  }).format(new Date(value));
}

export function requestTypeLabel(type: GuestRequest['type']) {
  switch (type) {
    case 'guest':
      return 'Misafir';
    case 'courier':
      return 'Kurye';
    case 'service':
      return 'Teknik servis';
  }
}

export function requestStatusLabel(status: GuestRequest['status']) {
  switch (status) {
    case 'pending':
      return 'Bekliyor';
    case 'approved':
      return 'Onaylandı';
    case 'rejected':
      return 'Reddedildi';
    case 'redirected':
      return 'Danışmaya aktarıldı';
    case 'expired':
      return 'Süre doldu';
  }
}

export function packageStatusLabel(status: PackageRecord['status']) {
  switch (status) {
    case 'at_desk':
      return 'Teslim alınmayı bekliyor';
    case 'on_the_way':
      return 'Yolda';
    case 'delivered':
      return 'Teslim edildi';
  }
}

export function profileNameForUnit(state: PortalState, unitId: string) {
  return getResidentProfileByUnitId(state, unitId)?.fullName ?? 'Atanmamış daire';
}

export function buildingNameForUnit(state: PortalState, unitId: string) {
  const unit = getUnitById(state, unitId);
  if (!unit) {
    return 'Blok';
  }

  return getBuildingById(state, unit.buildingId)?.name ?? 'Blok';
}

export function unitLabel(state: PortalState, unitId: string) {
  const unit = getUnitById(state, unitId);
  if (!unit) {
    return 'Daire';
  }

  const building = getBuildingById(state, unit.buildingId);
  return `${building?.name ?? 'Blok'} · Daire ${unit.unitNumber} · ${unit.unitCode}`;
}

export function buildUnitResidentRows(state: PortalState, buildings: Building[], units: Unit[], profiles: Profile[]) {
  const buildingMap = new Map(buildings.map((building) => [building.id, building] as const));
  const residentMap = new Map(
    profiles
      .filter((profile) => (profile.role === 'resident' || profile.role === 'manager') && profile.unitId)
      .map((profile) => [profile.unitId!, profile] as const)
  );

  return units.map((unit) => ({
    unit,
    building: buildingMap.get(unit.buildingId) ?? null,
    resident: residentMap.get(unit.id) ?? null
  }));
}
