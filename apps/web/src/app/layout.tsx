import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import { AuthProvider } from '@/components/providers/auth-provider';
import { PanelThemeProvider } from '@/components/providers/panel-theme-provider';
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
  description: 'Apartman ve site giriş süreçleri için profesyonel ziyaretçi, sakin ve danışman deneyimi.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body className={`${bodyFont.variable} ${headingFont.variable}`} data-panel-theme="soft">
        <PanelThemeProvider>
          <ToastProvider>
            <AuthProvider>{children}</AuthProvider>
          </ToastProvider>
        </PanelThemeProvider>
      </body>
    </html>
  );
}
