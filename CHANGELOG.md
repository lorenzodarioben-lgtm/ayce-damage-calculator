# Changelog

All notable changes to this project are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **A generated preview card for the app itself.** A posted link used to preview as the 512px app
  icon: square, cropped by most feeds, and silent about what the thing does. It now renders a
  1200x630 card carrying the question the app exists to ask and the three facts that make it worth
  opening — built on the same terms as the shared-report card, palette and type only, with no
  photograph and no font fetch.
- **Illustrated empty states.** Five panels that were a sentence in a dashed box now draw the same
  overhead plate the food illustrations use, with a different thing resting on it — filed records,
  two empty seats, a shopfront, three readings, a bare plate. For anyone arriving without a meal on
  file these panels are most of the app, so they were the screens least worth leaving blank.
- **Short pages reach the bottom of the window.** A route with one small panel left the footer
  halfway up the screen with black underneath, which read as a page that had failed to load rather
  than one that was honestly empty.
- **The photographs are actually visible now.** They were dimmed to a third and disappeared into
  the background, which is the failure mode of dimming a picture uniformly: neither a photograph nor
  a clean surface. Each now runs at its own brightness with a scrim anchored to the corner the words
  occupy — near-solid under the type, thin where the frame is worth seeing. The hero is full-bleed
  and half again as tall, and the section headers are edge-to-edge bands rather than dim panels.
  Measured rather than eyeballed: the worst backdrop pixel under an actual glyph is 4.7:1 on the
  hero and 3.6–5.6:1 on the bands, against the 3:1 large-text threshold.
- **Photographic backdrops**, behind the hero, the six section headers and the verdict. Used as
  atmosphere rather than content: a third strength or less, under a wash that is almost opaque
  where the type is, so nothing on them has to be read and no screen depends on one loading. The
  app's own cut illustrations still do all the explaining. Bundled in `public/images`, so the app
  still makes no external request, and cached by the service worker so an offline visit keeps them.
- **A visual overhaul.** The interface kept its layout, its copy and every number it reports, and
  changed how all of it is presented.
  - **Three typefaces, checked into the repository** and loaded with `next/font/local`. The display
    face was Impact, reached through a system stack: one weight, a different rendering on every
    machine, and the tone of a 2003 flyer over an app that is careful about how it presents a
    number. Anton now carries the hero and the verdict, Oswald gives headings and cut names a
    weight axis, and Inter takes the interface text for its tabular figures. Nothing is downloaded
    at build time or at runtime, which is the property the old system stack was protecting.
  - **Depth, from the edges rather than the fill.** Six near-black browns all read as the same
    brown, so panels are separated by a lit top edge and a warm shadow instead. Three elevations, a
    recessed treatment for fields and inner wells, and an accent glow spent only on things that are
    genuinely live.
  - **A hero that fills the space it was given**, a verdict that arrives in the display face over a
    bloom in its own colour, and a damage meter that is a recessed instrument with quarter marks
    rather than a hairline.
  - **One shape for repeated things.** The segmented controls, the recessed wells and the button
    variants were each being assembled by hand in up to seventy places and drifting; they are now
    single utilities.
  - **A staggered arrival for the report**, so the verdict lands before the evidence, running
    entirely through properties the existing reduced-motion rule already neutralises.

### Fixed

- **"You are offline" is no longer prerendered into every page.** The initial reading guarded on
  `typeof navigator === 'undefined'` to detect the server. Node has defined a global `navigator`
  since v18 and it carries no `onLine`, so the guard passed, the property read `undefined`, and a
  disconnection was assumed — baking the banner into the static HTML of nine routes and serving it
  to every visitor before a line of client code ran, with nothing about their connection involved.
  Only a real boolean is treated as an answer now.
- **A lost connection is confirmed before it is announced.** `navigator.onLine` is a hint, and
  only one of its answers is worth trusting: the specification promises that false means no
  interface is up, and browsers get it wrong — on a machine carrying a virtual network adapter,
  Chrome reports false over a working connection, which left a permanent offline banner on the
  deployed site. A claimed disconnection is now checked with one same-origin HEAD before the bar
  repeats it. Any HTTP answer counts, including an error status: the question is whether the
  network carried a request, not whether a resource exists. The check runs only when the browser
  has already said the connection is gone, so an ordinary session never pays for it.
