import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

/*
 * Four weights of the same button, separated by how much light each one gets.
 *
 * Primary is the only variant that glows, and there is at most one of it on a
 * screen: it is the thing the page is for. The rest step down from a lit edge,
 * to a border, to nothing — so the order they should be read in is the order
 * they catch the eye.
 *
 * Every variant keeps its disabled state flat and unlit. A disabled control
 * that still glows is the single most common way an interface promises
 * something it will not do.
 */
const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-linear-to-b from-ember-400 to-ember-600 text-ash-950 font-bold ' +
    'shadow-[inset_0_1px_0_rgb(255_250_240/0.4),0_2px_8px_-2px_rgb(0_0_0/0.6),0_0_22px_-8px_var(--color-ember-500)] ' +
    'hover:from-ember-300 hover:to-ember-500 hover:shadow-[inset_0_1px_0_rgb(255_250_240/0.45),0_4px_14px_-3px_rgb(0_0_0/0.65),0_0_30px_-6px_var(--color-ember-400)] ' +
    'active:from-ember-500 active:to-ember-700 ' +
    'disabled:bg-ash-700 disabled:bg-none disabled:text-cream-700 disabled:shadow-none',
  secondary:
    'bg-ash-800 text-cream-100 border border-line ' +
    'shadow-[inset_0_1px_0_rgb(255_250_240/0.05),0_2px_6px_-3px_rgb(0_0_0/0.5)] ' +
    'hover:border-ember-700 hover:bg-ash-700 ' +
    'disabled:text-cream-700 disabled:shadow-none',
  ghost:
    'bg-transparent text-cream-300 border border-transparent hover:text-cream-100 ' +
    'hover:bg-ash-800 disabled:text-cream-700',
  danger:
    'bg-transparent text-char-500 border border-char-700 hover:border-char-600 ' +
    'hover:bg-char-700/30 hover:text-cream-100 disabled:text-cream-700',
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
  'bg-ash-850 px-5 text-sm font-semibold uppercase tracking-[0.1em] text-ember-300 ' +
  'shadow-[inset_0_1px_0_rgb(255_250_240/0.05),0_2px_8px_-4px_rgb(0_0_0/0.6)] ' +
  'transition-[background-color,border-color,transform] duration-200 ' +
  'hover:-translate-y-px hover:border-ember-600 hover:bg-ash-800';

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
        'transition-[background-color,border-color,color,transform,box-shadow] duration-200 ease-out-soft',
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
