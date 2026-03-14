'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, ShieldCheck, Smartphone, KeyRound, MonitorSmartphone } from 'lucide-react';
import { roleHomePath } from '@/lib/auth-session';
import type { UserRole } from '@/lib/types';
import { useAuth } from '../providers/auth-provider';
import { useToast } from '../providers/toast-provider';

const roleOptions: Array<{
  role: UserRole;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    role: 'super_admin',
    label: 'Sistem Yöneticisi',
    description: 'Siteleri, kullanıcıları ve tüm akışı yönetin.',
    icon: <ShieldCheck className="h-5 w-5 text-amber-400" />
  },
  {
    role: 'concierge',
    label: 'Danışman',
    description: 'Canlı çağrıları yönetin ve kapı akışını izleyin.',
    icon: <Building2 className="h-5 w-5 text-cyan-400" />
  },
  {
    role: 'resident',
    label: 'Sakin',
    description: 'Kapı kararlarını verin ve erişimlerinizi yönetin.',
    icon: <Smartphone className="h-5 w-5 text-emerald-400" />
  },
  {
    role: 'tablet',
    label: 'Apartman Tableti',
    description: 'Apartman kimliği ile giriş yapıp ziyaretçi ekranını açın.',
    icon: <MonitorSmartphone className="h-5 w-5 text-fuchsia-400" />
  }
];

function isRequestedRole(value: string | null): value is UserRole {
  return value === 'super_admin' || value === 'concierge' || value === 'resident' || value === 'tablet';
}

export function AuthConsole() {
  const { session, loading, login } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRole = searchParams.get('role');
  const redirectTarget = searchParams.get('redirect');

  const [selectedRole, setSelectedRole] = useState<UserRole>(() => {
    if (isRequestedRole(requestedRole)) {
      return requestedRole;
    }

    return 'super_admin';
  });
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !session) {
      return;
    }

    router.replace(redirectTarget || roleHomePath(session.user.role));
  }, [loading, redirectTarget, router, session]);

  const selectedRoleMeta = useMemo(
    () => roleOptions.find((item) => item.role === selectedRole) ?? roleOptions[0],
    [selectedRole]
  );

  const inputMeta =
    selectedRole === 'tablet'
      ? {
          label: 'Apartman Kimliği',
          placeholder: 'İl, ilçe, site, blok ve apartman kodu',
          helper: 'Tablet girişi için apartman kimliğini eksiksiz girin.',
          minLength: 13
        }
      : {
          label: 'Giriş Numarası',
          placeholder: '5xxxxxxxxx',
          helper: 'Telefon numarasını 10 haneli biçimde yazın.',
          minLength: 10
        };

  const isIdentifierValid =
    selectedRole === 'tablet' ? identifier.replace(/[^\d]/g, '').length >= inputMeta.minLength : identifier.length === 10;

  return (
    <main className="min-h-screen bg-[var(--bg-deep)] px-4 py-10 text-white selection:bg-amber-500/20 md:px-8 md:py-16">
      <div className="mx-auto grid max-w-[1280px] gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="relative overflow-hidden rounded-[40px] border border-white/10 bg-[#0a0a0c] p-8 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] md:p-12">
          <div className="absolute inset-0 bg-transparent" />
          <div className="relative z-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-400/80">Güvenli Erişim</p>
            <h1 className="mt-4 font-heading text-5xl font-bold tracking-tight text-white">
              Tek girişle
              <br />
              doğru panele geçin
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-zinc-400">
              Yönetim, danışman, sakin ve apartman tableti aynı güvenli oturum altyapısı üzerinden çalışır.
            </p>

            <div className="mt-10 grid gap-4">
              {roleOptions.map((item) => {
                const active = item.role === selectedRole;

                return (
                  <button
                    key={item.role}
                    type="button"
                    onClick={() => {
                      setSelectedRole(item.role);
                      setIdentifier('');
                      setPassword('');
                      setMessage(null);
                    }}
                    className={`rounded-[28px] border px-5 py-5 text-left transition-all ${
                      active
                        ? 'border-amber-500/40 bg-amber-500/10 shadow-[0_0_30px_rgba(245,158,11,0.12)]'
                        : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl border border-white/10 bg-black/30 p-3">{item.icon}</div>
                      <div>
                        <p className="font-heading text-2xl font-semibold tracking-tight text-white">{item.label}</p>
                        <p className="mt-1 text-sm text-zinc-400">{item.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="rounded-[40px] border border-white/10 bg-black/40 p-8 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.8)] backdrop-blur md:p-12">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <KeyRound className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Oturum Aç</p>
              <h2 className="font-heading text-3xl font-bold tracking-tight text-white">{selectedRoleMeta.label}</h2>
            </div>
          </div>

          <div className="mt-10 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">{inputMeta.label}</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="username"
                value={identifier}
                onChange={(event) =>
                  setIdentifier(
                    selectedRole === 'tablet'
                      ? event.target.value.replace(/[^\d]/g, '').slice(0, 13)
                      : event.target.value.replace(/[^\d]/g, '').slice(0, 10)
                  )
                }
                placeholder={inputMeta.placeholder}
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-white placeholder:text-zinc-600 focus:border-amber-500/40 focus:outline-none"
              />
              <p className="text-xs text-zinc-500">{inputMeta.helper}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Şifre</label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Şifrenizi girin"
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-white placeholder:text-zinc-600 focus:border-amber-500/40 focus:outline-none"
              />
            </div>
          </div>

          {selectedRole === 'resident' ? (
            <p className="mt-4 text-sm leading-relaxed text-zinc-400">
              Sakin giriş numarası daireniz sisteme işlendiğinde otomatik oluşturulur.
            </p>
          ) : null}

          {selectedRole === 'tablet' ? (
            <p className="mt-4 text-sm leading-relaxed text-zinc-400">
              Apartman kimliği ve ilk şifre yönetim panelinden görüntülenebilir.
            </p>
          ) : null}

          {message ? <p className="mt-4 text-sm text-rose-400">{message}</p> : null}

          <button
            type="button"
            disabled={submitting || !isIdentifierValid || password.length < 4}
            onClick={async () => {
              setSubmitting(true);
              setMessage(null);

              try {
                const nextSession = await login(identifier, password, selectedRole);
                showToast({
                  tone: 'success',
                  message: 'Giriş başarılı.'
                });

                if (nextSession.user.role !== selectedRole) {
                  setSelectedRole(nextSession.user.role);
                }

                router.replace(redirectTarget || roleHomePath(nextSession.user.role));
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Oturum açılamadı.';
                setMessage(errorMessage);
                showToast({
                  tone: 'danger',
                  message: errorMessage
                });
              } finally {
                setSubmitting(false);
              }
            }}
            className="mt-8 w-full rounded-2xl border border-amber-500/40 bg-amber-500 px-6 py-4 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Kontrol ediliyor...' : 'Giriş Yap'}
          </button>
        </section>
      </div>
    </main>
  );
}
