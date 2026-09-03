// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function load() {
  // The modules read the environment at call time, but the import cache would
  // otherwise hold whatever the first test happened to set.
  const [{ siteUrl }, sitemap, robots] = await Promise.all([
    import('@/lib/site'),
    import('@/app/sitemap'),
    import('@/app/robots'),
  ]);
  return { siteUrl, sitemap: sitemap.default, robots: robots.default };
}

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('siteUrl', () => {
  it('prefers an explicitly configured origin', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://damage.example';
    const { siteUrl } = await load();
    expect(siteUrl().origin).toBe('https://damage.example');
  });

  it('keeps only the public origin from an explicit URL', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://person:secret@damage.example/release-preview';
    const { siteUrl } = await load();

    expect(siteUrl().toString()).toBe('https://damage.example/');
  });

  it('falls back safely when an explicit URL is not an HTTP origin', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'javascript:alert(1)';
    const { siteUrl } = await load();

    expect(siteUrl().origin).toBe('http://localhost:3000');
  });

  it('falls back to the host the platform supplies', async () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'ayce.vercel.app';
    const { siteUrl } = await load();
    expect(siteUrl().origin).toBe('https://ayce.vercel.app');
  });

  it('falls back to the dev server with nothing configured', async () => {
    const { siteUrl } = await load();
    expect(siteUrl().origin).toBe('http://localhost:3000');
  });
});

describe('sitemap', () => {
  it('lists the calculator first', async () => {
    const { sitemap } = await load();
    expect(sitemap()[0]?.url).toBe('http://localhost:3000/');
  });

  it('lists every entry as an absolute URL on one origin', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://damage.example';
    const { sitemap } = await load();

    for (const entry of sitemap()) {
      expect(new URL(entry.url).origin).toBe('https://damage.example');
    }
  });

  it('keeps private, device-local and machine-only routes out', async () => {
    const { sitemap } = await load();
    const paths = sitemap().map((entry) => new URL(entry.url).pathname);

    expect(paths).not.toContain('/offline');
    expect(paths).not.toContain('/history/data');
    expect(paths).not.toContain('/restaurants');
    expect(paths).not.toContain('/diners');
    expect(paths).not.toContain('/history');
    expect(paths).not.toContain('/history/compare');
    expect(paths).not.toContain('/stats');
    expect(paths.some((path) => path.startsWith('/share'))).toBe(false);
  });

  it('lists nothing twice', async () => {
    const { sitemap } = await load();
    const urls = sitemap().map((entry) => entry.url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});

describe('robots', () => {
  it('welcomes crawlers to the app but not to anything shared', async () => {
    const { robots } = await load();
    const rules = robots().rules;

    expect(Array.isArray(rules)).toBe(false);
    expect(rules).toMatchObject({
      userAgent: '*',
      allow: '/',
      disallow: ['/share/', '/menu/', '/challenge/'],
    });
  });

  it('points at the sitemap on the same origin', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://damage.example';
    const { robots } = await load();
    expect(robots().sitemap).toBe('https://damage.example/sitemap.xml');
  });
});
