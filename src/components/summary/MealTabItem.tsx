'use client';

import { useState } from 'react';
import { Receipt, Trash2, Utensils } from 'lucide-react';
import { QuantityStepper } from '@/components/meal/QuantityStepper';
import { MAX_LINE_QUANTITY, MIN_QUANTITY, getPlateSizeMeta, getQualityMeta } from '@/lib/constants';
import { CONSUMPTION_STEP, formatPlateQuantity } from '@/lib/consumption';
import { formatMoney, formatUnits, formatWeight } from '@/lib/formatting';
import { usePricingProfile } from '@/components/session/PricingContext';
import { formatSharePlates, sharedQuantity } from '@/lib/diners';
import type { Diner, LineItemTotals } from '@/types/meal';

interface MealTabItemProps {
  line: LineItemTotals;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onConsumptionChange: (id: string, consumed: number) => void;
  onChargeChange: (id: string, separate: boolean, charge?: number) => void;
  onSharedAmongChange: (id: string, sharedAmong: readonly string[]) => void;
  /** The meal's roster. Empty whenever Table Mode is not in use. */
  diners: readonly Diner[];
  onRemove: (id: string) => void;
}

/**
 * One tab line, with an optional statement about how much of it was eaten.
 *
 * The control stays folded away behind an explicit action, because the fast
 * journey is unchanged: log a plate, and it is a plate you ate. Only someone
 * who actually left something has any reason to open it, and the wording stays
 * on the food — what arrived and what is left — rather than on the person.
 */
