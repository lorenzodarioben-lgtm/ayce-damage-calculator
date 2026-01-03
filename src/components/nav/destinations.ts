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
  { href: '/history', label: 'History' },
];

/** Treats nested paths as belonging to their section, but keeps `/` exact. */
export function isCurrentDestination(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
