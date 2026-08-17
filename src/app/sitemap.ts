import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

/**
 * The routes worth indexing.
 *
 * Listed explicitly rather than crawled from the filesystem: `/share/<token>`
 * is unbounded and private, `/offline` only exists for the service worker, and
 * neither belongs in a sitemap. Everything here is a real destination a visitor
 * could arrive at cold.
 */
const ROUTES: ReadonlyArray<{ path: string; priority: number }> = [
  { path: '/', priority: 1 },
  { path: '/live', priority: 0.8 },
  { path: '/history', priority: 0.6 },
  { path: '/history/compare', priority: 0.4 },
  { path: '/history/data', priority: 0.4 },
  { path: '/stats', priority: 0.6 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  // One timestamp for the whole build: the pages are a single deployment, and
  // pretending they changed at different moments would be invention.
  const lastModified = new Date();

  return ROUTES.map(({ path, priority }) => ({
    url: new URL(path, base).toString(),
    lastModified,
    changeFrequency: 'monthly' as const,
    priority,
  }));
}
