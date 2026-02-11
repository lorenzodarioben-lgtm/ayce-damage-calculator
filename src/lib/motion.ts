/**
 * Whether the visitor has asked for motion to stop.
 *
 * The stylesheet already neutralises animation and CSS `scroll-behavior` under
 * `prefers-reduced-motion`, but a scroll asked for in script carries its own
 * `behavior` and overrides the stylesheet, so the preference has to be read
 * here too. Guarded for the server and for any environment without
 * `matchMedia`, where the honest answer is that nothing was asked for.
 */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** What to pass a scrolling call, given that preference. */
export function scrollBehaviour(): ScrollBehavior {
  return prefersReducedMotion() ? 'auto' : 'smooth';
}
