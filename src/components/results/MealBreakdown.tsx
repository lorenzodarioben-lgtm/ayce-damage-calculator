import { getPlateSizeMeta, getQualityMeta } from '@/lib/constants';
import { formatMoney, formatPlates, formatWeight } from '@/lib/formatting';
import type { LineItemTotals } from '@/types/meal';

interface MealBreakdownProps {
  lines: readonly LineItemTotals[];
  headingId: string;
  /** Names the section. Varies by context; the table does not. */
  heading?: string;
}

/**
 * Every line on the tab, with what it was worth.
 *
 * The headline figures answer "did I win?"; this answers "on what?". Shared by
 * the live report, a filed record and a shared link, so the itemisation cannot
 * drift between them — and so the printable receipt is no longer the only place
 * the detail exists.
 */
export function MealBreakdown({
  lines,
  headingId,
  heading = 'What was recorded',
}: MealBreakdownProps) {
  if (lines.length === 0) {
    return null;
  }

  const total = lines.reduce((sum, line) => sum + line.retailValue, 0);

  return (
    <section aria-labelledby={headingId} className="panel p-4 sm:p-5">
      <h3 id={headingId} className="micro-label mb-3">
        {heading}
      </h3>

      <ul>
        {lines.map((line) => (
          <li
            key={line.item.id}
            className="flex items-start justify-between gap-3 border-b border-line-soft py-3 first:pt-0"
          >
            <div className="min-w-0">
              <p className="text-sm font-bold text-cream-50">{line.food.name}</p>
              <p className="text-xs text-cream-500">
                {getQualityMeta(line.item.quality).label} ·{' '}
                {getPlateSizeMeta(line.item.plateSize).label}
              </p>
              <p className="tabular mt-0.5 text-xs text-cream-700">
                {formatPlates(line.plates)} · {formatWeight(line.weightG)}
              </p>
            </div>
            <p className="tabular shrink-0 text-sm font-bold text-ember-400">
              {formatMoney(line.retailValue)}
            </p>
          </li>
        ))}
      </ul>

      <div className="flex items-baseline justify-between gap-3 pt-3">
        <p className="micro-label">Est. retail value</p>
        <p className="tabular text-base font-bold text-cream-50">{formatMoney(total)}</p>
      </div>
    </section>
  );
}
