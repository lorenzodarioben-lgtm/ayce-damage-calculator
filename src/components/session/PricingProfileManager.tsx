'use client';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { FOODS } from '@/data/foods';
import { Dialog } from '@/components/ui/Dialog';
import { formatUnitPrice } from '@/lib/formatting';
import { resolveFoodPricing } from '@/lib/pricing';
import { SUPPORTED_CURRENCIES, defaultLocaleForCurrency, type CurrencyCode } from '@/lib/money';
import { nextPricingProfileId, createPricingProfile } from '@/lib/pricingProfiles';
import type { FoodPricing, PricingProfile, PricingProfileId } from '@/types/pricing';

interface PricingProfileManagerProps {
  profiles: readonly PricingProfile[];
  onSave: (profile: PricingProfile) => void;
  onRemove: (id: PricingProfileId) => void;
  onStatus: (message: string) => void;
}

type DraftPrices = Record<string, { retail: string; cost: string }>;

function initialPrices(profile: PricingProfile | null): DraftPrices {
  return Object.fromEntries(
    FOODS.flatMap((food) => {
      const pricing = profile?.overrides[food.id];
      return pricing && pricing.valuation === food.valuation
        ? [
            [
              food.id,
              {
                retail: String(
                  pricing.valuation === 'by-weight'
                    ? pricing.retailPricePerKg
                    : pricing.retailPricePerServing,
                ),
                cost: String(
                  pricing.valuation === 'by-weight'
                    ? pricing.restaurantCostPerKg
                    : pricing.restaurantCostPerServing,
                ),
              },
            ],
          ]
        : [];
    }),
  );
}

