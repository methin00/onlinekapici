export type PortalRole = 'super_admin' | 'consultant' | 'manager' | 'resident' | 'kiosk_device';

export type SiteRole = Exclude<PortalRole, 'resident' | 'kiosk_device'>;

export type GuestRequestType = 'guest' | 'courier' | 'service';
export type GuestRequestStatus = 'pending' | 'approved' | 'rejected' | 'redirected' | 'expired';
export type InvoiceStatus = 'paid' | 'unpaid' | 'overdue';
export type PackageStatus = 'at_desk' | 'on_the_way' | 'delivered';
export type ProviderCategory = 'Temizlik' | 'Elektrik' | 'Tesisat' | 'Asansör' | 'Nakliyat' | 'Peyzaj';
export type AccessPassType = 'qr' | 'nfc';
export type AccessPassStatus = 'active' | 'used' | 'expired';
export type NotificationTone = 'info' | 'success' | 'warning' | 'danger';

export interface Site {
  id: string;
  name: string;
  address: string;
  district: string;
  city: string;
  createdAt?: string;
}

export interface Building {
  id: string;
  siteId: string;
  name: string;
  address: string;
  apiKey: string;
  doorLabel: string;
  kioskCode: string;
  createdAt?: string;
}

export interface Unit {
  id: string;
  buildingId: string;
  unitNumber: string;
  floor: number;
  createdAt?: string;
}

export interface Profile {
  id: string;
  unitId?: string;
  primaryBuildingId?: string;
  fullName: string;
  email?: string;
  role: PortalRole;
  phone: string;
  title: string;
  loginId: string;
  password?: string;
  siteIds: string[];
  buildingIds: string[];
  createdAt?: string;
}

export interface ResidentPreference {
  profileId: string;
  awayModeEnabled: boolean;
  updatedAt: string;
}

export interface GuestRequest {
  id: string;
  buildingId: string;
  unitId: string;
  guestName: string;
  type: GuestRequestType;
  status: GuestRequestStatus;
  createdAt: string;
  expiresAt: string;
  decidedAt?: string;
  createdByProfileId?: string;
  lastActionBy?: string;
}

export interface LogEntry {
  id: string;
  buildingId: string;
  eventDetails: string;
  timestamp: string;
}

export interface Announcement {
  id: string;
  siteId: string;
  title: string;
  summary: string;
  category: 'Operasyon' | 'Güvenlik' | 'Yönetim';
  publishedAt: string;
  pinned: boolean;
}

export interface AnnouncementRead {
  id: string;
  announcementId: string;
  profileId: string;
  readAt: string;
}

export interface InvoiceRecord {
  id: string;
  unitId: string;
  periodLabel: string;
  amount: number;
  dueDate: string;
  status: InvoiceStatus;
  paidAt?: string;
}

export interface SiteInvoicePlan {
  id: string;
  siteId: string;
  amount: number;
  dueDay: number;
  active: boolean;
  startMonth: string;
  lastGeneratedPeriod?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  unitId: string;
  amount: number;
  recordedAt: string;
  recordedBy: string;
}

export interface PackageRecord {
  id: string;
  unitId: string;
  courierName: string;
  trackingCode?: string;
  status: PackageStatus;
  arrivedAt: string;
  deliveredAt?: string;
}

export interface PackageEvent {
  id: string;
  packageId: string;
  note: string;
  createdAt: string;
}

export interface ServiceProvider {
  id: string;
  siteId: string;
  category: ProviderCategory;
  fullName: string;
  phone: string;
  note: string;
  createdAt?: string;
}

export interface ManagerSiteAssignment {
  id: string;
  profileId: string;
  siteId: string;
  createdAt?: string;
}

export interface ConsultantSiteAssignment {
  id: string;
  profileId: string;
  siteId: string;
  createdAt?: string;
}

export interface AccessPass {
  id: string;
  unitId: string;
  holderName: string;
  type: AccessPassType;
  status: AccessPassStatus;
  expiresAt: string;
}

export interface NotificationItem {
  id: string;
  profileId: string;
  title: string;
  body: string;
  tone: NotificationTone;
  createdAt: string;
}

export interface GateEvent {
  id: string;
  buildingId: string;
  requestId?: string;
  source: 'resident' | 'dashboard' | 'kiosk';
  result: 'ok' | 'simulated';
  createdAt: string;
  actorName: string;
}

export interface EmergencyAlert {
  id: string;
  siteId: string;
  title: string;
  status: 'open' | 'closed';
  createdAt: string;
}

export interface PortalState {
  sites: Site[];
  buildings: Building[];
  units: Unit[];
  profiles: Profile[];
  residentPreferences: ResidentPreference[];
  managerSiteAssignments: ManagerSiteAssignment[];
  consultantSiteAssignments: ConsultantSiteAssignment[];
  guestRequests: GuestRequest[];
  logs: LogEntry[];
  announcements: Announcement[];
  announcementReads: AnnouncementRead[];
  siteInvoicePlans: SiteInvoicePlan[];
  invoices: InvoiceRecord[];
  payments: PaymentRecord[];
  packages: PackageRecord[];
  packageEvents: PackageEvent[];
  serviceProviders: ServiceProvider[];
  accessPasses: AccessPass[];
  notifications: NotificationItem[];
  gateEvents: GateEvent[];
  emergencyAlerts: EmergencyAlert[];
}

export interface PortalSessionUser {
  id: string;
  fullName: string;
  role: PortalRole;
  phone: string;
  title: string;
  loginId: string;
  siteIds: string[];
  buildingIds: string[];
  unitId?: string;
}

export interface PortalAuthSession {
  token: string;
  mode: 'supabase' | 'demo';
  user: PortalSessionUser;
}
