'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { BRAND_NAME, BrandMark } from '@/components/BrandMark';
import { MethodologyTrigger } from '@/components/methodology/MethodologyTrigger';
import { DESTINATIONS, isCurrentDestination } from '@/components/nav/destinations';
import { cn } from '@/lib/cn';

interface SiteHeaderProps {
  /**
   * Supplied by the calculator, where the brand doubles as a way back out of
   * the report. Without it the brand is an ordinary link home.
   */
  onBrandClick?: () => void;
  brandActionLabel?: string;
}

/*
 * A destination marks itself current with a lit bar under it rather than a
 * filled background. The old treatment was a tint one step off the header's
 * own, which on this palette is close to no treatment at all — and it said
 * "hovered" in the same language it said "you are here".
 */
const LINK_BASE =
  'relative flex min-h-11 items-center rounded-[10px] px-3 text-xs font-semibold uppercase ' +
  'tracking-[0.1em] transition-colors duration-200 ' +
  "after:absolute after:inset-x-3 after:bottom-1.5 after:h-px after:rounded-full after:content-['']";

const LINK_IDLE =
  'text-cream-300 hover:bg-ash-800/70 hover:text-cream-50 after:bg-transparent ' +
  'hover:after:bg-line-ember';

const LINK_CURRENT =
  'text-ember-300 after:bg-ember-400 after:shadow-[0_0_10px_0_var(--color-ember-500)]';

/**
 * Tailwind's own small breakpoint, in pixels. The menu and its toggle are
 * hidden above it, so the state has to be told what the stylesheet knows.
 */
const SM_BREAKPOINT = 640;

export function SiteHeader({ onBrandClick, brandActionLabel }: SiteHeaderProps) {
  const pathname = usePathname();
  const menuId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPathname, setMenuPathname] = useState(pathname);
  const menuToggleRef = useRef<HTMLButtonElement>(null);

  /*
   * Escape dismisses the menu, and focus goes back to the control that opened
   * it rather than to the top of the document.
   *
   * A native modal dialog handles its own Escape through the cancel event, and
   * the methodology dialog can be opened from inside this very menu. When one
   * is on screen it owns the key: the menu neither closes behind it nor calls
   * preventDefault, which would stop the dialog closing at all.
   */
  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented) {
        return;
      }
      if (document.querySelector('dialog[open]')) {
        return;
      }

      event.preventDefault();
      setMenuOpen(false);
      menuToggleRef.current?.focus();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  /*
   * The panel covers the page on a narrow screen, so the page behind it should
   * not scroll away underneath. The previous values are restored rather than
   * cleared, because something else may have set them.
   */
  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const { style } = document.body;
    const previousOverflow = style.overflow;
    const previousPaddingRight = style.paddingRight;
    // Hold the width the scrollbar occupied, so locking does not shift the
    // page sideways underneath the menu.
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      style.overflow = previousOverflow;
      style.paddingRight = previousPaddingRight;
    };
  }, [menuOpen]);

  /*
   * Above the small breakpoint the stylesheet hides both the panel and its
   * toggle. Left alone, a widened window would strand a locked page with no
   * visible way to unlock it, so the state follows the stylesheet: the menu
   * closes, and the lock is released by the effect above.
   */
  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handleResize() {
      if (window.innerWidth >= SM_BREAKPOINT) {
        setMenuOpen(false);
      }
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [menuOpen]);

  // Arriving somewhere new means the menu has done its job. Resolved during
  // render so the panel is never painted over the page it just navigated to.
  if (menuPathname !== pathname) {
    setMenuPathname(pathname);
    setMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-ash-950/72 shadow-[0_1px_0_0_rgb(255_250_240/0.04),0_10px_30px_-22px_rgb(0_0_0/0.9)] backdrop-blur-xl backdrop-saturate-150">
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
          ref={menuToggleRef}
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
          className="border-t border-line-soft bg-ash-900/95 px-4 py-3 shadow-[0_18px_40px_-20px_rgb(0_0_0/0.85)] backdrop-blur-xl sm:hidden"
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
