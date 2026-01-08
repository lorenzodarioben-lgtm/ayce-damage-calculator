'use client';

import { useId } from 'react';
import { Search, X } from 'lucide-react';

interface FoodSearchProps {
  value: string;
  onChange: (value: string) => void;
  /** Matches for the current query, or null when nothing is being searched. */
  resultCount: number | null;
}

/**
 * Finds a cut without knowing which category it is filed under.
 *
 * Four tabs are quick to scan, but only if you already know that prawns are
 * seafood and jowl is pork. Typing is the shortcut for everyone who does not.
 */
export function FoodSearch({ value, onChange, resultCount }: FoodSearchProps) {
  const inputId = useId();
  const statusId = useId();

  return (
    <div className="mb-3">
      <label htmlFor={inputId} className="micro-label mb-2 block">
        Find a cut
      </label>

      <div className="relative">
        <Search
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cream-700"
        />
        <input
          id={inputId}
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Brisket, premium pork, prawns…"
          autoComplete="off"
          aria-describedby={statusId}
          className="min-h-11 w-full rounded-[10px] border border-line bg-ash-900 pl-9 pr-11 text-sm text-cream-100 placeholder:text-cream-700 focus:border-ember-600 focus:outline-none"
        />
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Clear the search"
            className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[8px] text-cream-500 transition-colors duration-200 hover:bg-ash-800 hover:text-cream-100"
          >
            <X size={15} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Always present, so the count is announced rather than appearing from
          nowhere the first time a query matches nothing. */}
      <p id={statusId} role="status" className="tabular mt-1.5 min-h-4 text-xs text-cream-700">
        {resultCount === null
          ? ''
          : `${resultCount} ${resultCount === 1 ? 'cut matches' : 'cuts match'}`}
      </p>
    </div>
  );
}
