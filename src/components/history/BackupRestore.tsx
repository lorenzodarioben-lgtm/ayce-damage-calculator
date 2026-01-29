'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, FileSpreadsheet, Lock, Upload } from 'lucide-react';
import { VaultPasswordDialog } from '@/components/history/VaultPasswordDialog';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  BACKUP_ERROR_MESSAGES,
  MAX_BACKUP_BYTES,
  backupFilename,
  buildBackup,
  mergeById,
  parseBackup,
  serialiseBackup,
  type BackupContents,
  type BackupSummary,
  type RestoreMode,
} from '@/lib/backup';
import { csvFilename, historyToCsv } from '@/lib/csv';
import {
  MAX_VAULT_BYTES,
  VAULT_ERROR_MESSAGES,
  decryptBackup,
  encryptBackup,
  isEncryptedBackup,
  vaultFilename,
} from '@/lib/encryptedBackup';
import { loadCustomFoods, saveCustomFoods } from '@/lib/customFoods';
import { loadFavorites, saveFavorites } from '@/lib/favorites';
import { foodCatalogue } from '@/lib/foodCatalogue';
import { formatRecordedAt } from '@/lib/formatting';
import { listSessions, putSessions, replaceSessions } from '@/lib/historyRepository';
import { loadRestaurants, saveRestaurants } from '@/lib/restaurants';
import { loadPricingProfiles, savePricingProfiles } from '@/lib/pricingProfiles';

type Stage =
  | { kind: 'idle' }
  | { kind: 'error'; message: string }
  | { kind: 'preview'; contents: BackupContents; summary: BackupSummary }
  | { kind: 'done'; message: string };

/** What the password dialog is currently being asked for, if anything. */
type PasswordPrompt =
  | { kind: 'none' }
  | { kind: 'encrypt' }
  | { kind: 'decrypt'; raw: string; error: string | null };

const BACK_LINK =
  '-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-2 text-xs font-semibold ' +
  'uppercase tracking-[0.1em] text-cream-500 transition-colors duration-200 hover:bg-ash-850 hover:text-cream-100';

