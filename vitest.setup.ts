import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Suites that exercise non-DOM code (the service worker, for one) opt into the
// node environment, where none of the browser setup below applies.
const isDomEnvironment = typeof window !== 'undefined';

afterEach(() => {
  if (!isDomEnvironment) {
    return;
  }
  cleanup();
  window.localStorage.clear();
});

// jsdom does not implement matchMedia, which the reduced-motion hook depends on.
if (isDomEnvironment) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: () => false,
    }),
  });
}
