import type { Metadata, Viewport } from 'next';
import { Anton, Archivo } from 'next/font/google';
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

export const metadata: Metadata = {
  title: 'AYCE Damage Calculator',
  description:
    'Did you beat the buffet, or fund their next renovation? Track your Korean BBQ meal and calculate the damage.',
  applicationName: 'AYCE Damage Calculator',
  keywords: ['korean bbq', 'all you can eat', 'buffet', 'calculator', 'value'],
};

export const viewport: Viewport = {
  themeColor: '#0d0c0a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU" className={`${archivo.variable} ${anton.variable}`}>
      <body>{children}</body>
    </html>
  );
}
