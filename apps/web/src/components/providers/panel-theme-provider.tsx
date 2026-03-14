'use client';

import { useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';

function resolvePanelTheme(pathname: string) {
  return pathname.startsWith('/tablet') ? 'tablet' : 'soft';
}

export function PanelThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useLayoutEffect(() => {
    const nextTheme = resolvePanelTheme(pathname);
    document.body.dataset.panelTheme = nextTheme;

    return () => {
      document.body.dataset.panelTheme = 'soft';
    };
  }, [pathname]);

  return <>{children}</>;
}
