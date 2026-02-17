import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStatusMessage } from '@/hooks/useStatusMessage';

/*
 * Every confirmation in the app goes through this hook, and the part that is
 * easy to get wrong is the timing: a plain confirmation and an offer to undo
 * are deliberately given different lifespans, and a second announcement has to
 * restart the clock rather than inherit the first one's remaining time.
 */

const VISIBLE_MS = 2600;
const ACTIONABLE_VISIBLE_MS = 7000;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useStatusMessage', () => {
  it('starts with nothing to say', () => {
    const { result } = renderHook(() => useStatusMessage());

    expect(result.current[0]).toBeNull();
  });

  it('holds a plain confirmation briefly, then clears it', () => {
    const { result } = renderHook(() => useStatusMessage());

    act(() => result.current[1]('Ribeye added.'));
    expect(result.current[0]).toEqual({ text: 'Ribeye added.' });

    act(() => void vi.advanceTimersByTime(VISIBLE_MS - 1));
    expect(result.current[0]).not.toBeNull();

    act(() => void vi.advanceTimersByTime(1));
    expect(result.current[0]).toBeNull();
  });

  it('holds an offer longer, because it has to be read before it can be taken', () => {
    const { result } = renderHook(() => useStatusMessage());
    const onAction = vi.fn();

    act(() => result.current[1]('Ribeye removed.', { label: 'Undo', onAction }));

    act(() => void vi.advanceTimersByTime(VISIBLE_MS));
    expect(result.current[0]?.action?.label).toBe('Undo');

    act(() => void vi.advanceTimersByTime(ACTIONABLE_VISIBLE_MS - VISIBLE_MS));
    expect(result.current[0]).toBeNull();
  });

  it('carries the action through untouched, so the caller decides what it does', () => {
    const { result } = renderHook(() => useStatusMessage());
    const onAction = vi.fn();

    act(() => result.current[1]('Ribeye removed.', { label: 'Undo', onAction }));
    act(() => result.current[0]?.action?.onAction());

    expect(onAction).toHaveBeenCalledOnce();
  });

  it('restarts the clock when a second message replaces the first', () => {
    const { result } = renderHook(() => useStatusMessage());

    act(() => result.current[1]('First.'));
    act(() => void vi.advanceTimersByTime(VISIBLE_MS - 100));
    act(() => result.current[1]('Second.'));

    // The first message's timer must not carry over and clear the second.
    act(() => void vi.advanceTimersByTime(100));
    expect(result.current[0]).toEqual({ text: 'Second.' });

    act(() => void vi.advanceTimersByTime(VISIBLE_MS));
    expect(result.current[0]).toBeNull();
  });

  it('leaves no timer running once it is gone', () => {
    const { result, unmount } = renderHook(() => useStatusMessage());

    act(() => result.current[1]('Ribeye added.'));
    unmount();

    // A timer firing into an unmounted hook would warn rather than throw, so
    // the count is what actually proves it was cleared.
    expect(vi.getTimerCount()).toBe(0);
  });
});
