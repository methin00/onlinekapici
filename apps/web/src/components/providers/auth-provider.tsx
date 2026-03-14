'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { appFetch } from '@/lib/api';
import {
  clearStoredAuthSession,
  readStoredAuthSession,
  writeStoredAuthSession
} from '@/lib/auth-session';
import type { AuthLoginResponse, AuthMeResponse, AuthSession } from '@/lib/types';
import { useToast } from './toast-provider';

type AuthContextValue = {
  session: AuthSession | null;
  loading: boolean;
  login: (identifier: string, password: string, role: AuthSession['user']['role']) => Promise<AuthSession>;
  logout: () => void;
  refreshSession: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function PasswordUpdateOverlay({
  onSubmit
}: {
  onSubmit: (currentPassword: string, newPassword: string) => Promise<void>;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 backdrop-blur-md">
      <div className="w-full max-w-lg rounded-[32px] border border-white/10 bg-[#0a0a0c] p-8 text-white shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-400/80">İlk Güvenlik Adımı</p>
        <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight text-white">Şifrenizi yenileyin</h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          Hesabınız için sistem tarafından oluşturulan geçici şifre aktif. Güvenli kullanım için şimdi yeni şifre belirleyin.
        </p>

        <div className="mt-8 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Mevcut Şifre</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white focus:border-amber-500/50 focus:outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Yeni Şifre</label>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white focus:border-amber-500/50 focus:outline-none"
            />
          </div>
        </div>

        {message ? <p className="mt-4 text-sm text-rose-400">{message}</p> : null}

        <button
          type="button"
          disabled={submitting || currentPassword.length < 4 || newPassword.length < 8}
          onClick={async () => {
            setSubmitting(true);
            setMessage(null);

            try {
              await onSubmit(currentPassword, newPassword);
            } catch (error) {
              setMessage(error instanceof Error ? error.message : 'Şifre güncellenemedi.');
            } finally {
              setSubmitting(false);
            }
          }}
          className="mt-8 w-full rounded-2xl border border-amber-500/40 bg-amber-500 px-6 py-4 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Kaydediliyor...' : 'Şifreyi Güncelle'}
        </button>
      </div>
    </div>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedSession = readStoredAuthSession();

    if (!storedSession) {
      setLoading(false);
      return;
    }

    setSession(storedSession);
    void refreshSession();
  }, []);

  async function refreshSession() {
    const storedSession = readStoredAuthSession();

    if (!storedSession) {
      setSession(null);
      setLoading(false);
      return;
    }

    try {
      const response = await appFetch<AuthMeResponse>('auth/me');
      const nextSession = {
        token: storedSession.token,
        user: response.user
      };

      writeStoredAuthSession(nextSession);
      setSession(nextSession);
    } catch {
      clearStoredAuthSession();
      setSession(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(identifier: string, password: string, role: AuthSession['user']['role']) {
    const response = await appFetch<AuthLoginResponse>('auth/login', {
      method: 'POST',
      body: {
        identifier,
        password,
        role
      }
    });

    const nextSession = {
      token: response.token,
      user: response.user
    };

    writeStoredAuthSession(nextSession);
    setSession(nextSession);
    return nextSession;
  }

  function logout() {
    clearStoredAuthSession();
    setSession(null);
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    const response = await appFetch<AuthLoginResponse>('auth/change-password', {
      method: 'POST',
      body: {
        currentPassword,
        newPassword
      }
    });

    const nextSession = {
      token: response.token,
      user: response.user
    };

    writeStoredAuthSession(nextSession);
    setSession(nextSession);
    showToast({
      tone: 'success',
      message: 'Şifreniz güncellendi.'
    });
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      login,
      logout,
      refreshSession,
      changePassword
    }),
    [session, loading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {session?.user.mustChangePassword ? <PasswordUpdateOverlay onSubmit={changePassword} /> : null}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth yalnızca AuthProvider içinde kullanılabilir.');
  }

  return context;
}
