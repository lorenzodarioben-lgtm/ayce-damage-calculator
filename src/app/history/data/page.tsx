import type { Metadata } from 'next';
import { BackupRestore } from '@/components/history/BackupRestore';
import { StorageDurability } from '@/components/history/StorageDurability';
import { SiteFooter } from '@/components/nav/SiteFooter';
import { SiteHeader } from '@/components/nav/SiteHeader';
import { MAIN_CONTENT_ID } from '@/components/nav/destinations';

export const metadata: Metadata = {
  title: 'Backup and restore — AYCE Damage Calculator',
  description: 'Export the sessions and saved orders held on this device, or restore them.',
  // A tool for data this device already holds. It has nothing to show a visitor
  // arriving cold, so it stays out of the index like every other local surface.
  robots: { index: false, follow: false },
};

export default function BackupPage() {
  return (
    <>
      <SiteHeader />

      <main
        id={MAIN_CONTENT_ID}
        className="relative z-10 mx-auto max-w-[720px] px-4 pt-6 pb-16 sm:px-6"
      >
        <h1 className="display-type mt-2 text-4xl text-cream-50 sm:text-5xl">Custody of records</h1>
        <p className="mt-3 max-w-[56ch] text-sm leading-relaxed text-cream-300">
          Your history and saved orders live in this browser and nowhere else. Clearing site data,
          or switching browser, takes them with it — a backup is how they survive that.
        </p>

        <div className="mt-8">
          <BackupRestore />
        </div>
        <div className="mt-6">
          <StorageDurability />
        </div>
      </main>

      <SiteFooter>
        Backups are ordinary JSON files written and read on this device. Nothing is uploaded at any
        point.
      </SiteFooter>
    </>
  );
}
