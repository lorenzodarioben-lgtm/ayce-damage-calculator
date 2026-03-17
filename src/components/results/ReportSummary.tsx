'use client';

import { Figure } from '@/components/ui/Figure';
import { DamageMeter } from '@/components/summary/DamageMeter';
import { usePricingProfile } from '@/components/session/PricingContext';
import { SEVERITY_TEXT, verdictGlow, verdictText } from '@/lib/bands';
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

/**
 * Where a block sits in the arrival sequence.
 *
 * Capped at the sixth step: past about half a second a visitor is waiting for
 * the interface rather than watching it, and the report can be as long as the
 * meal was.
 */
function rise(step: number): React.CSSProperties {
  return { '--rise-delay': `${Math.min(step, 6) * 70}ms` } as React.CSSProperties;
}

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
      <section
        aria-labelledby={headingId}
        style={rise(0)}
        className="animate-rise panel-raised relative isolate overflow-hidden"
      >
        {/*
         * Coals under the verdict. Faint, and faded out well before the title
         * so the sentence keeps the contrast it had — the picture is there to
         * give the moment a floor to land on, not to be looked at.
         */}
        {/*
         * Coals under the verdict, at their own brightness rather than dimmed
         * to a smudge. The scrim over them is what keeps the sentence legible:
         * heaviest through the middle where the words are, thinning towards the
         * edges where the fire is allowed to be fire.
         */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-20 bg-[url('/images/embers.webp')] bg-cover bg-center"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(115%_130%_at_50%_50%,rgba(13,12,10,0.93)_0%,rgba(13,12,10,0.88)_42%,rgba(13,12,10,0.6)_74%,rgba(13,12,10,0.35)_100%)]"
        />
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute -top-24 left-1/2 -z-10 h-72 w-[36rem] max-w-[130%] -translate-x-1/2 opacity-25 blur-3xl',
            verdictGlow(verdict.tone, report.retailRecoveryPercent),
          )}
        />
        <div className="grill-texture border-b border-line px-5 py-4 text-center">
          <Heading id={headingId} className="display-type text-lead text-cream-300">
            {heading}
          </Heading>
          {restaurantName && (
            <p className="mt-1 break-words text-ui text-cream-300">{restaurantName}</p>
          )}
        </div>

        <div className="px-5 py-10 text-center sm:py-14">
          <p
            className={cn(
              'display-hero text-[clamp(2.5rem,8vw,4.75rem)]',
              verdictText(verdict.tone, report.retailRecoveryPercent),
            )}
          >
            {verdict.title}
          </p>
          <p className="mx-auto mt-5 max-w-[44ch] reading text-cream-300">{verdict.copy}</p>
          {subheading && <p className="mt-3 text-caption text-cream-600">{subheading}</p>}
        </div>

        {/* The verdict says it in words; this says it in the number the words
            are about. They are one block because they are one answer. */}
        <div className="border-t border-line px-5 pb-6 pt-5">
          <DamageMeter
            retailValue={report.totalRetailValue}
            totalAdmission={report.totalAdmission}
            recoveryPercent={report.retailRecoveryPercent}
            remainingGap={report.remainingRetailGap}
          />
        </div>
      </section>

      {(hasAdjustments || report.hasSeparatelyChargedItems) && (
        <section
          aria-labelledby="bill-breakdown-heading"
          style={rise(1)}
          className="animate-rise well px-4 py-3"
        >
          <h3 id="bill-breakdown-heading" className="display-type mb-2 text-lead text-cream-100">
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
              label={report.hasSeparatelyChargedItems ? 'Buffet total' : 'Paid in total'}
              value={formatMoney(report.totalAdmission, pricingProfile.money)}
              total
            />
            {report.hasSeparatelyChargedItems && (
              <>
                <BillRow
                  label="Charged separately"
                  value={`+${formatMoney(report.separateSpend, pricingProfile.money)}`}
                />
                <BillRow
                  label="Spent in total"
                  value={formatMoney(report.totalSpend, pricingProfile.money)}
                  total
                />
              </>
            )}
          </dl>
          <p className="mt-2 max-w-[62ch] reading">
            Every figure below is measured against the total paid, not the entry price — that is
            what the evening actually cost.
            {report.hasSeparatelyChargedItems
              ? ' Items the buffet price did not cover are kept out of it on both sides: their value does not count towards recovery, and what you paid for them does not count against it. Spent in total is the whole evening.'
              : ''}
            {report.unpricedSeparateLines > 0
              ? ` ${report.unpricedSeparateLines === 1 ? 'One separately charged item has' : `${report.unpricedSeparateLines} separately charged items have`} no price recorded, so the total spent is understated by whatever they cost.`
              : ''}
          </p>
        </section>
      )}

      {/* 2 — The three figures the answer is made of. Ruled rather than
             tiled: ten equal boxes ranked nothing, and the layout was identical
             at twenty-one per cent and at two hundred and forty-eight. */}
      <dl style={rise(2)} className="animate-rise grid gap-x-6 gap-y-3 sm:grid-cols-3">
        <Figure
          label="Est. retail value"
          value={formatMoney(report.totalRetailValue, pricingProfile.money)}
          detail="What a similar quantity might cost at retail."
          size="figure"
        />
        <Figure
          label={hasAdjustments ? 'Total paid' : 'Admission'}
          value={formatMoney(report.totalAdmission, pricingProfile.money)}
          detail={
            hasAdjustments
              ? 'Entry price, plus what went on the bill and minus what came off.'
              : 'What the table paid to walk in.'
          }
          size="figure"
        />
        <Figure
          label={extracted ? 'Value extracted' : 'Value gap'}
          value={formatSignedMoney(report.retailValueDifference, pricingProfile.money)}
          detail={`Estimated retail value minus ${hasAdjustments ? 'the total paid' : 'admission'}.`}
          size="figure"
          tone={extracted ? 'recovered' : 'lost'}
        />
      </dl>

      {/* 3 — Supporting: what was ordered and what it weighed. */}
      <dl style={rise(3)} className="animate-rise grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <Figure
          label="Plates ordered"
          value={formatPlates(report.totalPlates)}
          {...(hasUneaten
            ? { detail: `${formatPlateQuantity(report.totalConsumedPlates)} eaten` }
            : {})}
        />
        <Figure
          label="Food eaten"
          value={formatKg(report.totalWeightKg)}
          detail={formatLb(report.totalWeightLb)}
        />
      </dl>

      {hasUneaten && (
        <section aria-labelledby="uneaten-heading" className="well px-4 py-3">
          <SubHeading id="uneaten-heading" className="display-type mb-2 text-lead text-cream-100">
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
          <p className="mt-2 max-w-[62ch] reading">
            Recovery is measured on what was eaten, because value you did not eat is not value you
            extracted. What reached the table is kept alongside it, so the tab still says what
            arrived. Estimated ingredient cost follows the ordered figure — the restaurant bought
            the plate either way.
          </p>
        </section>
      )}

      {/* 4 — The even split */}
      {perDiner && (
        <section
          aria-labelledby={`${headingId}-per-diner`}
          style={rise(4)}
          className="animate-rise border-t border-line pt-5 first:border-t-0 first:pt-0"
        >
          <SubHeading
            id={`${headingId}-per-diner`}
            className="display-type mb-1 text-lead text-cream-100"
          >
            Split {formatCount(perDiner.dinerCount)} ways
          </SubHeading>
          <p className="mb-3 text-caption text-cream-600">
            An even split of the table&rsquo;s totals. The calculator records one shared tab, so it
            cannot know who reached for what.
          </p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-4">
            <Figure
              label="Admission each"
              value={formatMoney(perDiner.admission, pricingProfile.money)}
            />
            <Figure
              label="Retail value each"
              value={formatMoney(perDiner.retailValue, pricingProfile.money)}
            />
            <Figure label="Food each" value={formatWeight(perDiner.weightG)} />
            <Figure label="Calories each" value={formatCalories(perDiner.nutrition.calories)} />
          </dl>
        </section>
      )}

      {/* 5 — Nutrition */}
      <section aria-labelledby={`${headingId}-nutrition`} style={rise(5)} className="animate-rise">
        <SubHeading
          id={`${headingId}-nutrition`}
          className="display-type mb-2 text-lead text-cream-100"
        >
          Approximate nutrition
        </SubHeading>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-4">
          <Figure label="Calories" value={formatCalories(report.nutrition.calories)} />
          <Figure label="Protein" value={formatGrams(report.nutrition.protein)} />
          <Figure label="Fat" value={formatGrams(report.nutrition.fat)} />
          <Figure label="Carbohydrates" value={formatGrams(report.nutrition.carbs)} />
        </dl>
        {report.linesWithoutNutrition > 0 && (
          <p className="mt-2 max-w-[62ch] reading">
            {report.linesWithoutNutrition}{' '}
            {report.linesWithoutNutrition === 1 ? 'item on this tab has' : 'items on this tab have'}{' '}
            no nutrition recorded, so {report.linesWithoutNutrition === 1 ? 'it is' : 'they are'}{' '}
            not counted above. An unknown figure is left out rather than treated as zero.
          </p>
        )}
      </section>

      {/* 6 — The house side of the ledger */}
      <section
        aria-labelledby={`${headingId}-house`}
        style={rise(6)}
        className="animate-rise border-t border-line pt-5 first:border-t-0 first:pt-0"
      >
        <SubHeading
          id={`${headingId}-house`}
          className="display-type mb-3 text-lead text-cream-100"
        >
          The house side of the ledger
        </SubHeading>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Figure
            label="Est. ingredient cost"
            value={formatMoney(report.totalRestaurantCost, pricingProfile.money)}
            detail="What the restaurant may have spent on the raw ingredient."
          />
          <Figure
            label="Est. ingredient margin"
            value={formatMoney(report.estimatedIngredientMargin, pricingProfile.money)}
            detail="Before rent, wages, utilities, tax, waste, sides and overhead."
          />
        </dl>
        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 border-t border-line-soft pt-3">
          <div>
            <p className="micro-label text-cream-500">Est. food cost</p>
            <p className={cn('mt-0.5 text-ui font-semibold', SEVERITY_TEXT[houseStatus.severity])}>
              {houseStatus.label}
            </p>
          </div>
          <p className="tabular text-figure font-bold leading-none text-cream-100">
            {formatPercent(report.estimatedFoodCostPercent)}{' '}
            <span className="text-ui text-cream-600">
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
      <dt
        className={total ? 'text-ui font-semibold text-cream-200' : 'text-caption text-cream-600'}
      >
        {label}
      </dt>
      <dd
        className={cn(
          'tabular',
          total ? 'text-ui font-semibold text-cream-100' : 'text-caption text-cream-500',
        )}
      >
        {value}
      </dd>
    </div>
  );
}
