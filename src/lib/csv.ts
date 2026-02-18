import { getPlateSizeMeta, getQualityMeta } from '@/lib/constants';
import { formatPlateQuantity } from '@/lib/consumption';
import { resolveSavedSession } from '@/lib/history';
import type { SavedMealSession } from '@/types/history';
import type { Diner, MealItem } from '@/types/meal';

/**
 * History as a spreadsheet.
 *
 * The JSON backup is for restoring this app; this is for taking the numbers
 * somewhere else. One row per tab line, with the session's own figures repeated
 * across its rows, because that is the shape a pivot table wants — and totals a
 * spreadsheet can recompute for itself are not worth a second file format.
 */

export const CSV_COLUMNS = [
  'recorded_at',
  'restaurant',
  'note',
  'diners',
  'price_per_diner',
  'base_admission',
  'bill_charges',
  'bill_discounts',
  'admission',
  'verdict',
  'session_retail_value',
  'session_recovery_percent',
  'food',
  'category',
  'quality',
  'plate_size',
  'plates',
  'plates_eaten',
  'plates_left',
  'weight_g',
  'ordered_weight_g',
  'line_retail_value',
  'line_ordered_retail_value',
  'attribution',
] as const;

/** Characters a spreadsheet may read as the start of a formula. */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

/**
 * Who this line belonged to, in one cell.
 *
 * Explicit attributions are named with their amounts; a line shared by only
 * some of the table names them rather than saying "Table", because the export
 * has to be able to say the same thing the report does.
 */
function attributionOf(item: MealItem, diners: readonly Diner[] | undefined): string {
  const nameOf = (id: string) => diners?.find((diner) => diner.id === id)?.displayName ?? 'Unknown';
  const explicit = (item.allocations ?? []).map(
    (allocation) => `${nameOf(allocation.dinerId)}: ${formatPlateQuantity(allocation.quantity)}`,
  );
  const subset = item.sharedAmong?.length
    ? [`Shared by ${item.sharedAmong.map(nameOf).join(' & ')}`]
    : [];
  const parts = [...explicit, ...subset];
  return parts.length > 0 ? parts.join('; ') : 'Table';
}

/**
 * Escapes one field.
 *
 * The leading apostrophe on formula-like text is the important part: a
 * restaurant name or note is free text the diner typed, and `=1+1` in a cell is
 * a formula to every spreadsheet that opens the file. Neutralising it here
 * costs one character and removes the whole class of surprise.
 */
export function escapeCsvField(value: string): string {
  const guarded = FORMULA_LEAD.test(value) ? `'${value}` : value;
  return `"${guarded.replace(/"/g, '""')}"`;
}

function money(value: number): string {
  return (Number.isFinite(value) ? value : 0).toFixed(2);
}

function whole(value: number): string {
  return String(Math.round(Number.isFinite(value) ? value : 0));
}

export function historyToCsv(records: readonly SavedMealSession[]): string {
  const rows: string[] = [CSV_COLUMNS.join(',')];

  for (const { record, report, verdict } of records.map(resolveSavedSession)) {
    // Repeated on every line of the session, so each row stands alone.
    const session = [
      record.createdAt,
      record.restaurantName,
      record.note,
      String(record.dinerCount),
      money(record.pricePerDiner),
      money(report.baseAdmission),
      money(report.adjustmentCharges),
      money(report.adjustmentDiscounts),
      // The final paid total, which is what every recovery figure divides by.
      money(report.totalAdmission),
      verdict.title,
      money(report.totalRetailValue),
      report.retailRecoveryPercent.toFixed(1),
    ];

    for (const line of report.lines) {
      rows.push(
        [
          ...session,
          line.food.name,
          line.food.category,
          getQualityMeta(line.item.quality).label,
          getPlateSizeMeta(line.item.plateSize).label,
          String(line.plates),
          formatPlateQuantity(line.consumedPlates),
          formatPlateQuantity(line.uneatenPlates),
          whole(line.weightG),
          whole(line.orderedWeightG),
          money(line.retailValue),
          money(line.orderedRetailValue),
          attributionOf(line.item, record.diners),
        ]
          .map(escapeCsvField)
          .join(','),
      );
    }
  }

  // A trailing newline, so appending to the file by hand cannot join two rows.
  return `${rows.join('\n')}\n`;
}

/** `ayce-damage-history-2026-08-17.csv` */
export function csvFilename(date: Date): string {
  const stamp = Number.isNaN(date.getTime())
    ? 'unknown-date'
    : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return `ayce-damage-history-${stamp}.csv`;
}
