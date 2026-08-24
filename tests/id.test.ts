import { afterEach, describe, expect, it, vi } from 'vitest';
import { createId } from '@/lib/id';

/*
 * Every stored record is keyed by one of these, so a collision would not throw
 * — it would quietly merge two meals. The fallback matters as much as the
 * primary path: `crypto.randomUUID` needs a secure context, and this app is
 * meant to keep working over plain HTTP on a phone.
 */

const originalRandomUUID = crypto.randomUUID;

afterEach(() => {
  Object.defineProperty(crypto, 'randomUUID', {
    configurable: true,
    value: originalRandomUUID,
  });
});

function withoutRandomUUID() {
  Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: undefined });
}

describe('createId', () => {
  it('uses the platform generator where there is one', () => {
    const randomUUID = vi.fn(() => '11111111-2222-4333-8444-555555555555' as const);
    Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: randomUUID });

    expect(createId()).toBe('11111111-2222-4333-8444-555555555555');
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it('still produces an id without a secure context', () => {
    withoutRandomUUID();

    const id = createId();

    expect(id).toBeTruthy();
    expect(id).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
  });

  it('does not repeat itself within a single millisecond', () => {
    withoutRandomUUID();
    // The timestamp half cannot separate ids created in the same tick, so a
    // burst is the case that decides whether the random half is doing its job.
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

    const ids = new Set(Array.from({ length: 1000 }, () => createId()));

    expect(ids.size).toBe(1000);
    vi.restoreAllMocks();
  });
});
