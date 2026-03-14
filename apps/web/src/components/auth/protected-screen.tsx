'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { roleHomePath } from '@/lib/auth-session';
import type { UserRole } from '@/lib/types';
import { useAuth } from '../providers/auth-provider';

export function ProtectedScreen({
  allowedRoles,
  children
}: {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}) {
  const { session, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

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

  if (loading || !session || !allowedRoles.includes(session.user.role)) {
    return (
      <main className="min-h-screen bg-[var(--bg-deep)] px-4 py-20 text-white">
        <div className="mx-auto max-w-xl rounded-[32px] border border-white/10 bg-black/40 p-8 text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-t-2 border-amber-500" />
          <p className="text-sm text-zinc-400">Oturum bilgileri hazırlanıyor...</p>
        </div>
      </main>
    );
  }

  return (
    <>
      <div className="fixed right-4 top-4 z-50 flex items-center gap-3 rounded-full border border-white/10 bg-[var(--bg-surface)] px-4 py-2 text-[var(--text-primary)] shadow-[0_12px_24px_-18px_rgba(0,0,0,0.35)]">
        <div className="text-right">
          <p className="text-xs font-semibold text-[var(--text-primary)]">{session.user.fullName}</p>
          <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-400">{session.user.loginId}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            logout();
            router.replace('/auth');
          }}
          className="rounded-full border border-[var(--text-primary)] bg-[var(--text-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--bg-surface)] transition-colors hover:border-[var(--brand-primary-dark)] hover:bg-[var(--brand-primary-dark)] hover:text-white"
        >
          Çıkış Yap
        </button>
      </div>
      {children}
    </>
  );
}
