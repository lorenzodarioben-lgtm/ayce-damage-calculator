'use client';

import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';

interface QuantityStepperProps {
  value: number;
  min: number;
  max: number;
  /**
   * Direction rather than a precomputed value: several taps inside one React
   * batch would otherwise all resolve against the same stale count.
   */
  onIncrement: () => void;
  onDecrement: () => void;
  label: string;
  size?: 'sm' | 'md';
  decrementLabel?: string;
  incrementLabel?: string;
}

export function QuantityStepper({
  value,
  min,
  max,
  onIncrement,
  onDecrement,
  label,
  size = 'md',
  decrementLabel,
  incrementLabel,
}: QuantityStepperProps) {
  const buttonSize = size === 'sm' ? 'size-9' : 'size-12';
  const valueSize = size === 'sm' ? 'min-w-8 text-body' : 'min-w-14 text-title';
  const iconSize = size === 'sm' ? 14 : 18;

  const buttonClass = cn(
    buttonSize,
    'flex shrink-0 cursor-pointer items-center justify-center rounded-inner border border-line-strong',
    'bg-ash-800 text-cream-100 elevate-control',
    'transition-[background-color,border-color,transform] duration-200 ease-out-soft',
    'hover:border-line-strong hover:bg-ash-700 active:scale-95 active:bg-ash-800',
    'disabled:cursor-not-allowed disabled:border-line-soft disabled:bg-ash-900 disabled:text-cream-600',
  );

  return (
    <div
      className="segmented-track inline-flex items-center gap-2 p-1"
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        className={buttonClass}
        onClick={onDecrement}
        disabled={value <= min}
        aria-label={decrementLabel ?? `Decrease ${label}`}
      >
        <Minus size={iconSize} strokeWidth={2.5} aria-hidden="true" />
      </button>

      {/* <output> is a polite live region by default, so assistive technology
          hears the new count after pressing either control. */}
      <output className={cn('tabular text-center font-bold text-cream-50', valueSize)}>
        {value}
      </output>

      <button
        type="button"
        className={buttonClass}
        onClick={onIncrement}
        disabled={value >= max}
        aria-label={incrementLabel ?? `Increase ${label}`}
      >
        <Plus size={iconSize} strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  );
}
