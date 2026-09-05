'use client';

import { useCallback, useId, useMemo, useState } from 'react';
import { Calculator, ClipboardCopy, Lock, Unlock } from 'lucide-react';
import { PricingProfileProvider, usePricingProfile } from '@/components/session/PricingContext';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusToast } from '@/components/ui/StatusToast';
import { useCustomFoods } from '@/hooks/useCustomFoods';
import { usePricingProfiles } from '@/hooks/usePricingProfiles';
import { useStatusMessage } from '@/hooks/useStatusMessage';
import { calculateBillTotals, clampDinerCount, clampPricePerDiner } from '@/lib/calculations';
import { cn } from '@/lib/cn';
import {
  CATEGORY_META,
  MAX_DINERS,
  MAX_PRICE_PER_DINER,
  MIN_DINERS,
  MIN_PRICE_PER_DINER,
  PLATE_SIZES,
  QUALITY_TIERS,
} from '@/lib/constants';
import { foodCatalogue } from '@/lib/foodCatalogue';
import { COPY_UNAVAILABLE, copyToClipboard } from '@/lib/share';
import {
  formatCalories,
  formatGrams,
  formatMoney,
  formatPercent,
  formatPlates,
  formatWeight,
} from '@/lib/formatting';
import {
  DEFAULT_TARGET_RECOVERY,
  MAX_PLAN_QUANTITY_PER_ITEM,
  MAX_TARGET_RECOVERY,
  MIN_TARGET_RECOVERY,
  PLAN_FAILURE_MESSAGES,
  PLAN_STRATEGY_META,
  buildDamagePlan,
  calculatePlanProgress,
  clampTargetRecovery,
  type PlanLine,
  type PlanResult,
  type PlanStrategy,
} from '@/lib/planner';
import { resolvePricingProfile } from '@/lib/pricingProfiles';
import { mealItemId } from '@/lib/mealItems';
import { loadSession, saveSession } from '@/lib/storage';
import type { BillAdjustment, PlateSize, QualityTier } from '@/types/meal';

const CHIP =
  'min-h-11 cursor-pointer rounded-[10px] border px-3 text-xs font-semibold uppercase ' +
  'tracking-[0.08em] transition-colors duration-200';

const ON = 'border-line-ember bg-ash-800 text-ember-400';
const OFF = 'border-line bg-ash-900 text-cream-300 hover:bg-ash-800';

function toggle<T>(values: readonly T[], value: T): readonly T[] {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}

/**
 * A menu simulation, run before a meal rather than during one.
 *
 * It deliberately shares nothing with the live session except the calculation
 * engine and the personal menu: the setup here is local to the page, so
 * exploring assumptions can never disturb a tab someone has open. Planned food
 * is not eaten food, and the only route from one to the other is an explicit,
 * confirmed action that says exactly what it does.
 */