- **The offline banner no longer latches on over a working connection.** Network state was read
  once at hydration and afterwards only ever moved when an `online` or `offline` event arrived. A
  worker-backed app paints its shell from cache before the network has settled, so the first
  reading is often a false "offline" — and the event that should have corrected it can land before
  the listener exists, or never fire at all if the tab was in the background when connectivity
  returned. The deployed site was showing the banner with `navigator.onLine` true and requests
  succeeding. The property is now re-read on mount and whenever the page is looked at again.
- **Every field carries a visible focus ring.** Three inputs had opted out of the global focus
  outline — which is clipped by a scrolling ancestor — and replaced it with a border colour change
  alone, while a fourth, an all but identical search box, kept a ring. Thirty-one per-field
  overrides were replaced by one base rule, so a field added later cannot ship without a focus
  state.
- **The exported result card draws in the typeface it names.** It asked for "Anton" and had been
  measuring and drawing the fallback, because the loaded family name is generated. Styles now name
  a role and the family is resolved from the same custom property the stylesheet reads.

### Added

- **Timestamped meal event ledger** — every plate added or taken back, every line removed or
  restored, every attribution and roster change, and the meal's own lifecycle are recorded with a
  stable id, an ISO instant and a deterministic sequence number.
- **Meal lifecycle metadata** — a meal starts from meal activity, can be paused, resumed and
  completed, and carries the time it spent paused. Editing the restaurant name, price or pricing
  profile deliberately starts nothing.
- **Optional meal clock in Live Meal Mode** — 60, 90 or 120 minutes, or a validated custom length
  between 15 and 300, with start, pause, resume and finish. Elapsed time is derived from recorded
  instants rather than a counter, so it survives reloads, route changes, a backgrounded tab and
  offline use.
- **Encrypted backup vaults** — an optional password-encrypted export alongside the ordinary
  unencrypted JSON one, sealed in the browser with Web Crypto: a random salt, PBKDF2-HMAC-SHA-256,
  a random IV and AES-256-GCM, with the non-secret parameters in a versioned envelope. Import
  detects a sealed file, asks for the password only when one is needed, authenticates, then runs
  the existing validation and the usual merge-or-replace preview. A failure imports nothing.
- **Damage Challenge sharing** (`/challenge/<token>`) — a stateless, versioned, validated link
  carrying two completed meals, with the head-to-head recalculated by the app's own comparison
  engine and its own generated Open Graph preview. No backend, no challenge database, no account.
- **A wider comparison** — commendations gained, kept and not repeated, plus food diversity, added
  to the existing comparison engine so the history page and a shared challenge stay identical.
- **Stateless menu sharing** (`/menu/<token>`) — a versioned, bounded, validated link that carries
  a personal menu: the pricing assumptions, the diner's own foods and, optionally, a restaurant
  setup. The recipient sees a read-only preview, imports only on request, and nothing of theirs is
  ever replaced — a colliding name comes in as a separate entry, and the preview says so first.
- **QR codes for menu links**, with a copyable link always offered alongside.
- **Restaurant hub** (`/restaurants`) — a local list of saved places with a detail page for each:
  visits, first and latest, average admission, average and best recovery, average plates and
  weight, most ordered foods, category mix, a recovery trend and the recent visits. A meal can be
  started from a place, and filing it records the visit there.
- **Real plate weights** — a by-weight cut can declare what one of its regular plates actually
  weighs, per item or per pricing profile, instead of every restaurant's plates being assumed to be
  the app's nominal 155 g. Small and large scale from it in the proportion they always had. This is
  the number every other figure is multiplied by: retail value is weight times price per kilogram,
  so a place serving 250 g plates was understating its own weight, value, recovery and verdict by
  more than half. An item that declares nothing is calculated exactly as before, and the CSV
  importer now honours the grams column for plated cuts instead of reading it and throwing it away.
- **Precise diner sharing** — a line can name the few people who actually shared it, so one plate of
  wagyu split by two of the five at the table is not divided five ways and credited to three people
  who never touched it. Nobody outside the named subset is given any of it, and neither are the
  seats nobody named. The division is kept as a division rather than stored as a fraction — one
  plate between three is a third each, and a third does not survive being written down — so the
  shares always add back up to the plate. Attribution also became fractional to a hundredth of a
  plate, so "I had half of that" is recordable where it used to be floored to nothing. Recorded
  through the allocation path that already existed, and a line nobody says anything about is still
  shared by the whole table.
