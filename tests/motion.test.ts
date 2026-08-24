import { afterEach, describe, expect, it, vi } from 'vitest';
import { prefersReducedMotion, scrollBehaviour } from '@/lib/motion';

const original = window.matchMedia;

function stubReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? matches : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  window.matchMedia = original;
});

describe('prefersReducedMotion', () => {
  it('reports the preference the browser was asked for', () => {
    stubReducedMotion(true);
    expect(prefersReducedMotion()).toBe(true);

    stubReducedMotion(false);
    expect(prefersReducedMotion()).toBe(false);
  });

  it('answers no rather than throwing where matchMedia is missing', () => {
    // Reflected in older engines and in any non-browser environment the module
    // is imported into; a missing query is not a request for stillness.
    Reflect.deleteProperty(window, 'matchMedia');

    expect(prefersReducedMotion()).toBe(false);
  });
});

describe('scrollBehaviour', () => {
  it('scrolls instantly when motion has been asked to stop', () => {
    stubReducedMotion(true);

    // The stylesheet cannot help here: a behaviour passed in script overrides
    // the CSS `scroll-behavior` the reduced-motion block sets.
    expect(scrollBehaviour()).toBe('auto');
  });

  it('scrolls smoothly otherwise', () => {
    stubReducedMotion(false);

    expect(scrollBehaviour()).toBe('smooth');
  });
});
