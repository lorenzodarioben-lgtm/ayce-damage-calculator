import { escapeCsvField } from '@/lib/csv';
import {
  MAX_CUSTOM_FOODS,
  MAX_CUSTOM_FOOD_DESCRIPTION_LENGTH,
  MAX_CUSTOM_FOOD_NAME_LENGTH,
  createCustomFood,
  customFoodId,
  nextCustomFoodId,
  normaliseCustomFoodName,
} from '@/lib/customFoods';
import { CATEGORY_META, FOOD_CATEGORIES } from '@/lib/constants';
import type { CustomFood, CustomFoodDraft } from '@/types/customFoods';
import type { FoodCategory, ValuationModel } from '@/types/meal';

/**
 * Bringing a menu in from a spreadsheet.
 *
 * Someone who knows their regular restaurant's prices has usually written them
 * down somewhere already, and retyping thirty rows into a dialog is a reason
 * not to bother. This reads that file.
 *
 * Everything about it is preview-first and on-device. Parsing produces a plan
 * and touches nothing; the plan says exactly what would be written, what was
 * rejected and why, and which rows collide with a menu the diner already has.
 * Only an explicit apply writes, and it writes in one go — a half-applied
 * import would leave a personal menu in a state nobody chose.
 */

/** Comfortably larger than any hand-written menu, and a hard stop well below it. */
export const MAX_IMPORT_BYTES = 256 * 1024;

/** More rows than a restaurant has items, and a fixed ceiling on the parse. */
export const MAX_IMPORT_ROWS = 400;

/** A field longer than this is not a menu entry; it is something else. */
export const MAX_IMPORT_FIELD_LENGTH = 512;

export const IMPORT_COLUMNS = [
  'name',
  'category',
  'valuation',
  'short_name',
  'description',
  'retail_price',
  'restaurant_cost',
  'grams_per_serving',
  'calories',
  'protein_g',
  'fat_g',
  'carbs_g',
] as const;

export type ImportColumn = (typeof IMPORT_COLUMNS)[number];

/**
 * A template someone can open, fill in and bring back.
 *
 * The two example rows are illustrative and say so in their own description
 * field: they demonstrate the two valuation models rather than asserting what
 * anything costs. Every figure a diner keeps has to be one they typed.
 */
export function importTemplateCsv(): string {
  const rows = [
    IMPORT_COLUMNS.join(','),
    [
      'Cheese corn',
      'sides',
      'by-weight',
      'Cheese corn',
      'Example row — replace it with your own prices',
      '14',
      '6',
      '',
      '180',
      '4',
      '9',
      '18',
    ],
    [
      'House lager',
      'drinks',
      'by-serving',
      'Lager',
      'Example row — leave a figure blank when you do not know it',
      '9',
      '2.5',
      '330',
      '',
      '',
      '',
      '',
    ],
  ];

  const body = rows
    .map((row) => (typeof row === 'string' ? row : row.map(escapeCsvField).join(',')))
    .join('\n');
  return `${body}\n`;
}

export const IMPORT_TEMPLATE_FILENAME = 'ayce-menu-template.csv';

/**
 * Splits a CSV document into rows of fields.
 *
 * Written out rather than pulled in, because the awkward parts are exactly the
 * parts a small dependency would also have to get right: a quoted field may
 * contain commas, doubled quotes and line breaks, and a spreadsheet on Windows
 * ends its lines with a carriage return. Bounded on rows and on field length,
 * so a hostile file cannot make this allocate without limit.
 */
export function parseCsv(text: string): readonly (readonly string[])[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  const endField = () => {
    row.push(field.slice(0, MAX_IMPORT_FIELD_LENGTH));
    field = '';
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ',') {
      endField();
    } else if (character === '\n') {
      endRow();
      if (rows.length > MAX_IMPORT_ROWS) {
        return rows.slice(0, MAX_IMPORT_ROWS);
      }
    } else if (character !== '\r') {
      field += character;
    }
  }

  if (field.length > 0 || row.length > 0) {
    endRow();
  }

  // A trailing newline leaves one empty row, which is not a record of anything.
  return rows.filter((entry) => entry.some((value) => value.trim().length > 0));
}

/**
 * Strips the characters a spreadsheet reads as the start of a formula.
 *
 * The export escapes them on the way out; this removes them on the way in, so a
 * name that arrives as `=cmd|'/c calc'!A1` becomes inert text before it is ever
 * stored, shared or written back into another CSV.
 */
export function stripFormulaLead(value: string): string {
  return value.replace(/^[=+\-@\t\r]+/, '').trim();
}

export type RowProblem =
  | 'missing-name'
  | 'unknown-category'
  | 'unknown-valuation'
  | 'missing-price'
  | 'invalid-number'
  | 'duplicate-in-file';

