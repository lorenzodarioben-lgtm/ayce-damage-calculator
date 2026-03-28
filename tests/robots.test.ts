// @vitest-environment node
import { describe, expect, it } from 'vitest';
import robots from '@/app/robots';

describe('crawler rules', () => {
  it('allows public pages while keeping data-bearing links out of crawls', () => {
    const rules = robots().rules;

    expect(rules).toEqual({
      userAgent: '*',
      allow: '/',
      disallow: ['/share/', '/menu/', '/challenge/'],
    });
  });

  it('advertises the sitemap from the same public origin as the app', () => {
    expect(robots().sitemap).toMatch(/\/sitemap\.xml$/);
  });
});
