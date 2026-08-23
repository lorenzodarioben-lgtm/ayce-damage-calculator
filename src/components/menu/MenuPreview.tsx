'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusToast } from '@/components/ui/StatusToast';
import { useCustomFoods } from '@/hooks/useCustomFoods';
import { usePricingProfiles } from '@/hooks/usePricingProfiles';
import { useRestaurants } from '@/hooks/useRestaurants';
import { useStatusMessage } from '@/hooks/useStatusMessage';
import { CATEGORY_META } from '@/lib/constants';
import { formatMoney, formatPricePerKg } from '@/lib/formatting';
import { planMenuImport, type MenuSharePayload } from '@/lib/menuShare';
import { findFoodInCatalogue } from '@/lib/foodCatalogue';
import { FOODS } from '@/data/foods';

const CTA_CLASS =
  'inline-flex min-h-14 items-center justify-center rounded-[10px] bg-ember-500 px-6 text-base ' +
  'font-bold uppercase tracking-[0.1em] text-ash-950 transition-colors duration-200 hover:bg-ember-400';

/**
 * A received menu, shown read-only until the recipient says otherwise.
 *
 * Nothing is written on arrival. When they do import, nothing local is
 * replaced either: anything whose name or identifier is already taken comes in
 * under a fresh one, and the preview says which ones those will be before the
 * button is pressed.
 */
