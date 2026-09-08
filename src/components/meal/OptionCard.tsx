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
        'relative flex cursor-pointer flex-col items-center gap-1 rounded-surface border px-2 py-3 text-center',
        'transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out-soft',
        'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2',
        'has-[:focus-visible]:outline-ember-400',
        selected
          ? 'border-ember-500 bg-ash-800 elevate-selected'
          : 'border-line-strong bg-ash-900 recessed hover:-translate-y-px hover:border-line-strong hover:bg-ash-850',
      )}
    >
      <input type="radio" name={name} checked={selected} onChange={onSelect} className="sr-only" />
      {glyph}
      <span
        className={cn(
          'text-ui font-bold uppercase tracking-caps',
          selected ? 'text-cream-100' : 'text-cream-100',
        )}
      >
        {label}
      </span>
      <span className="tabular text-caption leading-tight text-cream-500">{detail}</span>
    </label>
  );
}
