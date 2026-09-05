import { FOODS } from '@/data/foods';

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

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-line-ember/60">
      {/* The coals. Purely atmospheric, so it is hidden from assistive
          technology and sits behind everything the section actually says. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        {/*
         * The grill itself, filling the half of the hero the words do not use.
         *
         * Masked to nothing well before it reaches the headline, so the type
         * keeps the contrast it had against a flat background and the picture
         * is never something anyone has to read past. It is atmosphere: the
         * hero says exactly what it said without it.
         */}
        <div className="absolute inset-y-0 right-0 hidden w-[64%] md:block">
          <div className="absolute inset-0 bg-[url('/images/grill.webp')] bg-cover bg-center opacity-40 [mask-image:linear-gradient(to_right,transparent_2%,rgba(0,0,0,0.18)_30%,rgba(0,0,0,0.62)_58%,black_88%)]" />
          {/* Pulls the photograph back towards the palette it is sitting in. */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-ash-950),rgba(13,12,10,0.55)_38%,rgba(13,12,10,0.25))] mix-blend-multiply" />
          {/* Feathers the top and bottom edges so the photograph ends in the
              page rather than on a line. */}
          <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-b from-transparent to-ash-950" />
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-t from-transparent to-ash-950" />
        </div>

        <div className="grill-texture absolute inset-0 opacity-70" />
        <div className="animate-ember-breathe absolute -top-40 left-[6%] h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,var(--color-ember-500)_0%,transparent_66%)] opacity-30 blur-3xl" />
        <div className="absolute -bottom-52 right-[4%] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,var(--color-char-600)_0%,transparent_68%)] opacity-40 blur-3xl" />
        {/* Fades the texture out into the page rather than ending on a line. */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-ash-950" />
      </div>

      <div className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6 sm:py-20 lg:py-24">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="h-4 w-[3px] rounded-full bg-ember-500" />
          <p className="micro-label !text-ember-400">AYCE Damage Calculator</p>
        </div>

        <h1 className="display-hero mt-6 max-w-[15ch] text-[clamp(3.25rem,10vw,7.5rem)]">
          <span className="text-cream-50">Did you beat</span>
          <br />
          <span className="text-gradient-ember">the buffet?</span>
        </h1>

        <p className="mt-7 max-w-[52ch] text-base leading-relaxed text-cream-300 sm:text-lg">
          Track the plates. Calculate the damage. Find out whether you got your money&rsquo;s worth
          or funded their next renovation.
        </p>

        <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-5 border-t border-line pt-6">
          {CREDENTIALS.map((credential) => (
            <div key={credential.value}>
              <dt className="display-type text-lg text-cream-100">{credential.value}</dt>
              <dd className="micro-label mt-1">{credential.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
