/**
 * Where this deployment lives.
 *
 * Vercel supplies its own host at build time, so a deployment needs no
 * configuration; the explicit variable is only there for a custom domain, and
 * local development falls back to the dev server. Shared by the root metadata,
 * the sitemap and the robots rules, so the three cannot disagree about which
 * origin they are describing.
 */
function publicHttpOrigin(value: string | undefined): URL | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    // A metadata base describes the deployment origin. Keeping a configured
    // path or credentials here would make generated root-relative links point
    // somewhere surprising, so retain only the safe public origin.
    return new URL(url.origin);
  } catch {
    return null;
  }
}

export function siteUrl(): URL {
  const configured = publicHttpOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (configured) {
    return configured;
  }
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return (
    publicHttpOrigin(vercelHost ? `https://${vercelHost}` : undefined) ??
    new URL('http://localhost:3000')
  );
}
