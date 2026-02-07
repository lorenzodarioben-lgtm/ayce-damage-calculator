'use client';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { FOODS } from '@/data/foods';
import { Dialog } from '@/components/ui/Dialog';
import { formatPricePerKg } from '@/lib/formatting';
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
      return pricing
        ? [
            [
              food.id,
              {
                retail: String(pricing.retailPricePerKg),
                cost: String(pricing.restaurantCostPerKg),
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
      const retail = fields.retail.trim();
      const cost = fields.cost.trim();
      if (!retail && !cost) {
        continue;
      }
      const retailPricePerKg = Number(retail);
      const restaurantCostPerKg = Number(cost);
      if (
        !Number.isFinite(retailPricePerKg) ||
        !Number.isFinite(restaurantCostPerKg) ||
        retailPricePerKg < 0 ||
        restaurantCostPerKg < 0
      ) {
        setError('Enter zero or a positive number for both prices, or leave both blank.');
        return;
      }
      overrides[foodId] = { retailPricePerKg, restaurantCostPerKg };
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
          const retail = Number(current?.retail || food.retailPricePerKg);
          const cost = Number(current?.cost || food.restaurantCostPerKg);
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
        <p className="text-sm leading-relaxed text-cream-500">
          Keep a local set of assumptions for a particular restaurant or city. Blank cut prices keep
          the original Australian estimate for that cut.
        </p>

        <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
          <div>
            <label htmlFor={nameId} className="mb-1.5 block text-sm font-semibold text-cream-300">
              Profile name
            </label>
            <input
              id={nameId}
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="off"
              placeholder="e.g. Sydney dinner menu"
              className="h-11 w-full rounded-[10px] border border-line bg-ash-900 px-3 text-cream-50 placeholder:text-cream-700 focus:border-ember-600"
            />
          </div>
          <div>
            <label
              htmlFor={currencyId}
              className="mb-1.5 block text-sm font-semibold text-cream-300"
            >
              Currency
            </label>
            <select
              id={currencyId}
              value={currency}
              onChange={(event) => setCurrency(event.target.value as CurrencyCode)}
              className="h-11 w-full rounded-[10px] border border-line bg-ash-900 px-3 text-cream-50 focus:border-ember-600"
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
          <div className="mb-3 rounded-[10px] border border-line-soft p-3">
            <p className="text-sm font-semibold text-cream-100">Bulk price adjustment</p>
            <p className="mt-1 text-xs text-cream-700">
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
                className="h-10 w-28 rounded-[8px] border border-line bg-ash-850 px-2 text-sm text-cream-50"
              />
              <button
                type="button"
                onClick={previewAdjustment}
                className="rounded-[8px] border border-line px-3 text-xs font-semibold text-ember-400"
              >
                Preview all cuts
              </button>
            </div>
          </div>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h3 className="micro-label">Cut assumptions</h3>
            <p className="text-xs text-cream-700">Per kg · leave a row blank to inherit</p>
          </div>
          <div className="max-h-[40dvh] overflow-y-auto rounded-[10px] border border-line-soft bg-ash-900/50">
            {FOODS.map((food) => {
              const fields = prices[food.id];
              return (
                <div
                  key={food.id}
                  className="grid gap-2 border-b border-line-soft px-3 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_7rem_7rem] sm:items-center"
                >
                  <div>
                    <p className="text-sm font-bold text-cream-100">{food.name}</p>
                    <p className="text-xs text-cream-700">
                      Default{' '}
                      {formatPricePerKg(food.retailPricePerKg, {
                        currency,
                        locale: defaultLocaleForCurrency(currency),
                      })}
                    </p>
                  </div>
                  <label className="text-xs text-cream-500 sm:text-[0px]">
                    Retail price per kg
                    <input
                      aria-label={`${food.name} retail price per kg`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={fields?.retail ?? ''}
                      onChange={(event) => updatePrice(food.id, 'retail', event.target.value)}
                      placeholder="Retail"
                      className="mt-1 h-10 w-full rounded-[8px] border border-line bg-ash-850 px-2 text-sm text-cream-50 placeholder:text-cream-700 sm:mt-0"
                    />
                  </label>
                  <label className="text-xs text-cream-500 sm:text-[0px]">
                    Restaurant cost per kg
                    <input
                      aria-label={`${food.name} restaurant cost per kg`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={fields?.cost ?? ''}
                      onChange={(event) => updatePrice(food.id, 'cost', event.target.value)}
                      placeholder="Cost"
                      className="mt-1 h-10 w-full rounded-[8px] border border-line bg-ash-850 px-2 text-sm text-cream-50 placeholder:text-cream-700 sm:mt-0"
                    />
                  </label>
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm font-semibold text-char-500">
            {error}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-line-soft pt-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-[9px] px-3 text-xs font-semibold uppercase tracking-[0.1em] text-cream-400 hover:bg-ash-800 hover:text-cream-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="min-h-10 rounded-[9px] bg-ember-500 px-4 text-xs font-bold uppercase tracking-[0.1em] text-ash-950 hover:bg-ember-400"
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
          <h3 id="menu-pricing-heading" className="micro-label">
            Menu pricing
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-cream-700">
            Keep your restaurant assumptions local to this device.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-[8px] px-2 text-xs font-semibold uppercase tracking-[0.1em] text-ember-500 transition-colors duration-200 hover:bg-ash-800"
        >
          <Plus size={14} aria-hidden="true" />
          New profile
        </button>
      </div>

      <ul className="mt-3 space-y-2">
        {profiles.map((profile) => (
          <li
            key={profile.id}
            className="flex min-h-12 items-center justify-between gap-3 rounded-[10px] border border-line bg-ash-900/70 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-cream-100">{profile.name}</p>
              <p className="text-xs text-cream-600">
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
                  className="flex size-9 cursor-pointer items-center justify-center rounded-[8px] text-cream-500 transition-colors hover:bg-ash-800 hover:text-ember-400"
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
                  className="flex size-9 cursor-pointer items-center justify-center rounded-[8px] text-cream-600 transition-colors hover:bg-char-700/25 hover:text-char-500"
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
