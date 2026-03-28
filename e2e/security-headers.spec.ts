import { expect, test } from '@playwright/test';

test('serves the application hardening headers in production', async ({ request }) => {
  const response = await request.get('/');

  expect(response.ok()).toBe(true);
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  expect(response.headers()['x-dns-prefetch-control']).toBe('off');
  expect(response.headers()['x-permitted-cross-domain-policies']).toBe('none');
  expect(response.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(response.headers()['x-frame-options']).toBe('DENY');
  expect(response.headers()['cross-origin-opener-policy']).toBe('same-origin');
  expect(response.headers()['cross-origin-resource-policy']).toBe('same-origin');
  expect(response.headers()['permissions-policy']).toBe(
    'camera=(), geolocation=(), microphone=(), payment=(), usb=()',
  );
});

test('does not cache pages carrying data in their address', async ({ request }) => {
  for (const path of [
    '/share/1.gj4.1.bg-2-2-6.U2VvdWwgR2FyZGVu',
    '/menu/not-a-token',
    '/challenge/not-a-token',
  ]) {
    const response = await request.get(path);
    const cacheControl = response.headers()['cache-control'] ?? '';

    expect(response.ok(), path).toBe(true);
    expect(cacheControl, path).toContain('no-store');
    expect(cacheControl, path).toContain('private');
  }
});
