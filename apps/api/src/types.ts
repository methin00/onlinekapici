export type BuildingStatus = 'online' | 'offline';
export type GuestStatus = 'waiting' | 'approved' | 'rejected' | 'escalated';
export type VisitorType = 'guest' | 'cargo' | 'courier' | 'other';
export type UserRole = 'building_admin' | 'concierge' | 'resident' | 'super_admin' | 'tablet';
export type ActivityType =
  | 'call_created'
  | 'approved'
  | 'rejected'
  | 'escalated'
  | 'manual_open'
  | 'concierge_connected';

export interface Building {
  id: string;
  name: string;
  status: BuildingStatus;
  address: string;
}

export interface Resident {
  id: string;
  buildingId: string;
  unitNumber: string;
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

export interface RequestUser {
  sub: string;
  role: 'SUPER_ADMIN' | 'BUILDING_ADMIN' | 'CONCIERGE' | 'RESIDENT' | 'TABLET';
  buildingId?: string | null;
  apartmentId?: string | null;
  unitId?: string | null;
  phone: string;
  fullName: string;
}