- **Separately charged items** — a line can say that the buffet price did not cover it and what was
  actually paid for it, so a beer, a premium upgrade or an à-la-carte extra stops being counted as
  value the entry price delivered. The headline recovery figure stays an apples-to-apples buffet
  metric: an extra's retail value never lifts the numerator and its cost never worsens the
  denominator. What it cost is recorded, never inferred from retail value — a restaurant's price for
  a beer says nothing about what the same beer costs at a supermarket — and an extra with no price
  yet is reported as unpriced rather than as free. Buffet total and spent in total are shown as the
  two different figures they are. A tab with no extras is calculated exactly as before.
- **Percentage charges and discounts** — a service charge, a card surcharge or a group discount can
  be recorded as the share of the bill it actually is, rather than worked out by hand and left to go
  stale. Each one states what it is a share of — the entry price alone, or the entry price plus the
  fixed charges already on the bill — and is resolved to money once, against a base that contains no
  percentage, so percentages never compound and the order they were entered in cannot change the
  total. A bill of plain cash amounts is untouched, and a record filed before this existed still
  means exactly what it meant.
- **Explicit visit linking** — a filed record belongs to a restaurant because the meal was started
  from it, or because the diner linked it. Two places that share a name are not assumed to be the
  same place, and older records can be linked only on request.
- **Diner hub** (`/diners`) — a local list of the people saved from a table roster, with a detail
  page for each: meals, first and latest, their plates, estimated retail value, recovery, food
  weight, what they paid, most ordered foods, category mix and the recent meals. Someone can be
  added to the meal in progress behind a confirmation, and every figure is recomputed from the
  filed meals rather than kept in a second store.
- **Stated attribution in the diner hub** — plates somebody explicitly attributed are kept apart
  from an even share of what the table shared, and the page says which is a record and which is an
  assumption. People are matched by their opaque local id rather than by display name, a meal filed
  without a roster is assigned to nobody, and removing a profile leaves every filed roster exactly
  as it was recorded. A name on a filed roster that is not saved locally is reported, not
  re-created.
- **Uncertainty and sensitivity analysis** — every report and filed record now carries a
  conservative, base and upper scenario built by moving the serving-weight, retail-price and
  ingredient-cost assumptions to the ends of a stated band, plus a ranking of which assumption
  moves the result most and whether any of them decides the verdict alone. They are named
  scenarios, not confidence intervals, and the interface says so. The point estimate remains the
  headline number and the detail stays collapsed by default.
- **Damage planner** (`/plan`) — an optional pre-meal menu simulation with a bounded,
  deterministic optimiser. Choose a target recovery between 50% and 250%, pick from three explicit
  strategies, include or exclude cuts, lock the ones you want, cap repeats and restrict quality
  tiers and serving sizes. It reports the proposed plates, estimated retail value, recovery, weight
  and nutrition, and states why the search settled there. A plan never becomes a meal without an
  explicit confirmation.
- **Meal replay** — a filed meal recorded with a ledger gains a Timeline view: a scrubbable,
  playable reconstruction with running plates, retail value, recovery, food weight and diner
  contributions, an accessible plain-SVG chart with a full table equivalent, and named moments for
  the first plate, break-even, the busiest run, the longest lull, the last plate and the meal being
  called. Records filed before the ledger existed state that detailed timing was never recorded.
- **Pacing forecast** — plates per hour, retail value per minute, recovery rate, a projected final
  recovery and the pace break-even would take before the window closes. Projections are withheld
  until a few minutes of meal have happened, and are labelled as extrapolations rather than
  promises.
- **A security policy** — where to report a vulnerability privately, what the local-first
  architecture does and does not claim, and which boundaries are treated as untrusted input.
- **A global error boundary** — a failure that prevents the root layout from rendering now gets the
  app's own recovery surface, which says plainly that stored meals were not cleared by it.
- **Default social metadata** — a link to the app itself now carries a title, description and image.
  Shared reports and challenges keep their own generated previews.
- **Source and licence links in the footer**, so the claim that nothing leaves the device can be
  checked against the code that makes it.
- **Keyboard controls for the cut search** — `/` jumps to it from anywhere on the page, Escape
  clears the query without leaving the field. Neither fires from another text field or from behind
  an open dialog.

### Changed

