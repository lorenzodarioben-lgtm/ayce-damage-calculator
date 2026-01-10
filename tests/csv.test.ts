import { describe, expect, it } from 'vitest';
import { buildDamageReport } from '@/lib/calculations';
import { CSV_COLUMNS, csvFilename, escapeCsvField, historyToCsv } from '@/lib/csv';
import { createSavedSession } from '@/lib/history';
import { getVerdict } from '@/lib/verdicts';
import type { SavedMealSession } from '@/types/history';
import type { MealItem, MealSession } from '@/types/meal';

function line(foodId: string, quantity: number): MealItem {
  return {
    id: `${foodId}__standard__regular`,
    foodId,
    quality: 'standard',
    plateSize: 'regular',
    quantity,
  };
}

function saved(overrides: Partial<MealSession> = {}, id = 'record-1', note = ''): SavedMealSession {
  const session: MealSession = {
    restaurantName: 'Seoul Garden',
    pricePerDiner: 59.9,
    dinerCount: 2,
    items: [line('beef-ribeye', 2)],
    ...overrides,
  };
  const report = buildDamageReport(session.items, session);
  return createSavedSession(
    session,
    report,
    getVerdict(report.totalRetailValue, report.totalAdmission),
    { id, createdAt: '2026-08-16T12:00:00.000Z', note },
  );
}

function rows(csv: string): string[] {
  return csv.trimEnd().split('\n');
}

describe('escapeCsvField', () => {
  it('quotes every field, so a comma is never ambiguous', () => {
    expect(escapeCsvField('Seoul Garden')).toBe('"Seoul Garden"');
    expect(escapeCsvField('Kim, Lee & Co')).toBe('"Kim, Lee & Co"');
  });

  it('doubles an embedded quote', () => {
    expect(escapeCsvField('the "good" one')).toBe('"the ""good"" one"');
  });

  it('keeps a newline inside its own field', () => {
    expect(escapeCsvField('one\ntwo')).toBe('"one\ntwo"');
  });

  it.each(['=1+1', '+SUM(A1)', '-2', '@name', '\ttabbed'])(
    'neutralises %s so a spreadsheet cannot execute it',
    (input) => {
      expect(escapeCsvField(input)).toBe(`"'${input}"`);
    },
  );

  it('leaves ordinary text alone', () => {
    expect(escapeCsvField('Brisket')).toBe('"Brisket"');
    expect(escapeCsvField('')).toBe('""');
  });
});

describe('historyToCsv', () => {
  it('writes a header even when there is nothing to export', () => {
    expect(historyToCsv([])).toBe(`${CSV_COLUMNS.join(',')}\n`);
  });

  it('writes one row per tab line', () => {
    const csv = historyToCsv([
      saved({ items: [line('beef-ribeye', 2), line('pork-belly', 1)] }, 'a'),
      saved({ items: [line('seafood-prawns', 3)] }, 'b'),
    ]);

    // Header plus two lines from the first record and one from the second.
    expect(rows(csv)).toHaveLength(4);
  });

  it('repeats the session figures across its own rows', () => {
    const csv = historyToCsv([saved({ items: [line('beef-ribeye', 2), line('pork-belly', 1)] })]);
    const [, first, second] = rows(csv);

    const admission = '"119.80"';
    expect(first).toContain(admission);
    expect(second).toContain(admission);
    expect(first).toContain('"Seoul Garden"');
    expect(second).toContain('"Seoul Garden"');
  });

  it('carries the line detail', () => {
    const csv = historyToCsv([saved()]);
    const [, row] = rows(csv);

    expect(row).toContain('"Ribeye"');
    expect(row).toContain('"beef"');
    expect(row).toContain('"Standard"');
    expect(row).toContain('"Regular"');
    // 2 x 155 g = 310 g at $52/kg = $16.12
    expect(row).toContain('"310"');
    expect(row).toContain('"16.12"');
  });

  it('carries a note through unchanged', () => {
    const csv = historyToCsv([saved({}, 'a', 'Anniversary dinner')]);
    expect(rows(csv)[1]).toContain('"Anniversary dinner"');
  });

  it('escapes a restaurant name that would otherwise break the row', () => {
    const csv = historyToCsv([saved({ restaurantName: 'Kim, Lee "BBQ"' })]);
    expect(rows(csv)[1]).toContain('"Kim, Lee ""BBQ"""');
    // Still one row: the comma did not split it.
    expect(rows(csv)).toHaveLength(2);
  });

  it('has one field per column on every row', () => {
    const csv = historyToCsv([saved({ items: [line('beef-ribeye', 2), line('pork-belly', 1)] })]);

    for (const row of rows(csv).slice(1)) {
      expect(row.match(/","|^"|"$/g)).not.toBeNull();
      expect(row.split('","')).toHaveLength(CSV_COLUMNS.length);
    }
  });

  it('ends with a newline', () => {
    expect(historyToCsv([saved()]).endsWith('\n')).toBe(true);
  });
});

describe('csvFilename', () => {
  it('stamps the date', () => {
    expect(csvFilename(new Date('2026-08-17T09:00:00.000Z'))).toMatch(
      /^ayce-damage-history-\d{4}-\d{2}-\d{2}\.csv$/,
    );
  });

  it('does not produce a broken name from an invalid date', () => {
    expect(csvFilename(new Date('not a date'))).toBe('ayce-damage-history-unknown-date.csv');
  });
});
