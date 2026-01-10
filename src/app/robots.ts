import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

/**
 * Crawling rules.
 *
 * Everything the app itself renders is welcome in an index. Shared reports are
 * not: they carry someone's meal inside the URL, and the page already sets
 * `noindex` for itself — this states the same thing to crawlers that read the
 * rules before the page.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/share/',
    },
    sitemap: new URL('/sitemap.xml', siteUrl()).toString(),
  };
}
