import { describe, expect, it } from 'vitest';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  MAX_BACKUP_BYTES,
  backupFilename,
  buildBackup,
  mergeById,
  parseBackup,
  serialiseBackup,
} from '@/lib/backup';
import { buildDamageReport } from '@/lib/calculations';
import { createFavorite, type MealFavorite } from '@/lib/favorites';
import { createSavedSession } from '@/lib/history';
import { getVerdict } from '@/lib/verdicts';
import type { SavedMealSession } from '@/types/history';
import type { MealItem, MealSession } from '@/types/meal';

const AT = '2026-08-16T12:00:00.000Z';

function item(foodId = 'beef-ribeye', quantity = 2): MealItem {
  return {
    id: `${foodId}__standard__regular`,
    foodId,
    quality: 'standard',
    plateSize: 'regular',
    quantity,
  };
}

function record(id: string, overrides: Partial<MealSession> = {}): SavedMealSession {
  const session: MealSession = {
    restaurantName: 'Seoul Garden',
    pricePerDiner: 59.9,
    dinerCount: 1,
    items: [item()],
    ...overrides,
  };
  const report = buildDamageReport(session.items, session);
  return createSavedSession(
    session,
    report,
    getVerdict(report.totalRetailValue, report.totalAdmission),
    { id, createdAt: AT },
  );
}

const RIBEYE_FAVORITE = createFavorite(
  { foodId: 'beef-ribeye', quality: 'premium', plateSize: 'large' },
  AT,
);
const PORK_FAVORITE = createFavorite(
  { foodId: 'pork-belly', quality: 'standard', plateSize: 'regular' },
  AT,
);

function exported(
  history: readonly SavedMealSession[] = [record('a')],
  favorites: readonly MealFavorite[] = [RIBEYE_FAVORITE],
): string {
  return serialiseBackup(buildBackup(history, favorites, AT));
}

describe('backupFilename', () => {
  it('is dated and clearly ours', () => {
    expect(backupFilename(new Date('2026-08-16T12:00:00.000Z'))).toMatch(
      /^ayce-damage-backup-2026-08-\d{2}\.json$/,
    );
  });

  it('pads single-digit months and days', () => {
    expect(backupFilename(new Date(2026, 0, 5))).toBe('ayce-damage-backup-2026-01-05.json');
  });

  it('does not produce a broken name for an invalid date', () => {
    expect(backupFilename(new Date('nonsense'))).toBe('ayce-damage-backup-unknown-date.json');
  });
});

describe('Round trip', () => {
  it('restores exactly what was exported', () => {
    const history = [record('a'), record('b', { dinerCount: 3 })];
    const favorites = [RIBEYE_FAVORITE, PORK_FAVORITE];

    const parsed = parseBackup(exported(history, favorites));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.contents.history).toEqual(history);
    expect(parsed.contents.favorites).toEqual(favorites);
    expect(parsed.contents.exportedAt).toBe(AT);
    expect(parsed.summary).toEqual({ skippedHistory: 0, skippedFavorites: 0 });
  });

  it('stamps the file with the format and version', () => {
    const backup = buildBackup([record('a')], [], AT);

    expect(backup.format).toBe(BACKUP_FORMAT);
    expect(backup.version).toBe(BACKUP_VERSION);
  });

  it('survives a backup with history but no favourites', () => {
    const parsed = parseBackup(exported([record('a')], []));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.contents.favorites).toEqual([]);
  });

  it('survives a backup with favourites but no history', () => {
    const parsed = parseBackup(exported([], [RIBEYE_FAVORITE]));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.contents.history).toEqual([]);
  });
});