export function MealTabItem({
  line,
  onIncrement,
  onDecrement,
  onConsumptionChange,
  onChargeChange,
  onSharedAmongChange,
  diners,
  onRemove,
}: MealTabItemProps) {
  const pricingProfile = usePricingProfile();
  const { item, food } = line;
  const descriptor = `${food.name}, ${getQualityMeta(item.quality).label}, ${getPlateSizeMeta(item.plateSize).label}`;
  const left = line.uneatenPlates > 0;
  const [open, setOpen] = useState(false);
  const expanded = open || left;
  const extra = line.separatelyCharged;
  // Only worth offering when there is a remainder to share and people to share
  // it between; two diners have nothing to choose from.
  const shareable = diners.length > 2 && sharedQuantity(item) > 0;
  const sharedBy = item.sharedAmong ?? [];

  function toggleSharer(dinerId: string) {
    const next = sharedBy.includes(dinerId)
      ? sharedBy.filter((entry) => entry !== dinerId)
      : [...sharedBy, dinerId];
    onSharedAmongChange(item.id, next);
  }

  return (
    <li className="border-b border-line-soft py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        {/* The name is given the full row width; cut-off cut names read as bugs. */}
        <div className="min-w-0">
          <p className="text-sm font-bold text-cream-50">{food.name}</p>
          <p className="text-xs text-cream-500">
            {getQualityMeta(item.quality).label} · {getPlateSizeMeta(item.plateSize).label}
          </p>
          <p className="tabular mt-0.5 text-xs text-cream-700">
            {formatUnits(line)}
            {line.hasWeight ? ` · ${formatWeight(line.weightG)}` : ' · not weighed'}
          </p>
          {left && (
            <p className="tabular mt-0.5 text-xs text-cream-500">
              {formatPlateQuantity(line.consumedPlates)} eaten ·{' '}
              {formatPlateQuantity(line.uneatenPlates)} left
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p
            className={[
              'tabular text-sm font-bold',
              // An extra's retail value is not buffet value, so it is not
              // coloured as though it counted towards beating the buffet.
              extra ? 'text-cream-500' : 'text-ember-400',
            ].join(' ')}
          >
            {formatMoney(line.retailValue, pricingProfile.money)}
          </p>
          {extra && (
            <p className="tabular text-xs text-cream-700">
              {line.unpricedCharge
                ? 'paid separately'
                : `${formatMoney(line.separateCharge, pricingProfile.money)} paid`}
            </p>
          )}
          {left && (
            <p className="tabular text-xs text-cream-700">
              of {formatMoney(line.orderedRetailValue, pricingProfile.money)} ordered
            </p>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-end gap-1.5">
        {!left && (
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={expanded}
            aria-label={`Record how much of ${descriptor} was eaten`}
            className="flex size-9 cursor-pointer items-center justify-center rounded-[10px] border border-transparent text-cream-700 transition-colors duration-200 hover:border-line hover:bg-ash-800 hover:text-cream-300"
          >
            <Utensils size={15} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onChargeChange(item.id, !extra)}
          aria-pressed={extra}
          aria-label={`Charge ${descriptor} separately from the buffet price`}
          className={[
            'flex size-9 cursor-pointer items-center justify-center rounded-[10px] border transition-colors duration-200',
            extra
              ? 'border-line-ember bg-ash-800 text-ember-400'
              : 'border-transparent text-cream-700 hover:border-line hover:bg-ash-800 hover:text-cream-300',
          ].join(' ')}
        >
          <Receipt size={15} aria-hidden="true" />
        </button>
        <QuantityStepper
          size="sm"
          label={`plates of ${descriptor}`}
          value={item.quantity}
          min={MIN_QUANTITY}
          max={MAX_LINE_QUANTITY}
          onIncrement={() => onIncrement(item.id)}
          onDecrement={() => onDecrement(item.id)}
          decrementLabel={`Remove one plate of ${descriptor}`}
          incrementLabel={`Add one plate of ${descriptor}`}
        />
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          aria-label={`Remove ${descriptor} from your tab`}
          className="flex size-9 cursor-pointer items-center justify-center rounded-[10px] border border-transparent text-cream-700 transition-colors duration-200 hover:border-char-700 hover:bg-char-700/20 hover:text-char-500"
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>

      {shareable && (
        <div className="mt-2 well px-3 py-2">
          <p className="micro-label mb-1.5">Shared by</p>
          <div
            role="group"
            aria-label={`Who shared ${descriptor}`}
            className="flex flex-wrap gap-1.5"
          >
            {diners.map((diner) => {
              const sharing = sharedBy.length === 0 || sharedBy.includes(diner.id);
              return (
                <button
                  key={diner.id}
                  type="button"
                  aria-pressed={sharedBy.includes(diner.id)}
                  onClick={() => toggleSharer(diner.id)}
                  className={[
                    'min-h-9 cursor-pointer rounded-full border px-3 text-xs font-semibold transition-colors duration-200',
                    sharing
                      ? 'border-ember-600 bg-ash-800 text-cream-100'
                      : 'border-line bg-ash-950 text-cream-700 hover:border-ember-700',
                  ].join(' ')}
                >
                  {diner.displayName}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-cream-700">
            {sharedBy.length === 0
              ? 'Everyone at the table splits what is left of this line. Name a few of them instead if only they shared it.'
              : `Split between ${sharedBy.length} of them, and nobody else. ${formatSharePlates(
                  sharedQuantity(item) / sharedBy.length,
                )} each.`}
          </p>
        </div>
      )}

      {extra && (
        <div className="mt-2 well px-3 py-2">
          <label className="tabular flex items-baseline justify-between gap-2 text-xs text-cream-300">
            What was paid for it
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              aria-label={`Amount paid for ${descriptor}`}
              value={line.unpricedCharge ? '' : line.separateCharge}
              onChange={(event) =>
                onChargeChange(
                  item.id,
                  true,
                  event.target.value === '' ? undefined : Number(event.target.value),
                )
              }
              className="tabular h-9 w-28 rounded-[8px] border border-line bg-ash-950 px-2 text-right text-sm font-normal text-cream-50"
            />
          </label>
          <p className="mt-1.5 text-xs leading-relaxed text-cream-700">
            The buffet price did not cover this, so its value is kept out of the recovery figure and
            what you paid is counted as spending instead. Leave the amount blank if you do not know
            it.
          </p>
        </div>
      )}

      {expanded && (
        <div className="mt-2 well px-3 py-2">
          <div className="tabular flex items-baseline justify-between gap-2 text-xs text-cream-500">
            <span className="text-cream-300">Eaten</span>
            <span>
              {formatPlateQuantity(line.consumedPlates)} of {line.plates}
            </span>
          </div>
          {/*
            Named for its own line rather than just "Eaten": a tab has one of
            these per cut, and four identically named sliders would tell a
            screen reader nothing about which plate it was adjusting.
          */}
          <input
            type="range"
            aria-label={`Plates of ${descriptor} eaten`}
            min={0}
            max={line.plates}
            step={CONSUMPTION_STEP}
            value={line.consumedPlates}
            onChange={(event) => onConsumptionChange(item.id, Number(event.target.value))}
            className="mt-1.5 h-6 w-full cursor-pointer accent-[var(--color-ember-500)]"
          />
          <p className="text-xs leading-relaxed text-cream-700">
            Slide it down if some went back. Ordered value is still counted separately, so the tab
            keeps saying what reached the table.
          </p>
        </div>
      )}
    </li>
  );
}
