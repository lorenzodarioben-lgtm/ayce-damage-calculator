import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

/**
 * Crawling rules.
 *
 * Shared reports, shared menus and shared challenges are kept out: they carry
 * someone's own data inside the URL. All three set `noindex` for themselves, and
 * this states the same thing to crawlers that read the rules before the page.
 *
 * The rest of the app is welcome, apart from two routes that are excluded by
 * their own metadata rather than here — `/offline` and `/history/data` have to
 * be fetched for that `noindex` to be read at all, so disallowing them would
 * defeat it.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/share/', '/menu/', '/challenge/'],
    },
    sitemap: new URL('/sitemap.xml', siteUrl()).toString(),
  };
}