function ProfileEditor({
  profile,
  profiles,
  onClose,
  onSave,
}: {
  profile: PricingProfile | null;
  profiles: readonly PricingProfile[];
  onClose: () => void;
  onSave: (profile: PricingProfile) => void;
}) {
  const titleId = useId();
  const nameId = useId();
  const currencyId = useId();
  const [name, setName] = useState(profile?.name ?? '');
  const [currency, setCurrency] = useState<CurrencyCode>(profile?.money.currency ?? 'AUD');
  const [prices, setPrices] = useState<DraftPrices>(() => initialPrices(profile));
  const [adjustment, setAdjustment] = useState('');
  const [error, setError] = useState<string | null>(null);

  function updatePrice(foodId: string, field: 'retail' | 'cost', value: string) {
    setPrices((current) => ({
      ...current,
      [foodId]: {
        retail: current[foodId]?.retail ?? '',
        cost: current[foodId]?.cost ?? '',
        [field]: value,
      },
    }));
  }

  function handleSave() {
    const overrides: Record<string, FoodPricing> = {};
    for (const [foodId, fields] of Object.entries(prices)) {
      const food = FOODS.find((entry) => entry.id === foodId);
      if (!food) {
        continue;
      }
      const retail = fields.retail.trim();
      const cost = fields.cost.trim();
      if (!retail && !cost) {
        continue;
      }
      const retailPrice = Number(retail);
      const restaurantCost = Number(cost);
      if (
        !Number.isFinite(retailPrice) ||
        !Number.isFinite(restaurantCost) ||
        retailPrice < 0 ||
        restaurantCost < 0
      ) {
        setError('Enter zero or a positive number for both prices, or leave both blank.');
        return;
      }
      overrides[foodId] =
        food.valuation === 'by-weight'
          ? {
              valuation: 'by-weight',
              retailPricePerKg: retailPrice,
              restaurantCostPerKg: restaurantCost,
            }
          : {
              valuation: 'by-serving',
              retailPricePerServing: retailPrice,
              restaurantCostPerServing: restaurantCost,
            };
    }

    const id = profile?.id ?? nextPricingProfileId(profiles, name);
    const next = createPricingProfile(
      { name, currency, locale: defaultLocaleForCurrency(currency), overrides },
      id,
    );
    if (!next) {
      setError('Give this pricing profile a short name.');
      return;
    }
    onSave(next);
  }

  function previewAdjustment() {
    const percent = Number(adjustment);
    if (!Number.isFinite(percent)) {
      setError('Enter a percentage adjustment.');
      return;
    }
    setPrices(
      Object.fromEntries(
        FOODS.map((food) => {
          const current = prices[food.id];
          const defaults = resolveFoodPricing(food);
          const retail = Number(
            current?.retail ||
              (defaults.valuation === 'by-weight'
                ? defaults.retailPricePerKg
                : defaults.retailPricePerServing),
          );
          const cost = Number(
            current?.cost ||
              (defaults.valuation === 'by-weight'
                ? defaults.restaurantCostPerKg
                : defaults.restaurantCostPerServing),
          );
          return [
            food.id,
            {
              retail: String(Math.max(0, retail * (1 + percent / 100))),
              cost: String(Math.max(0, cost * (1 + percent / 100))),
            },
          ];
        }),
      ),
    );
    setError(null);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={profile ? 'Edit price profile' : 'New price profile'}
      labelledById={titleId}
    >
      <div className="space-y-5">
        <p className="text-ui leading-relaxed text-cream-500">
          Keep a local set of assumptions for a particular restaurant or city. Blank cut prices keep
          the original Australian estimate for that cut.
        </p>

        <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
          <div>
            <label htmlFor={nameId} className="mb-1.5 block text-ui font-semibold text-cream-300">
              Profile name
            </label>
            <input
              id={nameId}
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="off"
              placeholder="e.g. Sydney dinner menu"
              className="h-11 w-full rounded-surface border border-line-strong bg-ash-900 px-3 text-cream-50 placeholder:text-cream-600"
            />
          </div>
          <div>
            <label
              htmlFor={currencyId}
              className="mb-1.5 block text-ui font-semibold text-cream-300"
            >
              Currency
            </label>
            <select
              id={currencyId}
              value={currency}
              onChange={(event) => setCurrency(event.target.value as CurrencyCode)}
              className="h-11 w-full rounded-surface border border-line-strong bg-ash-900 px-3 text-cream-50"
            >
              {SUPPORTED_CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="mb-3 rounded-surface border border-line-soft p-3">
            <p className="text-ui font-semibold text-cream-100">Bulk price adjustment</p>
            <p className="mt-1 text-caption text-cream-600">
              Preview an increase or decrease across this profile before saving. Historical meal
              snapshots are never changed.
            </p>
            <div className="mt-2 flex gap-2">
              <input
                aria-label="Bulk price adjustment percentage"
                value={adjustment}
                onChange={(event) => setAdjustment(event.target.value)}
                type="number"
                step="0.1"
                placeholder="e.g. 10"
                className="h-10 w-28 rounded-surface border border-line-strong bg-ash-850 px-2 text-ui text-cream-50"
              />
              <button
                type="button"
                onClick={previewAdjustment}
                className="rounded-surface border border-line px-3 text-caption font-semibold text-cream-100"
              >
                Preview all cuts
              </button>
            </div>
          </div>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h3 className="display-type text-lead text-cream-100">Cut assumptions</h3>
            <p className="text-caption text-cream-600">Per item · leave a row blank to inherit</p>
          </div>
          {/* The two number columns are identical once they hold values, so on a
              wide screen they are named once here rather than on every row —
              which is what the per-row labels used to do before they were sized
              to nothing and left the columns anonymous. */}
          <div
            aria-hidden="true"
            className="hidden px-3 pb-1 sm:grid sm:grid-cols-[minmax(0,1fr)_7rem_7rem] sm:items-baseline sm:gap-2"
          >
            <span />
            <span className="micro-label text-cream-500">Retail</span>
            <span className="micro-label text-cream-500">Cost</span>
          </div>
          <div className="max-h-[40dvh] overflow-y-auto rounded-surface border border-line-soft bg-ash-900/50">
            {FOODS.map((food) => {
              const fields = prices[food.id];
              return (
                <div
                  key={food.id}
                  className="grid gap-2 border-b border-line-soft px-3 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_7rem_7rem] sm:items-center"
                >
                  <div>
                    <p className="text-ui font-bold text-cream-100">{food.name}</p>
                    <p className="text-caption text-cream-600">
                      Default{' '}
                      {formatUnitPrice(resolveFoodPricing(food), {
                        currency,
                        locale: defaultLocaleForCurrency(currency),
                      })}
                    </p>
                  </div>
                  <label className="text-caption text-cream-500">
                    <span className="sm:sr-only">
                      Retail price per {food.valuation === 'by-weight' ? 'kg' : 'serving'}
                    </span>
                    <input
                      aria-label={`${food.name} retail price per ${food.valuation === 'by-weight' ? 'kg' : 'serving'}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={fields?.retail ?? ''}
                      onChange={(event) => updatePrice(food.id, 'retail', event.target.value)}
                      placeholder="Retail"
                      className="mt-1 h-10 w-full rounded-surface border border-line-strong bg-ash-850 px-2 text-ui text-cream-50 placeholder:text-cream-600 sm:mt-0"
                    />
                  </label>
                  <label className="text-caption text-cream-500">
                    <span className="sm:sr-only">
                      Restaurant cost per {food.valuation === 'by-weight' ? 'kg' : 'serving'}
                    </span>
                    <input
                      aria-label={`${food.name} restaurant cost per ${food.valuation === 'by-weight' ? 'kg' : 'serving'}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={fields?.cost ?? ''}
                      onChange={(event) => updatePrice(food.id, 'cost', event.target.value)}
                      placeholder="Cost"
                      className="mt-1 h-10 w-full rounded-surface border border-line-strong bg-ash-850 px-2 text-ui text-cream-50 placeholder:text-cream-600 sm:mt-0"
                    />
                  </label>
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <p role="alert" className="text-ui font-semibold text-char-400">
            {error}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-line-soft pt-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-surface px-3 text-caption font-semibold uppercase tracking-caps text-cream-400 hover:bg-ash-800 hover:text-cream-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="min-h-10 rounded-surface bg-ember-500 px-4 text-caption font-bold uppercase tracking-caps text-ash-950 hover:bg-ember-400"
          >
            Save profile
          </button>
        </div>
      </div>
    </Dialog>
  );
}

/** A modest local menu cabinet: default estimates plus personal variations. */
export function PricingProfileManager({
  profiles,
  onSave,
  onRemove,
  onStatus,
}: PricingProfileManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const editing = profiles.find((profile) => profile.id === editingId) ?? null;

  function handleSave(profile: PricingProfile) {
    onSave(profile);
    setEditingId(null);
    setCreating(false);
    onStatus(`${profile.name} pricing saved on this device.`);
  }

  return (
    <section aria-labelledby="menu-pricing-heading" className="mt-4 border-t border-line-soft pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 id="menu-pricing-heading" className="display-type text-lead text-cream-100">
            Menu pricing
          </h3>
          <p className="mt-1 text-caption leading-relaxed text-cream-600">
            Keep your restaurant assumptions local to this device.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-surface px-2 text-caption font-semibold uppercase tracking-caps text-cream-100 transition-colors duration-160 hover:bg-ash-800"
        >
          <Plus size={14} aria-hidden="true" />
          New profile
        </button>
      </div>

      <ul className="mt-3 space-y-2">
        {profiles.map((profile) => (
          <li
            key={profile.id}
            className="flex min-h-12 items-center justify-between gap-3 rounded-surface border border-line-strong bg-ash-900/70 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-ui font-bold text-cream-100">{profile.name}</p>
              <p className="text-caption text-cream-600">
                {profile.money.currency} · {Object.keys(profile.overrides).length || 'Catalogue'}{' '}
                assumptions
                {profile.builtIn ? ' · Built in' : ''}
              </p>
            </div>
            {!profile.builtIn && (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setEditingId(profile.id)}
                  aria-label={`Edit ${profile.name} pricing`}
                  className="flex size-9 cursor-pointer items-center justify-center rounded-surface text-cream-500 transition-colors hover:bg-ash-800 hover:text-cream-50"
                >
                  <Pencil size={15} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onRemove(profile.id);
                    onStatus(`${profile.name} pricing removed from this device.`);
                  }}
                  aria-label={`Delete ${profile.name} pricing`}
                  className="flex size-9 cursor-pointer items-center justify-center rounded-surface text-cream-600 transition-colors hover:bg-char-700/25 hover:text-char-400"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {(creating || editing) && (
        <ProfileEditor
          key={editing?.id ?? 'new'}
          profile={editing}
          profiles={profiles}
          onClose={() => {
            setEditingId(null);
            setCreating(false);
          }}
          onSave={handleSave}
        />
      )}
    </section>
  );
}
