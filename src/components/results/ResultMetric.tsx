import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface ResultMetricProps {
  label: string;
  value: string;
  detail?: string;
  emphasis?: 'major' | 'normal';
  tone?: 'neutral' | 'positive' | 'negative' | 'accent';
  icon?: ReactNode;
}

const TONES: Record<NonNullable<ResultMetricProps['tone']>, string> = {
  neutral: 'text-cream-50',
  positive: 'text-sesame-400',
  negative: 'text-char-500',
  accent: 'text-ember-300',
};

/*
 * A thread of the figure's own colour down the leading edge of its tile.
 *
 * Eight tiles of identical brown is a table pretending to be a dashboard: it
 * takes reading every label to find the one figure you came for. The edge
 * groups them by what they mean before any of them is read, and it repeats a
 * distinction the value's colour is already making rather than inventing one.
 */
const EDGES: Record<NonNullable<ResultMetricProps['tone']>, string> = {
  neutral: 'before:bg-line-ember',
  positive: 'before:bg-sesame-500',
  negative: 'before:bg-char-500',
  accent: 'before:bg-ember-500',
};

export function ResultMetric({
  label,
  value,
  detail,
  emphasis = 'normal',
  tone = 'neutral',
  icon,
}: ResultMetricProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-card border border-line bg-ash-850 p-4 pl-5',
        'shadow-[var(--shadow-panel)]',
        "before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-['']",
        EDGES[tone],
        // A major figure is the one the section exists to report, so it sits a
        // step above its neighbours rather than merely being set larger.
        emphasis === 'major' &&
          'bg-ash-800 bg-[image:var(--fill-panel-strong)] shadow-[var(--shadow-raised)]',
      )}
    >
      <div className="flex items-center gap-1.5">
        {icon}
        <p className="micro-label">{label}</p>
      </div>
      <p
        className={cn(
          'tabular mt-1.5 break-words',
          emphasis === 'major'
            ? 'display-hero text-4xl leading-none sm:text-5xl'
            : 'display-type text-2xl sm:text-3xl',
          TONES[tone],
        )}
      >
        {value}
      </p>
      {detail && <p className="tabular mt-1 text-xs leading-snug text-cream-700">{detail}</p>}
    </div>
  );
}
