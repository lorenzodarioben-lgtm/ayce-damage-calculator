'use client';

import { ResultMetric } from '@/components/results/ResultMetric';
import { usePricingProfile } from '@/components/session/PricingContext';
import { perDinerTotals } from '@/lib/calculations';
import { cn } from '@/lib/cn';
import { formatPlateQuantity } from '@/lib/consumption';
import {
  formatCalories,
  formatCount,
  formatGrams,
  formatKg,
  formatLb,
  formatMoney,
  formatPercent,
  formatPlates,
  formatSignedMoney,
  formatWeight,
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
  const pricingProfile = usePricingProfile();
  const houseStatus = getHouseStatus(report.totalRestaurantCost, report.totalAdmission);
  const extracted = report.retailValueDifference >= 0;
  const hasAdjustments = report.adjustmentCharges > 0 || report.adjustmentDiscounts > 0;
  const hasUneaten = report.totalUneatenPlates > 0;

  // A table of one is already reading per-diner figures, so the split is only
  // shown when there is something to split.
  const perDiner = report.dinerCount > 1 ? perDinerTotals(report) : null;

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

      {hasAdjustments && (
        <section
          aria-labelledby="bill-breakdown-heading"
          className="rounded-[10px] border border-line-soft bg-ash-900 px-4 py-3"
        >
          <h3 id="bill-breakdown-heading" className="micro-label mb-2">
            How the bill settled
          </h3>
          <dl className="space-y-1">
            <BillRow
              label="Entry price"
              value={formatMoney(report.baseAdmission, pricingProfile.money)}
            />
            {report.adjustmentCharges > 0 && (
              <BillRow
                label="Charges"
                value={`+${formatMoney(report.adjustmentCharges, pricingProfile.money)}`}
              />
            )}
            {report.adjustmentDiscounts > 0 && (
              <BillRow
                label="Discounts"
                value={`−${formatMoney(report.adjustmentDiscounts, pricingProfile.money)}`}
              />
            )}
            <BillRow
              label="Paid in total"
              value={formatMoney(report.totalAdmission, pricingProfile.money)}
              total
            />
          </dl>
          <p className="mt-2 max-w-[60ch] text-xs leading-relaxed text-cream-700">
            Every figure below is measured against the total paid, not the entry price — that is
            what the evening actually cost.
          </p>
        </section>
      )}

      {/* 2 — Retail value against what was paid */}
      <div className="grid gap-3 sm:grid-cols-2">
        <ResultMetric
          label="Est. retail value"
          value={formatMoney(report.totalRetailValue, pricingProfile.money)}
          detail="What a similar quantity might cost at retail."
          emphasis="major"
          tone="accent"
        />
        <ResultMetric
          label={hasAdjustments ? 'Total paid' : 'Admission'}
          value={formatMoney(report.totalAdmission, pricingProfile.money)}
          detail={
            hasAdjustments
              ? 'Entry price, plus what went on the bill and minus what came off.'
              : 'What the table paid to walk in.'
          }
          emphasis="major"
        />
        <ResultMetric
          label={extracted ? 'Value extracted' : 'Value gap'}
          value={formatSignedMoney(report.retailValueDifference, pricingProfile.money)}
          detail={`Estimated retail value minus ${hasAdjustments ? 'the total paid' : 'admission'}.`}
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
        <ResultMetric
          label="Plates ordered"
          value={formatPlates(report.totalPlates)}
          {...(hasUneaten
            ? { detail: `${formatPlateQuantity(report.totalConsumedPlates)} eaten` }
            : {})}
        />
        <ResultMetric
          label="Food eaten"
          value={formatKg(report.totalWeightKg)}
          detail={formatLb(report.totalWeightLb)}
        />
      </div>

      {hasUneaten && (
        <section
          aria-labelledby="uneaten-heading"
          className="rounded-[10px] border border-line-soft bg-ash-900 px-4 py-3"
        >
          <SubHeading id="uneaten-heading" className="micro-label mb-2">
            What reached the table
          </SubHeading>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Figure
              label="Ordered"
              value={formatMoney(report.totalOrderedRetailValue, pricingProfile.money)}
            />
            <Figure
              label="Eaten"
              value={formatMoney(report.totalRetailValue, pricingProfile.money)}
            />
            <Figure label="Left" value={formatPlateQuantity(report.totalUneatenPlates)} />
          </dl>
          <p className="mt-2 max-w-[62ch] text-xs leading-relaxed text-cream-700">
            Recovery is measured on what was eaten, because value you did not eat is not value you
            extracted. What reached the table is kept alongside it, so the tab still says what
            arrived. Estimated ingredient cost follows the ordered figure — the restaurant bought
            the plate either way.
          </p>
        </section>
      )}

      {/* 4 — The even split */}
      {perDiner && (
        <section aria-labelledby={`${headingId}-per-diner`} className="panel p-4 sm:p-5">
          <SubHeading id={`${headingId}-per-diner`} className="micro-label mb-1">
            Split {formatCount(perDiner.dinerCount)} ways
          </SubHeading>
          <p className="mb-3 text-xs text-cream-700">
            An even split of the table&rsquo;s totals. The calculator records one shared tab, so it
            cannot know who reached for what.
          </p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <ResultMetric
              label="Admission each"
              value={formatMoney(perDiner.admission, pricingProfile.money)}
            />
            <ResultMetric
              label="Retail value each"
              value={formatMoney(perDiner.retailValue, pricingProfile.money)}
              tone="accent"
            />
            <ResultMetric label="Food each" value={formatWeight(perDiner.weightG)} />
            <ResultMetric
              label="Calories each"
              value={formatCalories(perDiner.nutrition.calories)}
            />
          </div>
        </section>
      )}

      {/* 5 — Nutrition */}
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

      {/* 6 — The house side of the ledger */}
      <section aria-labelledby={`${headingId}-house`} className="panel p-4 sm:p-5">
        <SubHeading id={`${headingId}-house`} className="micro-label mb-3">
          The house side of the ledger
        </SubHeading>
        <div className="grid gap-3 sm:grid-cols-2">
          <ResultMetric
            label="Est. ingredient cost"
            value={formatMoney(report.totalRestaurantCost, pricingProfile.money)}
            detail="What the restaurant may have spent on the raw ingredient."
          />
          <ResultMetric
            label="Est. ingredient margin"
            value={formatMoney(report.estimatedIngredientMargin, pricingProfile.money)}
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
            <span className="text-sm text-cream-700">
              of {hasAdjustments ? 'the total paid' : 'admission'}
            </span>
          </p>
        </div>
      </section>
    </div>
  );
}

function BillRow({
  label,
  value,
  total = false,
}: {
  label: string;
  value: string;
  total?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={total ? 'text-sm font-semibold text-cream-200' : 'text-xs text-cream-700'}>
        {label}
      </dt>
      <dd
        className={cn(
          'tabular',
          total ? 'text-sm font-semibold text-ember-400' : 'text-xs text-cream-500',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="micro-label">{label}</dt>
      <dd className="tabular mt-0.5 text-sm font-semibold text-cream-50">{value}</dd>
    </div>
  );
}
