'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, RotateCcw, X } from 'lucide-react';
import { MealReplay, UntimedMealNotice } from '@/components/history/MealReplay';
import { UncertaintyPanel } from '@/components/methodology/UncertaintyPanel';
import { AchievementList } from '@/components/results/AchievementList';
import { MealBreakdown } from '@/components/results/MealBreakdown';
import { ReportSummary } from '@/components/results/ReportSummary';
import { PricingProfileProvider } from '@/components/session/PricingContext';
import { Button, EMPTY_STATE_LINK } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatPlates, formatRecordedAt } from '@/lib/formatting';
import {
  hasRecordedTimeline,
  resolveSavedSession,
  sessionFromSaved,
  type ResolvedSavedSession,
} from '@/lib/history';
import { foodCatalogue } from '@/lib/foodCatalogue';
import { buildMealReplay } from '@/lib/replay';
import { getSession } from '@/lib/historyRepository';
import { updateSessionTags } from '@/lib/historyRepository';
import { MAX_SESSION_TAGS, normaliseSessionTag, parseSessionTags } from '@/lib/sessionTags';
import { loadSession, saveSession as saveActiveSession } from '@/lib/storage';
import type { SavedMealSession } from '@/types/history';

type LoadState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'found'; resolved: ResolvedSavedSession };

const BACK_LINK =
  '-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-2 text-xs font-semibold ' +
  'uppercase tracking-[0.1em] text-cream-500 transition-colors duration-200 hover:bg-ash-850 hover:text-cream-100';

/**
 * A filed session, rendered read-only.
 *
 * The record is looked up on the client because history never leaves the
 * device; there is nothing for a server to render.
 */
