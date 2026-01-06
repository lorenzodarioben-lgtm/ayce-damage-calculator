# Changelog

All notable changes to this project are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
