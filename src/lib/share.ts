import {
  formatCalories,
  formatGrams,
  formatKg,
  formatMoney,
  formatPlates,
  formatSignedMoney,
} from '@/lib/formatting';
import type { Verdict } from '@/lib/verdicts';
import type { DamageReport } from '@/types/meal';

export function buildShareText(
  report: DamageReport,
  verdict: Verdict,
  restaurantName: string,
): string {
  const heading = restaurantName ? `AYCE Damage Report — ${restaurantName}` : 'AYCE Damage Report';
  const difference = report.retailValueDifference >= 0 ? 'value extracted' : 'value gap';

  return [
    heading,
    '',
    `${formatPlates(report.totalPlates)} • ${formatKg(report.totalWeightKg)}`,
    `${formatMoney(report.totalRetailValue)} estimated retail value`,
    `${formatMoney(report.totalAdmission)} admission`,
    `${formatSignedMoney(report.retailValueDifference)} ${difference}`,
    `${formatCalories(report.nutrition.calories)} • ${formatGrams(report.nutrition.protein)} protein`,
    '',
    `Verdict: ${verdict.title.toUpperCase()}`,
    '',
    'Did you beat the buffet?',
  ].join('\n');
}

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
