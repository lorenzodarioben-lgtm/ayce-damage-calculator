'use client';

import { useEffect, useId, useRef } from 'react';
import { Search, X } from 'lucide-react';

interface FoodSearchProps {
  value: string;
  onChange: (value: string) => void;
  /** Matches for the current query, or null when nothing is being searched. */
  resultCount: number | null;
}

/** Anything that is already taking typed input, where a slash is a slash. */
const EDITABLE =
  'input, textarea, select, [contenteditable], [role="textbox"], [role="searchbox"], [role="combobox"]';

/**
 * Finds a cut without knowing which category it is filed under.
 *
 * Four tabs are quick to scan, but only if you already know that prawns are
 * seafood and jowl is pork. Typing is the shortcut for everyone who does not.
 */
export function FoodSearch({ value, onChange, resultCount }: FoodSearchProps) {
  const inputId = useId();
  const statusId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  /*
   * Slash jumps to the search from anywhere on the page.
   *
   * It stays out of the way of anything that has a claim on the key first: a
   * field being typed into, a browser or OS chord, and an open modal dialog,
   * whose content is inert anyway — focusing behind it would fail silently
   * while the keystroke had already been swallowed.
   */
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== '/' || event.defaultPrevented) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (document.querySelector('dialog[open]')) {
        return;
      }
      if (!(event.target instanceof HTMLElement) || event.target.closest(EDITABLE)) {
        return;
      }

      const input = inputRef.current;
      if (!input) {
        return;
      }

      event.preventDefault();
      input.focus();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

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
          ref={inputRef}
          id={inputId}
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            // Escape empties the field without leaving it, which is what the
            // clear button does for a pointer.
            if (event.key === 'Escape' && value.length > 0) {
              event.preventDefault();
              onChange('');
            }
          }}
          placeholder="Brisket, premium pork, prawns…"
          autoComplete="off"
          aria-keyshortcuts="/"
          aria-describedby={statusId}
          className="min-h-11 w-full rounded-[10px] border border-line bg-ash-900 pl-9 pr-11 text-sm text-cream-100 placeholder:text-cream-700 focus:border-ember-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50"
        />
        {value.length > 0 ? (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Clear the search"
            className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[8px] text-cream-500 transition-colors duration-200 hover:bg-ash-800 hover:text-cream-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ember-400"
          >
            <X size={15} aria-hidden="true" />
          </button>
        ) : (
          /* The shortcut, shown in the space the clear button will take. Hidden
             from assistive technology, which is told the same thing properly by
             `aria-keyshortcuts`, and from narrow screens, which have no key to
             press. */
          <kbd
            aria-hidden="true"
            className="pointer-events-none absolute right-1.5 top-1/2 hidden size-8 -translate-y-1/2 items-center justify-center rounded-[8px] border border-line bg-ash-850 font-sans text-xs text-cream-700 sm:flex"
          >
            /
          </kbd>
        )}
      </div>

      {/* Always present, so the count is announced rather than appearing from
          nowhere the first time a query matches nothing. */}
      <p id={statusId} role="status" className="tabular mt-1.5 min-h-4 text-xs text-cream-700">
        {resultCount === null
          ? ''
          : resultCount === 0
            ? 'No cuts match this search'
            : `${resultCount} ${resultCount === 1 ? 'cut matches' : 'cuts match'}`}
      </p>
    </div>
  );
}
