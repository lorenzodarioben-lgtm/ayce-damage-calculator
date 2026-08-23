import { comparisonFromChallenge, decodeChallengePayload } from '@/lib/challengeShare';
import { formatPercent } from '@/lib/formatting';
import { truncateForCard } from '@/lib/socialCard';

/**
 * The model behind a shared challenge's social preview.
 *
 * Kept separate from both the metadata and the image, for the same reason the
 * report's card is: the two must describe the same comparison, and the
 * derivation is worth testing without rendering anything.
 *
 * Every figure is decoded and recomputed from the token. Nothing here is copy
 * the sender wrote.
 */
export interface ChallengeCardModel {
  readonly headline: string;
  readonly previousLabel: string;
  readonly currentLabel: string;
  readonly previousRecovery: string;
  readonly currentRecovery: string;
  /** Signed, in percentage points — never in percent, which would be a different claim. */
  readonly shift: string;
  readonly title: string;
  readonly description: string;
  readonly alt: string;
}

export const FALLBACK_CHALLENGE_CARD: ChallengeCardModel = {
  headline: 'Challenge Unavailable',
  previousLabel: '',
  currentLabel: '',
  previousRecovery: '—',
  currentRecovery: '—',
  shift: '—',
  title: 'AYCE Damage Calculator',
  description:
    'Did you beat the buffet, or fund their next renovation? Track your Korean BBQ meal and calculate the damage.',
  alt: 'AYCE Damage Calculator',
};

function points(value: number): string {
  const safe = Number.isFinite(value) ? Math.round(value) : 0;
  const magnitude = Math.abs(safe);
  return `${safe < 0 ? '-' : '+'}${magnitude} percentage ${magnitude === 1 ? 'point' : 'points'}`;
}

export function buildChallengeCardModel(token: string | null | undefined): ChallengeCardModel {
  const payload = decodeChallengePayload(token);
  if (!payload) {
    return FALLBACK_CHALLENGE_CARD;
  }

  const comparison = comparisonFromChallenge(payload);
  const previousRecovery = formatPercent(comparison.previous.report.retailRecoveryPercent);
  const currentRecovery = formatPercent(comparison.current.report.retailRecoveryPercent);
  const recovery = comparison.metrics.find((metric) => metric.id === 'recovery');

  const previousLabel = truncateForCard(comparison.previous.record.restaurantName, 22);
  const currentLabel = truncateForCard(comparison.current.record.restaurantName, 22);
  const shift = points(recovery?.delta ?? 0);

  return {
    headline: `${previousRecovery} vs ${currentRecovery}`,
    previousLabel,
    currentLabel,
    previousRecovery,
    currentRecovery,
    shift,
    title: `${previousRecovery} vs ${currentRecovery} — AYCE Damage Challenge`,
    description: `Two recorded all-you-can-eat sessions, measured against each other: ${previousRecovery} then ${currentRecovery}, a shift of ${shift}.`,
    alt: `AYCE Damage Challenge: ${previousRecovery} against ${currentRecovery}, a shift of ${shift}.`,
  };
}
