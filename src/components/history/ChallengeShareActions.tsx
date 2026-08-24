'use client';

import { useMemo, useState } from 'react';
import { ClipboardCopy, QrCode as QrCodeIcon, Swords } from 'lucide-react';
import { QrCode } from '@/components/share/QrCode';
import { Button } from '@/components/ui/Button';
import { challengeSideFromRecord, encodeChallengePayload } from '@/lib/challengeShare';
import { COPY_UNAVAILABLE, copyToClipboard } from '@/lib/share';
import type { SavedMealSession } from '@/types/history';

interface ChallengeShareActionsProps {
  previous: SavedMealSession;
  current: SavedMealSession;
  onStatus: (message: string) => void;
}

/**
 * Turns a comparison into a link anyone can open.
 *
 * The link carries both meals and their prices, and nothing else: no diner
 * names, no roster attribution, no notes, no ledger. Recipients get the same
 * comparison this page shows, recalculated by the same engine.
 */
export function ChallengeShareActions({ previous, current, onStatus }: ChallengeShareActionsProps) {
  const [showQr, setShowQr] = useState(false);

  const token = useMemo(
    () =>
      encodeChallengePayload({
        previous: challengeSideFromRecord(previous),
        current: challengeSideFromRecord(current),
      }),
    [previous, current],
  );

  const url =
    token && typeof window !== 'undefined' ? `${window.location.origin}/challenge/${token}` : '';

  async function copyLink() {
    if (!url) {
      return;
    }
    const copied = await copyToClipboard(url);
    onStatus(copied ? 'Challenge link copied.' : COPY_UNAVAILABLE);
  }

  return (
    <section aria-labelledby="challenge-share-heading" className="panel p-4 sm:p-5">
      <h3 id="challenge-share-heading" className="micro-label mb-2 flex items-center gap-1.5">
        <Swords size={13} aria-hidden="true" />
        Share this challenge
      </h3>

      {token === null ? (
        <p className="text-xs leading-relaxed text-cream-700">
          These two meals are too large to fit inside a link. A challenge carries both of them in
          the address itself, so there is a limit to how much it can hold.
        </p>
      ) : (
        <>
          <p className="max-w-[60ch] text-xs leading-relaxed text-cream-700">
            The link carries both meals and their entry prices, encoded into the address. Diner
            names, roster attribution and any note on either record stay on this device.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" size="md" onClick={() => void copyLink()}>
              <ClipboardCopy size={16} aria-hidden="true" />
              Copy challenge link
            </Button>
            <Button
              variant="ghost"
              size="md"
              aria-expanded={showQr}
              onClick={() => setShowQr((open) => !open)}
            >
              <QrCodeIcon size={16} aria-hidden="true" />
              {showQr ? 'Hide the code' : 'Show a QR code'}
            </Button>
          </div>

          {showQr && (
            <div className="mt-3 flex flex-col items-center gap-2">
              <QrCode value={url} label="A scannable link to this challenge" />
              <p className="max-w-[46ch] text-center text-xs leading-relaxed text-cream-700">
                Two meals make a long address, so a code is not always possible. The copied link
                always works.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
