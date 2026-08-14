export type VerdictId =
  | 'corporate-sponsor'
  | 'house-favourite'
  | 'respectable-restraint'
  | 'break-even-bandit'
  | 'value-extraction-specialist'
  | 'margin-compression-event'
  | 'do-not-return';

export interface Verdict {
  readonly id: VerdictId;
  /** Inclusive lower bound of totalRetailValue / totalAdmission. */
  readonly minRatio: number;
  readonly title: string;
  readonly copy: string;
  /** Drives the accent treatment on the report. */
  readonly tone: 'house' | 'even' | 'diner';
}

/** Ordered high to low so lookup returns the first satisfied threshold. */
export const VERDICTS: readonly Verdict[] = [
  {
    id: 'do-not-return',
    minRatio: 2.0,
    title: 'Do Not Return',
    copy: 'Your photo may already be behind the register.',
    tone: 'diner',
  },
  {
    id: 'margin-compression-event',
    minRatio: 1.6,
    title: 'Margin Compression Event',
    copy: 'Management has begun reconsidering the phrase "all you can eat."',
    tone: 'diner',
  },
  {
    id: 'value-extraction-specialist',
    minRatio: 1.25,
    title: 'Value Extraction Specialist',
    copy: 'This stopped being dinner and became an optimisation problem.',
    tone: 'diner',
  },
  {
    id: 'break-even-bandit',
    minRatio: 1.0,
    title: 'Break-Even Bandit',
    copy: 'By estimated retail value, you technically beat the buffet. Technically is all that matters.',
    tone: 'even',
  },
  {
    id: 'respectable-restraint',
    minRatio: 0.85,
    title: 'Respectable Restraint',
    copy: 'You came close, but the house still has the receipts.',
    tone: 'house',
  },
  {
    id: 'house-favourite',
    minRatio: 0.55,
    title: 'House Favourite',
    copy: 'A respectable meal. An even more respectable evening for the restaurant.',
    tone: 'house',
  },
  {
    id: 'corporate-sponsor',
    minRatio: Number.NEGATIVE_INFINITY,
    title: 'Corporate Sponsor',
    copy: 'You didn’t beat the buffet. You contributed to its long-term strategic growth.',
    tone: 'house',
  },
];

const FALLBACK_VERDICT = VERDICTS[VERDICTS.length - 1] as Verdict;

export function getVerdict(retailValue: number, totalAdmission: number): Verdict {
  if (!Number.isFinite(retailValue) || !Number.isFinite(totalAdmission) || totalAdmission <= 0) {
    return FALLBACK_VERDICT;
  }
  const ratio = retailValue / totalAdmission;
  return VERDICTS.find((verdict) => ratio >= verdict.minRatio) ?? FALLBACK_VERDICT;
}

export interface HouseStatus {
  readonly minRatio: number;
  readonly label: string;
  readonly severity: 'calm' | 'normal' | 'watch' | 'alert' | 'breach';
}

/** Ordered high to low on estimated ingredient cost / admission. */
export const HOUSE_STATUSES: readonly HouseStatus[] = [
  { minRatio: 1.0, label: 'Estimated ingredient-cost breach.', severity: 'breach' },
  { minRatio: 0.75, label: 'Material food-cost incident.', severity: 'alert' },
  { minRatio: 0.55, label: 'Kitchen manager is monitoring the situation.', severity: 'watch' },
  { minRatio: 0.35, label: 'Normal operating conditions.', severity: 'normal' },
  { minRatio: Number.NEGATIVE_INFINITY, label: 'Restaurant is sleeping well.', severity: 'calm' },
];

const FALLBACK_STATUS = HOUSE_STATUSES[HOUSE_STATUSES.length - 1] as HouseStatus;

export function getHouseStatus(restaurantCost: number, totalAdmission: number): HouseStatus {
  if (!Number.isFinite(restaurantCost) || !Number.isFinite(totalAdmission) || totalAdmission <= 0) {
    return FALLBACK_STATUS;
  }
  const ratio = restaurantCost / totalAdmission;
  return HOUSE_STATUSES.find((status) => ratio >= status.minRatio) ?? FALLBACK_STATUS;
}