export function MenuPreview({ payload }: { payload: MenuSharePayload }) {
  const pricingProfiles = usePricingProfiles();
  const customFoods = useCustomFoods();
  const restaurants = useRestaurants();
  const [status, announce] = useStatusMessage();
  const [imported, setImported] = useState(false);

  const local = useMemo(
    () => ({
      pricingProfiles: pricingProfiles.profiles,
      customFoods: customFoods.foods,
      restaurants: restaurants.restaurants,
    }),
    [pricingProfiles.profiles, customFoods.foods, restaurants.restaurants],
  );

  const plan = useMemo(
    () => planMenuImport(payload, local, new Date(0).toISOString()),
    [payload, local],
  );

  const runImport = useCallback(() => {
    // Re-planned at the moment of the click, so the timestamp is the import's
    // own rather than one fixed when the page rendered.
    const applied = planMenuImport(payload, local, new Date().toISOString());
    if (applied.pricingProfile) {
      pricingProfiles.save(applied.pricingProfile);
    }
    for (const food of applied.customFoods) {
      customFoods.save(food);
    }
    if (applied.restaurant) {
      restaurants.save({
        name: applied.restaurant.name,
        pricePerDiner: applied.restaurant.pricePerDiner,
        dinerCount: applied.restaurant.dinerCount,
        pricingProfileId: applied.restaurant.pricingProfileId,
      });
    }
    setImported(true);
    announce('Menu saved to this device. Nothing that was already here was changed.');
  }, [announce, customFoods, local, payload, pricingProfiles, restaurants]);

  const overrides = Object.entries(payload.pricingProfile.overrides);

  return (
    <div className="space-y-6">
      <section aria-labelledby="shared-menu-heading" className="panel p-4 sm:p-5">
        <p className="micro-label mb-2">A shared personal menu</p>
        <h1 id="shared-menu-heading" className="display-type text-3xl text-cream-50 sm:text-4xl">
          {payload.pricingProfile.name}
        </h1>
        <p className="tabular mt-2 text-sm text-cream-500">
          Prices in {payload.pricingProfile.money.currency} · {overrides.length} adjusted{' '}
          {overrides.length === 1 ? 'cut' : 'cuts'} · {payload.customFoods.length} custom{' '}
          {payload.customFoods.length === 1 ? 'food' : 'foods'}
        </p>
        <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-cream-300">
          This is a preview. Nothing has been saved to your device, and your own menu, history and
          saved orders are untouched.
        </p>
      </section>

      {payload.restaurant && (
        <section aria-labelledby="shared-restaurant-heading" className="panel p-4 sm:p-5">
          <h2 id="shared-restaurant-heading" className="micro-label mb-2">
            The restaurant setup
          </h2>
          <p className="text-base font-bold text-cream-50">{payload.restaurant.name}</p>
          <p className="tabular text-sm text-cream-500">
            {formatMoney(payload.restaurant.pricePerDiner, payload.pricingProfile.money)} per diner
            · {payload.restaurant.dinerCount}{' '}
            {payload.restaurant.dinerCount === 1 ? 'diner' : 'diners'}
          </p>
        </section>
      )}

      {overrides.length > 0 && (
        <section
          aria-labelledby="shared-prices-heading"
          className="panel overflow-x-auto p-4 sm:p-5"
        >
          <h2 id="shared-prices-heading" className="micro-label mb-3">
            Adjusted prices
          </h2>
          <table className="w-full min-w-[360px] text-left text-sm">
            <caption className="sr-only">
              The cuts this menu prices differently, with its own figures.
            </caption>
            <thead className="text-xs text-cream-500">
              <tr>
                <th scope="col" className="pb-2 pr-3">
                  Cut
                </th>
                <th scope="col" className="pb-2 pr-3">
                  Retail
                </th>
                <th scope="col" className="pb-2">
                  Est. ingredient cost
                </th>
              </tr>
            </thead>
            <tbody>
              {overrides.map(([foodId, pricing]) => {
                const known = findFoodInCatalogue(FOODS, foodId);
                const shared = payload.customFoods.find((food) => food.id === foodId);
                return (
                  <tr key={foodId} className="border-t border-line-soft text-cream-200">
                    <th scope="row" className="py-2 pr-3 text-left font-semibold text-cream-50">
                      {known?.name ?? shared?.name ?? foodId}
                    </th>
                    <td className="tabular py-2 pr-3 text-ember-400">
                      {formatPricePerKg(pricing.retailPricePerKg, payload.pricingProfile.money)}
                    </td>
                    <td className="tabular py-2">
                      {formatPricePerKg(pricing.restaurantCostPerKg, payload.pricingProfile.money)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {payload.customFoods.length > 0 && (
        <section aria-labelledby="shared-foods-heading" className="panel p-4 sm:p-5">
          <h2 id="shared-foods-heading" className="micro-label mb-3">
            Custom foods
          </h2>
          <ul>
            {payload.customFoods.map((food) => (
              <li
                key={food.id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line-soft py-3 first:pt-0"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-cream-50">
                    {food.name}
                  </span>
                  <span className="block text-xs text-cream-500">
                    {CATEGORY_META.find((entry) => entry.id === food.category)?.label ??
                      food.category}{' '}
                    · {food.caloriesPer100g} kcal / 100 g
                  </span>
                </span>
                <span className="tabular shrink-0 text-sm font-bold text-ember-400">
                  {formatPricePerKg(food.retailPricePerKg, payload.pricingProfile.money)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="shared-import-heading" className="panel p-4 sm:p-5">
        <h2 id="shared-import-heading" className="micro-label mb-2">
          Save it to this device
        </h2>

        {imported ? (
          <>
            <p role="status" className="max-w-[60ch] text-sm leading-relaxed text-cream-300">
              Saved. The menu is now in your own pricing profiles and custom foods, and nothing that
              was already there was changed.
            </p>
            <Link href="/" className={`${CTA_CLASS} mt-4`}>
              Back to the calculator
            </Link>
          </>
        ) : (
          <>
            <p className="max-w-[60ch] text-sm leading-relaxed text-cream-300">
              Importing adds this menu alongside your own. Nothing of yours is replaced or removed.
            </p>

            {(plan.pricingProfileRenamed ||
              plan.renamedFoods.length > 0 ||
              plan.restaurantRenamed) && (
              <div className="mt-3 rounded-[10px] border border-line bg-ash-900 px-4 py-3">
                <p className="micro-label mb-1">Some names are already taken here</p>
                <ul className="space-y-1 text-xs leading-relaxed text-cream-500">
                  {plan.pricingProfileRenamed && plan.pricingProfile && (
                    <li>
                      The pricing profile will be saved as{' '}
                      <strong className="text-cream-100">{plan.pricingProfile.name}</strong>.
                    </li>
                  )}
                  {plan.renamedFoods.length > 0 && (
                    <li>
                      {plan.renamedFoods.join(', ')} will be saved as separate entries, so your own
                      versions stay exactly as they are.
                    </li>
                  )}
                  {plan.restaurantRenamed && plan.restaurant && (
                    <li>
                      The restaurant will be saved as{' '}
                      <strong className="text-cream-100">{plan.restaurant.name}</strong>.
                    </li>
                  )}
                </ul>
              </div>
            )}

            <Button
              variant="primary"
              size="lg"
              fullWidth
              className="mt-4"
              disabled={!plan.writes}
              onClick={runImport}
            >
              <Download size={18} aria-hidden="true" />
              Import this menu
            </Button>
            <p className="mt-3 text-center text-xs text-cream-700">
              Until you press that, this page has changed nothing on your device.
            </p>
          </>
        )}
      </section>

      <StatusToast message={status} />
    </div>
  );
}
