'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Upload } from 'lucide-react';
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
import { loadFavorites, saveFavorites } from '@/lib/favorites';
import { formatRecordedAt } from '@/lib/formatting';
import { listSessions, putSessions, replaceSessions } from '@/lib/historyRepository';

type Stage =
  | { kind: 'idle' }
  | { kind: 'error'; message: string }
  | { kind: 'preview'; contents: BackupContents; summary: BackupSummary }
  | { kind: 'done'; message: string };

const BACK_LINK =
  '-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-2 text-xs font-semibold ' +
  'uppercase tracking-[0.1em] text-cream-500 transition-colors duration-200 hover:bg-ash-850 hover:text-cream-100';

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
  const [busy, setBusy] = useState(false);

  const handleExport = useCallback(async () => {
    setBusy(true);
    try {
      const now = new Date();
      const backup = buildBackup(await listSessions(), loadFavorites(), now.toISOString());

      const blob = new Blob([serialiseBackup(backup)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      try {
        const link = document.createElement('a');
        link.href = url;
        link.download = backupFilename(now);
        link.click();
      } finally {
        URL.revokeObjectURL(url);
      }

      setStage({
        kind: 'done',
        message: `Exported ${backup.history.length} sessions and ${backup.favorites.length} saved orders.`,
      });
    } finally {
      setBusy(false);
    }
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (file.size > MAX_BACKUP_BYTES) {
      setStage({ kind: 'error', message: BACKUP_ERROR_MESSAGES['too-large'] });
      return;
    }

    const parsed = parseBackup(await file.text());
    if (!parsed.ok) {
      setStage({ kind: 'error', message: BACKUP_ERROR_MESSAGES[parsed.error] });
      return;
    }
    setStage({ kind: 'preview', contents: parsed.contents, summary: parsed.summary });
  }, []);

  const applyRestore = useCallback(async (contents: BackupContents, mode: RestoreMode) => {
    setBusy(true);
    try {
      if (mode === 'replace') {
        await replaceSessions(contents.history);
        saveFavorites(contents.favorites);
        setStage({
          kind: 'done',
          message: `Replaced everything with ${contents.history.length} sessions and ${contents.favorites.length} saved orders.`,
        });
        return;
      }

      const history = mergeById(await listSessions(), contents.history);
      const favorites = mergeById(loadFavorites(), contents.favorites);
      await putSessions(history.result);
      saveFavorites(favorites.result);

      setStage({
        kind: 'done',
        message: `Added ${history.added} sessions and ${favorites.added} saved orders. Nothing already here was changed.`,
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
          Writes every filed session and saved order to a single JSON file. Keep it somewhere safe —
          it is the only copy of data that otherwise never leaves this browser.
        </p>
        <Button variant="secondary" onClick={() => void handleExport()} disabled={busy}>
          <Download size={16} aria-hidden="true" />
          Download backup
        </Button>
      </section>

      <section aria-labelledby="import-heading" className="panel p-4 sm:p-5">
        <h2 id="import-heading" className="micro-label mb-2">
          Restore
        </h2>
        <p className="mb-4 max-w-[56ch] text-sm leading-relaxed text-cream-300">
          Choose a backup file. Nothing is written until you have seen what it contains and chosen
          how to apply it.
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
              <li className="text-xs text-cream-700">
                Exported {formatRecordedAt(stage.contents.exportedAt)}
              </li>
            </ul>

            {(stage.summary.skippedHistory > 0 || stage.summary.skippedFavorites > 0) && (
              <p className="mt-3 text-xs text-ember-400">
                {stage.summary.skippedHistory} sessions and {stage.summary.skippedFavorites} saved
                orders in the file could not be read and will be left out.
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
              discards what is here first.
            </p>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={pendingReplace !== null}
        title="Replace everything on this device?"
        body="Every filed session and saved order currently on this device will be permanently discarded and replaced with the contents of the backup. It cannot be undone."
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
