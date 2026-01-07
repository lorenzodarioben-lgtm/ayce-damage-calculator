import type { Metadata, Viewport } from 'next';
import { Anton, Archivo } from 'next/font/google';
import { ServiceWorkerManager } from '@/components/pwa/ServiceWorkerManager';
import { THEME_COLOUR } from '@/lib/constants';
import './globals.css';

const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

const anton = Anton({
  subsets: ['latin'],
  variable: '--font-anton',
  display: 'swap',
  weight: '400',
});

/**
 * Absolute base for generated social image URLs.
 *
 * Vercel supplies its own host at build time, so a deployment needs no
 * configuration; the explicit variable is only there for a custom domain, and
 * local development falls back to the dev server.
 */
function resolveSiteUrl(): URL {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    return new URL(configured);
  }
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return new URL(vercelHost ? `https://${vercelHost}` : 'http://localhost:3000');
}

export const metadata: Metadata = {
  metadataBase: resolveSiteUrl(),
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
    <html lang="en-AU" className={`${archivo.variable} ${anton.variable}`}>
      <body>
        <ServiceWorkerManager />
        {children}
      </body>
    </html>
  );
}