export const ROW_PROBLEM_MESSAGES: Readonly<Record<RowProblem, string>> = {
  'missing-name': 'No name in this row.',
  'unknown-category': `Category must be one of: ${FOOD_CATEGORIES.join(', ')}.`,
  'unknown-valuation': 'Valuation must be by-weight or by-serving.',
  'missing-price': 'Both a retail price and a restaurant cost are required.',
  'invalid-number': 'A figure in this row is not zero or a positive number.',
  'duplicate-in-file': 'Another row in this file already has this name.',
};

export interface RejectedRow {
  /** 1-based, counting the header, so it matches what the spreadsheet shows. */
  readonly line: number;
  readonly name: string;
  readonly problem: RowProblem;
}

export type ConflictChoice = 'skip' | 'separate' | 'replace';

export interface ConflictRow {
  readonly line: number;
  readonly name: string;
  /** The local item this row would collide with. */
  readonly existingId: string;
  readonly existingName: string;
  readonly draft: CustomFoodDraft;
}

export interface ImportPlan {
  /** Rows that are valid and collide with nothing local. */
  readonly accepted: readonly CustomFood[];
  /** Rows that collide with an item the diner already has. */
  readonly conflicts: readonly ConflictRow[];
  readonly rejected: readonly RejectedRow[];
  /** True when the file had more rows than the parser will read. */
  readonly truncated: boolean;
  /** True when accepting everything would exceed the personal-menu ceiling. */
  readonly overCapacity: boolean;
}

export const EMPTY_IMPORT_PLAN: ImportPlan = {
  accepted: [],
  conflicts: [],
  rejected: [],
  truncated: false,
  overCapacity: false,
};

function headerIndex(header: readonly string[]): Readonly<Partial<Record<ImportColumn, number>>> {
  const index: Partial<Record<ImportColumn, number>> = {};
  header.forEach((raw, position) => {
    // Tolerant of what a spreadsheet does to a header: case, spaces and the
    // hyphens people use instead of underscores.
    const key = raw
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_') as ImportColumn;
    if (IMPORT_COLUMNS.includes(key) && index[key] === undefined) {
      index[key] = position;
    }
  });
  return index;
}

/**
 * Reads a numeric cell. Blank is genuinely absent; anything else must be a
 * number that is zero or above.
 *
 * Deliberately not run through the formula stripper. A leading minus is a
 * formula lead in a text field and a negative number in this one, and stripping
 * it here would quietly turn a price of -4 into a price of 4 — a wrong figure
 * accepted silently, which is worse than the row being rejected. Anything that
 * really is a formula fails `Number` and is rejected on that basis instead.
 */
