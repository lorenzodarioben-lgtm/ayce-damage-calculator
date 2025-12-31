'use client';

import { OptionCard } from '@/components/meal/OptionCard';
import { PLATE_SIZES } from '@/lib/constants';
import type { PlateSize } from '@/types/meal';

interface PlateSizeSelectorProps {
  value: PlateSize;
  onChange: (size: PlateSize) => void;
}

const LARGEST_GRAMS = Math.max(...PLATE_SIZES.map((size) => size.grams));

/** A disc scaled by portion weight, so the three options read at a glance. */
function PlateGlyph({ grams, active }: { grams: number; active: boolean }) {
  const diameter = 14 + (grams / LARGEST_GRAMS) * 16;
  return (
    <span
      aria-hidden="true"
      className="flex h-8 items-center justify-center transition-colors duration-200"
    >
      <span
        style={{ width: diameter, height: diameter }}
        className={
          active
            ? 'rounded-full border-2 border-ember-400 bg-ember-500/25'
            : 'rounded-full border-2 border-cream-700 bg-ash-800'
        }
      />
    </span>
  );
}

export function PlateSizeSelector({ value, onChange }: PlateSizeSelectorProps) {
  return (
    <fieldset>
      <legend className="micro-label mb-2">Plate size</legend>
      <div className="grid grid-cols-3 gap-2">
        {PLATE_SIZES.map((size) => {
          const selected = size.id === value;
          return (
            <OptionCard
              key={size.id}
              name="plate-size"
              selected={selected}
              onSelect={() => onChange(size.id)}
              label={size.label}
              detail={`${size.grams} g · ~${size.ounces}`}
              glyph={<PlateGlyph grams={size.grams} active={selected} />}
            />
          );
        })}
      </div>
    </fieldset>
  );
}
