# AYCE Damage Calculator

[![CI](https://github.com/lorenzodarioben-lgtm/ayce-damage-calculator/actions/workflows/ci.yml/badge.svg)](https://github.com/lorenzodarioben-lgtm/ayce-damage-calculator/actions/workflows/ci.yml)

**Did you beat the buffet, or fund their next renovation?**

**Live demo → [ayce-damage-calculator.vercel.app](https://ayce-damage-calculator.vercel.app)**

AYCE Damage Calculator is an unnecessarily serious Korean BBQ meal tracker. You log every plate you
put on the grill, and it estimates the supermarket retail value of what you ate, what the restaurant
probably paid for the raw ingredients, the full nutrition breakdown, and how much food you actually
got through. Then it delivers a verdict on whether you beat the buffet or quietly became one of its
investors.

The premise is a joke. The calculation engine, the verdict thresholds, the offline support and the
automated test suite are not. Everything runs in the browser — no accounts, no backend, no API
keys, and nothing you record ever leaves your device.

---

## Features

**Meal building**

- Beef, pork, chicken and seafood categories over an 18-item typed food dataset
- Search across every category at once, by cut, category or description
- Order the picker by menu or by retail value per kilogram
- House / Standard / Premium quality tiers, which change estimated pricing but never nutrition
- Small (100 g), Regular (155 g) and Large (220 g) serving sizes
- Adjustable plate counts, with identical selections merged into a single tab line
- Editable running tab — adjust quantities or remove a line at any point, with undo
- Saved orders: star a configured cut and re-add it in one tap
- A timestamped meal event ledger recorded alongside the tab, so a meal knows when it happened

**Session setup**

- Optional restaurant name, printed on the final report
- Configurable AYCE price per diner and diner count, validated and clamped
- Restaurant profiles you write yourself — save a setup, apply it on the next visit, and have the
  meal linked to that place
- Optional Table Mode: record a local diner roster and attribute plates without changing the shared table total
- Optional bill adjustments: vouchers, group discounts, weekend surcharges, card fees and paid extras,
  applied to the whole table or to one diner, with base admission, charges, discounts and the final
  paid total kept plainly apart
- Optional consumption tracking: record that some of a plate went back, in quarter plates, and see
  ordered, eaten and left stated plainly — no scolding, no default that assumes waste

**Restaurant hub** (`/restaurants`)

- A local list of the places you have saved, with a detail page per restaurant: visits, first and
  latest, average admission, average and best recovery, average plates and food weight, most
  ordered foods, category mix, a recovery trend and the recent visits themselves
- Start a meal from a saved place, priced and linked, so filing the report records the visit there
- A filed record belongs to a restaurant because the meal was started from it, or because you
  explicitly linked it — never because two names happen to match
- Deleting a place removes the saved setup only; filed visits keep the name, prices and menu
  context they were recorded with
- Still no bundled restaurant directory, no address, no rating, and no network call of any kind

**Personal menus**

- Currency-aware pricing profiles, starting from the built-in Australian KBBQ estimates and using
  explicit local currency and locale choices rather than exchange-rate guesses
- Per-cut price assumptions that flow through the builder, live mode, results, history and sharing
- Custom menu foods with a name, category, nutrition and price assumptions, illustrated with the
  same in-app food artwork system as the built-in catalogue
- A quick personal-menu editor that stays optional: a diner can start calculating with the default
  menu immediately

**Live Meal Mode** (`/live`)

- A one-handed surface for use at the table, driving the same session as the full builder
- One oversized button per cut; logging a plate is a single tap for the rest of the meal
- Running retail value, recovery, plates and weight pinned under the header
- Quick decrement and remove, then straight through to the full report
- Optional meal clock — 60, 90, 120 minutes or a validated custom length, with pause, resume
  and finish, derived from recorded instants so it survives reloads, backgrounding and offline use
- Pacing forecast — plates per hour, retail value per minute, recovery rate, a projected final
  recovery and the pace break-even would take, withheld until there is enough meal to project from

**Damage planner** (`/plan`)

- An optional pre-meal menu simulation: given an entry price, a diner count and a set of
  assumptions, it works out which plates would reach a chosen share of admission by estimated
  retail value
- Target recovery from 50% to 250%, with three explicit strategies — fewest plates, lowest
  estimated food weight, or a balanced spread that repeats no configuration more than three times
- Include or exclude cuts, lock the ones you want, cap repeats, and restrict quality tiers and
  serving sizes
- Shows the proposed configuration, estimated retail value, recovery, plate count, food weight,
  nutrition, and why the search settled where it did
- Planned food is never eaten food: the plan can be copied, and loading it into the calculator as a
  meal takes an explicit confirmation that says exactly what it does

**The numbers**

- Live retail damage meter tracking recovered value against total admission
- Estimated supermarket retail value and estimated restaurant ingredient cost
- Estimated ingredient margin and food-cost percentage
- Calories, protein, fat and carbohydrates
- Total food weight in grams, kilograms and pounds
- Retail break-even estimate — how many more average plates it would take
- An explicit uncertainty range behind the headline figure: conservative, base and upper scenarios
  built by moving the serving-weight, retail-price and ingredient-cost assumptions to the ends of a
  stated band, with a sensitivity ranking of which assumption moves the result most
- An even split across the table, stated as the assumption it is, whenever there is more than one
  diner
- Table Mode preserves explicit plate ownership; remaining shared plates are estimated evenly across the active roster

**The payoff**

- A deterministic verdict system, from _Corporate Sponsor_ up to _Do Not Return_
- Twelve deterministic commendations that reward breadth and precision rather than sheer volume
- A final AYCE Damage Report with the full breakdown, itemised line by line
- Copy Result, Web Share where supported, a downloadable PNG result card, and a printable receipt

**History** (`/history`)

- File a completed report and keep it, in IndexedDB, on this device
- Write a note against a session — who was there, what was worth ordering again
- Sort by recency, retail recovery or plates; search by restaurant or note; open any record
  read-only; delete one or all
- Load a filed meal back into the calculator to order it again, asking first if a tab is open
- Replay a filed meal — scrub or play back the recorded timeline, with running plates, retail
  value, recovery, food weight and diner contributions, and the moments worth naming: first plate,
  break-even, the busiest run, the longest lull, the last plate and the meal being called
- Records filed before the ledger existed say so plainly rather than being given a fabricated
  timeline
- Compare any two sessions (`/history/compare`) across recovery, retail value, admission, plates,
  food weight, category mix, commendations and food diversity, stated in percentage points where
  that is what the difference actually is
- Share the comparison as a Damage Challenge (`/challenge/<token>`) — both meals inside the link,
  read-only for the recipient, with its own generated Open Graph preview
- Local analytics (`/stats`) — totals, averages, bests, category and grade mix, and a recovery
  trend chart drawn in plain SVG
- Backup and restore (`/history/data`) — versioned JSON export of history, saved orders, personal
  menus and saved restaurants; validated import, merge or replace, migrating an older backup's
  presets into restaurant profiles
- Optional password-encrypted backups, sealed in the browser with Web Crypto, alongside the
  ordinary unencrypted export
- Spreadsheet export — history as CSV, one row per plate, for taking the numbers elsewhere

**Sharing**

- Shareable report links (`/share/<token>`) that carry the whole meal inside the URL, with no
  database behind them, including the active pricing profile and custom foods used in the meal
- Shareable menu links (`/menu/<token>`) that carry your price assumptions, your custom foods and,
  optionally, a restaurant setup — previewed read-only, imported only on request, and never
  overwriting anything the recipient already has
- A QR code for a menu link, alongside a copyable link that always works
- Shareable challenge links carrying two completed meals, with the comparison recalculated by the
  app's own engine rather than trusted from the sender
- Dynamic Open Graph images generated per report, so a posted link previews the actual verdict
- Compressed tokens, so a bigger meal or a full personal menu still fits in an address — and every
  link handed out under an older token format still opens
- A plain reason when something genuinely will not fit, rather than a link that silently is not there

**Everything else**

- Installable as a PWA, with a service worker that keeps the calculator working offline
- Responsive from 320 px phones to desktop, with original SVG food illustrations
- Skip link, keyboard-operable throughout, labelled controls, live-region confirmations,
  reduced-motion support, and AA contrast across the palette
- 1024 automated tests

## Tech stack

| Concern    | Choice                                   |
| ---------- | ---------------------------------------- |
| Framework  | Next.js 16 (App Router)                  |
| UI         | React 19                                 |
| Language   | TypeScript 5.9, strict                   |
| Styling    | Tailwind CSS 4 with a custom theme       |
| Icons      | lucide-react                             |
| QR codes   | qrcode-generator                         |
| Storage    | localStorage + IndexedDB (via `idb`)     |
| Encryption | Web Crypto (PBKDF2 + AES-GCM)            |
| Unit tests | Vitest 4 + React Testing Library         |
| E2E tests  | Playwright, desktop and mobile viewports |
| Tooling    | ESLint 9, Prettier 3, GitHub Actions     |
| Hosting    | Vercel                                   |

No component library, no state-management library, no charting library, no backend, and no external
data services. The one dependency beyond the framework and its icons is `qrcode-generator`: a
standards-correct QR encoder needs Reed-Solomon correction, eight mask patterns and forty version
tables, there is no browser-native equivalent, and getting any of it subtly wrong produces a code
that scans as something else. It is a single dependency-free MIT module; the SVG rendering is still
the app's own.

## Architecture

The interesting part of this project isn't the joke — it's that the joke is backed by a real
separation of concerns.

**Typed domain data.** The food dataset lives in `src/data/foods.ts` as readonly, strongly typed
records. No component anywhere hardcodes a price or a macro value.

**Pure calculation engine.** Weights, retail value, ingredient cost, nutrition, aggregates and
break-even estimates are all plain functions in `src/lib/` with no React dependency. They're
trivially testable, and every division is guarded so no code path can produce `NaN` or `Infinity` —
including the empty-meal case.

**A bounded optimiser.** The planner is a dynamic program over accumulated retail value in
fifty-cent buckets, clamped at the target so "more than enough" is one state rather than an
unbounded tail. Every dimension of the search — candidates, per-item cap, state width, plate
ceiling — is a constant declared in one place, so the worst case is fixed and no input can make the
browser sit and think. Ties resolve to the earliest candidate in a stable order, so the same
request always produces the same plan.

**Deterministic verdict and achievement engines.** Verdicts come from explicit ratio thresholds in a
single ordered table, not randomness. Achievements are the same idea: a table of rules over derived
facts, with every threshold named in one exported object. Nothing consults the clock or chance.

**One meal model.** Live Meal Mode, the full builder and the report all drive the same session
reducer and the same calculation engine. There is no second meal shape and no second set of sums.

**Ordered is not eaten.** A line records the plates that reached the table and, optionally, how much
of them was eaten. An absent consumed quantity means the plate went clean, which is the default for
ordinary logging and the truth about every session recorded before this existed — so the fast journey
and every old record are untouched. Where the two differ, eaten quantity drives retail value,
nutrition and recovery, because value nobody ate is not value anyone extracted; the ordered figures
are kept alongside so the tab still says what arrived. Estimated ingredient cost follows the ordered
quantity, because the restaurant bought the plate either way. Consumption can never be negative and
never exceeds what was ordered: reducing an order brings the eaten figure down with it.

**One denominator.** A bill can carry charges and discounts, so the engine settles it once and
everything measures against the result. Base admission, what was added, what was taken off and the
final paid total are four distinct figures and are never conflated; the total is floored at zero,
because a voucher larger than the bill means nothing was paid rather than that the restaurant owes
the table money. A meal with no adjustments settles to exactly its admission, which is what keeps
every session recorded before they existed calculating precisely as it always did. Adjustments
follow the same division rule the plates do: one named to a diner is theirs, and anything charged to
the table is split evenly and said to be an assumption.

**An aggregate tab, plus a ledger.** The tab in `MealSession.items` stays authoritative: every
total, verdict and report is derived from it and never from an event. Alongside it, the reducer
writes a bounded, timestamped ledger of what actually happened — plates added and taken back, lines
removed and restored, attribution changes, roster changes and lifecycle transitions — each with a
stable id, an ISO instant and a sequence number that breaks same-millisecond ties deterministically.
The reducer stays pure: the moment and the identifier are handed to it by whichever surface
dispatched the action, so nothing in the meal model reads a clock. A meal becomes _active_ from
meal activity alone; editing the restaurant name or a pricing profile deliberately starts nothing.

**Central session state.** One reducer owns restaurant name, price, diner count and every meal
action. Hydration from storage is tracked as committed state rather than a ref, which is what stops
the persistence effect from overwriting a saved session on first mount.

**Versioned local persistence, twice over.** The in-progress session is a versioned localStorage
envelope, now at version 4 with the ledger inside it. Completed sessions go to IndexedDB behind a repository that never rejects: a missing
database, a blocked one, a corrupt row or a record from an older schema all degrade to something
sensible rather than taking the page down. Saved records carry a schema version, and older
records are migrated forward on read rather than discarded — a record filed before the ledger
existed is reported as having no timeline rather than being given fabricated timestamps.

**Replay over interpolation.** A filed meal's timeline is rebuilt by replaying its ledger through
the same calculation engine the report uses, so a point on the chart and the filed total agree by
construction rather than by coincidence. The engine is pure and deterministic: the same record
produces the same series, in the same order, every time. A record with no ledger produces an
explicitly unavailable replay, never an invented one.

**Recalculation over cached derivation.** History records store the canonical meal _and_ the totals
that were shown at the time. Everything the app displays is recalculated from the meal, so history,
comparisons and analytics always agree with the current engine; each record also snapshots its menu
context so a later personal-menu edit does not silently rewrite what was filed.

**Untrusted input at every boundary.** Share tokens, imported backups, IndexedDB rows, localStorage
and the URL are all validated field by field, with explicit bounds on every number and a hard length
limit before parsing begins. A malformed input fails to `null` and is reported; it never throws, and
it can never produce a meal the calculator itself could not have produced.

**Stateless sharing.** A shared report has no server-side record. The token is a compact, versioned,
URL-safe encoding of the meal itself and the menu context needed to reproduce it. Older links keep
their original decoder, while current links carry the active pricing profile and just the custom
foods used on that tab. Shared menus use the same architecture and the same URL-safe codec: a
versioned, bounded, validated token, previewed read-only, and imported only on an explicit action
that never replaces anything local — a colliding name comes in as a separate entry instead.

**A compressor, because a link has a budget.** Reports, menus and Damage Challenges all carry their
whole payload in the address, and a JSON document full of repeated keys spends most of that budget
saying `"plateSize"` over and over. Current tokens are compressed with a small LZSS codec written
into the project — typically two thirds smaller for a meal and rather more for a menu, which is the
difference between a full personal catalogue being shareable and not. The obvious route,
`CompressionStream`, was not taken: it is asynchronous, absent from some engines this project
supports, and gives no guarantee that two builds of zlib agree byte for byte. Tokens have to be
reproducible — the same canonical meal must produce the same address on a phone, on a laptop and
inside a server-rendered Open Graph route — so the arithmetic lives here, where the output depends
on nothing but the input.

Decoding is treated as the trust boundary it is. A body declares its decoded size in its header, so
a decoder compares that claim against a fixed ceiling and refuses the token _before_ allocating
anything; back-references are validated against what has actually been produced so far; and the
output buffer is sized once and never grown. A hostile token cannot make the decoder allocate, loop
or read out of bounds. Every superseded token version keeps its own reader and is still decoded
exactly as it was — there is no server that could ever reissue a link somebody already posted, so an
address handed out today has to keep working. Dispatch is on the version prefix alone, and a token
is never retried against a second reader after the first declines it.

**Encryption without invention.** The optional encrypted backup is the ordinary design and nothing
clever: a random salt, a key derived from the password with PBKDF2-HMAC-SHA-256 at OWASP's current
iteration floor, a random IV, and AES-256-GCM — authenticated, so a file altered in transit fails to
open rather than decrypting to something plausible. The non-secret parameters live in a versioned
envelope so a later build can recognise or migrate the format instead of guessing. The password is
never stored, never logged and never put in an error; it exists only inside the call that derives a
key from it. A wrong password and a tampered file are indistinguishable to the cipher, and the
interface says so rather than pretending to know which it was.

**Conservative caching.** The service worker is network-first for documents and cache-first only for
content-hashed build assets, so a new deployment can never be masked by a stale shell. Its policy is
unit-tested directly against an in-memory Cache Storage, because neither Playwright's offline
emulation nor its request routing reaches the fetch a service worker makes on its own.

**Shared result-card model.** The on-screen result card and the exported PNG render from one shared
model, so they can't drift apart. The image is drawn directly to canvas rather than rasterised from
the DOM — no web-font fetching, no external requests, and a predictable output every time.

## How the calculations work

**Retail value** is the estimated supermarket-equivalent cost of what you ate: food weight × the
retail price per kilogram for that cut, adjusted by the selected quality tier.

**Estimated restaurant ingredient cost** applies the same idea to an illustrative bulk procurement
price — roughly what a restaurant might pay for the same raw ingredient.

**Quality tier** scales both of those prices. House is cheaper, Premium is dearer. It does not
change nutrition at all.

**Nutrition** scales from each food's per-100 g values against the total weight you recorded.

**Retail recovery** is `estimated retail value ÷ total admission × 100`. Total admission is simply
price per diner × number of diners.

**Break-even** is the playful goal: the point where your estimated retail value reaches the total
admission price. Below that, the app estimates how many more plates of your current average value
it would take to get there.

**Pacing** extrapolates the meal so far across whatever window the table booked. Elapsed time comes
from the instants the ledger recorded, never from a counter, so a paused meal is frozen at the
moment it paused and a backgrounded phone loses nothing. A projection is withheld for the first few
minutes, because extrapolating ninety minutes from thirty seconds describes the thirty seconds. All
of it is entertainment: nobody has to eat to a number.

Values are held at full precision throughout and rounded only for display.

## The headline figure is a point estimate, and says so

Every report carries a range alongside its number. Three named scenarios — conservative, base and
upper — re-run the same calculation with the serving-weight, retail-price and ingredient-cost
assumptions moved to the ends of a band the project chose and states in the interface. Alongside
them, a sensitivity ranking says which assumption moves the result most, and flags any assumption
that decides the verdict on its own.

They are **not confidence intervals**. Nothing was sampled and no distribution was estimated. They
are scenarios built from stated bounds, which is a much weaker and much more honest claim, and the
interface says exactly that. The point estimate remains the report's answer; the range is collapsed
behind a disclosure for the reader who wants to know how much that answer depends on assumptions.

## Retail value is not restaurant cost

This distinction matters, so the app is careful about it.

Retail value is what _you_ would have paid at a supermarket. Restaurant ingredient cost is what the
_restaurant_ may have paid a wholesaler. They are different numbers answering different questions,
and beating one says nothing about the other.

The estimated ingredient margin is **not** restaurant profit. It excludes labour, rent, utilities,
tax, waste, sauces, side dishes, supplier variation and every other operating cost. A restaurant can
comfortably lose the retail-value comparison and still have had a perfectly good night.

## Percentage points are not percentages

Session comparison states recovery differences in percentage points. A move from 134% to 172% is
**38 percentage points**, not a 38% increase. The comparison engine withholds a proportional change
for percentage-valued metrics entirely, so the two can never be conflated in the interface — on the
comparison page and inside a shared challenge alike, because both render from the same engine.

## Privacy

Everything is local by default and stays that way.

- Your in-progress meal, filed history, saved orders, saved restaurants, pricing profiles and
  custom foods live in this browser
- Analytics are derived on the device from your own records; no usage is tracked or transmitted
- There is no account system, no backend and no third-party service of any kind
- An encrypted backup is sealed on the device with a key derived from your password. The password
  is never stored, never logged and cannot be recovered — which is also why the file cannot be
  opened without it
- Diner names stay local. Shared links anonymise roster names by default, while an exported backup may include names because it is a deliberate local export.
- Shared challenge links carry two meals and their entry prices. Diner names, roster attribution,
  private notes and the meal ledger stay on the device; opening a challenge writes nothing.
- Shared menu links carry only the price assumptions, custom foods and (optionally) a restaurant
  setup. No history, saved order, diner name or note travels with one, and opening one changes
  nothing until the recipient imports it.
- Shared report links carry the meal snapshot **inside the URL itself** — the plates, entry price,
  pricing context and any custom foods used. Nothing is uploaded, and nothing else travels with the
  link. Shared pages are marked `noindex`, and opening one never touches the recipient's own session.
- Compression changes how many bytes a link spends, not what it carries. The same fields travel as
  before, and the privacy boundary for reports, menus and challenges is unchanged.

## Testing

```bash
npm run test:run    # unit and component tests
npm run test:e2e    # end-to-end tests, on desktop and mobile viewports
```

**Unit and component tests (Vitest + React Testing Library)** cover the calculation engine, the food
dataset's own integrity, cut search and ordering, verdict boundaries tested on both sides of every
threshold, number and currency formatting, pricing profiles, custom foods, the session reducer
including undo, storage recovery from corrupt or stale data, the IndexedDB repository against
`fake-indexeddb`, saved-session migration, meal event validation, ordering and bounds, the pacing
forecast on both sides of every boundary, replay reconstruction and its named moments, the planner's determinism and bounds, uncertainty scenarios and sensitivity ordering, restaurant profiles and their preset migration, menu-token boundaries and import conflict planning, challenge tokens and their privacy boundary, encrypted-backup envelope validation and cryptographic
round trips, session comparison, the achievement engine, favourites,
restaurant presets, share-token encoding and decoding, backup import and export, CSV escaping, local
analytics, browser-stage history, the sitemap and crawling rules, and the service worker's caching
policy.

**End-to-end tests (Playwright)** run against a production build on a 1440×900 desktop viewport and a
390×844 mobile one, covering the full meal journey, report navigation, real browser Back and Forward,
persistence across reloads, Live Meal Mode, history and comparison, favourites, presets, the share
link round trip through a genuinely separate browser context, Open Graph metadata, the printable
receipt under print media, PWA registration and cache contents, page structure and heading outlines,
the skip link, and horizontal overflow on every route.

`npm run test` runs Vitest in watch mode; `npm run test:e2e:ui` opens the Playwright UI.

## Getting started

Requires Node.js 20.9 or newer.

```bash
git clone https://github.com/lorenzodarioben-lgtm/ayce-damage-calculator.git
cd ayce-damage-calculator
npm install
npm run dev
```

Then open the local URL that Next.js prints in the terminal.

End-to-end tests need the Playwright browser once:

```bash
npx playwright install chromium
```

Other useful commands:

```bash
npm run build        # production build
npm run start        # serve the production build
npm run lint         # ESLint
npm run typecheck    # TypeScript, no emit
npm run test:run     # unit and component tests
npm run test:e2e     # end-to-end tests against a production build
npm run test:e2e:ui  # Playwright UI mode
npm run verify       # format check, lint, typecheck, tests and build in sequence
```

## Project structure

```text
src/
├── app/          routes: calculator, live, plan, restaurants, history, compare, backup, stats,
│                 challenge/[token] with its generated OG image,
│                 share/[token] with its generated OG image, offline, manifest,
│                 sitemap, robots
├── components/   meal builder, live mode, planner, restaurants, session setup, summary, results,
│                 history, stats, favourites, custom menus, navigation, methodology, PWA, UI
├── data/         the 18-item food dataset, with search and ordering
├── hooks/        session reducer, meal clock, stage history, meal history, favourites,
│                 presets, pricing profiles, custom foods, status messaging, undoable removal
├── lib/          calculations, session reducer, meal events, replay, pacing, verdicts,
│                 achievements, planner, uncertainty, restaurants, comparison, analytics,
│                 history and its repository, favourites, presets, pricing profiles, custom foods,
│                 report, menu and challenge share tokens, QR encoding, encrypted backups,
│                 social cards, backup, CSV, formatting, storage, card rendering
└── types/        domain types

e2e/              24 Playwright specs plus shared journey helpers
tests/            50 Vitest suites
public/           service worker and PWA icons
.github/          CI workflow, Dependabot, issue and pull request templates
```

## About the data

The prices and nutrition figures are illustrative estimates, not a survey. Real numbers move around
based on supplier, meat grade, location, the restaurant itself, serving size, trimming, marinade and
preparation.

Treat the output as entertainment and rough estimation. It will not hold up in a dispute with a
restaurant, and you should not try.

There is deliberately no bundled database of real restaurants. Prices vary by city, branch and
night, and inventing them would put made-up figures in front of you under the app's own name — so
restaurant presets are yours to write.

## Future ideas

Not implemented — possible directions for later versions:

- More curated regional price assumptions and currency contexts
- Other buffet formats such as hotpot or sushi
- An optional, opt-in cloud sync adapter behind the existing storage interface
- Anonymous public leaderboards

## Contributing

Setup, the conventions the code follows, and what is deliberately out of scope are all in
[CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
