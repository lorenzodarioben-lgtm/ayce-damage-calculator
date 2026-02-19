import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/cn';

/*
 * Every component in the app builds its class list through this one joiner, and
 * the only way it can go wrong is quietly: a stray space or a literal "false"
 * in the attribute changes nothing a test would otherwise notice, but it is the
 * difference between a conditional class being applied and being ignored.
 */

describe('cn', () => {
  it('keeps the classes in the order they were supplied', () => {
    expect(cn('inline-flex', 'rounded-full', 'text-sm')).toBe('inline-flex rounded-full text-sm');
  });

  it('drops every falsey value rather than spacing around it', () => {
    expect(cn('base', false, null, undefined, '', 'end')).toBe('base end');
  });

  it('returns an empty string when given nothing at all', () => {
    expect(cn()).toBe('');
  });

  it('returns an empty string when every value is falsey', () => {
    expect(cn(false, null, undefined, '')).toBe('');
  });

  it('keeps a conditional class only while its condition holds', () => {
    const width = (fullWidth: boolean) => cn('min-h-11', fullWidth && 'w-full', 'px-4');

    expect(width(true)).toBe('min-h-11 w-full px-4');
    expect(width(false)).toBe('min-h-11 px-4');
  });

  it('leaves no leading or trailing space when the edges are falsey', () => {
    expect(cn(undefined, 'centre', false)).toBe('centre');
  });
});