function figure(raw: string | undefined): number | null | undefined {
  const text = (raw ?? '').trim();
  if (text.length === 0) {
    return undefined;
  }
  const value = Number(text.replace(/[$,\s]/g, ''));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function isCategory(value: string): value is FoodCategory {
  return FOOD_CATEGORIES.some((category) => category === value);
}

/**
 * Works out exactly what an import would write, without writing anything.
 *
 * Rows are validated one at a time and a bad one is rejected on its own terms,
 * with the line number a spreadsheet would show, so fixing a file is a matter
 * of looking at the row it names rather than guessing.
 */
export function planCsvImport(text: string, existing: readonly CustomFood[]): ImportPlan {
  const rows = parseCsv(text);
  const [header, ...body] = rows;
  if (!header) {
    return EMPTY_IMPORT_PLAN;
  }

  const columns = headerIndex(header);
  const cell = (row: readonly string[], column: ImportColumn): string =>
    stripFormulaLead(row[columns[column] ?? -1] ?? '');

  const accepted: CustomFood[] = [];
  const conflicts: ConflictRow[] = [];
  const rejected: RejectedRow[] = [];

  const takenLocally = new Map(existing.map((food) => [food.id, food]));
  // Ids are claimed as the file is read, so two rows naming the same item are
  // caught here rather than silently overwriting one another on apply.
  const seenInFile = new Set<string>();

  body.forEach((row, offset) => {
    const line = offset + 2;
    const name = normaliseCustomFoodName(cell(row, 'name').slice(0, MAX_CUSTOM_FOOD_NAME_LENGTH));
    if (!name) {
      rejected.push({ line, name: '', problem: 'missing-name' });
      return;
    }

    const category = cell(row, 'category').toLowerCase().replace(/\s+/g, '-');
    if (!isCategory(category)) {
      rejected.push({ line, name, problem: 'unknown-category' });
      return;
    }

    const declared = cell(row, 'valuation').toLowerCase().replace(/\s+/g, '-');
    // A blank valuation is by weight, which is what the grill categories mean
    // and what a file written before servings existed would have meant.
    const valuation: ValuationModel | null =
      declared === '' || declared === 'by-weight'
        ? 'by-weight'
        : declared === 'by-serving'
          ? 'by-serving'
          : null;
    if (valuation === null) {
      rejected.push({ line, name, problem: 'unknown-valuation' });
      return;
    }

    const figures = {
      retail: figure(row[columns.retail_price ?? -1]),
      cost: figure(row[columns.restaurant_cost ?? -1]),
      grams: figure(row[columns.grams_per_serving ?? -1]),
      calories: figure(row[columns.calories ?? -1]),
      protein: figure(row[columns.protein_g ?? -1]),
      fat: figure(row[columns.fat_g ?? -1]),
      carbs: figure(row[columns.carbs_g ?? -1]),
    };

    if (Object.values(figures).some((value) => value === null)) {
      rejected.push({ line, name, problem: 'invalid-number' });
      return;
    }

    const { retail, cost, grams, calories, protein, fat, carbs } = figures;
    if (retail === undefined || retail === null || cost === undefined || cost === null) {
      rejected.push({ line, name, problem: 'missing-price' });
      return;
    }

    const id = customFoodId(name);
    if (seenInFile.has(id)) {
      rejected.push({ line, name, problem: 'duplicate-in-file' });
      return;
    }
    seenInFile.add(id);

    const shared = {
      name,
      category,
      shortName: cell(row, 'short_name').slice(0, MAX_CUSTOM_FOOD_NAME_LENGTH),
      description: cell(row, 'description').slice(0, MAX_CUSTOM_FOOD_DESCRIPTION_LENGTH),
    };

    const draft: CustomFoodDraft =
      valuation === 'by-serving'
        ? {
            ...shared,
            valuation: 'by-serving',
            retailPricePerServing: retail,
            restaurantCostPerServing: cost,
            ...(grams === undefined || grams === null ? {} : { gramsPerServing: grams }),
            ...(calories === undefined || calories === null
              ? {}
              : { caloriesPerServing: calories }),
            ...(protein === undefined || protein === null ? {} : { proteinPerServing: protein }),
            ...(fat === undefined || fat === null ? {} : { fatPerServing: fat }),
            ...(carbs === undefined || carbs === null ? {} : { carbsPerServing: carbs }),
          }
        : {
            ...shared,
            valuation: 'by-weight',
            retailPricePerKg: retail,
            restaurantCostPerKg: cost,
            ...(calories === undefined || calories === null ? {} : { caloriesPer100g: calories }),
            ...(protein === undefined || protein === null ? {} : { proteinPer100g: protein }),
            ...(fat === undefined || fat === null ? {} : { fatPer100g: fat }),
            ...(carbs === undefined || carbs === null ? {} : { carbsPer100g: carbs }),
          };

    const collision = takenLocally.get(id);
    if (collision) {
      conflicts.push({ line, name, existingId: id, existingName: collision.name, draft });
      return;
    }

    const food = createCustomFood(draft, id);
    if (!food) {
      rejected.push({ line, name, problem: 'invalid-number' });
      return;
    }
    accepted.push(food);
  });

  return {
    accepted,
    conflicts,
    rejected,
    truncated: rows.length >= MAX_IMPORT_ROWS,
    overCapacity: existing.length + accepted.length + conflicts.length > MAX_CUSTOM_FOODS,
  };
}

/**
 * The menu that results from applying a plan, computed in one pass.
 *
 * Returned rather than written, so the caller commits it in a single store
 * update: a personal menu is never left half-imported.
 */
export function applyImportPlan(
  plan: ImportPlan,
  existing: readonly CustomFood[],
  choices: Readonly<Record<string, ConflictChoice>>,
): readonly CustomFood[] {
  let menu = [...existing];

  for (const food of plan.accepted) {
    menu = [...menu.filter((entry) => entry.id !== food.id), food];
  }

  for (const conflict of plan.conflicts) {
    const choice = choices[conflict.existingId] ?? 'skip';
    if (choice === 'skip') {
      continue;
    }
    if (choice === 'replace') {
      const replacement = createCustomFood(conflict.draft, conflict.existingId);
      if (replacement) {
        menu = [...menu.filter((entry) => entry.id !== conflict.existingId), replacement];
      }
      continue;
    }
    // "separate" keeps both, which is the same rule a shared menu import uses:
    // an imported item is a suggestion, never an instruction to overwrite.
    const id = nextCustomFoodId(menu, conflict.name);
    const separate = createCustomFood(conflict.draft, id);
    if (separate) {
      menu = [...menu, separate];
    }
  }

  return menu.slice(0, MAX_CUSTOM_FOODS);
}

/** Human-readable category labels, for the preview table. */
export function categoryLabel(category: FoodCategory): string {
  return CATEGORY_META.find((entry) => entry.id === category)?.label ?? category;
}
