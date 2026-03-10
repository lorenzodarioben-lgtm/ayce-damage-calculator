import type { ReactNode } from 'react';

interface RouteHeaderProps {
  /** A backdrop from `public/images`, already sized for a band this shape. */
  image: string;
  title: string;
  /** The sentence under the title, describing what the page is for. */
  children: ReactNode;
}

/**
 * The opening panel of a section page.
 *
 * A photograph here is atmosphere, never content: it sits behind the title at
 * around a third strength, under a wash that is almost opaque where the words
 * are and thins out towards the empty side. Nothing on it needs to be legible
 * — the app's own drawings do the explaining — so it is free to be dark, and
 * the title keeps the contrast it had against flat brown.
 *
 * Deliberately a panel rather than a full-bleed band. The calculator's hero is
 * the one place the app raises its voice; a section page opening the same way
 * would flatten that distinction, and a panel is the shape everything else here
 * already uses.
 */
export function RouteHeader({ image, title, children }: RouteHeaderProps) {
  return (
    <div className="panel relative isolate overflow-hidden">
      <div
        aria-hidden="true"
        // Inline because the file is the one thing that varies per route.
        style={{ backgroundImage: `url(${image})` }}
        className="absolute inset-0 -z-20 bg-cover bg-center opacity-35"
      />
      {/* Heaviest at the left, where the title sits, thinning towards the right
          so the picture is allowed to show somewhere. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,var(--color-ash-950)_16%,rgba(13,12,10,0.82)_46%,rgba(13,12,10,0.42)_100%)]"
      />
      <div aria-hidden="true" className="grill-texture absolute inset-0 -z-10 opacity-45" />

      <div className="px-5 py-8 sm:px-7 sm:py-10">
        <h1 className="display-hero text-[clamp(2.25rem,6vw,3.5rem)] text-cream-50 drop-shadow-[0_2px_12px_rgba(13,12,10,0.9)]">
          {title}
        </h1>
        <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-cream-100">{children}</p>
      </div>
    </div>
  );
}
