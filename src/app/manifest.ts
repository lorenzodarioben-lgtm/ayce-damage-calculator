import type { MetadataRoute } from 'next';
import { THEME_COLOUR } from '@/lib/constants';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AYCE Damage Calculator',
    short_name: 'AYCE Damage',
    description:
      'Track an all-you-can-eat Korean BBQ meal and find out whether you beat the buffet.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: THEME_COLOUR,
    theme_color: THEME_COLOUR,
    categories: ['food', 'utilities', 'lifestyle'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Cropped to the platform's own shape, so it carries its own safe area.
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
