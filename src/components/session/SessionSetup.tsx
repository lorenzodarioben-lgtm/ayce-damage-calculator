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
import { RestaurantPresets } from '@/components/session/RestaurantPresets';
import { PricingProfileManager } from '@/components/session/PricingProfileManager';
import { usePricingProfile } from '@/components/session/PricingContext';
import { formatMoney } from '@/lib/formatting';
import { DEFAULT_PRICING_PROFILE_ID } from '@/lib/pricing';
import type { MealSession, SessionConfig } from '@/types/meal';
import type { PricingProfile, PricingProfileId } from '@/types/pricing';

interface SessionSetupProps {
  session: MealSession;
  totalAdmission: number;
  onRestaurantNameChange: (value: string) => void;
  onPricePerDinerChange: (value: number) => void;
  onPricingProfileChange: (id: PricingProfileId) => void;
  pricingProfiles: readonly PricingProfile[];
  onSavePricingProfile: (profile: PricingProfile) => void;
  onRemovePricingProfile: (id: PricingProfileId) => void;
  onDinerCountChange: (delta: number) => void;
  onApplySetup: (setup: SessionConfig) => void;
  onStatus: (message: string) => void;
}

export function SessionSetup({
  session,
  totalAdmission,
  onRestaurantNameChange,
  onPricePerDinerChange,
  onPricingProfileChange,
  pricingProfiles,
  onSavePricingProfile,
  onRemovePricingProfile,
  onDinerCountChange,
  onApplySetup,
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
            className="h-12 w-full rounded-[10px] border border-line bg-ash-900 px-3 text-base text-cream-50 placeholder:text-cream-700 focus:border-ember-600"
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
              className="tabular h-12 w-full rounded-[10px] border border-line bg-ash-900 pl-7 pr-3 text-base text-cream-50 focus:border-ember-600"
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
            className="h-12 w-full rounded-[10px] border border-line bg-ash-900 px-3 text-base text-cream-50 focus:border-ember-600"
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

      <div className="mt-4 flex flex-wrap items-end justify-between gap-2 rounded-[10px] border border-line-soft bg-ash-900 px-4 py-3">
        <div>
          <p className="micro-label">Total entry</p>
          <p className="tabular text-xs text-cream-500">
            {formatMoney(session.pricePerDiner, pricingProfile.money)} per person ×{' '}
            {session.dinerCount} {session.dinerCount === 1 ? 'diner' : 'diners'}
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
        }}
        hasMealInProgress={session.items.length > 0}
        onApply={(preset) =>
          onApplySetup({
            restaurantName: preset.name,
            pricePerDiner: preset.pricePerDiner,
            dinerCount: preset.dinerCount,
            pricingProfileId: DEFAULT_PRICING_PROFILE_ID,
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
    </section>
  );
}
