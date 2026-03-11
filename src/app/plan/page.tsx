import type { Metadata } from 'next';
import { DamagePlanner } from '@/components/planner/DamagePlanner';
import { SiteFooter } from '@/components/nav/SiteFooter';
import { RouteHeader } from '@/components/nav/RouteHeader';
import { SiteHeader } from '@/components/nav/SiteHeader';
import { MAIN_CONTENT_ID } from '@/components/nav/destinations';

export const metadata: Metadata = {
  title: 'Damage planner — AYCE Damage Calculator',
  description:
    'Explore how menu assumptions affect estimated retail recovery before a meal. A mathematical simulation, not a recommendation.',
};

export default function PlanPage() {
  return (
    <>
      <SiteHeader />

      <main id={MAIN_CONTENT_ID} className="relative z-10 pb-16">
        <RouteHeader image="/images/slate.webp" title="The pre-meal briefing">
          A mathematical menu simulation. Given an entry price and a set of assumptions, it works
          out which combination of plates would reach a chosen share of admission by estimated
          retail value. It is arithmetic about a menu, not a recommendation about what anyone should
          eat, and nothing here touches the meal you are actually tracking.
        </RouteHeader>

        <div className="mx-auto max-w-[900px] px-4 sm:px-6">
          <div className="mt-8">
            <DamagePlanner />
          </div>
        </div>
      </main>

      <SiteFooter>
        Planned food is not eaten food. The planner never adds anything to your tab on its own, and
        every price and portion it uses is the same illustrative estimate the calculator uses
        elsewhere.
      </SiteFooter>
    </>
  );
}
