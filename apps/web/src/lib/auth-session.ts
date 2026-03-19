import type { PortalRole } from './portal-types';

type RoleLike = PortalRole | 'tablet' | 'building_admin' | 'concierge';

export function roleHomePath(role: RoleLike) {
  switch (role) {
    case 'super_admin':
    case 'consultant':
    case 'building_admin':
    case 'concierge':
      return '/dashboard';
    case 'manager':
    case 'resident':
      return '/resident';
    case 'kiosk_device':
    case 'tablet':
      return '/tablet';
  }
}
