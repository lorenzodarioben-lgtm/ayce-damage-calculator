import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_STORED_REGULAR_DINERS_LENGTH,
  REGULAR_DINERS_STORAGE_KEY,
  REGULAR_DINERS_VERSION,
  createRegularDiner,
  loadRegularDiners,
  nextRegularDinerId,
  parseStoredRegularDiners,
  removeRegularDiner,
  saveRegularDiners,
  upsertRegularDiner,
} from '@/lib/regularDiners';
import type { RegularDiner } from '@/lib/regularDiners';

const LORENZO: RegularDiner = { id: 'diner-lorenzo', displayName: 'Lorenzo' };
const OMAR: RegularDiner = { id: 'diner-omar', displayName: 'Omar' };

beforeEach(() => window.localStorage.clear());

describe('regular diner parser', () => {
  it('normalises names and skips malformed records without losing valid ones', () => {
    const parsed = parseStoredRegularDiners(
      JSON.stringify({
        version: REGULAR_DINERS_VERSION,
        diners: [
          { id: 'diner-lorenzo', displayName: '  Lorenzo  ' },
          { id: 'bad id', displayName: 'Invalid' },
          { id: 'diner-blank', displayName: '   ' },
          { id: 'diner-omar', displayName: 'Omar' },
        ],
      }),
    );

    expect(parsed).toEqual([LORENZO, OMAR]);
  });

  it('rejects corrupt, stale and oversized local payloads', () => {
    expect(parseStoredRegularDiners('{oops')).toEqual([]);
    expect(parseStoredRegularDiners(JSON.stringify({ version: 99, diners: [LORENZO] }))).toEqual(
      [],
    );
    expect(parseStoredRegularDiners('x'.repeat(MAX_STORED_REGULAR_DINERS_LENGTH + 1))).toEqual([]);
  });

  it('de-duplicates by stable ID and display name', () => {
    const parsed = parseStoredRegularDiners(
      JSON.stringify({
        version: REGULAR_DINERS_VERSION,
        diners: [
          LORENZO,
          { id: 'diner-lorenzo-2', displayName: 'lorenzo' },
          { id: 'diner-lorenzo', displayName: 'Other' },
          OMAR,
        ],
      }),
    );

    expect(parsed).toEqual([LORENZO, OMAR]);
  });
});

describe('regular diner persistence', () => {
  it('round-trips through browser storage', () => {
    saveRegularDiners([LORENZO, OMAR]);

    expect(loadRegularDiners()).toEqual([LORENZO, OMAR]);
    expect(window.localStorage.getItem(REGULAR_DINERS_STORAGE_KEY)).toContain('Lorenzo');
  });

  it('makes duplicate saves deterministic and permits removal', () => {
    const renamed = { id: 'diner-lorenzo', displayName: 'Lorenzo D.' };
    const saved = upsertRegularDiner([LORENZO, OMAR], renamed);

    expect(saved).toEqual([renamed, OMAR]);
    expect(removeRegularDiner(saved, renamed.id)).toEqual([OMAR]);
  });

  it('creates bounded stable IDs and rejects empty names', () => {
    expect(nextRegularDinerId([LORENZO], 'Lorenzo')).toBe('diner-lorenzo-2');
    expect(createRegularDiner('  ', 'diner-guest')).toBeNull();
    expect(createRegularDiner('Diner 1', 'not valid')).toBeNull();
  });
});
