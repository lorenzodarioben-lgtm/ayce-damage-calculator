import { buildDamageReport } from '@/lib/calculations';
import { formatMoney, formatPercent, formatPlates } from '@/lib/formatting';
import { decodeSharePayload, type SharePayload } from '@/lib/shareLink';
import { getVerdict } from '@/lib/verdicts';

/**
 * The model behind a shared report's social preview.
 *
 * Kept separate from both the metadata and the image so the two cannot describe
 * different meals, and so the derivation can be tested without rendering
 * anything.
 */
export interface SocialCardModel {
  readonly verdictTitle: string;
  readonly restaurantName: string;
  readonly plates: string;
  readonly retailValue: string;
  readonly admission: string;
  readonly recovery: string;
  /** Page title, kept short enough to survive most platforms untruncated. */
  readonly title: string;
  readonly description: string;
  /** Alt text for the generated image. */
  readonly alt: string;
}

/**
 * How much of a restaurant name reaches the image.
 *
 * Names are already capped at 60 characters on the way in; this is tighter
 * again because the preview has one line to give it and must stay readable at
 * thumbnail size.
 */
export const SOCIAL_NAME_LIMIT = 34;

/** Collapses whitespace and truncates on a word boundary where it can. */
export function truncateForCard(value: string, limit = SOCIAL_NAME_LIMIT): string {
  const collapsed = value.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= limit) {
    return collapsed;
  }

  const clipped = collapsed.slice(0, limit - 1);
  const lastSpace = clipped.lastIndexOf(' ');
  // Only break on a word if that leaves something substantial behind.
  const base = lastSpace > limit * 0.6 ? clipped.slice(0, lastSpace) : clipped;
  return `${base.trimEnd()}…`;
}

export const FALLBACK_SOCIAL_CARD: SocialCardModel = {
  verdictTitle: 'Report Unavailable',
  restaurantName: '',
  plates: '—',
  retailValue: '—',
  admission: '—',
  recovery: '—',
  title: 'AYCE Damage Calculator',
  description:
    'Did you beat the buffet, or fund their next renovation? Track your Korean BBQ meal and calculate the damage.',
  alt: 'AYCE Damage Calculator',
};

export function buildSocialCardModel(payload: SharePayload): SocialCardModel {
  const report = buildDamageReport(payload.items, payload);
  const verdict = getVerdict(report.totalRetailValue, report.totalAdmission);

  const restaurantName = truncateForCard(payload.restaurantName);
  const recovery = formatPercent(report.retailRecoveryPercent);
  const plates = formatPlates(report.totalPlates);
  const retailValue = formatMoney(report.totalRetailValue);
  const admission = formatMoney(report.totalAdmission);

  const at = restaurantName ? ` at ${restaurantName}` : '';

  return {
    verdictTitle: verdict.title,
    restaurantName,
    plates,
    retailValue,
    admission,
    recovery,
    title: `${verdict.title} — AYCE Damage Report`,
    description: `${plates}${at}. ${retailValue} of estimated retail value against ${admission} admission — ${recovery} recovered.`,
    alt: `AYCE Damage Report: ${verdict.title}. ${plates}, ${recovery} of admission recovered.`,
  };
}

/** Decodes a token straight to a card model, falling back rather than failing. */
export function socialCardFromToken(token: string | null | undefined): SocialCardModel {
  const payload = decodeSharePayload(token);
  return payload ? buildSocialCardModel(payload) : FALLBACK_SOCIAL_CARD;
}
