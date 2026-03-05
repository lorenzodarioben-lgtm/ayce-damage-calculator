import { cn } from '@/lib/cn';

/**
 * The wordmark as plain text. Callers that need it in an accessible name use
 * this rather than restating the string, so the two can never disagree.
 */
export const BRAND_NAME = 'AYCE // Damage';

interface BrandMarkProps {
  className?: string;
}

/**
 * Grill bars beside the wordmark; a full logo would be overdesigned here. The
 * marks take their colour from the element rather than restating the hex, so
 * the theme stays the single place the brand colour is defined.
 */
export function BrandMark({ className }: BrandMarkProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg
        viewBox="0 0 24 24"
        className="size-6 shrink-0 text-ember-500 drop-shadow-[0_0_6px_var(--color-ember-700)]"
        aria-hidden="true"
        focusable="false"
      >
        <rect
          x="1"
          y="1"
          width="22"
          height="22"
          rx="6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity="0.6"
        />
        {/* The bars fade downwards, so the mark reads as lit from the top like
            everything else on the page. */}
        <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="6" y1="9" x2="18" y2="9" />
          <line x1="6" y1="13" x2="18" y2="13" opacity="0.7" />
          <line x1="6" y1="17" x2="18" y2="17" opacity="0.4" />
        </g>
      </svg>
      <span className="display-type text-xl leading-none tracking-[0.03em] text-cream-50">
        AYCE <span className="text-ember-500">{'//'}</span> Damage
      </span>
    </span>
  );
}
