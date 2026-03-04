'use client';

import { useId, useState } from 'react';
import { QuantityStepper } from '@/components/meal/QuantityStepper';
import {
  MAX_DINERS,
  MAX_PRICE_PER_DINER,
  MAX_RESTAURANT_NAME_LENGTH,
  MIN_DINERS,
  MIN_PRICE_PER_DINER,
} from '@/lib/constants';
import { MenuShare } from '@/components/session/MenuShare';
import { RestaurantPresets } from '@/components/session/RestaurantPresets';
import { PricingProfileManager } from '@/components/session/PricingProfileManager';
import { CustomFoodManager } from '@/components/session/CustomFoodManager';
import { TableRoster } from '@/components/session/TableRoster';
import { BillAdjustments } from '@/components/session/BillAdjustments';
import { usePricingProfile } from '@/components/session/PricingContext';
import { formatMoney } from '@/lib/formatting';
import type { MealSession, SessionConfig } from '@/types/meal';
import type { AdjustmentDraft } from '@/lib/adjustments';
import type { CustomFood } from '@/types/customFoods';
import type { PricingProfile, PricingProfileId } from '@/types/pricing';
import type { RegularDiner } from '@/lib/regularDiners';
import type { Diner } from '@/types/meal';

interface SessionSetupProps {
  session: MealSession;
  /** Entry price alone, before charges and discounts. */
  baseAdmission: number;
  /** What the table pays once the bill has settled. */
  totalAdmission: number;
  onRestaurantNameChange: (value: string) => void;
  onPricePerDinerChange: (value: number) => void;
  onPricingProfileChange: (id: PricingProfileId) => void;
  pricingProfiles: readonly PricingProfile[];
  onSavePricingProfile: (profile: PricingProfile) => void;
  onRemovePricingProfile: (id: PricingProfileId) => void;
  customFoods: readonly CustomFood[];
  onSaveCustomFood: (food: CustomFood) => void;
  onRemoveCustomFood: (id: string) => void;
  onReplaceCustomFoods: (foods: readonly CustomFood[]) => void;
  onDinerCountChange: (delta: number) => void;
  onApplySetup: (setup: SessionConfig) => void;
  regularDiners: readonly RegularDiner[];
  onAddDiner: (diner: Diner) => void;
  onRenameDiner: (id: string, displayName: string) => void;
  onDinerAdmissionPriceChange: (id: string, value: number | undefined) => void;
  onRemoveDiner: (id: string) => void;
  onMoveDiner: (id: string, direction: -1 | 1) => void;
  onClearDiners: () => void;
  onSaveRegularDiner: (diner: RegularDiner) => void;
  onAddAdjustment: (draft: AdjustmentDraft, id: string) => void;
  onRemoveAdjustment: (id: string) => void;
  onClearAdjustments: () => void;
  onStatus: (message: string) => void;
}

