import { formatPercent, formatRecordedAt } from '@/lib/formatting';
import type { TrendPoint } from '@/lib/analytics';

interface RecoveryTrendProps {
  points: readonly TrendPoint[];
  headingId: string;
}

const WIDTH = 640;
const HEIGHT = 200;
const PADDING = { top: 16, right: 8, bottom: 8, left: 8 };

/**
 * Recovery across recent sessions, as a bar per visit.
 *
 * Hand-drawn SVG rather than a charting library: the whole chart is a dozen
 * rects, and a dependency would cost more than it saves. The figures are also
 * exposed as a table for anything that cannot read the drawing.
 */
export function RecoveryTrend({ points, headingId }: RecoveryTrendProps) {
  if (points.length === 0) {
    return null;
  }

  const ceiling = Math.max(120, ...points.map((point) => point.recoveryPercent));
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const slot = plotWidth / points.length;
  const barWidth = Math.min(48, slot * 0.62);

  const breakEvenY = PADDING.top + plotHeight - (100 / ceiling) * plotHeight;

  return (
    <>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-labelledby={`${headingId}-title`}
        className="h-auto w-full"
        preserveAspectRatio="none"
      >
        <title id={`${headingId}-title`}>
          Retail recovery across the last {points.length}{' '}
          {points.length === 1 ? 'session' : 'sessions'}, from{' '}
          {formatPercent(points[0]?.recoveryPercent ?? 0)} to{' '}
          {formatPercent(points[points.length - 1]?.recoveryPercent ?? 0)}.
        </title>

        {/* The break-even line is the only reference the chart needs. */}
        <line
          x1={PADDING.left}
          x2={WIDTH - PADDING.right}
          y1={breakEvenY}
          y2={breakEvenY}
          stroke="var(--color-cream-700)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        {points.map((point, index) => {
          const height = Math.max(2, (point.recoveryPercent / ceiling) * plotHeight);
          const x = PADDING.left + index * slot + (slot - barWidth) / 2;
          const y = PADDING.top + plotHeight - height;
          const beaten = point.recoveryPercent >= 100;

          return (
            <rect
              key={point.id}
              x={x}
              y={y}
              width={barWidth}
              height={height}
              rx="3"
              fill={beaten ? 'var(--color-sesame-500)' : 'var(--color-ember-600)'}
            />
          );
        })}
      </svg>

      <p className="mt-2 text-center text-[0.7rem] text-cream-700">
        Dashed line marks retail break-even. Oldest on the left.
      </p>

      {/* The same data, readable without the drawing. */}
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-cream-500">Show these figures</summary>
        <table className="tabular mt-2 w-full text-left text-xs">
          <thead>
            <tr className="text-cream-700">
              <th scope="col" className="py-1 font-semibold">
                Session
              </th>
              <th scope="col" className="py-1 text-right font-semibold">
                Recovery
              </th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.id} className="border-t border-line-soft">
                <td className="py-1 text-cream-300">{formatRecordedAt(point.recordedAt)}</td>
                <td className="py-1 text-right text-cream-100">
                  {formatPercent(point.recoveryPercent)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}
