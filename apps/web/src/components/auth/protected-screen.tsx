'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { roleHomePath } from '@/lib/auth-session';
import type { PortalRole } from '@/lib/portal-types';
import { useAuth } from '../providers/auth-provider';

function roleLabel(role: PortalRole) {
  switch (role) {
    case 'super_admin':
      return 'Merkez yönetimi';
    case 'consultant':
      return 'Danışma';
    case 'manager':
      return 'Site yöneticisi';
    case 'resident':
      return 'Daire sakini';
    case 'kiosk_device':
      return 'Giriş terminali';
  }
}

type ProtectedScreenProps = {
  allowedRoles: PortalRole[];
  children: React.ReactNode;
  showSessionChrome?: boolean;
};

export function ProtectedScreen({
  allowedRoles,
  children,
  showSessionChrome = true
}: ProtectedScreenProps) {
  const { session, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const hasAccess = Boolean(session && allowedRoles.includes(session.user.role));

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!session) {
      router.replace(`/auth?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    if (!allowedRoles.includes(session.user.role)) {
      router.replace(roleHomePath(session.user.role));
    }
  }, [allowedRoles, loading, pathname, router, session]);

  if ((!session && loading) || !session || (session && !hasAccess)) {
    return (
      <main className="app-shell min-h-screen px-4 py-20 text-[var(--color-text)]">
        <div className="app-panel mx-auto max-w-xl p-8 text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-[var(--color-line)] border-t-[var(--color-accent)]" />
          <p className="text-sm text-[var(--color-muted)]">Oturum hazırlanıyor.</p>
        </div>
      </main>
    );
  }

  return (
    <>
      {showSessionChrome ? (
        <div className="fixed right-4 top-4 z-50 flex items-center gap-3 border-2 border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3 text-[var(--color-text)] shadow-[8px_8px_0_0_rgba(0,0,0,0.28)]">
          <div className="text-right">
            <p className="text-sm font-semibold">{session.user.fullName}</p>
            <p className="text-[11px] text-[var(--color-muted)]">{roleLabel(session.user.role)}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              router.replace('/auth');
            }}
            className="inline-flex items-center justify-center border-2 border-[var(--color-line)] bg-transparent px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            Çıkış
          </button>
        </div>
      ) : null}
      {children}
    </>
  );
}
