'use client';

import { motion } from 'framer-motion';
import { ShieldCheck, Building2, Smartphone, MonitorSmartphone, Headset } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { roleHomePath } from '@/lib/auth-session';
import { demoCredentialMap } from '@/lib/portal-seed';
import type { PortalRole } from '@/lib/portal-types';
import { useAuth } from '../providers/auth-provider';
import { useToast } from '../providers/toast-provider';
import { BrandLogo } from '../ui/brand-logo';

const roleOptions: Array<{
  role: PortalRole;
  label: string;
  icon: ReactNode;
}> = [
  {
    role: 'super_admin',
    label: 'Merkez Yönetim',
    icon: <ShieldCheck className="h-5 w-5 text-[var(--color-accent)]" />
  },
  {
    role: 'consultant',
    label: 'Danışma',
    icon: <Headset className="h-5 w-5 text-[var(--color-accent)]" />
  },
  {
    role: 'manager',
    label: 'Site Yönetimi',
    icon: <Building2 className="h-5 w-5 text-[var(--color-accent)]" />
  },
  {
    role: 'resident',
    label: 'Sakin',
    icon: <Smartphone className="h-5 w-5 text-[var(--color-accent)]" />
  },
  {
    role: 'kiosk_device',
    label: 'Giriş Terminali',
    icon: <MonitorSmartphone className="h-5 w-5 text-[var(--color-accent)]" />
  }
];

function isRole(value: string | null): value is PortalRole {
  return (
    value === 'super_admin' ||
    value === 'consultant' ||
    value === 'manager' ||
    value === 'resident' ||
    value === 'kiosk_device'
  );
}

function normalizeRequestedRole(value: string | null) {
  if (value === 'tablet') {
    return 'kiosk_device';
  }

  return isRole(value) ? value : 'resident';
}

function getDemoCredentials(role: PortalRole) {
  return demoCredentialMap[role];
}

function getIdentifierMeta(role: PortalRole) {
  switch (role) {
    case 'super_admin':
      return {
        label: 'E-posta adresi',
        placeholder: 'admin@onlinekapici.com',
        type: 'email' as const,
        autoComplete: 'email'
      };
    case 'consultant':
      return {
        label: 'Telefon numarası',
        placeholder: '05xxxxxxxxx',
        type: 'tel' as const,
        autoComplete: 'tel'
      };
    case 'manager':
    case 'resident':
      return {
        label: 'Daire ID',
        placeholder: 'IST-UMR-ATLA-ABL-012',
        type: 'text' as const,
        autoComplete: 'username'
      };
    case 'kiosk_device':
      return {
        label: 'Terminal kodu',
        placeholder: 'atlas-a',
        type: 'text' as const,
        autoComplete: 'username'
      };
  }
}

export function AuthConsole() {
  const { session, loading, login } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRole = normalizeRequestedRole(searchParams.get('role'));
  const redirectTarget = searchParams.get('redirect');

  const [selectedRole, setSelectedRole] = useState<PortalRole>(requestedRole);
  const [identifier, setIdentifier] = useState<string>(getDemoCredentials(requestedRole).identifier);
  const [password, setPassword] = useState<string>(getDemoCredentials(requestedRole).password);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const credentials = getDemoCredentials(requestedRole);
    setSelectedRole(requestedRole);
    setIdentifier(credentials.identifier);
    setPassword(credentials.password);
    setMessage(null);
  }, [requestedRole]);

  useEffect(() => {
    if (loading || !session) {
      return;
    }

    router.replace(redirectTarget || roleHomePath(session.user.role));
  }, [loading, redirectTarget, router, session]);

  const selectedMeta = useMemo(
    () => roleOptions.find((item) => item.role === selectedRole) ?? roleOptions[0],
    [selectedRole]
  );
  const identifierMeta = useMemo(() => getIdentifierMeta(selectedRole), [selectedRole]);

  return (
    <main className="app-shell min-h-screen px-4 py-8 md:py-12">
      <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="app-panel overflow-hidden px-6 py-8 md:px-10 md:py-10"
        >
          <BrandLogo size="lg" showTagline />
          <h1 className="mt-6 max-w-3xl font-heading text-4xl font-bold tracking-tight md:text-6xl">
            Aynı sistem içinde
            <br />
            doğru ekrana geçin
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--color-muted)]">
            Giriş terminali, sakin ekranı, site yönetimi ve merkez operasyonu aynı veri akışıyla birlikte çalışır.
          </p>

          <div className="mt-10 grid gap-4">
            {roleOptions.map((item, index) => {
              const active = item.role === selectedRole;
              return (
                <motion.button
                  key={item.role}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  type="button"
                  onClick={() => {
                    const credentials = getDemoCredentials(item.role);
                    setSelectedRole(item.role);
                    setIdentifier(credentials.identifier);
                    setPassword(credentials.password);
                    setMessage(null);
                  }}
                  className={`rounded-md border-2 px-5 py-5 text-left transition-all ${
                    active
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
                      : 'border-[var(--color-line)] bg-[var(--color-panel-strong)] hover:border-[var(--color-line-strong)]'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-md border-2 border-[var(--color-line)] bg-[#151517]">
                      {item.icon}
                    </div>
                    <div>
                      <p className="font-heading text-2xl font-bold">{item.label}</p>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="app-panel h-fit px-6 py-8 md:px-8"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="app-kicker">Giriş</p>
              <h2 className="mt-3 font-heading text-3xl font-bold">{selectedMeta.label}</h2>
            </div>
            <div className="rounded-md border-2 border-[var(--color-line)] bg-[var(--color-panel-soft)] px-3 py-2 text-xs font-semibold text-[var(--color-accent)]">
              Güvenli oturum
            </div>
          </div>

          <div className="mt-8 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[var(--color-muted)]">{identifierMeta.label}</label>
              <input
                className="app-input px-4 py-4"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder={identifierMeta.placeholder}
                type={identifierMeta.type}
                autoComplete={identifierMeta.autoComplete}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-[var(--color-muted)]">Şifre</label>
              <input
                className="app-input px-4 py-4"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Şifrenizi girin"
                type="password"
                autoComplete="current-password"
              />
            </div>
          </div>

          {message ? <p className="mt-4 text-sm font-medium text-[var(--color-danger)]">{message}</p> : null}

          <button
            type="button"
            disabled={submitting || identifier.trim().length < 3 || password.trim().length < 4}
            onClick={async () => {
              setSubmitting(true);
              setMessage(null);

              try {
                const nextSession = await login(identifier, password, selectedRole);
                showToast({
                  tone: 'success',
                  message: 'Giriş tamamlandı.'
                });
                router.replace(redirectTarget || roleHomePath(nextSession.user.role));
              } catch (error) {
                const nextMessage = error instanceof Error ? error.message : 'Giriş sırasında bir sorun oluştu.';
                setMessage(nextMessage);
                showToast({
                  tone: 'danger',
                  message: nextMessage
                });
              } finally {
                setSubmitting(false);
              }
            }}
            className="app-button mt-8 w-full px-6 py-4 text-sm uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Giriş yapılıyor' : 'Panele geç'}
          </button>

        </motion.section>
      </div>
    </main>
  );
}