- **Exhaustive, cent-exact table splits** — shared food is now divided across every seat the table
  was charged for rather than only the people named on the roster, so a partial roster no longer
  hands the unnamed seats' plates to the diners who were typed in; those seats are reported as their
  own line instead. Per-seat money is settled in whole cents against the table's own total by
  largest remainder, so what each person owes adds up exactly to what the table paid.
- Shared report links no longer carry a diner's identity. Display names were already replaced with
  positions, but the underlying id was not — and a person saved from the diner hub has an id derived
  from their name, so "Lorenzo" travelled inside the token as `diner-lorenzo`. Every diner reference
  in a shared document is now rewritten to a position (`d1`, `d2`), which keeps the attribution the
  recipient needs — who shared which plate, whose charge was whose — while carrying no identity at
  all. Per-item attribution now travels too, so a shared table breakdown stops dividing every plate
  evenly and being confidently wrong. Older tokens still decode. Challenge links, which deliberately
  carry no roster or attribution, are unchanged.
- The uncertainty panel now receives the bill and measures every scenario against what was actually
  paid, the same figure the report beside it uses. A meal with a voucher or a surcharge could
  previously have its scenarios, verdicts and headline sentence computed against the undiscounted
  entry price, so the panel could contradict the report directly above it on the same screen. The
  serving-weight band also stops scaling the weight of per-serving items, whose value that
  assumption deliberately never moved.
- Added `qrcode-generator`, the project's one dependency beyond the framework and its icons. A
  standards-correct QR encoder has no browser-native equivalent and is not something to hand-roll;
  the module is dependency-free and MIT, and the SVG rendering remains the app's own.

- The session reducer moved to `src/lib/sessionReducer.ts`, free of React, and stays pure: the
  moment and identifier for each event are supplied by the dispatching surface.
- The in-progress session envelope is version 5 and filed records are schema version 8. Older
  sessions and records load unchanged and are treated as untimed rather than being given
  fabricated timestamps.
- Filed records now preserve Table Mode plate attribution, reconciled against their own roster.
- Backups are format version 4 and carry saved restaurants. A backup written before restaurant
  profiles existed has its presets migrated forward on import rather than dropped.
- Restaurant presets became restaurant profiles, migrated on first read. The old preset list is
  left in storage untouched, so an older build still finds it.
- The installed app's launcher shortcuts now cover the meal from before it to across all of them:
  Live, Plan, History and Stats.
- The offline fallback and the local backup tools are no longer offered to search engines. Neither
  has anything to show a visitor arriving cold, and `/history/data` has left the sitemap to match.

### Accessibility

- The mobile menu closes on Escape and hands focus back to the control that opened it. A native
  dialog opened from inside the menu keeps Escape for itself, so dismissing the dialog no longer
  dismisses the menu behind it.
- The page behind the open mobile menu no longer scrolls, and the lock is released on close, on
  unmount, and when the viewport grows past the width that hides the menu.
- Moving between the builder and the report respects `prefers-reduced-motion`; the scroll is
  instant when motion has been asked to stop.
- The restaurant comparison table names its own rows and columns.

### Privacy

- The encrypted backup password is never stored, never logged and never included in an error. A
  wrong password and a tampered file are indistinguishable to an authenticated cipher, and the
  message says so instead of guessing.
- A shared challenge carries two meals and their prices and nothing else: no diner names, roster
  attribution, notes or ledger, and opening one writes nothing on the recipient's device.
- A shared menu carries the menu and nothing else: no history, saved orders, diner names, notes or
  backups travel with it, and opening one writes nothing.
- Events reference diners by the same opaque local identifier the roster already uses. No display
  name, note or other free text is written into the ledger.

## [3.1.0]

### Added

- **Optional Table Mode** — a local diner roster, reusable local diner directory, per-diner admission overrides and plate attribution in the regular builder and Live Meal Mode.
- **Shared-table estimates** — each diner sees known plates plus an even share of Table plates, while the table report remains the primary calculation and its totals never change.
- **Diner-aware reports and portability** — filed roster snapshots, anonymised share rosters and CSV attribution columns.

### Privacy

- No contacts, sync service or backend was added. Diner names stay on-device unless included in a deliberate local export; share links anonymise them by default.

## [3.0.0]

The calculator can now follow the menu in front of you as well as the built-in
Australian KBBQ estimates. The default meal journey is unchanged: a diner can
still open the app and start adding plates immediately.

