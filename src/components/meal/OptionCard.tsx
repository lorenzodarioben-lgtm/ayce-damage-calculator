'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface OptionCardProps {
  selected: boolean;
  onSelect: () => void;
  label: string;
  detail: string;
  /** Optional glyph rendered above the label, e.g. the plate-size discs. */
  glyph?: ReactNode;
  name: string;
}

/**
 * A radio presented as a card. The native input stays in the DOM so keyboard
 * and screen-reader behaviour comes from the platform rather than ARIA.
 */
export function OptionCard({ selected, onSelect, label, detail, glyph, name }: OptionCardProps) {
  return (
    <label
      className={cn(
        'relative flex cursor-pointer flex-col items-center gap-1 rounded-card border px-2 py-3 text-center',
        'transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out-soft',
        'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2',
        'has-[:focus-visible]:outline-ember-400',
        selected
          ? 'border-ember-500 bg-ash-800 shadow-[inset_0_1px_0_rgb(255_250_240/0.08),inset_0_0_0_1px_var(--color-ember-500),0_0_20px_-8px_var(--color-ember-500)]'
          : 'border-line bg-ash-900 shadow-[inset_0_1px_3px_rgb(0_0_0/0.35)] hover:-translate-y-px hover:border-ember-700 hover:bg-ash-850',
      )}
    >
      <input type="radio" name={name} checked={selected} onChange={onSelect} className="sr-only" />
      {glyph}
      <span
        className={cn(
          'text-[0.8rem] font-bold uppercase tracking-[0.08em]',
          selected ? 'text-ember-300' : 'text-cream-100',
        )}
      >
        {label}
      </span>
      <span className="tabular text-[0.7rem] leading-tight text-cream-500">{detail}</span>
    </label>
  );
}
