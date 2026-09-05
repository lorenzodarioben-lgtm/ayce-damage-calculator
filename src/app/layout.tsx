import type { Metadata, Viewport } from 'next';
import { fontVariables } from '@/app/fonts';
import { SkipLink } from '@/components/nav/SkipLink';
import { ServiceWorkerManager } from '@/components/pwa/ServiceWorkerManager';
import { THEME_COLOUR } from '@/lib/constants';
import { siteUrl } from '@/lib/site';
import './globals.css';

const SITE_NAME = 'AYCE Damage Calculator';
const SITE_DESCRIPTION =
  'Did you beat the buffet, or fund their next renovation? Track your Korean BBQ meal and calculate the damage.';

export const metadata: Metadata = {
  // Absolute base for generated social image URLs.
  metadataBase: siteUrl(),
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ['korean bbq', 'all you can eat', 'buffet', 'calculator', 'value'],
  /*
   * The card every page falls back to when it does not describe itself.
   *
   * A segment that sets `openGraph` replaces this whole object rather than
   * merging into it, so the shared report and challenge routes keep their own
   * titles and their own generated previews untouched. No image is named here:
   * `opengraph-image.tsx` beside this file supplies one, and leaving the field
   * out is what keeps the answer to "which image" in a single place.
   */
  openGraph: {
    type: 'website',
    locale: 'en_AU',
    url: '/',
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    // A 1200x630 card, so the wide treatment is the one that fits it.
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
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
    <html lang="en-AU" className={fontVariables}>
      <body>
        {/* Ahead of everything, including the service worker's status bar, so a
            keyboard always reaches it first. */}
        <SkipLink />
        <ServiceWorkerManager />
        {children}
      </body>
    </html>
  );
}
