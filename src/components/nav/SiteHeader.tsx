'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { BRAND_NAME, BrandMark } from '@/components/BrandMark';
import { MethodologyTrigger } from '@/components/methodology/MethodologyTrigger';
import { DESTINATIONS, MAIN_CONTENT_ID, isCurrentDestination } from '@/components/nav/destinations';
import { cn } from '@/lib/cn';

interface SiteHeaderProps {
  /**
   * Supplied by the calculator, where the brand doubles as a way back out of
   * the report. Without it the brand is an ordinary link home.
   */
  onBrandClick?: () => void;
  brandActionLabel?: string;
}

const LINK_BASE =
  'flex min-h-11 items-center rounded-[10px] px-3 text-xs font-semibold uppercase ' +
  'tracking-[0.1em] transition-colors duration-200';

const LINK_IDLE = 'text-cream-300 hover:bg-ash-800 hover:text-cream-50';
const LINK_CURRENT = 'bg-ash-800 text-ember-400';

export function SiteHeader({ onBrandClick, brandActionLabel }: SiteHeaderProps) {
  const pathname = usePathname();
  const menuId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPathname, setMenuPathname] = useState(pathname);

  // Arriving somewhere new means the menu has done its job. Resolved during
  // render so the panel is never painted over the page it just navigated to.
  if (menuPathname !== pathname) {
    setMenuPathname(pathname);
    setMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ash-950/85 backdrop-blur-md">
      {/* The first focusable thing on every page. Without it, reaching the
          content by keyboard means tabbing past the whole navigation each time. */}
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className="absolute left-4 top-2 z-50 -translate-y-[150%] rounded-[10px] border border-line-ember bg-ash-850 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ember-400 transition-transform duration-150 focus-visible:translate-y-0"
      >
        Skip to content
      </a>

      <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-3 px-4 sm:px-6">
        {/* An explicit label rather than one derived from the child text: it keeps
            the name identical across engines, and still opens with the visible
            wordmark so speech input can target what the user actually sees. */}
        {onBrandClick ? (
          <button
            type="button"
            onClick={onBrandClick}
            aria-label={`${BRAND_NAME} — ${brandActionLabel ?? 'Back to the top of the page'}`}
            className="-mx-2 flex min-h-11 cursor-pointer items-center rounded-[10px] px-2 transition-colors duration-200 hover:bg-ash-800"
          >
            <BrandMark />
          </button>
        ) : (
          <Link
            href="/"
            aria-label={`${BRAND_NAME} — back to the calculator`}
            className="-mx-2 flex min-h-11 items-center rounded-[10px] px-2 transition-colors duration-200 hover:bg-ash-800"
          >
            <BrandMark />
          </Link>
        )}

        {/* Wide screens get the destinations laid out; narrow ones would be
            crowded by them, so they go behind a single control instead. */}
        <nav aria-label="Primary" className="hidden items-center gap-1 sm:flex">
          {DESTINATIONS.map((destination) => {
            const current = isCurrentDestination(pathname, destination.href);
            return (
              <Link
                key={destination.href}
                href={destination.href}
                aria-current={current ? 'page' : undefined}
                className={cn(LINK_BASE, current ? LINK_CURRENT : LINK_IDLE)}
              >
                {destination.label}
              </Link>
            );
          })}
          <MethodologyTrigger className={cn(LINK_BASE, LINK_IDLE, 'cursor-pointer')} />
        </nav>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls={menuId}
          aria-label={menuOpen ? 'Close the menu' : 'Open the menu'}
          className="-mr-2 flex size-11 cursor-pointer items-center justify-center rounded-[10px] text-cream-300 transition-colors duration-200 hover:bg-ash-800 hover:text-cream-50 sm:hidden"
        >
          {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
      </div>

      {menuOpen && (
        <nav
          id={menuId}
          aria-label="Primary"
          className="border-t border-line-soft bg-ash-900 px-4 py-2 sm:hidden"
        >
          <ul className="space-y-1">
            {DESTINATIONS.map((destination) => {
              const current = isCurrentDestination(pathname, destination.href);
              return (
                <li key={destination.href}>
                  <Link
                    href={destination.href}
                    aria-current={current ? 'page' : undefined}
                    className={cn(LINK_BASE, 'w-full', current ? LINK_CURRENT : LINK_IDLE)}
                  >
                    {destination.label}
                  </Link>
                </li>
              );
            })}
            <li>
              <MethodologyTrigger
                className={cn(LINK_BASE, LINK_IDLE, 'w-full cursor-pointer text-left')}
              />
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
