'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookmarkPlus, X } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatMoney } from '@/lib/formatting';
import {
  restaurantMatchesSetup,
  type RestaurantDraft,
  type RestaurantProfile,
} from '@/lib/restaurants';
import { useRestaurants } from '@/hooks/useRestaurants';

interface RestaurantPresetsProps {
  setup: RestaurantDraft;
  onApply: (preset: RestaurantProfile) => void;
  /** Whether a meal is already on the tab, which changes what applying means. */
  hasMealInProgress: boolean;
  onStatus: (message: string) => void;
}

function describe(preset: RestaurantProfile): string {
  return `${preset.name}, ${formatMoney(preset.pricePerDiner)} per diner, ${preset.dinerCount} ${
    preset.dinerCount === 1 ? 'diner' : 'diners'
  }`;
}

/**
 * Saved restaurants, applied in one tap.
 *
 * Applying only ever changes the restaurant, price and diner count — it never
 * touches the plates on the tab. It does move the totals underneath a meal in
 * progress, though, so that case is confirmed rather than silently applied. It
 * also links the meal to that place, which is what lets a filed visit appear in
 * the restaurant's own history.
 */
export function RestaurantPresets({
  setup,
  onApply,
  hasMealInProgress,
  onStatus,
}: RestaurantPresetsProps) {
  const { restaurants: presets, save, remove } = useRestaurants();
  const [pending, setPending] = useState<RestaurantProfile | null>(null);

  const nameGiven = setup.name.trim().length > 0;

  function handleSave() {
    const saved = save(setup);
    onStatus(
      saved
        ? `${saved.name} saved to your restaurants.`
        : 'Give the restaurant a name before saving it.',
    );
  }

  function requestApply(preset: RestaurantProfile) {
    // Nothing to disturb, or nothing would change: apply straight away.
    if (!hasMealInProgress || restaurantMatchesSetup(preset, setup)) {
      onApply(preset);
      onStatus(`${preset.name} applied.`);
      return;
    }
    setPending(preset);
  }

  return (
    <div className="mt-4 border-t border-line-soft pt-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="micro-label">Saved restaurants</h3>
        <Link
          href="/restaurants"
          className="inline-flex min-h-9 items-center rounded-[8px] px-2 text-xs font-semibold uppercase tracking-[0.1em] text-cream-500 transition-colors duration-200 hover:bg-ash-800 hover:text-cream-100"
        >
          Open the hub
        </Link>
        <button
          type="button"
          onClick={handleSave}
          disabled={!nameGiven}
          className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-[8px] px-2 text-xs font-semibold uppercase tracking-[0.1em] text-ember-500 transition-colors duration-200 hover:bg-ash-800 disabled:cursor-not-allowed disabled:text-cream-700 disabled:hover:bg-transparent"
        >
          <BookmarkPlus size={14} aria-hidden="true" />
          Save this setup
        </button>
      </div>

      {presets.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-line bg-ash-900/60 px-4 py-3 text-center text-xs leading-relaxed text-cream-700">
          No saved restaurants yet. Name a restaurant and set its price, then save the setup to
          reuse it on the next visit.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <li key={preset.id} className="relative">
              <button
                type="button"
                onClick={() => requestApply(preset)}
                aria-label={`Apply preset ${describe(preset)}`}
                className="flex min-h-11 cursor-pointer items-center rounded-[10px] border border-line bg-ash-900 pl-3 pr-9 text-left transition-colors duration-200 hover:border-ember-700 hover:bg-ash-850"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-cream-50">
                    {preset.name}
                  </span>
                  <span className="tabular block text-[0.7rem] text-cream-500">
                    {formatMoney(preset.pricePerDiner)} · {preset.dinerCount}{' '}
                    {preset.dinerCount === 1 ? 'diner' : 'diners'}
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => remove(preset.id)}
                aria-label={`Delete the preset ${preset.name}`}
                className="absolute right-1 top-1/2 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-cream-700 transition-colors duration-200 hover:bg-char-700/25 hover:text-char-500"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pending !== null}
        title="Apply this preset?"
        body={
          pending
            ? `This changes the restaurant to ${pending.name}, the price to ${formatMoney(pending.pricePerDiner)} per diner and the table to ${pending.dinerCount}. Your plates stay exactly as they are, but the totals will be recalculated against the new entry price.`
            : ''
        }
        confirmLabel="Apply preset"
        cancelLabel="Leave it as it is"
        onConfirm={() => {
          if (pending) {
            onApply(pending);
            onStatus(`${pending.name} applied.`);
          }
          setPending(null);
        }}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
