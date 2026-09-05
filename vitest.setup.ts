import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

/**
 * Components are rendered directly rather than inside the App Router, so the
 * navigation hooks have no context to read and would return null. Standing them
 * up here keeps every suite from having to repeat the same mock.
 */
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

/**
 * `next/font/local` is a compile-time transform, not a runtime function: the
 * Next plugin rewrites each call into the generated class names before any of
 * this ever runs. Under Vitest the plugin is absent, so the import resolves to
 * a module whose default export is not callable and every suite that reaches
 * the root layout fails on the import rather than on anything it asserts.
 *
 * The stub returns the shape the real transform produces. Suites care that the
 * layout renders and what it puts in the document, not which font it picked.
 */
vi.mock('next/font/local', () => ({
  default: (options: { variable?: string }) => ({
    className: 'mock-font',
    variable: options.variable ?? '--mock-font',
    style: { fontFamily: 'mock-font' },
  }),
}));

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

// jsdom does not implement matchMedia. The service-worker manager queries it for
// display-mode, and it is stood up here so no suite has to know that.
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
