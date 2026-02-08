'use client';

import { useRef } from 'react';
import { CATEGORY_META, GRILL_CATEGORIES, type CategoryMeta } from '@/lib/constants';
import { cn } from '@/lib/cn';
import type { FoodCategory, FoodItem } from '@/types/meal';

interface CategoryTabsProps {
  value: FoodCategory;
  onChange: (category: FoodCategory) => void;
  panelId: string;
  /** The menu in play, so empty categories are not offered. */
  foods: readonly FoodItem[];
}

/**
 * The categories worth showing.
 *
 * The four grill categories are always there — they are the bundled menu and
 * the reason someone opened the app. The four custom-only ones appear only once
 * the diner has actually put something in them, so nobody using the default
 * menu is shown four empty tabs to wonder about.
 */
export function visibleCategories(foods: readonly FoodItem[]): readonly CategoryMeta[] {
  return CATEGORY_META.filter(
    (category) =>
      GRILL_CATEGORIES.includes(category.id) || foods.some((food) => food.category === category.id),
  );
}

export function CategoryTabs({ value, onChange, panelId, foods }: CategoryTabsProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const categories = visibleCategories(foods);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const last = categories.length - 1;
    const currentIndex = categories.findIndex((category) => category.id === value);

    let nextIndex: number;
    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % categories.length;
        break;
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + categories.length) % categories.length;
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
    const next = categories[nextIndex];
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
      {categories.map((category) => {
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
