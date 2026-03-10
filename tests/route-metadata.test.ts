import { describe, expect, it } from 'vitest';
import type { Metadata } from 'next';

/**
 * The metadata a route declares, rather than the markup Next renders from it.
 *
 * Social cards and indexing rules are the kind of thing that is only noticed
 * once it is wrong in public, and the merge rules that make the root defaults
 * safe are not obvious from reading any single file.
 */
describe('root metadata', () => {
  it('describes the app for a platform that has only the link', async () => {
    const { metadata } = await import('@/app/layout');
    const openGraph = metadata.openGraph as Extract<
      Metadata['openGraph'],
      { siteName?: unknown }
    > & {
      images?: ReadonlyArray<{ url: string; alt?: string }>;
    };

    expect(openGraph.siteName).toBe('AYCE Damage Calculator');
    expect(openGraph.title).toBe('AYCE Damage Calculator');
    expect(openGraph.description).toBe(metadata.description);
    /*
     * Deliberately unset. `app/opengraph-image.tsx` supplies the card, and
     * naming one here as well would put the answer to "which image" in two
     * places that could disagree.
     */
    expect(openGraph.images).toBeUndefined();
  });

  it('generates a wide card rather than naming a file', async () => {
    const og = await import('@/app/opengraph-image');

    expect(og.size).toEqual({ width: 1200, height: 630 });
    expect(og.contentType).toBe('image/png');
    // Read aloud where the image itself cannot be seen.
    expect(og.alt).toMatch(/buffet/i);
  });

  it('offers the wide card its generated image is shaped for', async () => {
    const { metadata } = await import('@/app/layout');
    const twitter = metadata.twitter as { card?: string; title?: string };

    // 1200x630 is the wide treatment's shape; `summary` would crop it square.
    expect(twitter.card).toBe('summary_large_image');
    expect(twitter.title).toBe('AYCE Damage Calculator');
  });

  it('resolves relative image paths against the deployment origin', async () => {
    const { metadata } = await import('@/app/layout');

    expect(metadata.metadataBase).toBeInstanceOf(URL);
  });
});

describe('shared report metadata', () => {
  /*
   * `openGraph` is merged shallowly: a segment that declares one replaces the
   * root object outright rather than inheriting the icon from it. This is what
   * keeps the generated per-report preview in front of a shared link, so it is
   * worth a test rather than a comment.
   */
  it('describes itself rather than inheriting the site default', async () => {
    const { generateMetadata } = await import('@/app/share/[token]/page');
    const metadata = await generateMetadata({ params: Promise.resolve({ token: 'not-a-token' }) });
    const openGraph = metadata.openGraph as { type?: string; images?: unknown };

    expect(openGraph).toBeDefined();
    expect(openGraph.type).toBe('article');
    // No image of its own here: the route's `opengraph-image` file supplies it,
    // and a value inherited from the root would quietly take its place.
    expect(openGraph.images).toBeUndefined();
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});

describe('machine-only and device-local routes', () => {
  it('keeps the service-worker fallback out of search results', async () => {
    const { metadata } = await import('@/app/offline/page');

    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('keeps the local backup tools out of search results', async () => {
    const { metadata } = await import('@/app/history/data/page');

    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('keeps the local diner directory out of search results', async () => {
    const { metadata } = await import('@/app/diners/page');

    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('keeps the local restaurant list out of search results', async () => {
    const { metadata } = await import('@/app/restaurants/page');

    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('keeps local meal history out of search results', async () => {
    const { metadata } = await import('@/app/history/page');

    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('keeps device-local analytics out of search results', async () => {
    const { metadata } = await import('@/app/stats/page');

    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
