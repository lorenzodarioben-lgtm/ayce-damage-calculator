import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

/**
 * Crawling rules.
 *
 * Everything the app itself renders is welcome in an index. Shared reports, shared menus
 * and shared challenges are not: they carry someone's own data inside the URL, and both
 * pages already set `noindex` for themselves — this states the same thing to
 * crawlers that read the rules before the page.
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
