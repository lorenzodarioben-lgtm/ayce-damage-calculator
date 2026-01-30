'use client';

import { useId, useState } from 'react';
import { Minus, Plus, Receipt, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { usePricingProfile } from '@/components/session/PricingContext';
import {
  CHARGE_SUGGESTIONS,
  DISCOUNT_SUGGESTIONS,
  normaliseAdjustmentAmount,
  normaliseAdjustmentLabel,
  totalAdjustments,
  type AdjustmentDraft,
} from '@/lib/adjustments';
import {
  MAX_ADJUSTMENT_AMOUNT,
  MAX_ADJUSTMENT_LABEL_LENGTH,
  MAX_BILL_ADJUSTMENTS,
  MIN_ADJUSTMENT_AMOUNT,
} from '@/lib/constants';
import { formatMoney } from '@/lib/formatting';
import { createId } from '@/lib/id';
import type { AdjustmentKind, MealSession } from '@/types/meal';

interface BillAdjustmentsProps {
  readonly session: MealSession;
  readonly baseAdmission: number;
  readonly totalPaid: number;
  readonly onAdd: (draft: AdjustmentDraft, id: string) => void;
  readonly onRemove: (id: string) => void;
  readonly onClear: () => void;
  readonly onStatus: (message: string) => void;
}

/**
 * What the bill picked up beyond the entry price.
 *
 * Optional, like the roster: a table that just paid the advertised price adds
 * nothing here and sees exactly the calculator it always saw. It exists because
 * the alternative — telling people to fold a voucher into the price per head —
 * quietly misreports what each person paid, and makes the recovery figure
 * answer a slightly different question than the one it puts on the screen.
 */
export function BillAdjustments({
  session,
  baseAdmission,
  totalPaid,
  onAdd,
  onRemove,
  onClear,
  onStatus,
}: BillAdjustmentsProps) {
  const pricingProfile = usePricingProfile();
  const labelId = useId();
  const amountId = useId();
  const dinerId = useId();
  const suggestionsId = useId();

  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<AdjustmentKind>('charge');
  const [scope, setScope] = useState('');
  const [clearOpen, setClearOpen] = useState(false);

  const adjustments = session.adjustments ?? [];
  const diners = session.diners ?? [];
  const totals = totalAdjustments(adjustments);
  const full = adjustments.length >= MAX_BILL_ADJUSTMENTS;

  function submit() {
    const cleanLabel = normaliseAdjustmentLabel(label);
    if (!cleanLabel) {
      onStatus('Give the charge or discount a name first.');
      return;
    }
    const cleanAmount = normaliseAdjustmentAmount(Number(amount));
    if (cleanAmount === null) {
      onStatus(
        `Enter an amount of at least ${formatMoney(MIN_ADJUSTMENT_AMOUNT, pricingProfile.money)}.`,
      );
      return;
    }
    if (full) {
      onStatus(`A bill can carry ${MAX_BILL_ADJUSTMENTS} adjustments.`);
      return;
    }

    onAdd(
      {
        label: cleanLabel,
        amount: cleanAmount,
        kind,
        // Only ever set from the roster this meal actually has, so the scope
        // cannot outlive the person it names.
        ...(scope && diners.some((diner) => diner.id === scope) ? { dinerId: scope } : {}),
      },
      `adj-${createId()}`,
    );
    onStatus(
      `${cleanLabel} ${kind === 'charge' ? 'added to' : 'taken off'} the bill: ${formatMoney(cleanAmount, pricingProfile.money)}.`,
    );
    setLabel('');
    setAmount('');
    setScope('');
  }

  const suggestions = kind === 'charge' ? CHARGE_SUGGESTIONS : DISCOUNT_SUGGESTIONS;

  return (
    <section aria-labelledby="bill-adjustments-heading" className="mt-5 border-t border-line pt-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            id="bill-adjustments-heading"
            className="flex items-center gap-2 text-sm font-semibold text-cream-200"
          >
            <Receipt size={17} aria-hidden="true" />
            Charges and discounts
          </h3>
          <p className="mt-1 max-w-[62ch] text-xs leading-relaxed text-cream-700">
            Optional. A voucher, a weekend surcharge, a card fee, a drink charged separately —
            anything the bill picked up beyond the entry price. Leave it empty and nothing changes.
          </p>
        </div>
        {adjustments.length > 0 && (
          <Button variant="danger" size="sm" onClick={() => setClearOpen(true)}>
            Clear them all
          </Button>
        )}
      </div>

      <fieldset className="mt-4">
        <legend className="sr-only">Add a charge or a discount</legend>

        <div
          role="radiogroup"
          aria-label="Direction"
          className="inline-flex rounded-[10px] border border-line bg-ash-900 p-0.5"
        >
          {(['charge', 'discount'] as const).map((option) => (
            <label
              key={option}
              className={[
                'inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-[8px] px-3 text-xs font-semibold uppercase tracking-[0.08em]',
                'transition-colors duration-200',
                kind === option
                  ? 'bg-ash-700 text-cream-50'
                  : 'text-cream-500 hover:text-cream-200',
              ].join(' ')}
            >
              <input
                type="radio"
                name="adjustment-kind"
                value={option}
                checked={kind === option}
                onChange={() => setKind(option)}
                className="sr-only"
              />
              {option === 'charge' ? (
                <Plus size={13} aria-hidden="true" />
              ) : (
                <Minus size={13} aria-hidden="true" />
              )}
              {option === 'charge' ? 'Charge' : 'Discount'}
            </label>
          ))}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_9rem]">
          <div>
            <label htmlFor={labelId} className="mb-1.5 block text-xs font-semibold text-cream-300">
              What was it
            </label>
            <input
              id={labelId}
              type="text"
              value={label}
              list={suggestionsId}
              maxLength={MAX_ADJUSTMENT_LABEL_LENGTH}
              placeholder={suggestions[0]}
              onChange={(event) => setLabel(event.target.value)}
              className="h-12 w-full rounded-[10px] border border-line bg-ash-900 px-3 text-base text-cream-50 focus:border-ember-600"
            />
            <datalist id={suggestionsId}>
              {suggestions.map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
          </div>

          <div>
            <label htmlFor={amountId} className="mb-1.5 block text-xs font-semibold text-cream-300">
              Amount
            </label>
            <input
              id={amountId}
              type="number"
              inputMode="decimal"
              min={MIN_ADJUSTMENT_AMOUNT}
              max={MAX_ADJUSTMENT_AMOUNT}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="tabular h-12 w-full rounded-[10px] border border-line bg-ash-900 px-3 text-base text-cream-50 focus:border-ember-600"
            />
          </div>
        </div>

        {diners.length > 0 && (
          <div className="mt-2">
            <label htmlFor={dinerId} className="mb-1.5 block text-xs font-semibold text-cream-300">
              Who it belongs to
            </label>
            <select
              id={dinerId}
              value={scope}
              onChange={(event) => setScope(event.target.value)}
              className="h-12 w-full rounded-[10px] border border-line bg-ash-900 px-3 text-base text-cream-50 focus:border-ember-600"
            >
              <option value="">The whole table</option>
              {diners.map((diner) => (
                <option key={diner.id} value={diner.id}>
                  {diner.displayName}
                </option>
              ))}
            </select>
          </div>
        )}

        <Button variant="secondary" size="md" className="mt-3" disabled={full} onClick={submit}>
          <Plus size={16} aria-hidden="true" />
          Add to the bill
        </Button>
        {full && (
          <p className="mt-2 text-xs text-cream-700">
            That is {MAX_BILL_ADJUSTMENTS} adjustments, which is as many as a bill can carry here.
          </p>
        )}
      </fieldset>

      {adjustments.length > 0 && (
        <ul className="mt-4 space-y-1">
          {adjustments.map((adjustment) => {
            const owner = diners.find((diner) => diner.id === adjustment.dinerId);
            return (
              <li
                key={adjustment.id}
                className="flex items-center gap-3 border-t border-line-soft py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-cream-100">{adjustment.label}</p>
                  <p className="text-xs text-cream-700">
                    {adjustment.kind === 'charge' ? 'Added to' : 'Taken off'} ·{' '}
                    {owner ? owner.displayName : 'The whole table'}
                  </p>
                </div>
                <p
                  className={[
                    'tabular shrink-0 text-sm font-semibold',
                    adjustment.kind === 'charge' ? 'text-cream-50' : 'text-ember-400',
                  ].join(' ')}
                >
                  {adjustment.kind === 'charge' ? '+' : '−'}
                  {formatMoney(adjustment.amount, pricingProfile.money)}
                </p>
                <button
                  type="button"
                  aria-label={`Remove ${adjustment.label}`}
                  onClick={() => {
                    onRemove(adjustment.id);
                    onStatus(`${adjustment.label} was taken off the bill.`);
                  }}
                  className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[8px] text-cream-500 transition-colors duration-200 hover:bg-ash-800 hover:text-char-500"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {adjustments.length > 0 && (
        <dl className="mt-3 space-y-1 rounded-[10px] border border-line-soft bg-ash-900 px-4 py-3 text-sm">
          <Row label="Entry price" value={formatMoney(baseAdmission, pricingProfile.money)} muted />
          {totals.charges > 0 && (
            <Row
              label="Charges"
              value={`+${formatMoney(totals.charges, pricingProfile.money)}`}
              muted
            />
          )}
          {totals.discounts > 0 && (
            <Row
              label="Discounts"
              value={`−${formatMoney(totals.discounts, pricingProfile.money)}`}
              muted
            />
          )}
          <Row label="Paid in total" value={formatMoney(totalPaid, pricingProfile.money)} />
          {totalPaid === 0 && (
            <p className="pt-1 text-xs leading-relaxed text-cream-700">
              The discounts cover the whole bill. Nothing was paid, so there is no recovery
              percentage to report — every plate is upside.
            </p>
          )}
        </dl>
      )}

      <ConfirmDialog
        open={clearOpen}
        title="Clear every charge and discount?"
        body="The bill goes back to the entry price alone. The meal itself, and every plate on it, is untouched."
        confirmLabel="Clear them"
        cancelLabel="Keep them"
        onConfirm={() => {
          onClear();
          setClearOpen(false);
          onStatus('The bill is back to the entry price.');
        }}
        onCancel={() => setClearOpen(false)}
      />
    </section>
  );
}

function Row({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={muted ? 'text-xs text-cream-700' : 'text-sm font-semibold text-cream-200'}>
        {label}
      </dt>
      <dd
        className={
          muted ? 'tabular text-xs text-cream-500' : 'tabular text-sm font-semibold text-ember-400'
        }
      >
        {value}
      </dd>
    </div>
  );
}
