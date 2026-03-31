import {
  formatCalories,
  formatGrams,
  formatKg,
  formatMoney,
  formatPlates,
  formatSignedMoney,
} from '@/lib/formatting';
import type { Verdict } from '@/lib/verdicts';
import { DEFAULT_MONEY_CONTEXT, type MoneyContext } from '@/lib/money';
import type { DamageReport } from '@/types/meal';

export function buildShareText(
  report: DamageReport,
  verdict: Verdict,
  restaurantName: string,
  money: MoneyContext = DEFAULT_MONEY_CONTEXT,
): string {
  const title = restaurantName ? `AYCE Damage Report — ${restaurantName}` : 'AYCE Damage Report';
  const heading = `${title} (${money.currency})`;
  const difference = report.retailValueDifference >= 0 ? 'value extracted' : 'value gap';

  return [
    heading,
    '',
    `${formatPlates(report.totalPlates)} • ${formatKg(report.totalWeightKg)}`,
    `${formatMoney(report.totalRetailValue, money)} estimated retail value`,
    `${formatMoney(report.totalAdmission, money)} admission`,
    `${formatSignedMoney(report.retailValueDifference, money)} ${difference}`,
    `${formatCalories(report.nutrition.calories)} • ${formatGrams(report.nutrition.protein)} protein`,
    '',
    `Verdict: ${verdict.title.toUpperCase()}`,
    '',
    'Did you beat the buffet?',
  ].join('\n');
}

/**
 * Said the same way wherever a copy can fail, because the reason is always the
 * same: this browser will not let the page write to the clipboard.
 */
export const COPY_UNAVAILABLE = 'Copying is unavailable in this browser.';

export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Falls through to the selection-based path below.
    }
  }

  if (typeof document === 'undefined') {
    return false;
  }

  // execCommand remains the only fallback in insecure contexts and older browsers.
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  document.body.removeChild(textarea);
  return copied;
}

export function canWebShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}
