'use client';

import { useMemo } from 'react';
import { buildQrMatrix, qrPath } from '@/lib/qr';

interface QrCodeProps {
  value: string;
  /** Describes what scanning it would do, since the drawing cannot say so. */
  label: string;
}

/** How many modules of quiet zone the specification asks for. */
const QUIET_ZONE = 4;

/**
 * A scannable code for a link, drawn as one SVG path.
 *
 * Returns nothing at all when the link is too long to encode: a copyable link
 * is always offered alongside, so a missing code costs nothing.
 */
export function QrCode({ value, label }: QrCodeProps) {
  const matrix = useMemo(() => buildQrMatrix(value), [value]);

  if (!matrix) {
    return null;
  }

  const extent = matrix.size + QUIET_ZONE * 2;

  return (
    <svg
      viewBox={`0 0 ${extent} ${extent}`}
      role="img"
      aria-label={label}
      className="h-auto w-full max-w-[220px] rounded-[10px] bg-cream-50 p-1"
      shapeRendering="crispEdges"
    >
      <path
        d={qrPath(matrix)}
        transform={`translate(${QUIET_ZONE} ${QUIET_ZONE})`}
        fill="var(--color-ash-950)"
      />
    </svg>
  );
}
