// @vitest-environment node
import { describe, expect, it } from 'vitest';
import nextConfig from '../next.config';

describe('response security headers', () => {
  it('protects every route from framing and cross-origin window access', async () => {
    const rules = await nextConfig.headers?.();
    const appRule = rules?.find((rule) => rule.source === '/(.*)');

    expect(appRule?.headers).toEqual(
      expect.arrayContaining([
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      ]),
    );
  });

  it('does not grant hardware or payment features the app never uses', async () => {
    const rules = await nextConfig.headers?.();
    const appRule = rules?.find((rule) => rule.source === '/(.*)');
    const permissions = appRule?.headers.find((header) => header.key === 'Permissions-Policy');

    expect(permissions?.value).toBe('camera=(), geolocation=(), microphone=(), payment=(), usb=()');
  });
});
