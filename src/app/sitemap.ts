import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

/**
 * The routes worth indexing.
 *
 * Listed explicitly rather than crawled from the filesystem: `/share/<token>`
 * and `/menu/<token>` are unbounded and private; the restaurant, diner,
 * history and analytics surfaces depend on data held only on this device;
 * `/history/data` is a tool for data this device already holds; and `/offline`
 * only exists for the service worker. None belongs in a sitemap. Everything
 * here is a real destination a visitor could arrive at cold. Each exclusion
 * also says `noindex` for itself, so the two never disagree.
 */
const ROUTES: ReadonlyArray<{ path: string; priority: number }> = [
  { path: '/', priority: 1 },
  { path: '/live', priority: 0.8 },
  { path: '/plan', priority: 0.5 },
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
