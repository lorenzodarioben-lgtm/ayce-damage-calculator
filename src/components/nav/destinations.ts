/** Target of the skip link; every page's `main` carries it. */
export const MAIN_CONTENT_ID = 'main-content';

export interface Destination {
  readonly href: string;
  readonly label: string;
}

/**
 * Every page the header links to, in the order they appear. Adding a route here
 * is all it takes to reach it from both the desktop bar and the mobile menu.
 */
export const DESTINATIONS: readonly Destination[] = [
  { href: '/', label: 'Calculator' },
  { href: '/live', label: 'Live' },
  { href: '/history', label: 'History' },
  { href: '/stats', label: 'Stats' },
];

/** Treats nested paths as belonging to their section, but keeps `/` exact. */
export function isCurrentDestination(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
