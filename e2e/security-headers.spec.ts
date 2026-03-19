import { expect, test } from '@playwright/test';

test('serves the application hardening headers in production', async ({ request }) => {
  const response = await request.get('/');

  expect(response.ok()).toBe(true);
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  expect(response.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(response.headers()['x-frame-options']).toBe('DENY');
  expect(response.headers()['cross-origin-opener-policy']).toBe('same-origin');
  expect(response.headers()['cross-origin-resource-policy']).toBe('same-origin');
});
