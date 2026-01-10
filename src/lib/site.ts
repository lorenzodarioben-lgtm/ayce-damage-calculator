/**
 * Where this deployment lives.
 *
 * Vercel supplies its own host at build time, so a deployment needs no
 * configuration; the explicit variable is only there for a custom domain, and
 * local development falls back to the dev server. Shared by the root metadata,
 * the sitemap and the robots rules, so the three cannot disagree about which
 * origin they are describing.
 */
export function siteUrl(): URL {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    return new URL(configured);
  }
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return new URL(vercelHost ? `https://${vercelHost}` : 'http://localhost:3000');
}
