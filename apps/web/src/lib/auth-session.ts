import type { AuthSession, UserRole } from './types';

const AUTH_STORAGE_KEY = 'online-kapici-auth-session';

export function readStoredAuthSession() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    return JSON.parse(rawValue) as AuthSession;
  } catch {
    return null;
  }
}

export function writeStoredAuthSession(session: AuthSession) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredAuthSession() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function roleHomePath(role: UserRole) {
  switch (role) {
    case 'super_admin':
    case 'concierge':
      return '/dashboard';
    case 'tablet':
      return '/tablet';
    case 'resident':
      return '/resident';
    case 'building_admin':
      return '/dashboard';
  }
}
