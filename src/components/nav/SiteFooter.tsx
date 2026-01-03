import type { ReactNode } from 'react';
import { MethodologyTrigger } from '@/components/methodology/MethodologyTrigger';
import { cn } from '@/lib/cn';

interface SiteFooterProps {
  children: ReactNode;
  /** Extra bottom padding on the calculator, which has a fixed summary bar. */
  className?: string;
}

export function SiteFooter({ children, className }: SiteFooterProps) {
  return (
    <footer className={cn('relative z-10 border-t border-line px-4 pt-6 pb-8 sm:px-6', className)}>
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3">
        <p className="max-w-[52ch] text-xs leading-relaxed text-cream-700">{children}</p>
        <MethodologyTrigger
          label="How we calculate it"
          className="min-h-11 cursor-pointer px-1 text-xs font-semibold uppercase tracking-[0.1em] text-ember-500 underline-offset-4 hover:underline"
        />
      </div>
    </footer>
  );
}
