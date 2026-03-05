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
  const valueSize = size === 'sm' ? 'min-w-8 text-base' : 'min-w-14 text-2xl';
  const iconSize = size === 'sm' ? 14 : 18;

  const buttonClass = cn(
    buttonSize,
    'flex shrink-0 cursor-pointer items-center justify-center rounded-[10px] border border-line',
    'bg-ash-800 text-cream-100 shadow-[inset_0_1px_0_rgb(255_250_240/0.05)]',
    'transition-[background-color,border-color,transform] duration-200 ease-out-soft',
    'hover:border-ember-600 hover:bg-ash-700 active:scale-95 active:bg-ash-800',
    'disabled:cursor-not-allowed disabled:border-line-soft disabled:bg-ash-900 disabled:text-cream-700',
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
      <output className={cn('tabular display-hero text-center text-cream-50', valueSize)}>
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
