'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { DEFAULT_PRICING_PROFILE } from '@/lib/pricing';
import type { PricingProfile } from '@/types/pricing';

const PricingProfileContext = createContext<PricingProfile>(DEFAULT_PRICING_PROFILE);

export function PricingProfileProvider({
  profile,
  children,
}: {
  profile: PricingProfile;
  children: ReactNode;
}) {
  return <PricingProfileContext value={profile}>{children}</PricingProfileContext>;
}

/** The one active local menu assumption for the current calculation surface. */
export function usePricingProfile(): PricingProfile {
  return useContext(PricingProfileContext);
}
