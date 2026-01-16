import { SiteFooter } from '@/components/nav/SiteFooter';
import { SiteHeader } from '@/components/nav/SiteHeader';
import { MAIN_CONTENT_ID } from '@/components/nav/destinations';

interface RouteLoadingProps {
  readonly label: string;
  readonly title: string;
  readonly description: string;
}

/** Consistent, labelled feedback while a dynamic route is being prepared. */
export function RouteLoading({ label, title, description }: RouteLoadingProps) {
  return (
    <>
      <SiteHeader />

      <main
        id={MAIN_CONTENT_ID}
        className="relative z-10 mx-auto flex min-h-[calc(100dvh-14rem)] max-w-[900px] items-center px-4 py-16 sm:px-6"
      >
        <div role="status" aria-live="polite" aria-busy="true" className="panel w-full p-6 sm:p-8">
          <p className="micro-label">{label}</p>
          <h1 className="display-type mt-4 text-3xl text-cream-50 sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-cream-300">{description}</p>
        </div>
      </main>

      <SiteFooter>Nothing has been changed while this page is loading.</SiteFooter>
    </>
  );
}
