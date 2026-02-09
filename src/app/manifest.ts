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
    /*
     * The meal, from before it to across all of them. Four is what a launcher
     * will realistically show, so the list stops at the moments worth starting
     * cold: the calculator itself is already the start URL, and the restaurant
     * and diner hubs are reached while setting a meal up rather than instead of
     * doing so.
     */
    shortcuts: [
      {
        name: 'Live meal mode',
        short_name: 'Live',
        description: 'Log plates one tap at a time while at the table.',
        url: '/live',
      },
      {
        name: 'Damage planner',
        short_name: 'Plan',
        description: 'Work out what a meal needs to be worth before you sit down.',
        url: '/plan',
      },
      {
        name: 'Meal history',
        short_name: 'History',
        description: 'Review previously recorded sessions.',
        url: '/history',
      },
      {
        name: 'Damage analytics',
        short_name: 'Stats',
        description: 'See the patterns across every session on this device.',
        url: '/stats',
      },
    ],
  };
}
