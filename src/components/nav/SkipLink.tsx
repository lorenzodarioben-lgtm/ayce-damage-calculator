import { MAIN_CONTENT_ID } from '@/components/nav/destinations';

/**
 * The first focusable thing in the document. It lives at the layout root rather
 * than inside the header so that nothing mounted above the page — the service
 * worker's status bar, for one — can ever come before it in tab order. Fixed
 * rather than absolute for the same reason: it no longer has the sticky header
 * as a positioning context.
 */
export function SkipLink() {
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="fixed left-4 top-2 z-50 -translate-y-[150%] rounded-[10px] border border-line-ember bg-ash-850 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ember-400 transition-transform duration-150 focus-visible:translate-y-0"
    >
      Skip to content
    </a>
  );
}
