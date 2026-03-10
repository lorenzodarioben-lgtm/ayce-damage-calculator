import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * What an empty panel draws above its sentence.
 *
 * Every one is the same overhead plate the food illustrations use, with a
 * different thing resting on it. That is the point: an empty history and an
 * empty menu are the same absence, and drawing them in the same language says
 * so without a word. The plate is also the one shape this app has already
 * taught the reader to recognise.
 */
export type EmptyMark = 'plate' | 'record' | 'people' | 'place' | 'chart';

/*
 * Flat fills rather than gradients, so this renders in a server component
 * without needing a unique id per instance — two of these on one page would
 * otherwise collide, and the gradient would have been identical anyway.
 */
const PLATE = '#241E19';
const PLATE_EDGE = '#3A3128';
const GLYPH = '#8F8271';
const GLYPH_WARM = '#A97A41';

function Glyph({ mark }: { mark: EmptyMark }) {
  switch (mark) {
    case 'record':
      // Filed reports, stacked and face down.
      return (
        <g stroke={GLYPH} strokeWidth="2.5" fill="none" strokeLinejoin="round">
          <rect x="44" y="49" width="40" height="14" rx="3" opacity="0.45" />
          <rect x="41" y="60" width="46" height="15" rx="3" opacity="0.7" />
          <rect x="38" y="72" width="52" height="16" rx="3" />
          <line x1="46" y1="80" x2="66" y2="80" stroke={GLYPH_WARM} strokeLinecap="round" />
        </g>
      );
    case 'people':
      // Two seats at a table, nobody in them.
      return (
        <g stroke={GLYPH} strokeWidth="2.5" fill="none" strokeLinecap="round">
          <circle cx="52" cy="58" r="8" />
          <path d="M38 82c0-8 6-13 14-13s14 5 14 13" />
          <circle cx="79" cy="62" r="7" opacity="0.55" />
          <path d="M67 82c0-7 5-11 12-11s12 4 12 11" opacity="0.55" />
        </g>
      );
    case 'place':
      // A shopfront with the extraction duct every one of these rooms has.
      return (
        <g stroke={GLYPH} strokeWidth="2.5" fill="none" strokeLinejoin="round">
          <path d="M40 84V60h48v24" />
          <path d="M36 60l6-12h44l6 12z" />
          <path d="M58 84V70h12v14" stroke={GLYPH_WARM} />
        </g>
      );
    case 'chart':
      // Three readings and nothing to read them against.
      return (
        <g stroke={GLYPH} strokeWidth="2.5" fill="none" strokeLinecap="round">
          <line x1="42" y1="84" x2="86" y2="84" />
          <line x1="52" y1="84" x2="52" y2="70" opacity="0.55" />
          <line x1="64" y1="84" x2="64" y2="60" stroke={GLYPH_WARM} />
          <line x1="76" y1="84" x2="76" y2="66" opacity="0.55" />
        </g>
      );
    case 'plate':
    default:
      // Nothing on it, said with a pair of rests rather than a blank circle.
      return (
        <g stroke={GLYPH} strokeWidth="2.5" fill="none" strokeLinecap="round">
          <line x1="50" y1="52" x2="44" y2="86" opacity="0.6" />
          <line x1="78" y1="52" x2="84" y2="86" opacity="0.6" />
          <circle cx="64" cy="68" r="13" strokeDasharray="4 6" stroke={GLYPH_WARM} opacity="0.8" />
        </g>
      );
  }
}

interface EmptyStateProps {
  mark?: EmptyMark;
  title: string;
  children: ReactNode;
  /** The way out, where there is one. Usually a link shaped like a button. */
  action?: ReactNode;
  className?: string;
}

/**
 * The panel a page shows when it has nothing to report.
 *
 * Nineteen of these were being assembled by hand out of the same three
 * elements. They are also, for anyone arriving without a meal on file, most of
 * the app — so they were the screens least worth leaving as a sentence in a
 * dashed box.
 */
export function EmptyState({
  mark = 'plate',
  title,
  children,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'panel relative isolate overflow-hidden border-dashed px-6 py-12 text-center sm:py-14',
        className,
      )}
    >
      {/* The same warm light everything else in the app is lit by. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-56 w-72 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,var(--color-ember-600)_0%,transparent_70%)] opacity-20 blur-2xl"
      />

      <svg
        viewBox="0 0 128 128"
        role="presentation"
        focusable="false"
        aria-hidden="true"
        className="mx-auto mb-5 size-24 drop-shadow-[0_8px_18px_rgba(0,0,0,0.55)] sm:size-28"
      >
        <ellipse cx="64" cy="68" rx="52" ry="50" fill={PLATE} />
        <ellipse
          cx="64"
          cy="66"
          rx="41"
          ry="39"
          fill="none"
          stroke={PLATE_EDGE}
          strokeWidth="1.5"
        />
        {/* Scaled about the plate's centre so each glyph fills it rather than
            floating in the middle of a lot of ceramic. */}
        <g transform="translate(64 68) scale(1.3) translate(-64 -68)">
          <Glyph mark={mark} />
        </g>
      </svg>

      <p className="display-type text-2xl text-cream-300">{title}</p>
      <p className="mx-auto mt-3 max-w-[44ch] text-sm leading-relaxed text-cream-700">{children}</p>
      {action}
    </div>
  );
}
