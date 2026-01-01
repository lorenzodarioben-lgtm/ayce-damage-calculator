'use client';

import { BRAND_NAME, BrandMark } from '@/components/BrandMark';

interface HeaderProps {
  /** Decided by the parent, which owns the stage; the header only reports the click. */
  onBrandClick: () => void;
  /** Describes where activating the brand leads, for assistive technology. */
  brandActionLabel: string;
  onOpenMethodology: () => void;
}

export function Header({ onBrandClick, brandActionLabel, onOpenMethodology }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ash-950/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-3 px-4 sm:px-6">
        {/* An explicit label rather than one derived from the child text: it keeps
            the name identical across engines, and still opens with the visible
            wordmark so speech input can target what the user actually sees. */}
        <button
          type="button"
          onClick={onBrandClick}
          aria-label={`${BRAND_NAME} — ${brandActionLabel}`}
          className="-mx-2 flex min-h-11 cursor-pointer items-center rounded-[10px] px-2 transition-colors duration-200 hover:bg-ash-800"
        >
          <BrandMark />
        </button>

        <nav aria-label="Primary">
          <button
            type="button"
            onClick={onOpenMethodology}
            className="min-h-11 cursor-pointer rounded-[10px] px-3 text-xs font-semibold uppercase tracking-[0.1em] text-cream-300 transition-colors hover:bg-ash-800 hover:text-cream-50"
          >
            Methodology
          </button>
        </nav>
      </div>
    </header>
  );
}
