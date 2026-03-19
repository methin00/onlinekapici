import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import { AuthProvider } from '@/components/providers/auth-provider';
import { PanelThemeProvider } from '@/components/providers/panel-theme-provider';
import { PortalDataProvider } from '@/components/providers/portal-data-provider';
import { ToastProvider } from '@/components/providers/toast-provider';
import './globals.css';

const bodyFont = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap'
});

const headingFont = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'Online Kapıcı',
  description: 'Kiosk, sakin ve yönetim panellerini aynı canlı akışta toplayan dijital site yönetim sistemi.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body className={`${bodyFont.variable} ${headingFont.variable}`} data-panel-theme="command">
        <PanelThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <PortalDataProvider>{children}</PortalDataProvider>
            </AuthProvider>
          </ToastProvider>
        </PanelThemeProvider>
      </body>
    </html>
  );
}
