import type { Metadata } from 'next';
import { LiveMealMode } from '@/components/live/LiveMealMode';

export const metadata: Metadata = {
  title: 'Live meal mode — AYCE Damage Calculator',
  description: 'Log plates one tap at a time while you are still at the table.',
};

export default function LivePage() {
  return <LiveMealMode />;
}
