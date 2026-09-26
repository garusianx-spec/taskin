import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { THEME_BOOTSTRAP_SCRIPT } from '@/lib/theme';
import { DATA_SOURCE } from '@/lib/data-source';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { WorkspaceProvider } from '@/store/WorkspaceProvider';
import { OverlayProvider } from '@/components/overlays/OverlayProvider';

export const metadata: Metadata = {
  title: {
    default: 'تسکین — پلتفرم ارتباط و مدیریت وظایف سازمانی',
    template: '%s | تسکین',
  },
  description:
    'پلتفرم یکپارچه گفتگو، مدیریت پروژه و وظایف سازمانی با تقویم هجری شمسی، طراحی راست‌به‌چپ و موتور چندپوسته‌ای.',
  applicationName: 'تسکین',
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#0C111D' },
  ],
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    // `data-source` tells tooling which build this is (`api` or `demo`); it is inlined at build time.
    <html lang="fa" dir="rtl" data-source={DATA_SOURCE} suppressHydrationWarning>
      <head>
        {/*
          Applies data-theme / data-accent before first paint so a hard navigation never
          flashes the default palette. Runs ahead of hydration; ThemeProvider adopts it.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <WorkspaceProvider>
            <OverlayProvider>{children}</OverlayProvider>
          </WorkspaceProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
