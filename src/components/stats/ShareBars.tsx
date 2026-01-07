import { formatPercent } from '@/lib/formatting';
import type { Tally } from '@/lib/analytics';

interface ShareBarsProps {
  tallies: readonly Tally<string>[];
  /** Named so the bars are never the only thing carrying the meaning. */
  unitLabel: string;
}

/**
 * Proportional bars, drawn with CSS widths rather than SVG.
 *
 * Each row states its own figures in text, so the bar is decoration and the
 * numbers are the content.
 */
export function ShareBars({ tallies, unitLabel }: ShareBarsProps) {
  return (
    <ul className="space-y-3">
      {tallies.map((tally) => (
        <li key={tally.id}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-semibold text-cream-100">{tally.label}</span>
            <span className="tabular text-xs text-cream-500">
              {tally.plates} {unitLabel} · {formatPercent(tally.share)}
            </span>
          </div>
          <div aria-hidden="true" className="mt-1.5 h-2 overflow-hidden rounded-full bg-ash-900">
            <div
              className="h-full rounded-full bg-ember-600"
              style={{ width: `${Math.max(0, Math.min(100, tally.share))}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
