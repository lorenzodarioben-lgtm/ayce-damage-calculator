import { cn } from '@/lib/cn';

interface BrandMarkProps {
  className?: string;
}

/** Grill bars beside the wordmark; a full logo would be overdesigned here. */
export function BrandMark({ className }: BrandMarkProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 24 24" className="size-6 shrink-0" aria-hidden="true" focusable="false">
        <rect
          x="1"
          y="1"
          width="22"
          height="22"
          rx="6"
          fill="none"
          stroke="#C99557"
          strokeWidth="1.5"
          opacity="0.6"
        />
        <g stroke="#C99557" strokeWidth="2" strokeLinecap="round">
          <line x1="6" y1="9" x2="18" y2="9" />
          <line x1="6" y1="13" x2="18" y2="13" opacity="0.7" />
          <line x1="6" y1="17" x2="18" y2="17" opacity="0.4" />
        </g>
      </svg>
      <span className="display-type text-xl leading-none text-cream-50">
        AYCE <span className="text-ember-500">{'//'}</span> Damage
      </span>
    </span>
  );
}