describe('Rejecting bad files', () => {
  it.each([
    ['not JSON at all', 'this is not json', 'invalid-json'],
    ['a bare array', '[]', 'not-a-backup'],
    ['JSON that is not a backup', JSON.stringify({ hello: 'world' }), 'not-a-backup'],
    [
      'someone else’s export',
      JSON.stringify({ format: 'some-other-app', version: 1 }),
      'not-a-backup',
    ],
    [
      'a newer schema',
      JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION + 1, history: [] }),
      'unsupported-version',
    ],
    [
      'a version that is not a number',
      JSON.stringify({ format: BACKUP_FORMAT, version: 'one', history: [] }),
      'unsupported-version',
    ],
    [
      'a backup with nothing readable in it',
      JSON.stringify({ format: BACKUP_FORMAT, version: 1, history: [], favorites: [] }),
      'nothing-usable',
    ],
  ])('rejects %s', (_label, raw, error) => {
    const parsed = parseBackup(raw);

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toBe(error);
  });

  it('refuses a file too large to be a real backup', () => {
    const huge = 'x'.repeat(MAX_BACKUP_BYTES + 1);
    const parsed = parseBackup(huge);

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toBe('too-large');
  });

  it('never executes anything from the file', () => {
    // A backup is data; a function-shaped value simply does not survive JSON.
    const hostile = JSON.stringify({
      format: BACKUP_FORMAT,
      version: 1,
      history: [{ ...record('a'), restaurantName: '<script>alert(1)</script>' }],
      favorites: [],
    });
    const parsed = parseBackup(hostile);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    // Preserved as inert text, exactly as the app itself would store it.
    expect(parsed.contents.history[0]?.restaurantName).toBe('<script>alert(1)</script>');
  });

  it('never throws, whatever it is handed', () => {
    for (const raw of ['', '{', 'null', '"a string"', '{"format":null}', '0']) {
      expect(() => parseBackup(raw)).not.toThrow();
    }
  });
});

describe('Discarding unusable records', () => {
  it('keeps the good records and reports what it dropped', () => {
    const raw = JSON.stringify({
      format: BACKUP_FORMAT,
      version: 1,
      exportedAt: AT,
      history: [record('a'), { id: 'broken', version: 2, createdAt: 'whenever' }, 'nonsense'],
      favorites: [
        RIBEYE_FAVORITE,
        { foodId: 'beef-unicorn', quality: 'standard', plateSize: 'regular' },
      ],
    });

    const parsed = parseBackup(raw);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.contents.history).toHaveLength(1);
    expect(parsed.contents.favorites).toHaveLength(1);
    expect(parsed.summary).toEqual({ skippedHistory: 2, skippedFavorites: 1 });
  });

  it('collapses a record repeated inside the file', () => {
    const raw = JSON.stringify({
      format: BACKUP_FORMAT,
      version: 1,
      history: [record('a'), record('a')],
      favorites: [],
    });

    const parsed = parseBackup(raw);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.contents.history).toHaveLength(1);
  });

  it('repairs a missing export timestamp rather than rejecting the file', () => {
    const raw = JSON.stringify({
      format: BACKUP_FORMAT,
      version: 1,
      history: [record('a')],
      favorites: [],
    });

    const parsed = parseBackup(raw);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(Number.isNaN(Date.parse(parsed.contents.exportedAt))).toBe(false);
  });

  it('brings version 1 history records forward on restore', () => {
    const legacy = record('legacy');
    const { achievementIds: _dropped, ...snapshot } = legacy.snapshot;
    const raw = JSON.stringify({
      format: BACKUP_FORMAT,
      version: 1,
      history: [{ ...legacy, version: 1, snapshot }],
      favorites: [],
    });

    const parsed = parseBackup(raw);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.contents.history[0]?.version).toBe(legacy.version);
  });
});

describe('mergeById', () => {
  it('adds what is new and keeps what is already here', () => {
    const existing = [record('a')];
    const incoming = [record('a', { dinerCount: 9 }), record('b')];

    const outcome = mergeById(existing, incoming);

    expect(outcome.result).toHaveLength(2);
    expect(outcome.added).toBe(1);
    expect(outcome.kept).toBe(1);
    // The existing copy of "a" wins; the incoming one does not overwrite it.
    expect(outcome.result.find((entry) => entry.id === 'a')?.dinerCount).toBe(1);
  });

  it('destroys nothing when the incoming list is empty', () => {
    const existing = [record('a'), record('b')];

    expect(mergeById(existing, []).result).toEqual(existing);
  });

  it('accepts everything onto an empty device', () => {
    const outcome = mergeById([], [record('a'), record('b')]);

    expect(outcome.result).toHaveLength(2);
    expect(outcome.added).toBe(2);
  });

  it('leaves the source arrays untouched', () => {
    const existing = [record('a')];
    mergeById(existing, [record('b')]);

    expect(existing).toHaveLength(1);
  });

  it('works for favourites as well as sessions', () => {
    const outcome = mergeById([RIBEYE_FAVORITE], [RIBEYE_FAVORITE, PORK_FAVORITE]);

    expect(outcome.result).toHaveLength(2);
    expect(outcome.added).toBe(1);
  });
});
