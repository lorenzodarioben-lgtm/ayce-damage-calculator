import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-ember-500 text-ash-950 font-bold hover:bg-ember-400 active:bg-ember-600 ' +
    'disabled:bg-ash-700 disabled:text-cream-700',
  secondary:
    'bg-ash-800 text-cream-100 border border-line hover:border-ember-700 ' +
    'hover:bg-ash-700 disabled:text-cream-700',
  ghost:
    'bg-transparent text-cream-300 border border-transparent hover:text-cream-100 ' +
    'hover:bg-ash-800 disabled:text-cream-700',
  danger:
    'bg-transparent text-char-500 border border-char-700 hover:bg-char-700/25 ' +
    'hover:text-cream-100 disabled:text-cream-700',
};

const SIZES: Record<Size, string> = {
  sm: 'min-h-9 px-3 text-xs tracking-[0.1em]',
  md: 'min-h-11 px-4 text-sm tracking-[0.08em]',
  lg: 'min-h-14 px-6 text-base tracking-[0.1em]',
};

/**
 * The way out of an empty state, which is always a link rather than a button:
 * every one of these navigates. Shaped like a secondary button and named once,
 * because seven copies of the same class list could not stay in step.
 */
export const EMPTY_STATE_LINK =
  'mt-6 inline-flex min-h-12 items-center justify-center rounded-[10px] border border-line-ember ' +
  'bg-ash-850 px-5 text-sm font-semibold uppercase tracking-[0.1em] text-ember-400 ' +
  'transition-colors duration-200 hover:bg-ash-800';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex cursor-pointer items-center justify-center gap-2 rounded-[10px] font-semibold uppercase',
        'transition-[background-color,border-color,color,transform] duration-200 ease-out-soft',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-400 active:scale-[0.985] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-70',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