### Added

- **Pricing profiles** — local, currency-aware menu assumptions with explicit
  currency and locale choices. Profiles can change the retail and illustrative
  restaurant ingredient prices for individual cuts without claiming live
  exchange-rate accuracy.
- **Custom foods** — diner-authored menu items with the same pricing,
  nutrition, serving-size and quality controls as built-in foods, including
  category-matched artwork.
- **Personal-menu management** — optional editors for local pricing profiles
  and custom foods, alongside the existing restaurant setup.

### Changed

- The selected pricing context now flows through meal building, Live Meal Mode,
  reports, saved history, comparisons, result cards and shared reports.
- Filed and shared meals include the menu context they need, so later personal
  menu edits cannot silently change a historical or received report.
- Backup and restore now carry pricing profiles and custom foods, validating
  each record independently while preserving the merge and replace workflows.

### Privacy

- Personal menu data stays in browser storage. Share links contain only the
  active pricing profile and custom foods used by the shared meal; no account,
  sync service or external menu database was added.

## [2.1.0]

A follow-up release. Nothing here changes how a number is calculated; everything here is about
finding a cut faster, recovering from a mis-tap, seeing what the verdict was actually built from,
and getting your own records back out.

### Added

**Meal building**

- **Cut search** — one field that reaches across every category at once, matching on name, category
  or description. Each word narrows, so "premium pork" means what it looks like.
- **Value ordering** — order the picker by menu or by retail price per kilogram.
- **Undo on removal** — removing a tab line now offers it straight back, with its quality, plate
  size, quantity and position intact. Available in the full builder and in Live Meal Mode.

**The report**

- **Itemised breakdown** — every line on the tab, with its configuration, volume and value, on the
  report itself. Previously this detail existed only on the printable receipt. Shared by the live
  report, a filed record and a shared link, so the three cannot drift apart.
- **The even split** — when the table is more than one, admission, retail value, food and calories
  per head, stated plainly as an even division rather than dressed up as a per-person measurement.

**History**

- **Session notes** — write a note against a filed session and read it back on the record and in the
  list. Saved records are now schema version 3; version 1 and 2 records are migrated forward on
  read, as before.
- **Search the file** — narrow filed sessions by restaurant name or by anything in a note. Appears
  once the file is long enough to lose something in.
- **Order this again** — load a filed meal back into the calculator. The record is untouched, and an
  open tab is never replaced without asking.
- **Spreadsheet export** — history as CSV, one row per plate, alongside the existing JSON backup.
  Fields that a spreadsheet would read as formulas are neutralised on the way out.

**Project**

- A sitemap and crawling rules, with shared reports excluded from both.
- Dependabot, grouped so a framework bump arrives as one reviewable pull request.
- A contributing guide, issue forms and a pull request template.

### Changed

- The builder states the size of the dataset from the dataset itself rather than from a number typed
  into the markup.
- Reports state the diner count they were built for, so anything downstream can divide by it without
  being handed it separately.
- The breakdown's total is labelled "Total" rather than repeating the headline metric's own label.

### Tests

- 568 unit and component tests across 25 files, up from 410 across 20. New coverage for the food
  dataset's integrity, search and ordering, undoable removal, the per-diner split, session notes and
  their migration, history filtering, CSV escaping, and the sitemap and robots rules.

## [2.0.0]

A major release. V1's calculator is unchanged in behaviour and still the front door; everything
around it is new. The application remains entirely local — no accounts, no backend, no API keys, and
nothing recorded ever leaves the device.

### Added

**Product**

- **Live Meal Mode** (`/live`) — a one-handed logging surface for use at the table, with one
  oversized button per cut and the running total pinned in view. It drives the same session reducer
  and calculation engine as the full builder.
- **Meal history** (`/history`) — file a completed report and keep it in IndexedDB on this device.
  Sort by recency, retail recovery or plates; open any record read-only; delete one or clear all.
- **Session comparison** (`/history/compare`) — measure any two filed sessions against each other,
  line by line and by category mix.
- **Damage analytics** (`/stats`) — totals, averages, bests, category and grade distribution, most
  ordered cuts and a recovery trend chart, all derived locally and drawn in plain SVG.
- **Achievements** — twelve deterministic commendations that reward breadth and precision rather
  than sheer volume, shown on the report and recorded with each filed session.
