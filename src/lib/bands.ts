/**
 * One axis runs through the whole product: what the food was worth at retail,
 * against what the table paid to walk in. Every colour that describes a result
 * is derived from it, and from nothing else.
 *
 * This is presentation, not arithmetic. The thresholds that decide *what the
 * app says* — the verdicts, the house statuses, the figures themselves — live
 * in `verdicts.ts` and `calculations.ts` and are untouched by this file. What
 * lives here is the answer to a narrower question: given a result, which of
 * three colours is the interface allowed to use?
 *
 * Three bands, because there are three things worth saying:
 *
 *   behind     the reading has not reached the entry price
 *   recovered  it has
 *   runaway    it has gone far enough that the house is losing badly
 *
 * The `runaway` threshold is the same 1.6 the verdict copy already uses for
 * "Margin Compression Event", so the colour and the sentence change together
 * rather than at two different moments.
 */
export type Band = 'behind' | 'recovered' | 'runaway';

/** Where break-even sits. Below it the diner is behind; at it they are not. */
export const BREAK_EVEN_RATIO = 1;

/** Where the house stops merely losing and starts losing badly. */
export const RUNAWAY_RATIO = 1.6;

/** The band a retail-value-to-admission ratio falls in. */
export function bandForRatio(ratio: number): Band {
  if (!Number.isFinite(ratio) || ratio < BREAK_EVEN_RATIO) {
    return 'behind';
  }
  return ratio >= RUNAWAY_RATIO ? 'runaway' : 'recovered';
}

/** The same question asked with a percentage, which is what most callers hold. */
export function bandForPercent(recoveryPercent: number): Band {
  return bandForRatio(recoveryPercent / 100);
}

/**
 * Text colour for a figure in a band.
 *
 * Each clears 4.5:1 on every surface it is drawn on: ember-300 at 9.6, sesame
 * at 7.8, flame-400 at 7.2 against a panel.
 */
export const BAND_TEXT: Record<Band, string> = {
  behind: 'text-ember-300',
  recovered: 'text-sesame-400',
  runaway: 'text-flame-400',
};

/** Fill for the part of a track that has been earned. */
export const BAND_FILL: Record<Band, string> = {
  behind: 'bg-linear-to-r from-char-600 via-ember-600 to-ember-400',
  recovered: 'bg-linear-to-r from-sesame-600 via-sesame-500 to-sesame-400',
  runaway: 'bg-linear-to-r from-ember-500 via-flame-500 to-flame-400',
};

/**
 * The verdict's tone, mapped to a colour.
 *
 * `even` covers ratios from 1.0 to 1.25, and it used to render ember while the
 * meter beside it had already turned green at 1.0 — so between those two
 * numbers the meter said recovered and the headline said not yet, about the
 * same result on the same screen. A verdict below break-even is stated in plain
 * cream: the copy is doing that work, and it does not need a colour to help.
 */
export type VerdictTone = 'house' | 'even' | 'diner';

export function verdictText(tone: VerdictTone, recoveryPercent: number): string {
  return tone === 'house' ? 'text-cream-50' : BAND_TEXT[bandForPercent(recoveryPercent)];
}

/**
 * The light behind the verdict, in the colour the verdict is already in.
 * Derived from the same band, so the bloom cannot disagree with the word.
 */
const GLOW: Record<Band, string> = {
  behind: 'bg-[radial-gradient(ellipse_at_center,var(--color-char-600)_0%,transparent_70%)]',
  recovered: 'bg-[radial-gradient(ellipse_at_center,var(--color-sesame-600)_0%,transparent_68%)]',
  runaway: 'bg-[radial-gradient(ellipse_at_center,var(--color-flame-600)_0%,transparent_68%)]',
};

export function verdictGlow(tone: VerdictTone, recoveryPercent: number): string {
  return tone === 'house' ? GLOW.behind : GLOW[bandForPercent(recoveryPercent)];
}

/**
 * The house's own status, read from the diner's side of the table.
 *
 * "Estimated ingredient-cost breach" used to render in the same red as "Value
 * gap" — so the best possible outcome and the worst were the same colour, three
 * tiles apart. Every colour on the report answers the same question, and the
 * question is how the diner did. A kitchen under pressure is good news.
 */
export const SEVERITY_TEXT = {
  calm: 'text-cream-500',
  normal: 'text-cream-300',
  watch: 'text-cream-100',
  alert: BAND_TEXT.recovered,
  breach: BAND_TEXT.runaway,
} as const;
