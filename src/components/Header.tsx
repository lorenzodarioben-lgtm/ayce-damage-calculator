'use client';

import { BrandMark } from '@/components/BrandMark';

interface HeaderProps {
  onOpenMethodology: () => void;
}

export function Header({ onOpenMethodology }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ash-950/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-3 px-4 sm:px-6">
        <BrandMark />
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
