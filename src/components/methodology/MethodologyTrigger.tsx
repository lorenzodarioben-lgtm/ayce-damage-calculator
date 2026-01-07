'use client';

import { useState } from 'react';
import { Methodology } from '@/components/methodology/Methodology';

interface MethodologyTriggerProps {
  className: string;
  label?: string;
}

/**
 * A self-contained button and dialog pair.
 *
 * Owning the open state here means every place that offers the methodology —
 * the header on any route, the footer on the calculator — gets it without any
 * shared state to plumb through. Only one instance can be open at a time
 * because only one can be clicked.
 */
export function MethodologyTrigger({ className, label = 'Methodology' }: MethodologyTriggerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>
      <Methodology open={open} onClose={() => setOpen(false)} />
    </>
  );
}
