import type { ReactNode } from 'react';
import { MethodologyTrigger } from '@/components/methodology/MethodologyTrigger';
import { LICENSE_URL, REPOSITORY_URL } from '@/lib/constants';
import { cn } from '@/lib/cn';

interface SiteFooterProps {
  children: ReactNode;
  /** Extra bottom padding on the calculator, which has a fixed summary bar. */
  className?: string;
}

const EXTERNAL_LINK =
  'min-h-11 content-center text-xs font-semibold uppercase tracking-[0.1em] ' +
  'text-cream-500 underline-offset-4 hover:text-cream-300 hover:underline';

/**
 * Said rather than shown: both links leave the app, and a target of _blank
 * that is only visible as a new tab appearing is a surprise for anyone not
 * watching for it.
 */
function NewTabHint() {
  return <span className="sr-only"> (opens in a new tab)</span>;
}

/**
 * An app that claims to keep everything on the device should be checkable on
 * that claim, which takes one link to the source and one to the terms it is
 * offered under. Both are quieter than the methodology control beside them:
 * verifying is a rarer errand than asking where a number came from.
 */
export function SiteFooter({ children, className }: SiteFooterProps) {
  return (
    <footer className={cn('relative z-10 border-t border-line px-4 pt-6 pb-8 sm:px-6', className)}>
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3">
        <p className="max-w-[52ch] text-xs leading-relaxed text-cream-700">{children}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <a
            href={REPOSITORY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={EXTERNAL_LINK}
          >
            Source
            <NewTabHint />
          </a>
          <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer" className={EXTERNAL_LINK}>
            MIT License
            <NewTabHint />
          </a>
          <MethodologyTrigger
            label="How we calculate it"
            className="min-h-11 cursor-pointer px-1 text-xs font-semibold uppercase tracking-[0.1em] text-ember-500 underline-offset-4 hover:underline"
          />
        </div>
      </div>
    </footer>
  );
}
