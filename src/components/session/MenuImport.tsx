'use client';

import { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { MAX_CUSTOM_FOODS } from '@/lib/customFoods';
import {
  IMPORT_TEMPLATE_FILENAME,
  MAX_IMPORT_BYTES,
  ROW_PROBLEM_MESSAGES,
  applyImportPlan,
  categoryLabel,
  importTemplateCsv,
  planCsvImport,
  type ConflictChoice,
  type ImportPlan,
} from '@/lib/menuImport';
import type { CustomFood } from '@/types/customFoods';

interface MenuImportProps {
  readonly foods: readonly CustomFood[];
  /** Applied in one call, so a menu is never left half-imported. */
  readonly onApply: (foods: readonly CustomFood[]) => void;
  readonly onStatus: (message: string) => void;
}

type Stage =
  | { readonly kind: 'idle' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'preview'; readonly plan: ImportPlan };

const CHOICES: readonly { readonly id: ConflictChoice; readonly label: string }[] = [
  { id: 'skip', label: 'Keep mine' },
  { id: 'separate', label: 'Keep both' },
  { id: 'replace', label: 'Replace mine' },
];

/**
 * Reads a chosen file as text, or resolves null.
 *
 * `FileReader` rather than `File.text()`: the promise-returning form is missing
 * from engines this project otherwise supports, and a menu import that silently
 * failed on one of them would be indistinguishable from a broken file. This
 * never rejects, so the caller has one path for "could not read it".
 */
function readAsText(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.onabort = () => resolve(null);
    try {
      reader.readAsText(file);
    } catch {
      resolve(null);
    }
  });
}

/** Hands the browser a file built in memory, and never leaks the object URL. */
function download(contents: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }));
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Bringing a personal menu in from a spreadsheet.
 *
 * Preview-first, like every other import in this app. The file is parsed and
 * reported on before anything is written: accepted rows, rejected rows with the
 * line number a spreadsheet would show, and any collision with a menu the diner
 * already has. Nothing local moves until they say so, and when they do it moves
 * in one call.
 */