export function SessionSetup({
  session,
  baseAdmission,
  totalAdmission,
  onRestaurantNameChange,
  onPricePerDinerChange,
  onPricingProfileChange,
  pricingProfiles,
  onSavePricingProfile,
  onRemovePricingProfile,
  customFoods,
  onSaveCustomFood,
  onRemoveCustomFood,
  onReplaceCustomFoods,
  onDinerCountChange,
  onApplySetup,
  regularDiners,
  onAddDiner,
  onRenameDiner,
  onDinerAdmissionPriceChange,
  onRemoveDiner,
  onMoveDiner,
  onClearDiners,
  onSaveRegularDiner,
  onAddAdjustment,
  onRemoveAdjustment,
  onClearAdjustments,
  onStatus,
}: SessionSetupProps) {
  const pricingProfile = usePricingProfile();
  const nameId = useId();
  const priceId = useId();
  const priceHintId = useId();

  // The price field keeps its own draft so intermediate text ("5.", "") is
  // editable without the clamped session value fighting the keystrokes.
  const [priceDraft, setPriceDraft] = useState(() => session.pricePerDiner.toFixed(2));
  const [priceError, setPriceError] = useState<string | null>(null);
  const [lastKnownPrice, setLastKnownPrice] = useState(session.pricePerDiner);

  // Resynchronise during render when the price changes outside this field —
  // restoring a persisted session, or a reset.
  if (lastKnownPrice !== session.pricePerDiner) {
    setLastKnownPrice(session.pricePerDiner);
    if (Number.parseFloat(priceDraft) !== session.pricePerDiner) {
      setPriceDraft(session.pricePerDiner.toFixed(2));
      setPriceError(null);
    }
  }

  function handlePriceChange(raw: string) {
    setPriceDraft(raw);

    if (raw.trim() === '') {
      setPriceError('Enter a price per person.');
      return;
    }

    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed)) {
      setPriceError('Enter a number.');
      return;
    }
    if (parsed < MIN_PRICE_PER_DINER || parsed > MAX_PRICE_PER_DINER) {
      setPriceError(`Use a price between $${MIN_PRICE_PER_DINER} and $${MAX_PRICE_PER_DINER}.`);
      onPricePerDinerChange(parsed);
      return;
    }

    setPriceError(null);
    onPricePerDinerChange(parsed);
  }

  function handlePriceBlur() {
    setPriceError(null);
    setPriceDraft(session.pricePerDiner.toFixed(2));
  }

  return (
    <section aria-labelledby="session-setup-heading" className="panel p-4 sm:p-5">
      <h2 id="session-setup-heading" className="micro-label mb-4">
        Session setup
      </h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor={nameId} className="mb-1.5 block text-sm font-semibold text-cream-300">
            Restaurant
          </label>
          <input
            id={nameId}
            type="text"
            inputMode="text"
            autoComplete="off"
            maxLength={MAX_RESTAURANT_NAME_LENGTH}
            value={session.restaurantName}
            onChange={(event) => onRestaurantNameChange(event.target.value)}
            placeholder="Restaurant name (optional)"
            className="h-12 w-full rounded-[10px] border border-line bg-ash-900 px-3 text-base text-cream-50 placeholder:text-cream-700"
          />
        </div>

        <div>
          <label htmlFor={priceId} className="mb-1.5 block text-sm font-semibold text-cream-300">
            Price per diner
          </label>
          <div className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base font-semibold text-cream-500"
            >
              $
            </span>
            <input
              id={priceId}
              type="number"
              inputMode="decimal"
              step="0.10"
              min={MIN_PRICE_PER_DINER}
              max={MAX_PRICE_PER_DINER}
              value={priceDraft}
              onChange={(event) => handlePriceChange(event.target.value)}
              onBlur={handlePriceBlur}
              aria-describedby={priceHintId}
              aria-invalid={priceError !== null}
              className="tabular h-12 w-full rounded-[10px] border border-line bg-ash-900 pl-7 pr-3 text-base text-cream-50"
            />
          </div>
          <p
            id={priceHintId}
            className={
              priceError
                ? 'mt-1.5 text-xs font-medium text-char-500'
                : 'mt-1.5 text-xs text-cream-700'
            }
          >
            {priceError ?? `AUD, between $${MIN_PRICE_PER_DINER} and $${MAX_PRICE_PER_DINER}.`}
          </p>
        </div>

        <div className="sm:col-span-2">
          <label
            htmlFor="pricing-profile"
            className="mb-1.5 block text-sm font-semibold text-cream-300"
          >
            Menu pricing
          </label>
          <select
            id="pricing-profile"
            value={pricingProfile.id}
            onChange={(event) => {
              onPricingProfileChange(event.target.value);
              const next = pricingProfiles.find((profile) => profile.id === event.target.value);
              if (next) {
                onStatus(`${next.name} pricing applied to this table.`);
              }
            }}
            className="h-12 w-full rounded-[10px] border border-line bg-ash-900 px-3 text-base text-cream-50"
          >
            {pricingProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name} · {profile.money.currency}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-cream-700">
            Switching profiles recalculates the whole tab with that menu&rsquo;s assumptions.
          </p>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-semibold text-cream-300">Diners</span>
          <QuantityStepper
            label="number of diners"
            value={session.dinerCount}
            min={MIN_DINERS}
            max={MAX_DINERS}
            onIncrement={() => onDinerCountChange(1)}
            onDecrement={() => onDinerCountChange(-1)}
            decrementLabel="Remove a diner"
            incrementLabel="Add a diner"
          />
        </div>
      </div>

      <TableRoster
        session={session}
        regularDiners={regularDiners}
        onAdd={onAddDiner}
        onRename={onRenameDiner}
        onAdmissionPriceChange={onDinerAdmissionPriceChange}
        onRemove={onRemoveDiner}
        onMove={onMoveDiner}
        onClear={onClearDiners}
        onSaveRegular={onSaveRegularDiner}
        onStatus={onStatus}
      />

      <BillAdjustments
        session={session}
        baseAdmission={baseAdmission}
        totalPaid={totalAdmission}
        onAdd={onAddAdjustment}
        onRemove={onRemoveAdjustment}
        onClear={onClearAdjustments}
        onStatus={onStatus}
      />

      <div className="mt-4 flex flex-wrap items-end justify-between gap-2 rounded-[10px] border border-line-soft bg-ash-900 px-4 py-3">
        <div>
          <p className="micro-label">
            {session.adjustments?.length ? 'Total paid' : 'Total entry'}
          </p>
          <p className="tabular text-xs text-cream-500">
            {session.adjustments?.length
              ? `${formatMoney(baseAdmission, pricingProfile.money)} entry, then ${session.adjustments.length} ${session.adjustments.length === 1 ? 'adjustment' : 'adjustments'}`
              : session.diners?.some((diner) => diner.admissionPrice !== undefined)
                ? 'Individual diner prices included.'
                : `${formatMoney(session.pricePerDiner, pricingProfile.money)} per person × ${session.dinerCount} ${session.dinerCount === 1 ? 'diner' : 'diners'}`}
          </p>
        </div>
        <p className="tabular display-type text-3xl text-ember-400">
          {formatMoney(totalAdmission, pricingProfile.money)}
        </p>
      </div>

      <RestaurantPresets
        setup={{
          name: session.restaurantName,
          pricePerDiner: session.pricePerDiner,
          dinerCount: session.dinerCount,
          pricingProfileId: pricingProfile.id,
        }}
        hasMealInProgress={session.items.length > 0}
        onApply={(preset) =>
          onApplySetup({
            restaurantName: preset.name,
            pricePerDiner: preset.pricePerDiner,
            dinerCount: preset.dinerCount,
            pricingProfileId: preset.pricingProfileId,
            // Applying a saved place links the meal to it, so filing the report
            // records the visit against that restaurant.
            restaurantId: preset.id,
          })
        }
        onStatus={onStatus}
      />

      <PricingProfileManager
        profiles={pricingProfiles}
        onSave={onSavePricingProfile}
        onRemove={onRemovePricingProfile}
        onStatus={onStatus}
      />

      <CustomFoodManager
        foods={customFoods}
        onSave={onSaveCustomFood}
        onRemove={onRemoveCustomFood}
        onReplaceAll={onReplaceCustomFoods}
        onStatus={onStatus}
      />

      <MenuShare
        pricingProfile={pricingProfile}
        customFoods={customFoods}
        restaurant={{
          name: session.restaurantName,
          pricePerDiner: session.pricePerDiner,
          dinerCount: session.dinerCount,
        }}
        onStatus={onStatus}
      />
    </section>
  );
}
