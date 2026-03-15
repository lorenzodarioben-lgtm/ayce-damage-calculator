import { cn } from '@/lib/cn';

type FigureSize = 'row' | 'figure';
type FigureTone = 'neutral' | 'behind' | 'recovered' | 'runaway' | 'lost';

/**
 * A label and the figure it names.
 *
 * Six of these had been written separately — four identical down to the
 * padding, one a panel, one bare — and between them they were most of what the
 * stats page, the planner, the place and diner records and the report were made
 * of. They are one thing now.
 *
 * Deliberately not a box. A page of figures was a page of boxes, and a grid of
 * identical boxes ranks nothing: it takes reading every label to find the one
 * figure you came for. A rule above each cell groups them and costs nothing,
 * which is the register the report is built from.
 *
 * The wrapper is a `div` so a caller can lay several out in a grid on a `dl`
 * and keep the definition-list semantics that pair a term with its value.
 */
const TONES: Record<FigureTone, string> = {
  neutral: 'text-cream-50',
  behind: 'text-ember-300',
  recovered: 'text-sesame-400',
  runaway: 'text-flame-400',
  lost: 'text-char-400',
};

interface FigureProps {
  label: string;
  value: string;
  /** A qualifier under the figure — an average, a date, a count. */
  detail?: string;
  /** `figure` is for the two or three readings a page is actually about. */
  size?: FigureSize;
  tone?: FigureTone;
  className?: string;
}

export function Figure({
  label,
  value,
  detail,
  size = 'row',
  tone = 'neutral',
  className,
}: FigureProps) {
  return (
    <div className={cn('border-t border-line-soft pt-2.5', className)}>
      <dt className="micro-label truncate text-cream-500">{label}</dt>
      <dd
        className={cn(
          'tabular mt-1 font-semibold',
          size === 'figure' ? 'display-type text-figure' : 'text-lead',
          TONES[tone],
        )}
      >
        {value}
      </dd>
      {detail && <p className="mt-1 text-caption text-cream-600">{detail}</p>}
    </div>
  );
}
