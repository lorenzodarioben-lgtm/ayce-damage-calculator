'use client';

import { useState, useSyncExternalStore } from 'react';
import { Copy, Download, Link2, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { usePricingProfile } from '@/components/session/PricingContext';
import type { ResultCardModel } from '@/lib/resultCard';
import { renderResultCardBlob } from '@/lib/resultCardImage';
import { buildShareText, canWebShare, copyToClipboard } from '@/lib/share';
import { shareLinkResult } from '@/lib/shareLink';
import type { Verdict } from '@/lib/verdicts';
import type { CustomFood } from '@/types/customFoods';
import type { DamageReport, MealSession } from '@/types/meal';

/** Share capability cannot change within a page lifetime, so nothing to subscribe to. */
const subscribeNever = () => () => {};

interface ShareActionsProps {
  report: DamageReport;
  verdict: Verdict;
  session: MealSession;
  cardModel: ResultCardModel;
  onStatus: (message: string) => void;
}

export function ShareActions({ report, verdict, session, cardModel, onStatus }: ShareActionsProps) {
  const restaurantName = session.restaurantName;
  const pricingProfile = usePricingProfile();
  const [isExporting, setIsExporting] = useState(false);

  // navigator.share is unavailable during SSR, so the server snapshot is false
  // and the real capability is read on the client after hydration.
  const shareSupported = useSyncExternalStore(subscribeNever, canWebShare, () => false);

  const shareText = buildShareText(report, verdict, restaurantName);

  async function handleCopy() {
    const copied = await copyToClipboard(shareText);
    onStatus(copied ? 'Damage report copied to clipboard.' : 'Copying is unavailable here.');
  }

  async function handleShare() {
    try {
      await navigator.share({ title: 'AYCE Damage Report', text: shareText });
    } catch (error) {
      // A user-cancelled share is a normal outcome, not a failure worth reporting.
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        onStatus('Sharing was not completed.');
      }
    }
  }

  async function handleCopyLink() {
    const customFoods = report.lines.flatMap((line) =>
      line.food.isCustom ? [line.food as CustomFood] : [],
    );
    const result = shareLinkResult(session, { pricingProfile, customFoods });
    if (!result.ok) {
      // The two reasons have opposite remedies, so they are said separately.
      onStatus(
        result.reason === 'empty'
          ? 'There is nothing on the tab to share yet.'
          : 'This meal is too large to fit inside a link. A share link carries the whole report in the address, so there is a limit to what it can hold.',
      );
      return;
    }

    // Built from the live origin so the link works on any deployment.
    const copied = await copyToClipboard(new URL(result.path, window.location.origin).toString());
    onStatus(
      copied
        ? 'Share link copied. The whole report travels inside the link.'
        : 'Copying is unavailable here.',
    );
  }

  async function handleDownload() {
    if (isExporting) {
      return;
    }
    setIsExporting(true);

    let url: string | null = null;
    try {
      const blob = await renderResultCardBlob(cardModel);
      if (!blob) {
        onStatus('The card image could not be generated in this browser.');
        return;
      }

      url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ayce-damage-report.png';
      link.click();
      onStatus('Result card downloaded.');
    } catch {
      onStatus('The card image could not be generated in this browser.');
    } finally {
      if (url) {
        URL.revokeObjectURL(url);
      }
      setIsExporting(false);
    }
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Button variant="secondary" onClick={handleCopyLink}>
        <Link2 size={16} aria-hidden="true" />
        Copy share link
      </Button>

      <Button variant="secondary" onClick={handleCopy}>
        <Copy size={16} aria-hidden="true" />
        Copy result
      </Button>

      {shareSupported && (
        <Button variant="secondary" onClick={handleShare}>
          <Share2 size={16} aria-hidden="true" />
          Share
        </Button>
      )}

      <Button variant="secondary" onClick={handleDownload} disabled={isExporting}>
        <Download size={16} aria-hidden="true" />
        {isExporting ? 'Rendering…' : 'Download card'}
      </Button>
    </div>
  );
}
