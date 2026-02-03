import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StorageDurability } from '@/components/history/StorageDurability';
import {
  inspectStorageDurability,
  requestStoragePersistence,
  type StorageManagerLike,
} from '@/lib/storageDurability';

const originalStorage = navigator.storage;

afterEach(() => {
  Object.defineProperty(navigator, 'storage', { configurable: true, value: originalStorage });
});

describe('storage durability helpers', () => {
  it('reports browser storage details without making an unsupported browser fail', async () => {
    await expect(inspectStorageDurability(undefined)).resolves.toEqual({
      supported: false,
      persisted: null,
      usage: null,
      quota: null,
    });

    const storage: StorageManagerLike = {
      persisted: vi.fn().mockResolvedValue(false),
      estimate: vi.fn().mockResolvedValue({ usage: 2_000_000, quota: 10_000_000 }),
    };
    await expect(inspectStorageDurability(storage)).resolves.toEqual({
      supported: true,
      persisted: false,
      usage: 2_000_000,
      quota: 10_000_000,
    });
  });

  it('handles incomplete and rejected storage-manager implementations', async () => {
    await expect(
      inspectStorageDurability({ persisted: vi.fn().mockRejectedValue(new Error()) }),
    ).resolves.toEqual({
      supported: true,
      persisted: null,
      usage: null,
      quota: null,
    });
    await expect(requestStoragePersistence(undefined)).resolves.toBe('unsupported');
    await expect(requestStoragePersistence({})).resolves.toBe('unavailable');
    await expect(
      requestStoragePersistence({ persist: vi.fn().mockResolvedValue(false) }),
    ).resolves.toBe('declined');
    await expect(
      requestStoragePersistence({ persist: vi.fn().mockResolvedValue(true) }),
    ).resolves.toBe('granted');
  });
});

describe('StorageDurability', () => {
  it('shows browser-provided usage and keeps a declined persistence request honest', async () => {
    const user = userEvent.setup();
    const persist = vi.fn().mockResolvedValue(false);
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        persisted: vi.fn().mockResolvedValue(false),
        estimate: vi.fn().mockResolvedValue({ usage: 2_000_000, quota: 10_000_000 }),
        persist,
      } satisfies StorageManagerLike,
    });

    render(<StorageDurability />);

    expect(await screen.findByText('Not protected yet')).toBeInTheDocument();
    expect(screen.getByText('1.9 MB')).toBeInTheDocument();
    expect(screen.getByText('7.6 MB')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Protect local data' }));

    await waitFor(() => expect(persist).toHaveBeenCalledOnce());
    expect(await screen.findByText(/did not grant persistent storage/i)).toBeInTheDocument();
  });

  it('uses graceful wording when StorageManager is unavailable', async () => {
    Object.defineProperty(navigator, 'storage', { configurable: true, value: undefined });
    render(<StorageDurability />);

    expect(
      await screen.findByText(/does not expose storage durability details/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Protect local data' })).not.toBeInTheDocument();
  });
});