export function HistoryDetail({ id }: { id: string }) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [pendingRerun, setPendingRerun] = useState<SavedMealSession | null>(null);
  const [tagDraft, setTagDraft] = useState('');
  const [tagStatus, setTagStatus] = useState('');
  const [savingTags, setSavingTags] = useState(false);

  /**
   * Loads the filed meal into the calculator and hands the diner over to it.
   *
   * The record itself is untouched: it is copied into the in-progress session,
   * which is the same versioned envelope the calculator writes itself, so the
   * calculator hydrates from it on arrival with nothing special to know.
   */
  const rerun = useCallback(
    (record: SavedMealSession) => {
      saveActiveSession(sessionFromSaved(record));
      router.push('/');
    },
    [router],
  );

  const handleRerun = useCallback(
    (record: SavedMealSession) => {
      const current = loadSession();
      // Overwriting plates someone is in the middle of eating is not a thing to
      // do quietly.
      if (current && current.items.length > 0) {
        setPendingRerun(record);
        return;
      }
      rerun(record);
    },
    [rerun],
  );

  useEffect(() => {
    let cancelled = false;

    void getSession(id).then((record) => {
      if (cancelled) {
        return;
      }
      setState(
        record ? { status: 'found', resolved: resolveSavedSession(record) } : { status: 'missing' },
      );
    });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.status === 'loading') {
    return (
      <p role="status" className="py-16 text-center text-sm text-cream-700">
        Retrieving the record…
      </p>
    );
  }

  if (state.status === 'missing') {
    return (
      <div className="panel border-dashed px-6 py-14 text-center">
        <p className="display-type text-2xl text-cream-300">No such record.</p>
        <p className="mx-auto mt-3 max-w-[44ch] text-sm leading-relaxed text-cream-700">
          This session is not in the file on this device. It may have been deleted, or filed in a
          different browser.
        </p>
        <Link href="/history" className={EMPTY_STATE_LINK}>
          Back to the file
        </Link>
      </div>
    );
  }

  const { record, report, verdict, achievements } = state.resolved;

  const saveTags = async (tags: readonly string[]) => {
    setSavingTags(true);
    const updated = await updateSessionTags(record.id, tags);
    setSavingTags(false);
    if (!updated) {
      setTagStatus('Tags could not be saved on this device.');
      return;
    }
    setState((current) =>
      current.status === 'found'
        ? { ...current, resolved: { ...current.resolved, record: updated } }
        : current,
    );
    setTagStatus('Tags saved locally.');
  };

  const addTag = () => {
    const tag = normaliseSessionTag(tagDraft);
    if (!tag) {
      setTagStatus('Enter a tag of up to 32 characters.');
      return;
    }
    if (record.tags.includes(tag)) {
      setTagStatus('That tag is already on this record.');
      return;
    }
    if (record.tags.length >= MAX_SESSION_TAGS) {
      setTagStatus(`A record can have up to ${MAX_SESSION_TAGS} tags.`);
      return;
    }
    setTagDraft('');
    void saveTags(parseSessionTags([...record.tags, tag]));
  };

  return (
    <PricingProfileProvider profile={record.pricingProfile}>
      <div className="animate-fade-up space-y-6">
        <Link href="/history" className={BACK_LINK}>
          <ArrowLeft size={15} aria-hidden="true" />
          Back to the file
        </Link>

        <ReportSummary
          report={report}
          verdict={verdict}
          restaurantName={record.restaurantName}
          heading="Filed Damage Report"
          headingId="saved-report-heading"
          headingLevel={1}
          subheading={`Recorded ${formatRecordedAt(record.createdAt)}`}
        />

        {record.note && (
          <section aria-labelledby="saved-note-heading" className="panel p-4 sm:p-5">
            <h3 id="saved-note-heading" className="micro-label mb-2">
              Note on file
            </h3>
            <p className="break-words text-sm leading-relaxed text-cream-300">{record.note}</p>
          </section>
        )}

        <section aria-labelledby="saved-tags-heading" className="panel p-4 sm:p-5">
          <h3 id="saved-tags-heading" className="micro-label mb-2">
            Tags
          </h3>
          <p className="mb-3 text-sm leading-relaxed text-cream-500">
            Add a few labels to make this local record easier to find later.
          </p>
          {record.tags.length > 0 && (
            <ul aria-label="Current tags" className="mb-3 flex flex-wrap gap-2">
              {record.tags.map((tag) => (
                <li
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full border border-line-ember bg-ash-900 py-1 pl-3 pr-1 text-sm text-ember-400"
                >
                  {tag}
                  <button
                    type="button"
                    disabled={savingTags}
                    onClick={() => void saveTags(record.tags.filter((current) => current !== tag))}
                    aria-label={`Remove tag ${tag}`}
                    className="flex size-7 cursor-pointer items-center justify-center rounded-full text-cream-500 hover:bg-ash-800 hover:text-cream-100 disabled:cursor-not-allowed"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="session-tag" className="sr-only">
              New tag
            </label>
            <input
              id="session-tag"
              value={tagDraft}
              maxLength={32}
              disabled={savingTags || record.tags.length >= MAX_SESSION_TAGS}
              onChange={(event) => setTagDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addTag();
                }
              }}
              placeholder="Birthday, friends, lunch…"
              className="min-h-11 min-w-0 flex-1 rounded-[10px] border border-line bg-ash-900 px-3 text-sm text-cream-100 placeholder:text-cream-700"
            />
            <Button
              variant="secondary"
              onClick={addTag}
              disabled={savingTags || record.tags.length >= MAX_SESSION_TAGS}
            >
              <Plus size={16} aria-hidden="true" />
              Add tag
            </Button>
          </div>
          <p role="status" className="mt-2 min-h-5 text-xs text-cream-700">
            {tagStatus}
          </p>
        </section>

        {/* Read from the record, so a session shows what it earned at the time. */}
        <AchievementList achievements={achievements} headingId="saved-achievements-heading" />

        <MealBreakdown lines={report.lines} headingId="recorded-plates-heading" />

        <UncertaintyPanel
          items={record.items}
          pricePerDiner={record.pricePerDiner}
          dinerCount={record.dinerCount}
          diners={record.diners}
          adjustments={record.adjustments}
          foods={foodCatalogue(record.customFoods)}
          headingId="saved-uncertainty-heading"
        />

        {/* The ordinary report above is unchanged; the replay is an addition to
            it, and a record filed before the ledger existed says so plainly. */}
        {hasRecordedTimeline(record) ? (
          <MealReplay replay={buildMealReplay(record)} record={record} headingId="replay-heading" />
        ) : (
          <UntimedMealNotice headingId="replay-heading" />
        )}

        {/* The point of keeping a record of a good order is being able to place
          it again. */}
        <Button variant="secondary" size="lg" fullWidth onClick={() => handleRerun(record)}>
          <RotateCcw size={18} aria-hidden="true" />
          Order this again
        </Button>

        <ConfirmDialog
          open={pendingRerun !== null}
          title="Replace the meal in progress?"
          body={`There is already a tab open in the calculator. Loading this record replaces it with ${formatPlates(report.totalPlates)} from ${record.restaurantName || 'an unnamed restaurant'}. The filed record itself is not changed.`}
          confirmLabel="Load this meal"
          cancelLabel="Keep my tab"
          onConfirm={() => {
            const target = pendingRerun;
            setPendingRerun(null);
            if (target) {
              rerun(target);
            }
          }}
          onCancel={() => setPendingRerun(null)}
        />
      </div>
    </PricingProfileProvider>
  );
}
