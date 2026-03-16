import { FOODS } from '@/data/foods';
import { cn } from '@/lib/cn';

/**
 * The first thing anyone sees, and the only place the app is allowed to be
 * loud.
 *
 * It is a masthead rather than a marketing hero: the question in the largest
 * type the app owns, the sentence that explains what is about to happen, and a
 * row of three plain facts about how it works. Nothing here is a claim that
 * needs qualifying and nothing is invented — the catalogue size is read from
 * the catalogue, so it cannot drift from it.
 */

/** Stated rather than sold. Each of these is true of the app as it stands. */
const CREDENTIALS = [
  { value: `${FOODS.length} cuts`, label: 'Built-in catalogue' },
  { value: 'No account', label: 'Nothing to sign up for' },
  { value: 'On device', label: 'Nothing leaves the browser' },
] as const;

interface HeroProps {
  /**
   * A meal is already in progress.
   *
   * The masthead is worth most of a screen the first time somebody arrives and
   * worth almost nothing on the fourth load of the same evening, when it is
   * just something to scroll past to reach the tab. It keeps its heading — the
   * route has exactly one, and this is it — and gives up its height.
   */
  compact?: boolean;
}

export function Hero({ compact = false }: HeroProps) {
  return (
    <section className="relative isolate overflow-hidden border-b border-line-ember/60">
      {/*
       * The grill, at full strength and across the whole hero.
       *
       * The picture is not dimmed. Dimming a photograph uniformly is how you
       * end up with neither a photograph nor a clean background — it reads as
       * dirt on the page. Instead it runs at its own brightness and a scrim is
       * laid over the corner the words occupy, so the type gets the contrast it
       * needs from the scrim and the picture keeps its own everywhere else.
       *
       * Hidden from assistive technology: it says nothing the heading does not.
       */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[url('/images/grill.webp')] bg-cover bg-[position:60%_45%]" />

        {/* Warms it towards the palette without flattening it. */}
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(122,51,36,0.35),rgba(13,12,10,0.1)_60%)] mix-blend-soft-light" />

        {/* The scrim. Near-solid under the headline, gone by the right edge —
            this is what buys the contrast, not a lower opacity on the photo. */}
        <div className="absolute inset-0 bg-[radial-gradient(120%_150%_at_0%_55%,rgba(13,12,10,0.985)_0%,rgba(13,12,10,0.955)_40%,rgba(13,12,10,0.75)_60%,rgba(13,12,10,0.32)_82%,rgba(13,12,10,0.1)_100%)]" />
        {/* A second pass downwards, so the credentials row keeps its footing
            and the section ends in the page rather than on a cut. */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(13,12,10,0.55)_0%,rgba(13,12,10,0.15)_38%,rgba(13,12,10,0.85)_88%,var(--color-ash-950)_100%)]" />

        <div className="grill-texture absolute inset-0 opacity-40" />
        <div className="animate-ember-breathe absolute -top-40 left-[4%] h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,var(--color-ember-500)_0%,transparent_66%)] opacity-25 blur-3xl" />
      </div>

      <div
        className={cn(
          'mx-auto flex max-w-page flex-col justify-center px-4 sm:px-6',
          compact ? 'min-h-0 py-5' : 'min-h-[clamp(19rem,52vh,32rem)] py-10 sm:py-16',
        )}
      >
        <div className={cn('flex items-center gap-3', compact && 'hidden')}>
          <span aria-hidden="true" className="h-4 w-[3px] rounded-full bg-ember-500" />
          <p className="micro-label text-cream-100">AYCE Damage Calculator</p>
        </div>

        <h1
          className={cn(
            'display-hero max-w-[15ch] text-over-photo',
            compact ? 'text-figure' : 'mt-6 text-[clamp(3.5rem,11vw,9rem)]',
          )}
        >
          <span className="text-cream-50">Did you beat</span>
          <br />
          <span className="text-gradient-ember">the buffet?</span>
        </h1>

        <p
          className={cn(
            'mt-7 max-w-[62ch] reading text-cream-100 text-over-photo sm:text-lead',
            compact && 'hidden',
          )}
        >
          Track the plates. Calculate the damage. Find out whether you got your money&rsquo;s worth
          or funded their next renovation.
        </p>

        <dl
          className={cn(
            'mt-10 flex flex-wrap gap-x-10 gap-y-5 border-t border-line pt-6',
            compact && 'hidden',
          )}
        >
          {CREDENTIALS.map((credential) => (
            <div key={credential.value}>
              <dt className="display-type text-lead text-cream-100">{credential.value}</dt>
              <dd className="micro-label text-cream-500 mt-1">{credential.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
