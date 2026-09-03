'use client';

import { useId, useState } from 'react';
import { ArrowDown, ArrowUp, Save, Trash2, UserPlus, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { createId } from '@/lib/id';
import { MAX_PRICE_PER_DINER, MIN_PRICE_PER_DINER } from '@/lib/constants';
import { nextRegularDinerId, type RegularDiner } from '@/lib/regularDiners';
import type { Diner, MealSession } from '@/types/meal';

interface TableRosterProps {
  readonly session: MealSession;
  readonly regularDiners: readonly RegularDiner[];
  readonly onAdd: (diner: Diner) => void;
  readonly onRename: (id: string, displayName: string) => void;
  readonly onAdmissionPriceChange: (id: string, value: number | undefined) => void;
  readonly onRemove: (id: string) => void;
  readonly onMove: (id: string, direction: -1 | 1) => void;
  readonly onClear: () => void;
  readonly onSaveRegular: (diner: RegularDiner) => void;
  readonly onStatus: (message: string) => void;
}

/** Optional attribution setup; the ordinary shared-table calculator needs none. */
export function TableRoster({
  session,
  regularDiners,
  onAdd,
  onRename,
  onAdmissionPriceChange,
  onRemove,
  onMove,
  onClear,
  onSaveRegular,
  onStatus,
}: TableRosterProps) {
  const inputId = useId();
  const [name, setName] = useState('');
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const diners = session.diners ?? [];
  const usedIds = new Set(diners.map((diner) => diner.id));

  function add(diner: Diner, message: string) {
    onAdd(diner);
    onStatus(message);
  }

  function addNamed(saveToDirectory: boolean) {
    const displayName = name.replace(/\s+/g, ' ').trim();
    if (!displayName) {
      onStatus('Enter a diner name first.');
      return;
    }
    const id = saveToDirectory
      ? nextRegularDinerId(regularDiners, displayName)
      : `diner-${createId()}`;
    const diner = { id, displayName };
    add(diner, `${displayName} joined this table.`);
    if (saveToDirectory) {
      onSaveRegular(diner);
      onStatus(`${displayName} joined the table and was saved locally.`);
    }
    setName('');
  }

  function remove(id: string) {
    const diner = diners.find((entry) => entry.id === id);
    if (!diner) return;
    const hasAllocations = session.items.some((item) =>
      item.allocations?.some((allocation) => allocation.dinerId === id),
    );
    if (hasAllocations) {
      setPendingRemoval(id);
      return;
    }
    onRemove(id);
    onStatus(`${diner.displayName} was removed from this table.`);
  }

  const unusedRegulars = regularDiners.filter((diner) => !usedIds.has(diner.id));

  return (
    <section aria-labelledby="table-roster-heading" className="mt-5 border-t border-line pt-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            id="table-roster-heading"
            className="flex items-center gap-2 text-sm font-semibold text-cream-200"
          >
            <UsersRound size={17} aria-hidden="true" />
            Table roster
          </h3>
          <p className="mt-1 max-w-[62ch] text-xs leading-relaxed text-cream-700">
            Optional. Add people only when you want to attribute plates; otherwise everything stays
            with the Table.
          </p>
        </div>
        {diners.length > 0 && (
          <Button variant="danger" size="sm" onClick={() => setClearOpen(true)}>
            Clear roster
          </Button>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor={inputId}>
          Diner name
        </label>
        <input
          id={inputId}
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addNamed(false);
            }
          }}
          maxLength={40}
          placeholder="Add a diner"
          className="h-11 min-w-0 flex-1 rounded-[10px] border border-line bg-ash-900 px-3 text-sm text-cream-50 placeholder:text-cream-700 focus:border-ember-600"
        />
        <Button variant="secondary" size="md" onClick={() => addNamed(false)}>
          <UserPlus size={16} aria-hidden="true" />
          Add
        </Button>
        <Button variant="ghost" size="md" onClick={() => addNamed(true)}>
          <Save size={16} aria-hidden="true" />
          Add &amp; save
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            add(
              { id: `diner-${createId()}`, displayName: `Diner ${diners.length + 1}` },
              'Anonymous diner added.',
            )
          }
        >
          Add anonymous diner
        </Button>
        {unusedRegulars.map((diner) => (
          <Button
            key={diner.id}
            variant="ghost"
            size="sm"
            onClick={() => add(diner, `${diner.displayName} joined this table.`)}
          >
            + {diner.displayName}
          </Button>
        ))}
      </div>

      {diners.length === 0 ? (
        <p className="mt-4 rounded-[10px] bg-ash-900 px-3 py-3 text-sm text-cream-500">
          No one is being tracked individually. Food you log remains shared by the table.
        </p>
      ) : (
        <ol className="mt-4 space-y-2">
          {diners.map((diner, index) => (
            <li key={diner.id} className="flex items-center gap-2 rounded-[10px] bg-ash-900 p-2">
              <span className="w-5 text-center text-xs font-bold text-ember-400">{index + 1}</span>
              <label className="sr-only" htmlFor={`diner-name-${diner.id}`}>
                Diner {index + 1} name
              </label>
              <input
                id={`diner-name-${diner.id}`}
                value={diner.displayName}
                onChange={(event) => onRename(diner.id, event.target.value)}
                autoComplete="off"
                className="h-9 min-w-0 flex-1 rounded-[8px] border border-line bg-ash-850 px-2 text-sm text-cream-100 focus:border-ember-600"
              />
              <label className="sr-only" htmlFor={`diner-admission-${diner.id}`}>
                {diner.displayName} admission price
              </label>
              <input
                id={`diner-admission-${diner.id}`}
                type="number"
                inputMode="decimal"
                min={MIN_PRICE_PER_DINER}
                max={MAX_PRICE_PER_DINER}
                step="0.10"
                value={diner.admissionPrice ?? ''}
                onChange={(event) => {
                  const raw = event.target.value;
                  const value = raw.trim() === '' ? undefined : Number.parseFloat(raw);
                  onAdmissionPriceChange(diner.id, Number.isFinite(value) ? value : undefined);
                }}
                placeholder="Default"
                className="h-9 w-24 rounded-[8px] border border-line bg-ash-850 px-2 text-right text-sm text-cream-100 placeholder:text-cream-700 focus:border-ember-600"
              />
              <div className="flex shrink-0">
                <button
                  type="button"
                  onClick={() => onMove(diner.id, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${diner.displayName} up`}
                  className="flex size-9 cursor-pointer items-center justify-center rounded-[8px] text-cream-500 hover:bg-ash-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ArrowUp size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onMove(diner.id, 1)}
                  disabled={index === diners.length - 1}
                  aria-label={`Move ${diner.displayName} down`}
                  className="flex size-9 cursor-pointer items-center justify-center rounded-[8px] text-cream-500 hover:bg-ash-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ArrowDown size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(diner.id)}
                  aria-label={`Remove ${diner.displayName} from this table`}
                  className="flex size-9 cursor-pointer items-center justify-center rounded-[8px] text-char-500 hover:bg-char-700/25"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <ConfirmDialog
        open={pendingRemoval !== null}
        title="Move plates back to the table?"
        body="Removing this diner keeps every plate on the tab. Their attributed plates become shared Table plates."
        confirmLabel="Remove diner"
        cancelLabel="Keep diner"
        onConfirm={() => {
          const diner = diners.find((entry) => entry.id === pendingRemoval);
          if (pendingRemoval && diner) {
            onRemove(pendingRemoval);
            onStatus(`${diner.displayName}'s plates are now shared by the table.`);
          }
          setPendingRemoval(null);
        }}
        onCancel={() => setPendingRemoval(null)}
      />
      <ConfirmDialog
        open={clearOpen}
        title="Clear this table roster?"
        body="Every diner-specific allocation will remain on the tab as a shared Table plate."
        confirmLabel="Clear roster"
        cancelLabel="Keep roster"
        onConfirm={() => {
          onClear();
          onStatus('Roster cleared. All plates are shared by the table.');
          setClearOpen(false);
        }}
        onCancel={() => setClearOpen(false)}
      />
    </section>
  );
}
