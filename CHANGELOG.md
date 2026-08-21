# Changelog

All notable changes to this project are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
