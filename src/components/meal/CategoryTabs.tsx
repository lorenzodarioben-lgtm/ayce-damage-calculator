'use client';

import { useRef } from 'react';
import { CATEGORY_META } from '@/lib/constants';
import { cn } from '@/lib/cn';
import type { FoodCategory } from '@/types/meal';

interface CategoryTabsProps {
  value: FoodCategory;
  onChange: (category: FoodCategory) => void;
  panelId: string;
}

export function CategoryTabs({ value, onChange, panelId }: CategoryTabsProps) {
  const listRef = useRef<HTMLDivElement>(null);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const last = CATEGORY_META.length - 1;
    const currentIndex = CATEGORY_META.findIndex((category) => category.id === value);

    let nextIndex: number;
    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % CATEGORY_META.length;
        break;
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + CATEGORY_META.length) % CATEGORY_META.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = last;
        break;
      default:
        return;
    }

    event.preventDefault();
    const next = CATEGORY_META[nextIndex];
    if (!next) {
      return;
    }
    onChange(next.id);
    listRef.current?.querySelector<HTMLButtonElement>(`#category-tab-${next.id}`)?.focus();
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label="Food category"
      onKeyDown={handleKeyDown}
      className="grid grid-cols-4 gap-1 rounded-[12px] border border-line bg-ash-900 p-1"
    >
      {CATEGORY_META.map((category) => {
        const selected = category.id === value;
        return (
          <button
            key={category.id}
            id={`category-tab-${category.id}`}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(category.id)}
            className={cn(
              'relative min-h-11 cursor-pointer rounded-[9px] px-1 text-[0.8rem] font-semibold uppercase',
              'tracking-[0.06em] transition-colors duration-200 ease-out-soft sm:text-sm',
              selected
                ? 'bg-ember-500 text-ash-950'
                : 'text-cream-500 hover:bg-ash-800 hover:text-cream-100',
            )}
          >
            {category.label}
            {selected && (
              <span aria-hidden="true" className="ml-1 hidden font-bold sm:inline">
                ●
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
