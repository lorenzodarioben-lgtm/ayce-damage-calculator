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
    'elevate-primary ' +
    'hover:from-ember-300 hover:to-ember-500 ' +
    'active:from-ember-500 active:to-ember-700 ' +
    'disabled:bg-ash-800 disabled:bg-none disabled:text-cream-500 disabled:shadow-none',
  secondary:
    'bg-ash-800 text-cream-100 border border-line-strong ' +
    'elevate-control ' +
    'hover:border-line-strong hover:bg-ash-700 ' +
    'disabled:text-cream-500 disabled:shadow-none',
  ghost:
    'bg-transparent text-cream-300 border border-transparent hover:text-cream-100 ' +
    'hover:bg-ash-800 disabled:text-cream-500',
  danger:
    'bg-transparent text-char-400 border border-char-700 hover:border-char-600 ' +
    'hover:bg-char-700/30 hover:text-cream-100 disabled:text-cream-500',
};

const SIZES: Record<Size, string> = {
  sm: 'min-h-9 px-3 text-caption tracking-caps',
  md: 'min-h-11 px-4 text-ui tracking-caps',
  lg: 'min-h-14 px-6 text-body tracking-caps',
};

/**
 * The way out of an empty state, which is always a link rather than a button:
 * every one of these navigates. Shaped like a secondary button and named once,
 * because seven copies of the same class list could not stay in step.
 */
export const EMPTY_STATE_LINK =
  'mt-6 inline-flex min-h-12 items-center justify-center rounded-surface border border-line-ember ' +
  'bg-ash-850 px-5 text-ui font-semibold uppercase tracking-caps text-cream-100 ' +
  'elevate-control ' +
  'transition-[background-color,border-color,transform] duration-200 ' +
  'hover:-translate-y-px hover:border-line-strong hover:bg-ash-800';

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
        'inline-flex cursor-pointer items-center justify-center gap-2 rounded-surface font-semibold uppercase',
        'transition-[background-color,border-color,color,transform,box-shadow] duration-200 ease-out-soft',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-400 active:scale-[0.985] disabled:pointer-events-none disabled:cursor-not-allowed',
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
