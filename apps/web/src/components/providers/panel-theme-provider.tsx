'use client';

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { usePathname } from 'next/navigation';

type PanelThemeMode = 'dark' | 'light';

type PanelThemeContextValue = {
  mode: PanelThemeMode;
  setMode: (mode: PanelThemeMode) => void;
  toggleMode: () => void;
};

const PanelThemeContext = createContext<PanelThemeContextValue | null>(null);
const RESIDENT_THEME_STORAGE_KEY = 'online-kapici-resident-theme-mode';

function resolvePanelTheme(pathname: string) {
  if (pathname.startsWith('/resident')) {
    return 'resident';
  }

  if (pathname.startsWith('/tablet')) {
    return 'kiosk';
  }

  if (pathname.startsWith('/auth')) {
    return 'auth';
  }

  if (pathname.startsWith('/dashboard')) {
    return 'command';
  }

  return 'marketing';
}

export function PanelThemeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mode, setMode] = useState<PanelThemeMode>('dark');

  useEffect(() => {
    const savedMode = window.localStorage.getItem(RESIDENT_THEME_STORAGE_KEY);

    if (savedMode === 'light' || savedMode === 'dark') {
      setMode(savedMode);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(RESIDENT_THEME_STORAGE_KEY, mode);
  }, [mode]);

  useLayoutEffect(() => {
    const nextTheme = resolvePanelTheme(pathname);
    const appliedMode = nextTheme === 'resident' ? mode : 'dark';

    document.body.dataset.panelTheme = nextTheme;
    document.body.dataset.panelMode = appliedMode;
    document.documentElement.style.colorScheme = appliedMode;

    return () => {
      document.body.dataset.panelTheme = 'command';
      document.body.dataset.panelMode = 'dark';
      document.documentElement.style.colorScheme = 'dark';
    };
  }, [mode, pathname]);

  const value = useMemo<PanelThemeContextValue>(
    () => ({
      mode,
      setMode,
      toggleMode: () => setMode((current) => (current === 'dark' ? 'light' : 'dark'))
    }),
    [mode]
  );

  return <PanelThemeContext.Provider value={value}>{children}</PanelThemeContext.Provider>;
}

export function usePanelTheme() {
  const context = useContext(PanelThemeContext);

  if (!context) {
    throw new Error('usePanelTheme yalnızca PanelThemeProvider içinde kullanılabilir.');
  }

  return context;
}