export function MenuImport({ foods, onApply, onStatus }: MenuImportProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });
  const [choices, setChoices] = useState<Record<string, ConflictChoice>>({});

  async function handleFile(file: File) {
    if (file.size > MAX_IMPORT_BYTES) {
      setStage({ kind: 'error', message: 'That file is too large to be a menu.' });
      return;
    }

    const text = await readAsText(file);
    if (text === null) {
      setStage({ kind: 'error', message: 'That file could not be read on this device.' });
      return;
    }

    const plan = planCsvImport(text, foods);
    if (plan.accepted.length === 0 && plan.conflicts.length === 0 && plan.rejected.length === 0) {
      setStage({
        kind: 'error',
        message:
          'Nothing in that file looked like a menu. It needs a header row and one row per item.',
      });
      return;
    }

    // Every conflict starts on "keep mine": replacing something the diner
    // already has is a decision, never a default.
    setChoices(Object.fromEntries(plan.conflicts.map((row) => [row.existingId, 'skip' as const])));
    setStage({ kind: 'preview', plan });
  }

  function apply(plan: ImportPlan) {
    const menu = applyImportPlan(plan, foods, choices);
    onApply(menu);
    const added = menu.length - foods.length;
    onStatus(
      added > 0
        ? `${added} ${added === 1 ? 'item' : 'items'} added to your menu.`
        : 'Your menu was updated.',
    );
    setStage({ kind: 'idle' });
  }

  return (
    <section aria-labelledby="menu-import-heading" className="mt-4 border-t border-line-soft pt-4">
      <h3 id="menu-import-heading" className="micro-label mb-2 flex items-center gap-1.5">
        <FileSpreadsheet size={13} aria-hidden="true" />
        Import a menu
      </h3>
      <p className="max-w-[62ch] text-xs leading-relaxed text-cream-700">
        Bring your restaurant&rsquo;s prices in from a spreadsheet. The file is read on this device,
        shown to you first, and nothing is saved until you say so.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="ghost"
          size="md"
          onClick={() => {
            download(importTemplateCsv(), IMPORT_TEMPLATE_FILENAME);
            onStatus('Template downloaded.');
          }}
        >
          <Download size={16} aria-hidden="true" />
          Download the template
        </Button>
        <Button variant="secondary" size="md" onClick={() => inputRef.current?.click()}>
          <Upload size={16} aria-hidden="true" />
          Choose a CSV file
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          aria-label="Menu CSV file"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Cleared straight away so choosing the same file twice re-reads it.
            event.target.value = '';
            if (file) {
              void handleFile(file);
            }
          }}
        />
      </div>

      {stage.kind === 'error' && (
        <p role="alert" className="mt-3 text-sm font-semibold text-char-500">
          {stage.message}
        </p>
      )}

      {stage.kind === 'preview' && (
        <div className="mt-4 space-y-4 rounded-[10px] border border-line bg-ash-900/60 p-3">
          <p role="status" className="text-sm text-cream-200">
            {stage.plan.accepted.length} {stage.plan.accepted.length === 1 ? 'row is' : 'rows are'}{' '}
            ready to import
            {stage.plan.conflicts.length > 0 && `, ${stage.plan.conflicts.length} need a decision`}
            {stage.plan.rejected.length > 0 && `, ${stage.plan.rejected.length} could not be read`}.
          </p>

          {stage.plan.truncated && (
            <p className="text-xs leading-relaxed text-cream-700">
              Only the first rows of that file were read. It is longer than a menu is expected to
              be, so the rest was left alone rather than parsed.
            </p>
          )}

          {stage.plan.overCapacity && (
            <p className="text-xs leading-relaxed text-char-500">
              Your menu holds {MAX_CUSTOM_FOODS} items. Importing everything here would go past
              that, so the overflow will not be saved — trim the file if the order matters.
            </p>
          )}

          {stage.plan.accepted.length > 0 && (
            <div>
              <h4 className="micro-label mb-2">Ready to import</h4>
              <ul className="max-h-40 overflow-y-auto">
                {stage.plan.accepted.map((food) => (
                  <li
                    key={food.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line-soft py-1.5 text-sm last:border-b-0"
                  >
                    <span className="min-w-0 truncate text-cream-100">{food.name}</span>
                    <span className="text-xs text-cream-700">
                      {categoryLabel(food.category)} ·{' '}
                      {food.valuation === 'by-serving' ? 'per serving' : 'per kg'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {stage.plan.conflicts.length > 0 && (
            <div>
              <h4 className="micro-label mb-1">Already on your menu</h4>
              <p className="mb-2 max-w-[60ch] text-xs leading-relaxed text-cream-700">
                These names are taken. Nothing is replaced unless you choose it.
              </p>
              <ul className="space-y-2">
                {stage.plan.conflicts.map((conflict) => (
                  <li key={conflict.existingId} className="border-b border-line-soft pb-2">
                    <p className="text-sm text-cream-100">
                      {conflict.name}{' '}
                      <span className="text-xs text-cream-700">(row {conflict.line})</span>
                    </p>
                    <div
                      role="radiogroup"
                      aria-label={`What to do with ${conflict.name}`}
                      className="mt-1.5 flex flex-wrap gap-1.5"
                    >
                      {CHOICES.map((choice) => {
                        const active = (choices[conflict.existingId] ?? 'skip') === choice.id;
                        return (
                          <label
                            key={choice.id}
                            className={`min-h-9 cursor-pointer rounded-[8px] border px-2.5 py-1.5 text-xs font-semibold transition-colors duration-200 ${
                              active
                                ? 'border-ember-600 bg-ash-800 text-cream-50'
                                : 'border-line text-cream-500 hover:text-cream-200'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`conflict-${conflict.existingId}`}
                              value={choice.id}
                              checked={active}
                              onChange={() =>
                                setChoices((current) => ({
                                  ...current,
                                  [conflict.existingId]: choice.id,
                                }))
                              }
                              className="sr-only"
                            />
                            {choice.label}
                          </label>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {stage.plan.rejected.length > 0 && (
            <div>
              <h4 className="micro-label mb-2">Could not be read</h4>
              <ul className="max-h-40 overflow-y-auto">
                {stage.plan.rejected.map((row) => (
                  <li
                    key={`${row.line}-${row.problem}`}
                    className="border-b border-line-soft py-1.5 text-xs last:border-b-0"
                  >
                    <span className="text-cream-300">
                      Row {row.line}
                      {row.name && `, ${row.name}`}
                    </span>{' '}
                    <span className="text-cream-700">{ROW_PROBLEM_MESSAGES[row.problem]}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t border-line-soft pt-3">
            <Button variant="ghost" size="md" onClick={() => setStage({ kind: 'idle' })}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={stage.plan.accepted.length === 0 && stage.plan.conflicts.length === 0}
              onClick={() => apply(stage.plan)}
            >
              Import this menu
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
