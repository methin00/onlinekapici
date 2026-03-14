import type { ActivityType, GuestStatus, UserRole, VisitorType } from './types';

export type PillTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

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
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

export function guestStatusLabel(status: GuestStatus) {
  switch (status) {
    case 'waiting':
      return 'Beklemede';
    case 'approved':
      return 'Onaylandı';
    case 'rejected':
      return 'Reddedildi';
    case 'escalated':
      return 'Danışmaya Aktarıldı';
  }
}

export function guestStatusTone(status: GuestStatus): PillTone {
  switch (status) {
    case 'waiting':
      return 'warning';
    case 'approved':
      return 'success';
    case 'rejected':
      return 'danger';
    case 'escalated':
      return 'info';
  }
}

export function visitorTypeLabel(type: VisitorType) {
  switch (type) {
    case 'guest':
      return 'Misafir';
    case 'cargo':
      return 'Kargo';
    case 'courier':
      return 'Kurye';
    case 'other':
      return 'Diğer';
  }
}

export function userRoleLabel(role: UserRole) {
  switch (role) {
    case 'super_admin':
      return 'Sistem Yöneticisi';
    case 'tablet':
      return 'Apartman Tableti';
    case 'resident':
      return 'Sakin';
    case 'concierge':
      return 'Danışma';
    case 'building_admin':
      return 'Bina Yöneticisi';
  }
}

export function activityTone(type: ActivityType): PillTone {
  switch (type) {
    case 'approved':
    case 'manual_open':
      return 'success';
    case 'rejected':
      return 'danger';
    case 'escalated':
    case 'concierge_connected':
      return 'info';
    case 'call_created':
      return 'neutral';
  }
}