export function DamagePlanner() {
  const pricingProfiles = usePricingProfiles();
  const customFoods = useCustomFoods();
  const catalogue = useMemo(() => foodCatalogue(customFoods.foods), [customFoods.foods]);

  const [profileId, setProfileId] = useState<string | undefined>(undefined);
  const [admissionPrice, setAdmissionPrice] = useState(59.9);
  const [dinerCount, setDinerCount] = useState(1);
  const [target, setTarget] = useState(DEFAULT_TARGET_RECOVERY);
  const [strategy, setStrategy] = useState<PlanStrategy>('fewest-plates');
  const [excluded, setExcluded] = useState<readonly string[]>([]);
  const [qualities, setQualities] = useState<readonly QualityTier[]>(
    QUALITY_TIERS.map((tier) => tier.id),
  );
  const [plateSizes, setPlateSizes] = useState<readonly PlateSize[]>(
    PLATE_SIZES.map((size) => size.id),
  );
  const [maxPerItem, setMaxPerItem] = useState(MAX_PLAN_QUANTITY_PER_ITEM);
  const [locked, setLocked] = useState<readonly PlanLine[]>([]);
  /**
   * Carried from the open tab, never edited here.
   *
   * A voucher or a surcharge changes the number a plan has to reach, so
   * planning against the entry price alone would aim at the wrong target. The
   * planner still writes nothing back, so this is a reading of the tab rather
   * than a second place to edit it.
   */
  const [adjustments, setAdjustments] = useState<readonly BillAdjustment[]>([]);
  const [result, setResult] = useState<PlanResult | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [status, announce] = useStatusMessage();

  const admissionId = useId();
  const dinersId = useId();
  const targetId = useId();
  const profileFieldId = useId();
  const perItemId = useId();

  /*
   * Seeds the page from whatever the diner last set up, without ever writing
   * back to it: a planner that started from nothing would make everyone retype
   * their own restaurant's entry price. Resolved during render, like the other
   * local stores, so the first paint is already the right one.
   */
  const [seeded, setSeeded] = useState(false);
  if (!seeded && typeof window !== 'undefined') {
    setSeeded(true);
    const session = loadSession(catalogue);
    if (session) {
      setAdmissionPrice(session.pricePerDiner);
      setDinerCount(session.dinerCount);
      setProfileId(session.pricingProfileId);
      setAdjustments(session.adjustments ?? []);
    }
  }

  const profile = useMemo(
    () => resolvePricingProfile(pricingProfiles.profiles, profileId),
    [pricingProfiles.profiles, profileId],
  );
  const mealInProgress = useMemo(() => loadSession(catalogue)?.items ?? [], [catalogue]);
  const progress = useMemo(
    () => (result?.feasible ? calculatePlanProgress(result.lines, mealInProgress) : null),
    [mealInProgress, result],
  );

  const bill = calculateBillTotals({
    pricePerDiner: admissionPrice,
    dinerCount,
    ...(adjustments.length ? { adjustments } : {}),
  });
  const admission = bill.totalPaid;

  const included = useMemo(
    () => catalogue.filter((food) => !excluded.includes(food.id)).map((food) => food.id),
    [catalogue, excluded],
  );

  const runPlan = useCallback(() => {
    const plan = buildDamagePlan(
      {
        targetRecoveryPercent: target,
        strategy,
        admission,
        includedFoodIds: included,
        qualities,
        plateSizes,
        maxPerItem,
        locked,
      },
      catalogue,
      profile,
    );
    setResult(plan);
    announce(
      plan.feasible
        ? `Simulation complete: ${formatPlates(plan.totals.totalPlates)}.`
        : 'That simulation has no answer inside its limits.',
    );
  }, [
    admission,
    announce,
    catalogue,
    included,
    locked,
    maxPerItem,
    plateSizes,
    profile,
    qualities,
    strategy,
    target,
  ]);

  const copyPlan = useCallback(async () => {
    if (!result?.feasible) {
      return;
    }
    const text = [
      `AYCE damage plan — target ${formatPercent(target)} of ${formatMoney(admission, profile.money)}`,
      ...result.lines.map((line) => {
        const food = catalogue.find((entry) => entry.id === line.foodId);
        return `${line.quantity} x ${food?.name ?? line.foodId} (${line.quality}, ${line.plateSize})`;
      }),
      `Estimated retail value ${formatMoney(result.totals.totalRetailValue, profile.money)} · ${formatPercent(result.recoveryPercent)} of admission`,
      'A menu simulation using illustrative estimates, not a recommendation.',
    ].join('\n');

    const copied = await copyToClipboard(text);
    announce(copied ? 'Plan copied.' : COPY_UNAVAILABLE);
  }, [admission, announce, catalogue, profile.money, result, target]);

  /**
   * Turns a plan into a meal, only ever behind a confirmation.
   *
   * The distinction is the whole point: everything the calculator reports is a
   * record of what was eaten, so writing a plan into the session has to be a
   * deliberate statement that these plates were ordered.
   */
  const applyPlan = useCallback(() => {
    if (!result?.feasible) {
      return;
    }
    saveSession({
      restaurantName: '',
      pricePerDiner: clampPricePerDiner(admissionPrice),
      dinerCount: clampDinerCount(dinerCount),
      pricingProfileId: profile.id,
      // Carried back because they came from the tab in the first place, and
      // the plan was measured against the total they produce.
      ...(adjustments.length ? { adjustments } : {}),
      items: result.lines.map((line) => ({
        id: mealItemId(line),
        foodId: line.foodId,
        quality: line.quality,
        plateSize: line.plateSize,
        quantity: line.quantity,
      })),
    });
    setApplyOpen(false);
    announce('Plan loaded into the calculator as a meal.');
  }, [adjustments, admissionPrice, announce, dinerCount, profile.id, result]);

  const lockedFor = (foodId: string) => locked.find((line) => line.foodId === foodId);

  function toggleLock(foodId: string) {
    setLocked((current) =>
      current.some((line) => line.foodId === foodId)
        ? current.filter((line) => line.foodId !== foodId)
        : [...current, { foodId, quality: 'standard', plateSize: 'regular', quantity: 1 }],
    );
  }

  return (
    <PricingProfileProvider profile={profile}>
      <div className="space-y-6">
        <section aria-labelledby="plan-setup-heading" className="panel p-4 sm:p-5">
          <h2 id="plan-setup-heading" className="micro-label mb-4">
            The assumptions
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor={admissionId}
                className="mb-1.5 block text-sm font-semibold text-cream-300"
              >
                Admission per diner
              </label>
              <input
                id={admissionId}
                type="number"
                inputMode="decimal"
                min={MIN_PRICE_PER_DINER}
                max={MAX_PRICE_PER_DINER}
                step="0.1"
                value={admissionPrice}
                onChange={(event) => setAdmissionPrice(Number(event.target.value))}
                onBlur={() => setAdmissionPrice((value) => clampPricePerDiner(value))}
                className="h-12 w-full rounded-[10px] border border-line bg-ash-900 px-3 text-base text-cream-50"
              />
              {adjustments.length > 0 && (
                <p className="tabular mt-1.5 text-xs text-cream-700">
                  Planning against {formatMoney(admission, profile.money)}, which is your open
                  tab&rsquo;s {formatMoney(bill.baseAdmission, profile.money)} admission after{' '}
                  {adjustments.length} {adjustments.length === 1 ? 'adjustment' : 'adjustments'}.
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor={dinersId}
                className="mb-1.5 block text-sm font-semibold text-cream-300"
              >
                Diners
              </label>
              <input
                id={dinersId}
                type="number"
                inputMode="numeric"
                min={MIN_DINERS}
                max={MAX_DINERS}
                value={dinerCount}
                onChange={(event) => setDinerCount(Number(event.target.value))}
                onBlur={() => setDinerCount((value) => clampDinerCount(value))}
                className="h-12 w-full rounded-[10px] border border-line bg-ash-900 px-3 text-base text-cream-50"
              />
            </div>

            <div>
              <label
                htmlFor={profileFieldId}
                className="mb-1.5 block text-sm font-semibold text-cream-300"
              >
                Pricing profile
              </label>
              <select
                id={profileFieldId}
                value={profile.id}
                onChange={(event) => setProfileId(event.target.value)}
                className="h-12 w-full rounded-[10px] border border-line bg-ash-900 px-3 text-base text-cream-50"
              >
                {pricingProfiles.profiles.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name} · {entry.money.currency}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor={targetId}
                className="mb-1.5 block text-sm font-semibold text-cream-300"
              >
                Target recovery: {formatPercent(target)}
              </label>
              <input
                id={targetId}
                type="range"
                min={MIN_TARGET_RECOVERY}
                max={MAX_TARGET_RECOVERY}
                step={5}
                value={target}
                onChange={(event) => setTarget(clampTargetRecovery(Number(event.target.value)))}
                aria-valuetext={`${target} percent of admission`}
                className="h-11 w-full accent-[var(--color-ember-500)]"
              />
            </div>
          </div>

          <p className="tabular mt-2 text-xs text-cream-700">
            Total admission {formatMoney(admission, profile.money)} · target retail value{' '}
            {formatMoney((admission * clampTargetRecovery(target)) / 100, profile.money)}
          </p>
        </section>

        <section aria-labelledby="plan-strategy-heading" className="panel p-4 sm:p-5">
          <h2 id="plan-strategy-heading" className="micro-label mb-3">
            The strategy
          </h2>
          <div role="radiogroup" aria-labelledby="plan-strategy-heading" className="space-y-2">
            {PLAN_STRATEGY_META.map((meta) => (
              <label
                key={meta.id}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-[10px] border p-3',
                  strategy === meta.id ? ON : OFF,
                )}
              >
                <input
                  type="radio"
                  name="plan-strategy"
                  value={meta.id}
                  checked={strategy === meta.id}
                  onChange={() => setStrategy(meta.id)}
                  className="mt-1 accent-[var(--color-ember-500)]"
                />
                <span>
                  <span className="block text-sm font-bold text-cream-50">{meta.label}</span>
                  <span className="block text-xs text-cream-500">{meta.description}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="mt-4">
            <label
              htmlFor={perItemId}
              className="mb-1.5 block text-sm font-semibold text-cream-300"
            >
              Most plates of any one configuration: {maxPerItem}
            </label>
            <input
              id={perItemId}
              type="range"
              min={1}
              max={MAX_PLAN_QUANTITY_PER_ITEM}
              step={1}
              value={maxPerItem}
              onChange={(event) => setMaxPerItem(Number(event.target.value))}
              className="h-11 w-full accent-[var(--color-ember-500)]"
            />
          </div>
        </section>

        <section aria-labelledby="plan-menu-heading" className="panel p-4 sm:p-5">
          <h2 id="plan-menu-heading" className="micro-label mb-3">
            The menu it may use
          </h2>

          <div role="group" aria-label="Quality tiers" className="flex flex-wrap gap-2">
            {QUALITY_TIERS.map((tier) => (
              <button
                key={tier.id}
                type="button"
                aria-pressed={qualities.includes(tier.id)}
                onClick={() => setQualities((current) => toggle(current, tier.id))}
                className={cn(CHIP, qualities.includes(tier.id) ? ON : OFF)}
              >
                {tier.label}
              </button>
            ))}
          </div>

          <div role="group" aria-label="Serving sizes" className="mt-2 flex flex-wrap gap-2">
            {PLATE_SIZES.map((size) => (
              <button
                key={size.id}
                type="button"
                aria-pressed={plateSizes.includes(size.id)}
                onClick={() => setPlateSizes((current) => toggle(current, size.id))}
                className={cn(CHIP, plateSizes.includes(size.id) ? ON : OFF)}
              >
                {size.label}
              </button>
            ))}
          </div>

          {CATEGORY_META.map((category) => {
            const foods = catalogue.filter((food) => food.category === category.id);
            if (foods.length === 0) {
              return null;
            }
            return (
              <div key={category.id} className="mt-4">
                <h3 className="micro-label mb-2">{category.label}</h3>
                <ul className="space-y-1">
                  {foods.map((food) => {
                    const isIncluded = !excluded.includes(food.id);
                    const lock = lockedFor(food.id);
                    return (
                      <li
                        key={food.id}
                        className="flex flex-wrap items-center gap-2 border-b border-line-soft py-2"
                      >
                        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isIncluded}
                            onChange={() => setExcluded((current) => toggle(current, food.id))}
                            className="size-4 accent-[var(--color-ember-500)]"
                          />
                          <span className="truncate text-sm text-cream-100">{food.name}</span>
                        </label>
                        <button
                          type="button"
                          aria-pressed={Boolean(lock)}
                          aria-label={
                            lock ? `Unlock ${food.name}` : `Lock ${food.name} into every plan`
                          }
                          onClick={() => toggleLock(food.id)}
                          disabled={!isIncluded}
                          className={cn(
                            CHIP,
                            'flex items-center gap-1.5',
                            lock ? ON : OFF,
                            !isIncluded && 'cursor-not-allowed opacity-50',
                          )}
                        >
                          {lock ? (
                            <Lock size={13} aria-hidden="true" />
                          ) : (
                            <Unlock size={13} aria-hidden="true" />
                          )}
                          {lock ? 'Locked' : 'Lock'}
                        </button>
                        {lock && (
                          <label className="flex items-center gap-1.5 text-xs text-cream-500">
                            <span className="sr-only">Locked plates of {food.name}</span>
                            <input
                              type="number"
                              min={1}
                              max={MAX_PLAN_QUANTITY_PER_ITEM}
                              value={lock.quantity}
                              onChange={(event) =>
                                setLocked((current) =>
                                  current.map((line) =>
                                    line.foodId === food.id
                                      ? { ...line, quantity: Number(event.target.value) }
                                      : line,
                                  ),
                                )
                              }
                              className="h-9 w-16 rounded-[8px] border border-line bg-ash-900 px-2 text-sm text-cream-50"
                            />
                            plates
                          </label>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </section>

        <Button variant="primary" size="lg" fullWidth onClick={runPlan}>
          <Calculator size={18} aria-hidden="true" />
          Run the simulation
        </Button>

        {result && (
          <PlanOutcome
            result={result}
            progress={progress}
            onCopy={copyPlan}
            onApply={() => setApplyOpen(true)}
          />
        )}

        <ConfirmDialog
          open={applyOpen}
          title="Load this plan as a meal?"
          body="A plan is a menu simulation, not a record of anything eaten. Loading it writes these plates into the calculator as food you ordered, replacing whatever is on your tab. Only do this once the plates are actually in front of you."
          confirmLabel="Log these plates"
          cancelLabel="Keep it a plan"
          onConfirm={applyPlan}
          onCancel={() => setApplyOpen(false)}
        />

        <StatusToast message={status} />
      </div>
    </PricingProfileProvider>
  );
}

function PlanOutcome({
  result,
  progress,
  onCopy,
  onApply,
}: {
  result: PlanResult;
  progress: ReturnType<typeof calculatePlanProgress> | null;
  onCopy: () => void;
  onApply: () => void;
}) {
  const money = usePricingProfile().money;

  if (!result.feasible) {
    return (
      <section aria-labelledby="plan-result-heading" className="panel border-dashed p-4 sm:p-5">
        <h2 id="plan-result-heading" className="micro-label mb-2">
          No plan
        </h2>
        <p role="status" className="max-w-[56ch] text-sm leading-relaxed text-cream-300">
          {result.failure ? PLAN_FAILURE_MESSAGES[result.failure] : 'No plan was produced.'}
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="plan-result-heading" className="panel p-4 sm:p-5">
      <h2 id="plan-result-heading" className="micro-label mb-3">
        The proposed configuration
      </h2>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Figure label="Plates" value={formatPlates(result.totals.totalPlates)} />
        <Figure
          label="Est. retail value"
          value={formatMoney(result.totals.totalRetailValue, money)}
        />
        <Figure label="Recovery" value={formatPercent(result.recoveryPercent)} />
        <Figure label="Food weight" value={formatWeight(result.totals.totalWeightG)} />
      </dl>

      <p className="tabular mt-2 text-xs text-cream-700">
        {formatCalories(result.totals.nutrition.calories)} ·{' '}
        {formatGrams(result.totals.nutrition.protein)} protein ·{' '}
        {formatGrams(result.totals.nutrition.fat)} fat ·{' '}
        {formatGrams(result.totals.nutrition.carbs)} carbs
      </p>

      {progress && (
        <p role="status" className="mt-3 text-sm text-cream-300">
          Meal progress: {formatPlates(progress.matchedPlates)} matched from the actual ledger ·{' '}
          {formatPlates(progress.remainingPlates)} planned remaining. This guidance never changes
          your meal, quantities, damage totals or report.
        </p>
      )}

      <table className="mt-4 w-full text-left text-sm">
        <caption className="sr-only">The plates this simulation proposes.</caption>
        <thead className="text-xs text-cream-500">
          <tr>
            <th scope="col" className="pb-2 pr-3">
              Cut
            </th>
            <th scope="col" className="pb-2 pr-3">
              Configuration
            </th>
            <th scope="col" className="pb-2 text-right">
              Plates
            </th>
          </tr>
        </thead>
        <tbody>
          {result.totals.lines.map((line) => (
            <tr key={line.item.id} className="border-t border-line-soft text-cream-200">
              <th scope="row" className="py-2 pr-3 text-left font-semibold text-cream-50">
                {line.food.name}
              </th>
              <td className="py-2 pr-3 text-xs text-cream-500">
                {line.item.quality} · {line.item.plateSize}
              </td>
              <td className="tabular py-2 text-right">{line.plates}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="micro-label mt-4 mb-2">Why this one</h3>
      <ul className="space-y-1 text-xs leading-relaxed text-cream-500">
        {result.rationale.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button variant="secondary" size="md" onClick={onCopy}>
          <ClipboardCopy size={16} aria-hidden="true" />
          Copy the plan
        </Button>
        <Button variant="ghost" size="md" onClick={onApply}>
          Load as a meal
        </Button>
      </div>
    </section>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="well px-3 py-2">
      <dt className="micro-label">{label}</dt>
      <dd className="tabular mt-0.5 text-sm font-semibold text-cream-50">{value}</dd>
    </div>
  );
}
