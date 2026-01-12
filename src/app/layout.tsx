import type { Metadata, Viewport } from 'next';
import { ServiceWorkerManager } from '@/components/pwa/ServiceWorkerManager';
import { THEME_COLOUR } from '@/lib/constants';
import { siteUrl } from '@/lib/site';
import './globals.css';

export const metadata: Metadata = {
  // Absolute base for generated social image URLs.
  metadataBase: siteUrl(),
  title: 'AYCE Damage Calculator',
  description:
    'Did you beat the buffet, or fund their next renovation? Track your Korean BBQ meal and calculate the damage.',
  applicationName: 'AYCE Damage Calculator',
  keywords: ['korean bbq', 'all you can eat', 'buffet', 'calculator', 'value'],
  // Installed on iOS the app runs without browser chrome, so it needs its own
  // status-bar treatment and home-screen title.
  appleWebApp: {
    capable: true,
    title: 'AYCE Damage',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: THEME_COLOUR,
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <body>
        <ServiceWorkerManager />
        {children}
      </body>
    </html>
  );
}
