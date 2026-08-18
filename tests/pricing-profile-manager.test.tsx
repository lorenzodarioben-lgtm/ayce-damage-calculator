import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PricingProfileManager } from '@/components/session/PricingProfileManager';
import { PRICING_PROFILES_STORAGE_KEY } from '@/lib/pricingProfiles';

beforeEach(() => {
  window.HTMLDialogElement.prototype.showModal = vi.fn(function showModal(this: HTMLDialogElement) {
    this.open = true;
  });
  window.HTMLDialogElement.prototype.close = vi.fn(function close(this: HTMLDialogElement) {
    this.open = false;
  });
});

describe('PricingProfileManager', () => {
  it('keeps the built-in profile visible and lets a diner save a local profile', async () => {
    const user = userEvent.setup();
    const onStatus = vi.fn();
    render(<PricingProfileManager onStatus={onStatus} />);

    expect(screen.getByText('Australian KBBQ estimates')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /new profile/i }));
    await user.type(screen.getByLabelText(/profile name/i), 'Downtown lunch');
    await user.selectOptions(screen.getByLabelText(/currency/i), 'USD');
    await user.type(screen.getByLabelText(/Ribeye retail price/i), '80');
    await user.type(screen.getByLabelText(/Ribeye restaurant cost/i), '45');
    await user.click(screen.getByRole('button', { name: /save profile/i }));

    expect(screen.getByText('Downtown lunch')).toBeInTheDocument();
    expect(window.localStorage.getItem(PRICING_PROFILES_STORAGE_KEY)).toContain(
      'custom-downtown-lunch',
    );
    expect(onStatus).toHaveBeenCalledWith('Downtown lunch pricing saved on this device.');
  });

  it('allows a saved custom profile to be removed without exposing delete controls for the default', async () => {
    window.localStorage.setItem(
      PRICING_PROFILES_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        profiles: [
          {
            id: 'custom-downtown-lunch',
            name: 'Downtown lunch',
            money: { currency: 'USD', locale: 'en-US' },
            overrides: {},
            builtIn: false,
          },
        ],
      }),
    );
    const user = userEvent.setup();
    render(<PricingProfileManager onStatus={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /delete australian/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /delete downtown lunch/i }));
    expect(screen.queryByText('Downtown lunch')).not.toBeInTheDocument();
  });
});