- **Saved orders** — star a configured cut and re-add it in one tap, from the builder or Live Mode.
- **Restaurant presets** — save a session setup and apply it on the next visit. Applying never
  touches the plates on the tab, and asks first when a meal is already in progress.
- **Backup and restore** (`/history/data`) — versioned JSON export of history and saved orders, with
  a validated import that previews the file and offers merge or replace.
- **Printable damage receipt** — the report as a monospaced docket, revealed only by the print
  stylesheet.

**Sharing**

- **Shareable report links** (`/share/<token>`) — a completed report encoded into a compact,
  versioned, URL-safe token. No database, no server-side record; the link is the payload. Shared
  pages are read-only and never touch the recipient's own session.
- **Dynamic social preview images** — an Open Graph card generated per report from the same token
  the page renders, so the preview and the page can never disagree.

**Platform**

- **Installable PWA** — web app manifest, original app icons including a maskable variant, and a
  service worker that keeps the calculator working offline once it has been opened. Caching is
  network-first for documents so a new deployment can never be masked by a stale shell.
- **Browser history integration** — the builder/report transition is a real history entry, so
  browser Back and Forward behave the way the URL implies without losing the meal.
- **Coherent navigation** — a shared header across every route, laid out on wide screens and behind
  a single control on narrow ones.
- **Offline page** for routes that were never visited.

**Engineering**

- **CI quality gates** — a GitHub Actions workflow running format, lint, typecheck, unit tests and a
  production build, then end-to-end tests behind a cached browser install.
- **Playwright end-to-end coverage** — 118 tests across 15 files, run against a production build on
  both a desktop and a mobile viewport.
- Unit coverage grown from 110 to 410 tests, including the IndexedDB repository, schema migration,
  share-token encoding, backup validation and the service worker's caching policy.

### Changed

- Saved-session records moved to schema version 2, carrying the achievements a session earned.
  Version 1 records are migrated forward on read rather than discarded.
- The report body is now a single shared component behind the live report, filed records and shared
  links, so all three present the same figures in the same order.
- History, comparisons and analytics recalculate every session from its canonical meal rather than
  trusting the totals cached at save time.
- Session comparison states recovery differences in percentage points, and deliberately withholds a
  proportional change for percentage-valued metrics so the two cannot be conflated.
- `next.config.ts` sets `X-Content-Type-Options`, `Referrer-Policy` and no-store headers for the
  service worker script.

### Accessibility

- A skip link on every page, and a `main` landmark to skip to.
- Report headings promoted to level one where the report is the page's own content, fixing an
  outline that previously started at level two on shared and filed reports.
- Safe-area insets applied to the document, so a notched phone held sideways keeps text off the
  cutout.
- Charts carry accessible names and expose the same figures as a table.
- Contrast verified across the palette; the lowest pairing in use is 4.79:1.

### Fixed

- The history list computed each session's report twice per render — once to sort, once to display.
  Sorting now returns the resolved sessions it already had to build.

## [1.0.0]

Initial public release.

### Added

- Meal builder over an 18-item typed food dataset across beef, pork, chicken and seafood.
- House / Standard / Premium quality tiers and Small / Regular / Large serving sizes.
- Session setup: optional restaurant name, price per diner and diner count, validated and clamped.
- A pure calculation engine for retail value, estimated restaurant ingredient cost, ingredient
  margin, food-cost percentage, nutrition, weight and a retail break-even estimate.
- A deterministic verdict system from _Corporate Sponsor_ up to _Do Not Return_.
- Live damage meter, editable running tab and a full AYCE Damage Report.
- Copy Result, Web Share where supported, and a downloadable PNG result card drawn to canvas.
- Sessions persisted to `localStorage` behind a versioned, re-validated envelope.
- Responsive layout from 320 px upwards, with original SVG food illustrations.
- 110 unit and component tests.

[2.0.0]: https://github.com/lorenzodarioben-lgtm/ayce-damage-calculator/releases/tag/v2.0.0
[1.0.0]: https://github.com/lorenzodarioben-lgtm/ayce-damage-calculator/releases/tag/v1.0.0
[3.0.0]: https://github.com/lorenzodarioben-lgtm/ayce-damage-calculator/releases/tag/v3.0.0
[3.1.0]: https://github.com/lorenzodarioben-lgtm/ayce-damage-calculator/releases/tag/v3.1.0
