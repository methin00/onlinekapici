'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { buildPortalAuthSession } from '@/lib/supabase/portal';
import { toSupabaseUserMessage, withSupabaseTimeout } from '@/lib/supabase/runtime';
import type { PortalAuthSession, PortalRole } from '@/lib/portal-types';

type AuthContextValue = {
  session: PortalAuthSession | null;
  loading: boolean;
  login: (identifier: string, password: string, role: PortalRole) => Promise<PortalAuthSession>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_TIMEOUT_MESSAGE = 'Supabase şu anda yanıt vermiyor. Lütfen kısa süre sonra yeniden deneyin.';
const PROFILE_TIMEOUT_MESSAGE = 'Oturum doğrulandı ancak hesap bilgileri alınamadı.';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<PortalAuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = getSupabaseBrowserClient();

    if (!client) {
      setLoading(false);
      return;
    }

    const supabase = client;
    let active = true;

    async function syncSession(nextSession: Session | null) {
      if (!active) {
        return;
      }

      if (!nextSession) {
        setSession(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const nextPortalSession = await withSupabaseTimeout(
          buildPortalAuthSession(supabase, nextSession),
          12000,
          PROFILE_TIMEOUT_MESSAGE
        );

        if (!active) {
          return;
        }

        setSession(nextPortalSession);
      } catch {
        await supabase.auth.signOut();

        if (!active) {
          return;
        }

        setSession(null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void withSupabaseTimeout(supabase.auth.getSession(), 12000, AUTH_TIMEOUT_MESSAGE)
      .then(({ data }) => syncSession(data.session))
      .catch(() => {
        if (active) {
          setSession(null);
          setLoading(false);
        }
      });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_: AuthChangeEvent, nextSession) => {
      void syncSession(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function refreshSession() {
    const client = getSupabaseBrowserClient();

    if (!client) {
      setSession(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const {
        data: { session: authSession }
      } = await withSupabaseTimeout(client.auth.getSession(), 12000, AUTH_TIMEOUT_MESSAGE);

      if (!authSession) {
        setSession(null);
        setLoading(false);
        return;
      }

      const nextSession = await withSupabaseTimeout(
        buildPortalAuthSession(client, authSession),
        12000,
        PROFILE_TIMEOUT_MESSAGE
      );

      setSession(nextSession);
    } finally {
      setLoading(false);
    }
  }

  async function login(identifier: string, password: string, role: PortalRole) {
    const client = getSupabaseBrowserClient();

    if (!client) {
      throw new Error('Supabase bağlantısı yapılandırılmadı.');
    }

    const normalizedEmail = identifier.trim().toLocaleLowerCase('tr-TR');
    setLoading(true);
    let authData: Awaited<ReturnType<typeof client.auth.signInWithPassword>>['data'] | null = null;
    let authError: string | null = null;
    try {
      const { data, error } = await withSupabaseTimeout(
        client.auth.signInWithPassword({
          email: normalizedEmail,
          password
        }),
        12000,
        AUTH_TIMEOUT_MESSAGE
      );

      if (data.session) {
        authData = data;
      } else {
        authError = toSupabaseUserMessage(
          error ? new Error(error.message) : null,
          'E-posta veya şifre bilgisini kontrol edip yeniden deneyin.'
        );
      }
    } catch (error) {
      authError = toSupabaseUserMessage(error, 'E-posta veya şifre bilgisini kontrol edip yeniden deneyin.');
    }

    if (!authData?.session) {
      setLoading(false);
      throw new Error(authError ?? 'E-posta veya şifre bilgisini kontrol edip yeniden deneyin.');
    }

    let nextSession: PortalAuthSession;

    try {
      nextSession = await withSupabaseTimeout(
        buildPortalAuthSession(client, authData.session),
        12000,
        PROFILE_TIMEOUT_MESSAGE
      );
    } catch (error) {
      await client.auth.signOut();
      setLoading(false);
      throw new Error(toSupabaseUserMessage(error, PROFILE_TIMEOUT_MESSAGE));
    }

    if (nextSession.user.role !== role) {
      await client.auth.signOut();
      setLoading(false);
      throw new Error('Seçtiğiniz panel için bu hesapla giriş yapılamıyor.');
    }

    setSession(nextSession);
    setLoading(false);
    return nextSession;
  }

  async function logout() {
    const client = getSupabaseBrowserClient();

    if (!client) {
      setSession(null);
      return;
    }

    await client.auth.signOut();
    setSession(null);
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      login,
      logout,
      refreshSession
    }),
    [session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth yalnızca AuthProvider içinde kullanılabilir.');
  }

  return context;
}
