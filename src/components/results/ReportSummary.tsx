import { ResultMetric } from '@/components/results/ResultMetric';
import { cn } from '@/lib/cn';
import {
  formatCalories,
  formatGrams,
  formatKg,
  formatLb,
  formatMoney,
  formatPercent,
  formatPlates,
  formatSignedMoney,
} from '@/lib/formatting';
import { getHouseStatus, type Verdict } from '@/lib/verdicts';
import type { DamageReport } from '@/types/meal';

interface ReportSummaryProps {
  report: DamageReport;
  verdict: Verdict;
  restaurantName: string;
  /** Names the verdict panel. Varies by context; the layout does not. */
  heading: string;
  headingId: string;
  /**
   * 1 where the report *is* the page — a shared link, a filed record, the
   * calculator once it has switched to the report. 2 where something else
   * already owns the page's title. Subsections follow one level below.
   */
  headingLevel?: 1 | 2;
  /** Rendered under the verdict copy, for context-specific detail. */
  subheading?: string;
}

const SEVERITY_TONE = {
  calm: 'text-cream-500',
  normal: 'text-cream-300',
  watch: 'text-ember-400',
  alert: 'text-ember-300',
  breach: 'text-char-500',
} as const;

const VERDICT_TONE = {
  diner: 'text-sesame-400',
  even: 'text-ember-400',
  house: 'text-cream-50',
} as const;

/**
 * The read-only body of a damage report.
 *
 * Shared by the live report, a saved session and a shared link, so all three
 * present the same numbers in the same order and cannot drift apart.
 */
export function ReportSummary({
  report,
  verdict,
  restaurantName,
  heading,
  headingId,
  headingLevel = 2,
  subheading,
}: ReportSummaryProps) {
  const houseStatus = getHouseStatus(report.totalRestaurantCost, report.totalAdmission);
  const extracted = report.retailValueDifference >= 0;

  const Heading = (headingLevel === 1 ? 'h1' : 'h2') as 'h1' | 'h2';
  const SubHeading = (headingLevel === 1 ? 'h2' : 'h3') as 'h2' | 'h3';

  return (
    <div className="space-y-6">
      {/* 1 — Verdict */}
      <section aria-labelledby={headingId} className="panel overflow-hidden">
        <div className="grill-texture border-b border-line px-5 py-4 text-center">
          <Heading id={headingId} className="micro-label !text-ember-400">
            {heading}
          </Heading>
          {restaurantName && (
            <p className="mt-1 break-words text-sm text-cream-300">{restaurantName}</p>
          )}
        </div>

        <div className="px-5 py-8 text-center sm:py-10">
          <p
            className={cn(
              'display-type text-[2.5rem] leading-[0.92] sm:text-6xl',
              VERDICT_TONE[verdict.tone],
            )}
          >
            {verdict.title}
          </p>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-cream-300 sm:text-base">
            {verdict.copy}
          </p>
          {subheading && <p className="mt-3 text-xs text-cream-700">{subheading}</p>}
        </div>
      </section>

      {/* 2 — Retail value against admission */}
      <div className="grid gap-3 sm:grid-cols-2">
        <ResultMetric
          label="Est. retail value"
          value={formatMoney(report.totalRetailValue)}
          detail="What a similar quantity might cost at retail."
          emphasis="major"
          tone="accent"
        />
        <ResultMetric
          label="Admission"
          value={formatMoney(report.totalAdmission)}
          detail="What the table paid to walk in."
          emphasis="major"
        />
        <ResultMetric
          label={extracted ? 'Value extracted' : 'Value gap'}
          value={formatSignedMoney(report.retailValueDifference)}
          detail="Estimated retail value minus admission."
          tone={extracted ? 'positive' : 'negative'}
        />
        <ResultMetric
          label="Retail value recovered"
          value={formatPercent(report.retailRecoveryPercent)}
          detail="Retail comparison only — not restaurant profitability."
          tone="accent"
        />
      </div>

      {/* 3 — Volume */}
      <div className="grid gap-3 sm:grid-cols-2">
        <ResultMetric label="Total plates" value={formatPlates(report.totalPlates)} />
        <ResultMetric
          label="Food consumed"
          value={formatKg(report.totalWeightKg)}
          detail={formatLb(report.totalWeightLb)}
        />
      </div>

      {/* 4 — Nutrition */}
      <section aria-labelledby={`${headingId}-nutrition`}>
        <SubHeading id={`${headingId}-nutrition`} className="micro-label mb-2">
          Approximate nutrition
        </SubHeading>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <ResultMetric label="Calories" value={formatCalories(report.nutrition.calories)} />
          <ResultMetric label="Protein" value={formatGrams(report.nutrition.protein)} />
          <ResultMetric label="Fat" value={formatGrams(report.nutrition.fat)} />
          <ResultMetric label="Carbohydrates" value={formatGrams(report.nutrition.carbs)} />
        </div>
      </section>

      {/* 5 — The house side of the ledger */}
      <section aria-labelledby={`${headingId}-house`} className="panel p-4 sm:p-5">
        <SubHeading id={`${headingId}-house`} className="micro-label mb-3">
          The house side of the ledger
        </SubHeading>
        <div className="grid gap-3 sm:grid-cols-2">
          <ResultMetric
            label="Est. ingredient cost"
            value={formatMoney(report.totalRestaurantCost)}
            detail="What the restaurant may have spent on the raw ingredient."
          />
          <ResultMetric
            label="Est. ingredient margin"
            value={formatMoney(report.estimatedIngredientMargin)}
            detail="Before rent, wages, utilities, tax, waste, sides and overhead."
          />
        </div>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 rounded-[10px] border border-line-soft bg-ash-900 px-4 py-3">
          <div>
            <p className="micro-label">Est. food cost</p>
            <p className={cn('mt-0.5 text-sm font-semibold', SEVERITY_TONE[houseStatus.severity])}>
              {houseStatus.label}
            </p>
          </div>
          <p className="tabular display-type text-3xl text-cream-100">
            {formatPercent(report.estimatedFoodCostPercent)}{' '}
            <span className="text-sm text-cream-700">of admission</span>
          </p>
        </div>
      </section>
    </div>
  );
}
