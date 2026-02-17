import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNow } from '@/hooks/useNow';

/*
 * The meal clock reads this, and the behaviour worth pinning is what happens
 * when the tab is backgrounded: a phone throws timers away, so the hook stops
 * ticking and re-reads the real clock on return rather than trying to keep a
 * counter alive through it.
 */

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  document.dispatchEvent(new Event('visibilitychange'));
}

const originalVisibility = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(document, 'visibilityState');
  if (originalVisibility) {
    Object.defineProperty(Document.prototype, 'visibilityState', originalVisibility);
  }
});

describe('useNow', () => {
  it('reports a time straight away, without waiting for a tick', () => {
    vi.setSystemTime(1_000_000);
    const { result } = renderHook(() => useNow());

    expect(result.current).toBe(1_000_000);
  });

  it('advances on the interval it was given', () => {
    vi.setSystemTime(1_000_000);
    const { result } = renderHook(() => useNow(1000));

    act(() => void vi.advanceTimersByTime(3000));

    expect(result.current).toBe(1_003_000);
  });

  it('stops while the tab is hidden and catches up when it comes back', () => {
    vi.setSystemTime(1_000_000);
    const { result } = renderHook(() => useNow(1000));

    act(() => setVisibility('hidden'));
    act(() => void vi.advanceTimersByTime(60_000));

    // Nothing ticked, so the reading is still the one from before hiding.
    expect(result.current).toBe(1_000_000);

    act(() => setVisibility('visible'));

    // Re-read from the real clock rather than replayed a minute of ticks.
    expect(result.current).toBe(1_060_000);
  });

  it('never starts a timer when it is disabled', () => {
    vi.setSystemTime(1_000_000);
    const { result } = renderHook(() => useNow(1000, false));

    expect(vi.getTimerCount()).toBe(0);

    act(() => void vi.advanceTimersByTime(5000));
    expect(result.current).toBe(1_000_000);
  });

  it('leaves no timer behind once it is gone', () => {
    const { unmount } = renderHook(() => useNow(1000));
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
