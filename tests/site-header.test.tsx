import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SiteHeader } from '@/components/nav/SiteHeader';

/** The panel and its toggle are both hidden from this width up. */
const WIDE_VIEWPORT = 900;
const NARROW_VIEWPORT = 400;

beforeEach(() => {
  window.HTMLDialogElement.prototype.showModal = vi.fn(function showModal(this: HTMLDialogElement) {
    this.open = true;
  });
  window.HTMLDialogElement.prototype.close = vi.fn(function close(this: HTMLDialogElement) {
    this.open = false;
  });
});

function setViewport(width: number, clientWidth = width) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(document.documentElement, 'clientWidth', {
    configurable: true,
    value: clientWidth,
  });
}

const originalInnerWidth = window.innerWidth;
const originalClientWidth = Object.getOwnPropertyDescriptor(
  document.documentElement,
  'clientWidth',
);

afterEach(() => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: originalInnerWidth,
  });
  if (originalClientWidth) {
    Object.defineProperty(document.documentElement, 'clientWidth', originalClientWidth);
  } else {
    Reflect.deleteProperty(document.documentElement, 'clientWidth');
  }
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
});

async function openMenu() {
  const user = userEvent.setup();
  render(<SiteHeader />);
  const toggle = screen.getByRole('button', { name: /open the menu/i });
  await user.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  return { user, toggle };
}

describe('SiteHeader mobile menu', () => {
  it('closes on Escape and returns focus to the toggle', async () => {
    const { user, toggle } = await openMenu();

    const mobileLink = screen.getAllByRole('link', { name: 'Live' }).at(-1)!;
    mobileLink.focus();
    await user.keyboard('{Escape}');

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();
  });

  it('leaves Escape to a dialog opened from inside the menu', async () => {
    const { user, toggle } = await openMenu();

    // The methodology dialog is reachable from the menu itself, and it is a
    // native modal: Escape belongs to it while it is on screen.
    await user.click(screen.getAllByRole('button', { name: 'Methodology' }).at(-1)!);
    const dialog = document.querySelector('dialog[open]');
    expect(dialog).not.toBeNull();

    await user.keyboard('{Escape}');

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).not.toHaveFocus();

    // jsdom does not turn Escape into the cancel event a browser fires, so the
    // dialog's own dismissal is driven directly. The menu must survive it.
    fireEvent(dialog!, new Event('cancel', { bubbles: false, cancelable: true }));

    expect(document.querySelector('dialog[open]')).toBeNull();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('locks the page behind it and restores what it found', async () => {
    setViewport(NARROW_VIEWPORT, NARROW_VIEWPORT - 20);
    const { user } = await openMenu();

    expect(document.body.style.overflow).toBe('hidden');
    // The scrollbar's width is held back so the page does not jump sideways.
    expect(document.body.style.paddingRight).toBe('20px');

    await user.click(screen.getByRole('button', { name: /close the menu/i }));

    expect(document.body.style.overflow).toBe('');
    expect(document.body.style.paddingRight).toBe('');
  });

  it('releases the lock when it is unmounted while open', async () => {
    setViewport(NARROW_VIEWPORT);
    const user = userEvent.setup();
    const { unmount } = render(<SiteHeader />);

    await user.click(screen.getByRole('button', { name: /open the menu/i }));
    expect(document.body.style.overflow).toBe('hidden');

    unmount();

    expect(document.body.style.overflow).toBe('');
  });

  it('closes itself when the viewport grows past the breakpoint that hides it', async () => {
    setViewport(NARROW_VIEWPORT);
    const { toggle } = await openMenu();

    setViewport(WIDE_VIEWPORT);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    // Nothing may be left holding the page still once the panel is hidden by
    // the stylesheet and its toggle has gone with it.
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(document.body.style.overflow).toBe('');
    expect(document.body.style.paddingRight).toBe('');
  });
});
