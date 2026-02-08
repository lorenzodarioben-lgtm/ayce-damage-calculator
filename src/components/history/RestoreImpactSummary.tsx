import type { RestoreImpact } from '@/lib/backup';

interface RestoreImpactSummaryProps {
  readonly impact: RestoreImpact;
}

interface ImpactRowProps {
  readonly label: string;
  readonly newItems: number;
  readonly alreadyOnDevice: number;
  readonly discarded: number;
}

function ImpactRow({ label, newItems, alreadyOnDevice, discarded }: ImpactRowProps) {
  return (
    <li className="grid gap-1 border-t border-line py-2 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-4">
      <span className="font-medium text-cream-100">{label}</span>
      <span className="tabular text-cream-300">
        {newItems} new · {alreadyOnDevice} already on this device
      </span>
      <span className="tabular text-xs text-char-400 sm:col-start-2">
        Replace discards {discarded} currently on this device
      </span>
    </li>
  );
}

/** A read-only, side-by-side forecast shown before a restore can be applied. */
export function RestoreImpactSummary({ impact }: RestoreImpactSummaryProps) {
  const rows = [
    {
      label: 'Filed sessions',
      merge: impact.merge.sessions,
      replace: impact.replace.sessions,
    },
    {
      label: 'Saved orders',
      merge: impact.merge.savedOrders,
      replace: impact.replace.savedOrders,
    },
    {
      label: 'Pricing profiles',
      merge: impact.merge.pricingProfiles,
      replace: impact.replace.pricingProfiles,
    },
    {
      label: 'Custom foods',
      merge: impact.merge.customFoods,
      replace: impact.replace.customFoods,
    },
    {
      label: 'Saved restaurants',
      merge: impact.merge.restaurants,
      replace: impact.replace.restaurants,
    },
  ];

  return (
    <section aria-labelledby="restore-impact-heading" className="mt-4">
      <h3 id="restore-impact-heading" className="micro-label mb-2">
        Restore impact
      </h3>
      <p className="mb-2 text-xs leading-relaxed text-cream-700">
        Merging adds only the new records below. Replacing discards the current records shown for
        each collection before writing this backup.
      </p>
      <ul className="rounded-[8px] border border-line bg-ash-950 px-3 text-sm">
        {rows.map((row) => (
          <ImpactRow
            key={row.label}
            label={row.label}
            newItems={row.merge.new}
            alreadyOnDevice={row.merge.alreadyOnDevice}
            discarded={row.replace.discarded}
          />
        ))}
      </ul>
    </section>
  );
}
