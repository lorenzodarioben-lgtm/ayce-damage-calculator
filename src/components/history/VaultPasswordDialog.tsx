'use client';

import { useId, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { MIN_VAULT_PASSWORD_LENGTH } from '@/lib/encryptedBackup';

interface VaultPasswordDialogProps {
  open: boolean;
  /** Encrypting asks twice; opening asks once. */
  mode: 'encrypt' | 'decrypt';
  /** Shown above the fields when a previous attempt failed. */
  error?: string | null;
  busy?: boolean;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}

const FIELD =
  'h-12 w-full rounded-[10px] border border-line bg-ash-900 px-3 text-base text-cream-50 focus:border-ember-600';

/**
 * Asks for the password, and holds it for exactly as long as it takes to use it.
 *
 * The value lives in component state, is cleared the moment the dialog closes,
 * and is never written to storage, a URL, a log or an error. The browser's own
 * password manager is welcome to it — that is what `autoComplete` is for — but
 * this app keeps nothing.
 */
export function VaultPasswordDialog({
  open,
  mode,
  error,
  busy = false,
  onSubmit,
  onCancel,
}: VaultPasswordDialogProps) {
  const titleId = useId();
  const passwordId = useId();
  const confirmId = useId();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);

  /*
   * Nothing typed survives the dialog being dismissed. Cleared during render
   * rather than in an effect, so the password never lingers for even one
   * committed frame after the dialog goes away.
   */
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) {
      setPassword('');
      setConfirmation('');
      setMismatch(false);
    }
  }

  const encrypting = mode === 'encrypt';
  const tooShort = password.length > 0 && password.length < MIN_VAULT_PASSWORD_LENGTH;

  function submit() {
    if (encrypting && password !== confirmation) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    onSubmit(password);
  }

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={encrypting ? 'Choose a password' : 'This backup is encrypted'}
      labelledById={titleId}
    >
      <p className="max-w-[52ch] text-sm leading-relaxed text-cream-300">
        {encrypting
          ? 'The backup is encrypted in this browser before it is saved. The password is never stored anywhere, which also means it cannot be recovered — without it the file cannot be opened again.'
          : 'Enter the password this backup was encrypted with. It is used here and kept nowhere.'}
      </p>

      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-char-500">
          {error}
        </p>
      )}

      <div className="mt-4 space-y-3">
        <div>
          <label htmlFor={passwordId} className="mb-1.5 block text-sm font-semibold text-cream-300">
            Password
          </label>
          <input
            id={passwordId}
            type="password"
            autoComplete={encrypting ? 'new-password' : 'current-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !encrypting) {
                event.preventDefault();
                submit();
              }
            }}
            className={FIELD}
          />
          {encrypting && (
            <p className="mt-1 text-xs text-cream-700">
              At least {MIN_VAULT_PASSWORD_LENGTH} characters.
            </p>
          )}
        </div>

        {encrypting && (
          <div>
            <label
              htmlFor={confirmId}
              className="mb-1.5 block text-sm font-semibold text-cream-300"
            >
              Confirm password
            </label>
            <input
              id={confirmId}
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className={FIELD}
            />
          </div>
        )}
      </div>

      {mismatch && (
        <p role="alert" className="mt-3 text-sm font-semibold text-char-500">
          Those two passwords are not the same.
        </p>
      )}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={submit}
          disabled={busy || password.length < MIN_VAULT_PASSWORD_LENGTH || tooShort}
        >
          {encrypting ? 'Encrypt and download' : 'Open the backup'}
        </Button>
      </div>
    </Dialog>
  );
}
