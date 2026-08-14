'use client';

import { useId } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { PLATE_SIZES } from '@/lib/constants';

interface MethodologyProps {
  open: boolean;
  onClose: () => void;
}

const ENTRIES = [
  {
    term: 'Retail value',
    detail:
      'The estimated supermarket-equivalent value of the meat you recorded, based on an illustrative Australian price per kilogram for each cut.',
  },
  {
    term: 'Est. ingredient cost',
    detail:
      'An illustrative bulk procurement estimate — roughly what a restaurant may have paid for the same raw ingredient.',
  },
  {
    term: 'Nutrition',
    detail:
      'Approximate figures derived from typical values per 100 g of raw product, scaled by the weight you recorded.',
  },
  {
    term: 'Quality tier',
    detail:
      'Adjusts the estimated retail price and ingredient cost of a cut. It does not change nutritional values.',
  },
] as const;

export function Methodology({ open, onClose }: MethodologyProps) {
  const titleId = useId();

  return (
    <Dialog open={open} onClose={onClose} title="How we calculate it" labelledById={titleId}>
      <dl className="space-y-4">
        {ENTRIES.map((entry) => (
          <div key={entry.term}>
            <dt className="text-sm font-bold text-cream-50">{entry.term}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-cream-300">{entry.detail}</dd>
          </div>
        ))}

        <div>
          <dt className="text-sm font-bold text-cream-50">Portion sizes</dt>
          <dd className="mt-2">
            <ul className="tabular grid grid-cols-3 gap-2 text-sm">
              {PLATE_SIZES.map((size) => (
                <li
                  key={size.id}
                  className="rounded-[10px] border border-line bg-ash-900 px-3 py-2 text-center"
                >
                  <span className="block text-xs uppercase tracking-wider text-cream-700">
                    {size.label}
                  </span>
                  <span className="block font-bold text-cream-100">{size.grams} g</span>
                </li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>

      <div className="mt-6 rounded-[10px] border border-line bg-ash-900 px-4 py-4">
        <p className="micro-label mb-2">Important disclaimer</p>
        <p className="text-sm leading-relaxed text-cream-300">
          AYCE Damage Calculator is for entertainment and estimation only. Actual meat prices,
          restaurant procurement costs, portion sizes and nutrition vary by supplier, restaurant,
          preparation, trimming, marinades and location. Estimated ingredient margin is not
          restaurant profit and excludes wages, rent, utilities, tax, waste, side dishes and other
          overhead.
        </p>
      </div>
    </Dialog>
  );
}
