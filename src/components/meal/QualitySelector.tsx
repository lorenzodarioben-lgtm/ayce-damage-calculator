'use client';

import { OptionCard } from '@/components/meal/OptionCard';
import { QUALITY_TIERS } from '@/lib/constants';
import type { QualityTier } from '@/types/meal';

interface QualitySelectorProps {
  value: QualityTier;
  onChange: (tier: QualityTier) => void;
}

export function QualitySelector({ value, onChange }: QualitySelectorProps) {
  return (
    <fieldset>
      <legend className="micro-label mb-2">Quality tier</legend>
      <div className="grid grid-cols-3 gap-2">
        {QUALITY_TIERS.map((tier) => (
          <OptionCard
            key={tier.id}
            name="quality-tier"
            selected={tier.id === value}
            onSelect={() => onChange(tier.id)}
            label={tier.label}
            detail={tier.subtitle}
          />
        ))}
      </div>
    </fieldset>
  );
}
