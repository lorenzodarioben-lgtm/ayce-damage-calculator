'use client';

import { useMemo, useState } from 'react';
import { ClipboardCopy, QrCode as QrCodeIcon, Share2 } from 'lucide-react';
import { QrCode } from '@/components/share/QrCode';
import { Button } from '@/components/ui/Button';
import { encodeMenuResult } from '@/lib/menuShare';
import { COPY_UNAVAILABLE, copyToClipboard } from '@/lib/share';
import type { CustomFood } from '@/types/customFoods';
import type { PricingProfile } from '@/types/pricing';

interface MenuShareProps {
  pricingProfile: PricingProfile;
  customFoods: readonly CustomFood[];
  restaurant: { readonly name: string; pricePerDiner: number; dinerCount: number };
  onStatus: (message: string) => void;
}

/**
 * Turns the personal menu into a link.
 *
 * The link carries the pricing assumptions and the diner's own foods, and — if
 * they tick the box — the restaurant setup. Nothing else on the device travels
 * with it: no history, no saved orders, no diner names, no notes.
 */
export function MenuShare({ pricingProfile, customFoods, restaurant, onStatus }: MenuShareProps) {
  const [includeRestaurant, setIncludeRestaurant] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const namedRestaurant = restaurant.name.trim().length > 0;

  const result = useMemo(
    () =>
      encodeMenuResult({
        pricingProfile,
        customFoods,
        ...(includeRestaurant && namedRestaurant
          ? {
              restaurant: {
                name: restaurant.name,
                pricePerDiner: restaurant.pricePerDiner,
                dinerCount: restaurant.dinerCount,
              },
            }
          : {}),
      }),
    [pricingProfile, customFoods, includeRestaurant, namedRestaurant, restaurant],
  );

  const token = result.ok ? result.token : null;
  const url =
    token && typeof window !== 'undefined' ? `${window.location.origin}/menu/${token}` : '';

  async function copyLink() {
    if (!url) {
      return;
    }
    const copied = await copyToClipboard(url);
    onStatus(copied ? 'Menu link copied.' : COPY_UNAVAILABLE);
  }

  return (
    <section aria-labelledby="menu-share-heading" className="mt-4 border-t border-line-soft pt-4">
      <h3 id="menu-share-heading" className="micro-label mb-2 flex items-center gap-1.5">
        <Share2 size={13} aria-hidden="true" />
        Share this menu
      </h3>

      {token === null ? (
        <p className="rounded-[10px] border border-dashed border-line bg-ash-900/60 px-4 py-3 text-center text-xs leading-relaxed text-cream-700">
          {!result.ok && result.reason === 'too-large'
            ? 'This menu is too large to fit inside a link. A menu link carries every price and custom food in the address itself, so there is a limit to what it can hold — share fewer foods, or trim their descriptions.'
            : 'There is nothing to share yet. A menu link carries your own price assumptions and custom foods — add one of those, or a restaurant setup, and a link appears here.'}
        </p>
      ) : (
        <>
          <p className="max-w-[60ch] text-xs leading-relaxed text-cream-700">
            The link carries the whole menu inside the address. Nothing is uploaded, and no history,
            saved order, diner name or note travels with it.
          </p>

          <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-cream-300">
            <input
              type="checkbox"
              checked={includeRestaurant && namedRestaurant}
              disabled={!namedRestaurant}
              onChange={(event) => setIncludeRestaurant(event.target.checked)}
              className="mt-1 size-4 accent-[var(--color-ember-500)]"
            />
            <span>
              Include the restaurant setup
              {namedRestaurant ? ` (${restaurant.name})` : ' — name a restaurant first'}
            </span>
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" size="md" onClick={() => void copyLink()}>
              <ClipboardCopy size={16} aria-hidden="true" />
              Copy the menu link
            </Button>
            <Button
              variant="ghost"
              size="md"
              aria-expanded={showQr}
              onClick={() => setShowQr((open) => !open)}
            >
              <QrCodeIcon size={16} aria-hidden="true" />
              {showQr ? 'Hide the code' : 'Show a QR code'}
            </Button>
          </div>

          {showQr && (
            <div className="mt-3 flex flex-col items-center gap-2">
              <QrCode value={url} label="A scannable link to this menu" />
              <p className="max-w-[46ch] text-center text-xs leading-relaxed text-cream-700">
                Scanning opens the same read-only preview the link does. Copy the link instead if
                the code will not scan — it always works.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
