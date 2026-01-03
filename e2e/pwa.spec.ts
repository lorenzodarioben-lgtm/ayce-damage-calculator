import { expect, test, type Page } from '@playwright/test';
import { openCalculator } from './helpers';

/*
 * Scope note: the worker's caching *policy* is covered by tests/service-worker.
 * Neither Playwright's offline emulation nor its request routing reaches the
 * fetch a service worker performs itself, so an end-to-end "offline" assertion
 * would pass while quietly using the network. What is verified here is the part
 * a browser genuinely proves: registration, control, and what lands in cache.
 */

const CACHE_NAME = 'ayce-shell-v1';

/**
 * Resolves once a service worker has finished activating.
 *
 * `registration.active` is already set while the worker is merely *activating*,
 * which is before `clients.claim()` and the precache have run. Waiting on the
 * state itself is what makes everything downstream deterministic.
 */
async function waitForServiceWorker(page: Page) {
  await page.waitForFunction(
    async () => {
      if (!('serviceWorker' in navigator)) {
        return false;
      }
      const registration = await navigator.serviceWorker.getRegistration('/');
      return registration?.active?.state === 'activated';
    },
    undefined,
    { timeout: 20_000 },
  );
}

async function cachedUrls(page: Page, cacheName: string): Promise<string[]> {
  return page.evaluate(async (name) => {
    const cache = await caches.open(name);
    return (await cache.keys()).map((request) => new URL(request.url).pathname);
  }, cacheName);
}

test.describe('Web app manifest', () => {
  test('describes an installable standalone app', async ({ request }) => {
    const response = await request.get('/manifest.webmanifest');
    expect(response.ok()).toBe(true);

    const manifest = await response.json();
    expect(manifest.name).toBe('AYCE Damage Calculator');
    expect(manifest.short_name).toBe('AYCE Damage');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    expect(manifest.theme_color).toBe('#0d0c0a');

    // Installability needs a 192 and a 512, and Android wants a maskable one.
    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect(manifest.icons.some((icon: { purpose: string }) => icon.purpose === 'maskable')).toBe(
      true,
    );
  });

  test('serves every icon the manifest advertises', async ({ request }) => {
    const manifest = await (await request.get('/manifest.webmanifest')).json();

    for (const icon of manifest.icons as Array<{ src: string }>) {
      const response = await request.get(icon.src);
      expect(response.ok(), `${icon.src} should resolve`).toBe(true);
      expect(response.headers()['content-type']).toContain('image/png');
    }
  });

  test('links the manifest and an Apple touch icon from the document', async ({ page }) => {
    await openCalculator(page);

    await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  });

  test('serves the worker script uncached so updates are never missed', async ({ request }) => {
    const response = await request.get('/sw.js');

    expect(response.ok()).toBe(true);
    expect(response.headers()['cache-control']).toContain('no-store');
  });
});

test.describe('Service worker', () => {
  test('registers and takes control of the page', async ({ page }) => {
    await openCalculator(page);
    await waitForServiceWorker(page);

    await page.reload();
    // Claiming a client is asynchronous, so this is polled rather than sampled.
    await expect
      .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
      .toBe(true);
  });

  test('precaches the calculator shell and the offline page', async ({ page }) => {
    await openCalculator(page);
    await waitForServiceWorker(page);

    // Precaching runs inside the install event's waitUntil, so it is polled.
    await expect.poll(() => cachedUrls(page, CACHE_NAME)).toContain('/');
    await expect.poll(() => cachedUrls(page, CACHE_NAME)).toContain('/offline');
  });

  test('caches the hashed build assets once it is controlling the page', async ({ page }) => {
    await openCalculator(page);
    await waitForServiceWorker(page);

    // Only a controlled load routes asset requests through the worker.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Build the meal' })).toBeVisible();

    await expect
      .poll(
        async () =>
          (await cachedUrls(page, CACHE_NAME)).filter((url) => url.startsWith('/_next/static/'))
            .length,
      )
      .toBeGreaterThan(0);
  });
});

test.describe('Offline page', () => {
  test('explains the situation and offers a way back', async ({ page }) => {
    await page.goto('/offline');

    await expect(page.getByRole('heading', { name: 'Service interrupted' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Return to the calculator' })).toBeVisible();

    await page.getByRole('link', { name: 'Return to the calculator' }).click();
    await expect(page.getByRole('heading', { name: 'Build the meal' })).toBeVisible();
  });
});
