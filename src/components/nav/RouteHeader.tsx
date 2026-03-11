import type { ReactNode } from 'react';

interface RouteHeaderProps {
  /** A backdrop from `public/images`, cropped to roughly this band's shape. */
  image: string;
  title: string;
  /** The sentence under the title, describing what the page is for. */
  children: ReactNode;
}

/**
 * The opening band of a section page: edge to edge, and photographic.
 *
 * The picture runs at its own brightness. Dimming a photograph uniformly is how
 * a page ends up with neither a photograph nor a clean background, so contrast
 * for the type comes from a scrim over the corner the words occupy instead —
 * near-solid at the left, gone by the right edge, where the picture is left to
 * be a picture.
 *
 * Full-bleed rather than a panel. A section page that opens inside the same
 * rounded box as its content has no opening at all; the band is what makes
 * arriving somewhere feel like arriving.
 */
export function RouteHeader({ image, title, children }: RouteHeaderProps) {
  return (
    <div className="relative isolate mb-8 overflow-hidden border-b border-line-ember/50">
      <div
        aria-hidden="true"
        // Inline because the file is the one thing that varies per route.
        style={{ backgroundImage: `url(${image})` }}
        className="absolute inset-0 -z-20 bg-cover bg-center"
      />
      {/* Warms the photograph towards the palette without flattening it. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(120deg,rgba(122,51,36,0.32),rgba(13,12,10,0.08)_62%)] mix-blend-soft-light"
      />
      {/*
       * The scrim that buys the contrast, anchored to the corner the words
       * occupy rather than swept across the whole band. A flat gradient dark
       * enough for a heading would have taken the picture with it; this is
       * near-solid under the text at the bottom left and thin by the top right,
       * which is the part of the frame worth seeing.
       */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(135%_155%_at_0%_100%,rgba(13,12,10,0.985)_0%,rgba(13,12,10,0.95)_38%,rgba(13,12,10,0.72)_58%,rgba(13,12,10,0.3)_80%,rgba(13,12,10,0.08)_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,rgba(13,12,10,0.5),rgba(13,12,10,0.05)_40%,rgba(13,12,10,0.55)_100%)]"
      />
      <div aria-hidden="true" className="grill-texture absolute inset-0 -z-10 opacity-35" />

      <div className="mx-auto flex min-h-[clamp(15rem,34vh,22rem)] max-w-[900px] flex-col justify-end px-4 pb-9 pt-16 sm:px-6 sm:pb-11 sm:pt-20">
        <h1 className="display-hero text-[clamp(2.75rem,8vw,4.75rem)] text-cream-50 drop-shadow-[0_3px_18px_rgba(13,12,10,0.9)]">
          {title}
        </h1>
        <p className="mt-4 max-w-[58ch] text-sm leading-relaxed text-cream-100 drop-shadow-[0_2px_10px_rgba(13,12,10,0.95)] sm:text-base">
          {children}
        </p>
      </div>
    </div>
  );
}