/** Hands the browser a file built in memory, and never leaks the object URL. */
function download(contents: string, type: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

function configurationCount(contents: BackupContents): number {
  return (
    contents.configuration.pricingProfiles.length +
    contents.configuration.customFoods.length +
    contents.configuration.restaurants.length
  );
}

/**
 * Export and restore, with the file previewed before anything is written.
 *
 * Restoring is a two-step action on purpose: the file is parsed and summarised
 * first, and only a deliberate choice between merging and replacing commits it.
 */
export function BackupRestore() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });
  const [pendingReplace, setPendingReplace] = useState<BackupContents | null>(null);
  const [prompt, setPrompt] = useState<PasswordPrompt>({ kind: 'none' });
  const [busy, setBusy] = useState(false);

  const handleExport = useCallback(async () => {
    setBusy(true);
    try {
      const now = new Date();
      const customFoods = loadCustomFoods();
      const backup = buildBackup(
        await listSessions(),
        loadFavorites(foodCatalogue(customFoods)),
        now.toISOString(),
        {
          pricingProfiles: loadPricingProfiles(),
          customFoods,
          restaurants: loadRestaurants(),
        },
      );

      download(serialiseBackup(backup), 'application/json', backupFilename(now));

      setStage({
        kind: 'done',
        message: `Exported ${backup.history.length} sessions, ${backup.favorites.length} saved orders and ${configurationCount(backup)} menu settings.`,
      });
    } finally {
      setBusy(false);
    }
  }, []);

  /**
   * Builds the same payload the plain export writes, then wraps it.
   *
   * Encrypting the serialised backup rather than a second structure means the
   * two exports are provably the same file with one of them sealed.
   */
  const handleEncryptedExport = useCallback(async (password: string) => {
    setBusy(true);
    try {
      const now = new Date();
      const customFoods = loadCustomFoods();
      const backup = buildBackup(
        await listSessions(),
        loadFavorites(foodCatalogue(customFoods)),
        now.toISOString(),
        {
          pricingProfiles: loadPricingProfiles(),
          customFoods,
          restaurants: loadRestaurants(),
        },
      );

      const sealed = await encryptBackup(serialiseBackup(backup), password, now.toISOString());
      if (!sealed.ok) {
        setPrompt({ kind: 'none' });
        setStage({ kind: 'error', message: VAULT_ERROR_MESSAGES[sealed.error] });
        return;
      }

      download(sealed.file, 'application/json', vaultFilename(now));
      setPrompt({ kind: 'none' });
      setStage({
        kind: 'done',
        message: `Encrypted ${backup.history.length} sessions, ${backup.favorites.length} saved orders and ${configurationCount(backup)} menu settings. Keep the password safe — it cannot be recovered.`,
      });
    } finally {
      setBusy(false);
    }
  }, []);

  const handleExportCsv = useCallback(async () => {
    setBusy(true);
    try {
      const now = new Date();
      const history = await listSessions();

      download(historyToCsv(history), 'text/csv;charset=utf-8', csvFilename(now));

      setStage({
        kind: 'done',
        message: `Wrote ${history.length} sessions to a spreadsheet, one row per plate.`,
      });
    } finally {
      setBusy(false);
    }
  }, []);

  /** Runs the ordinary validation, whether the bytes arrived plain or sealed. */
  const previewPlainBackup = useCallback((raw: string) => {
    const parsed = parseBackup(raw);
    if (!parsed.ok) {
      setStage({ kind: 'error', message: BACKUP_ERROR_MESSAGES[parsed.error] });
      return;
    }
    setStage({ kind: 'preview', contents: parsed.contents, summary: parsed.summary });
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_VAULT_BYTES) {
        setStage({ kind: 'error', message: BACKUP_ERROR_MESSAGES['too-large'] });
        return;
      }

      const raw = await file.text();

      // An encrypted file is recognised before the user is asked for anything.
      if (isEncryptedBackup(raw)) {
        setStage({ kind: 'idle' });
        setPrompt({ kind: 'decrypt', raw, error: null });
        return;
      }
      if (raw.length > MAX_BACKUP_BYTES) {
        setStage({ kind: 'error', message: BACKUP_ERROR_MESSAGES['too-large'] });
        return;
      }
      previewPlainBackup(raw);
    },
    [previewPlainBackup],
  );

  /**
   * Opens a sealed file, then validates the result exactly like a plain one.
   *
   * Nothing is written at any point here: a failure to authenticate, or a
   * decrypted payload that turns out not to be a backup, leaves the device
   * untouched and the preview unopened.
   */
  const handleDecrypt = useCallback(
    async (raw: string, password: string) => {
      setBusy(true);
      try {
        const opened = await decryptBackup(raw, password);
        if (!opened.ok) {
          setPrompt({ kind: 'decrypt', raw, error: VAULT_ERROR_MESSAGES[opened.error] });
          return;
        }
        setPrompt({ kind: 'none' });
        previewPlainBackup(opened.plaintext);
      } finally {
        setBusy(false);
      }
    },
    [previewPlainBackup],
  );

  const applyRestore = useCallback(async (contents: BackupContents, mode: RestoreMode) => {
    setBusy(true);
    try {
      if (mode === 'replace') {
        await replaceSessions(contents.history);
        savePricingProfiles(contents.configuration.pricingProfiles);
        saveCustomFoods(contents.configuration.customFoods);
        saveRestaurants(contents.configuration.restaurants);
        saveFavorites(contents.favorites);
        setStage({
          kind: 'done',
          message: `Replaced everything with ${contents.history.length} sessions, ${contents.favorites.length} saved orders and ${configurationCount(contents)} menu settings.`,
        });
        return;
      }

      const history = mergeById(await listSessions(), contents.history);
      const existingCustomFoods = loadCustomFoods();
      const pricingProfiles = mergeById(
        loadPricingProfiles(),
        contents.configuration.pricingProfiles,
      );
      const customFoods = mergeById(existingCustomFoods, contents.configuration.customFoods);
      const restaurants = mergeById(loadRestaurants(), contents.configuration.restaurants);
      const favorites = mergeById(
        loadFavorites(foodCatalogue(existingCustomFoods)),
        contents.favorites,
      );
      await putSessions(history.result);
      savePricingProfiles(pricingProfiles.result);
      saveCustomFoods(customFoods.result);
      saveRestaurants(restaurants.result);
      saveFavorites(favorites.result);

      setStage({
        kind: 'done',
        message: `Added ${history.added} sessions, ${favorites.added} saved orders and ${pricingProfiles.added + customFoods.added + restaurants.added} menu settings. Nothing already here was changed.`,
      });
    } finally {
      setBusy(false);
      if (fileInput.current) {
        fileInput.current.value = '';
      }
    }
  }, []);

  return (
    <div className="space-y-6">
      <Link href="/history" className={BACK_LINK}>
        <ArrowLeft size={15} aria-hidden="true" />
        Back to the file
      </Link>

      <section aria-labelledby="export-heading" className="panel p-4 sm:p-5">
        <h2 id="export-heading" className="micro-label mb-2">
          Export
        </h2>
        <p className="mb-4 max-w-[56ch] text-sm leading-relaxed text-cream-300">
          Writes every filed session, saved order and personal menu setting to a single JSON file.
          Keep it somewhere safe — it is the only copy of data that otherwise never leaves this
          browser.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void handleExport()} disabled={busy}>
            <Download size={16} aria-hidden="true" />
            Download backup
          </Button>
          {/* The same contents, sealed. Offered beside the plain export rather
              than replacing it: an unencrypted file is still the easiest thing
              to read back in five years. */}
          <Button
            variant="secondary"
            onClick={() => setPrompt({ kind: 'encrypt' })}
            disabled={busy}
          >
            <Lock size={16} aria-hidden="true" />
            Download encrypted backup
          </Button>
          {/* A second format, for a different job: the JSON file restores this
              app, the CSV takes the numbers somewhere else. */}
          <Button variant="secondary" onClick={() => void handleExportCsv()} disabled={busy}>
            <FileSpreadsheet size={16} aria-hidden="true" />
            Download spreadsheet
          </Button>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-cream-700">
          The spreadsheet is history only, one row per plate, and cannot be restored from. Saved
          orders, menu settings and the ability to restore live in the JSON backup. The encrypted
          backup holds exactly the same contents, sealed with a key this browser derives from your
          password and then forgets — the password is stored nowhere, cannot be recovered, and the
          file cannot be opened without it.
        </p>
      </section>

      <section aria-labelledby="import-heading" className="panel p-4 sm:p-5">
        <h2 id="import-heading" className="micro-label mb-2">
          Restore
        </h2>
        <p className="mb-4 max-w-[56ch] text-sm leading-relaxed text-cream-300">
          Choose a backup file, plain or encrypted. An encrypted one asks for its password first.
          Either way, nothing is written until you have seen what it contains and chosen how to
          apply it.
        </p>

        <label htmlFor="backup-file" className="mb-1.5 block text-sm font-semibold text-cream-300">
          Backup file
        </label>
        <input
          ref={fileInput}
          id="backup-file"
          type="file"
          accept="application/json,.json"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void handleFile(file);
            }
          }}
          className="block w-full cursor-pointer rounded-[10px] border border-line bg-ash-900 p-3 text-sm text-cream-300 file:mr-3 file:cursor-pointer file:rounded-[8px] file:border-0 file:bg-ash-800 file:px-3 file:py-2 file:text-xs file:font-semibold file:uppercase file:tracking-[0.1em] file:text-cream-100"
        />

        {stage.kind === 'error' && (
          <p role="alert" className="mt-4 text-sm font-semibold text-char-500">
            {stage.message}
          </p>
        )}

        {stage.kind === 'done' && (
          <p role="status" className="mt-4 text-sm text-sesame-400">
            {stage.message}
          </p>
        )}

        {stage.kind === 'preview' && (
          <div className="mt-4 rounded-[10px] border border-line-ember bg-ash-900 p-4">
            <p className="micro-label">In this file</p>
            <ul className="tabular mt-2 space-y-1 text-sm text-cream-100">
              <li>{stage.contents.history.length} filed sessions</li>
              <li>{stage.contents.favorites.length} saved orders</li>
              <li>{stage.contents.configuration.pricingProfiles.length} pricing profiles</li>
              <li>{stage.contents.configuration.customFoods.length} custom foods</li>
              <li>{stage.contents.configuration.restaurants.length} saved restaurants</li>
              <li className="text-xs text-cream-700">
                Exported {formatRecordedAt(stage.contents.exportedAt)}
              </li>
            </ul>

            {(stage.summary.skippedHistory > 0 ||
              stage.summary.skippedFavorites > 0 ||
              stage.summary.skippedPricingProfiles > 0 ||
              stage.summary.skippedCustomFoods > 0 ||
              stage.summary.skippedRestaurants > 0) && (
              <p className="mt-3 text-xs text-ember-400">
                {stage.summary.skippedHistory} sessions and {stage.summary.skippedFavorites} saved
                orders, {stage.summary.skippedPricingProfiles} pricing profiles,{' '}
                {stage.summary.skippedCustomFoods} custom foods and{' '}
                {stage.summary.skippedRestaurants} saved restaurants in the file could not be read
                and will be left out.
              </p>
            )}

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button
                variant="secondary"
                onClick={() => void applyRestore(stage.contents, 'merge')}
                disabled={busy}
              >
                <Upload size={16} aria-hidden="true" />
                Merge into this device
              </Button>
              <Button
                variant="danger"
                onClick={() => setPendingReplace(stage.contents)}
                disabled={busy}
              >
                Replace everything
              </Button>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-cream-700">
              Merging keeps everything already on this device and adds anything new. Replacing
              discards the current history, saved orders and menu settings first.
            </p>
          </div>
        )}
      </section>

      <VaultPasswordDialog
        open={prompt.kind !== 'none'}
        mode={prompt.kind === 'decrypt' ? 'decrypt' : 'encrypt'}
        error={prompt.kind === 'decrypt' ? prompt.error : null}
        busy={busy}
        onSubmit={(password) => {
          if (prompt.kind === 'encrypt') {
            void handleEncryptedExport(password);
          } else if (prompt.kind === 'decrypt') {
            void handleDecrypt(prompt.raw, password);
          }
        }}
        onCancel={() => {
          setPrompt({ kind: 'none' });
          if (fileInput.current) {
            fileInput.current.value = '';
          }
        }}
      />

      <ConfirmDialog
        open={pendingReplace !== null}
        title="Replace everything on this device?"
        body="Every filed session, saved order and menu setting currently on this device will be permanently discarded and replaced with the contents of the backup. It cannot be undone."
        confirmLabel="Replace everything"
        cancelLabel="Keep what I have"
        onConfirm={() => {
          const contents = pendingReplace;
          setPendingReplace(null);
          if (contents) {
            void applyRestore(contents, 'replace');
          }
        }}
        onCancel={() => setPendingReplace(null)}
      />
    </div>
  );
}
