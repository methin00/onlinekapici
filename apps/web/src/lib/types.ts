export type UserRole = 'resident' | 'concierge' | 'building_admin' | 'super_admin' | 'tablet';
export type GuestStatus = 'waiting' | 'approved' | 'rejected' | 'escalated';
export type VisitorType = 'guest' | 'cargo' | 'courier' | 'other';
export type ActivityType =
  | 'call_created'
  | 'approved'
  | 'rejected'
  | 'escalated'
  | 'manual_open'
  | 'concierge_connected';

export interface Resident {
  id: string;
  buildingId: string;
  apartmentId?: string;
  unitId?: string;
  unitNumber: string;
  unitCode?: string;
  fullName: string;
  phone: string;
  role: UserRole;
}

export interface GuestCall {
  id: string;
  buildingId: string;
  residentId: string;
  residentName: string;
  unitNumber: string;
  visitorLabel: string;
  visitorType: VisitorType;
  status: GuestStatus;
  createdAt: string;
  decidedAt?: string;
  imageUrl?: string;
}

export interface Province {
  id: string;
  code: string;
  name: string;
  districts?: District[];
}

export interface District {
  id: string;
  code: string;
  name: string;
  province?: Province;
}

export interface Building {
  id: string;
  districtId: string;
  siteNumber: number;
  code: string;
  name: string;
  slug: string;
  status: 'ONLINE' | 'OFFLINE';
  blockCount?: number;
  apartmentCount?: number;
  unitCount?: number;
  district?: District;
}

export interface ApartmentTabletCredential {
  id: string;
  loginId: string;
  temporaryPassword?: string;
  passwordChanged: boolean;
  lastLoginAt?: string;
}

export interface BuildingResidentCredential {
  id: string;
  fullName: string;
  loginPhone: string;
  temporaryPassword?: string;
  passwordChanged: boolean;
  lastLoginAt?: string;
}

export interface BuildingUnitDetail {
  id: string;
  code: string;
  label: string;
  floorNumber: number;
  unitNumber: number;
  ownerName?: string | null;
  isVacant: boolean;
  resident: BuildingResidentCredential | null;
}

export interface BuildingApartmentDetail {
  id: string;
  name: string;
  sequence: number;
  code: string;
  floorCount: number;
  unitCount: number;
  occupiedUnitCount: number;
  tablet: ApartmentTabletCredential;
  units: BuildingUnitDetail[];
}

export interface BuildingBlockDetail {
  id: string;
  name: string;
  sequence: number;
  floorCount: number;
  apartmentCount: number;
  unitCount: number;
  occupiedUnitCount: number;
  apartments: BuildingApartmentDetail[];
}

export interface BuildingDetail extends Building {
  vacantUnitCount: number;
  occupiedUnitCount: number;
  blocks: BuildingBlockDetail[];
}

export interface AssignedBuilding {
  id: string;
  name: string;
  district: string;
  province: string;
}

export interface AdminDirectoryUser {
  id: string;
  fullName: string;
  role: UserRole;
  phone: string;
  loginPhone: string;
  isActive: boolean;
  passwordChanged: boolean;
  temporaryPassword?: string;
  createdAt: string;
  lastLoginAt?: string;
  building?: {
    id: string;
    name: string;
  };
  unit?: {
    id: string;
    code: string;
    label: string;
  };
  assignedBuildings: AssignedBuilding[];
}

export interface SessionUser {
  id: string;
  fullName: string;
  role: UserRole;
  phone: string;
  loginId: string;
  buildingId?: string;
  apartmentId?: string;
  unitId?: string;
  building?: {
    id: string;
    name: string;
    district: string;
    province: string;
  };
  apartment?: {
    id: string;
    name: string;
    code: string;
    blockName: string;
    label: string;
  };
  unit?: {
    id: string;
    code: string;
    label: string;
    summary: string;
  };
  assignedBuildings: AssignedBuilding[];
  mustChangePassword: boolean;
}

export interface AuthSession {
  token: string;
  user: SessionUser;
}

export interface SiteApartmentInput {
  name: string;
}

export interface SiteBlockInput {
  name: string;
  apartments: SiteApartmentInput[];
}

export interface SiteFloorPlanInput {
  floorNumber: number;
  unitCount: number;
}

export interface SiteUnitInput {
  blockSequence: number;
  apartmentSequence: number;
  floorNumber: number;
  unitNumber: number;
  ownerName?: string;
  isVacant: boolean;
}

export interface CreateSitePayload {
  provinceId: string;
  districtId: string;
  name: string;
  floorCount: number;
  blocks: SiteBlockInput[];
  floorPlans: SiteFloorPlanInput[];
  units: SiteUnitInput[];
}

export interface AccessLog {
  id: string;
  buildingId: string;
  residentId: string;
  visitorLabel: string;
  summary: string;
  type: ActivityType;
  timestamp: string;
}

export interface DashboardMetrics {
  totalBuildings: number;
  onlineBuildings: number;
  waitingCalls: number;
  droppedCalls: number;
  approvalRate: number;
}

export interface ResidentOverview {
  resident: Resident;
  waitingCalls: GuestCall[];
  activityLogs: AccessLog[];
}

export interface ResidentsResponse {
  data: Resident[];
  total: number;
}

export interface GuestCallsResponse {
  data: GuestCall[];
}

export interface ResidentOverviewResponse {
  data: ResidentOverview;
}

export interface GuestDecisionResponse {
  data: GuestCall;
  door: {
    ok: boolean;
    mode: 'http' | 'simulated';
  } | null;
}

export interface GuestCreateResponse {
  data: GuestCall;
  notification: {
    delivered: boolean;
    channel: string;
    preview: string;
  };
}

export interface AdminOverviewResponse {
  metrics: DashboardMetrics;
  buildings: Building[];
  latestCalls: GuestCall[];
  fallbackCalls: GuestCall[];
}

export interface CreateSiteResponse {
  data: Building;
}

export interface AuthLoginResponse {
  token: string;
  user: SessionUser;
}

export interface AuthMeResponse {
  user: SessionUser;
}

export interface AdminUsersResponse {
  superAdmins: AdminDirectoryUser[];
  concierges: AdminDirectoryUser[];
}

export interface BuildingDirectoryResponse {
  data: Building[];
}

export interface BuildingDetailResponse {
  data: BuildingDetail;
}
