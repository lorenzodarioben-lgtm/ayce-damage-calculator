import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          // The worker script is the only thing that can announce a new build,
          // so it must never be answered from an HTTP cache.
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // The app does not benefit from speculative DNS lookups, and it has
          // no third-party hosts to discover through them.
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          // No legacy cross-domain policy files are served from this app.
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // The calculator neither embeds third-party pages nor needs its own
          // device-local data to appear inside someone else's frame.
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), geolocation=(), microphone=(), payment=(), usb=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
