// @vitest-environment node
import { describe, expect, it } from 'vitest';
import sitemap from '@/app/sitemap';

describe('public sitemap', () => {
  it('lists only routes a first-time visitor can use', () => {
    expect(sitemap().map((entry) => new URL(entry.url).pathname)).toEqual(['/', '/live', '/plan']);
  });

  it('uses one build timestamp across every listed page', () => {
    const entries = sitemap();
    const timestamps = new Set(
      entries.map(({ lastModified }) => {
        if (lastModified instanceof Date) return lastModified.getTime();
        return lastModified ? Date.parse(lastModified) : undefined;
      }),
    );

    expect(timestamps.size).toBe(1);
  });
});
