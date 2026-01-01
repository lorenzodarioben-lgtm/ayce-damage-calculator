# AYCE Damage Calculator

**Did you beat the buffet, or fund their next renovation?**

**Live demo → [ayce-damage-calculator.vercel.app](https://ayce-damage-calculator.vercel.app)**

AYCE Damage Calculator is an unnecessarily serious Korean BBQ meal tracker. You log every plate you
put on the grill, and it estimates the supermarket retail value of what you ate, what the restaurant
probably paid for the raw ingredients, the full nutrition breakdown, and how much food you actually
got through. Then it delivers a verdict on whether you beat the buffet or quietly became one of its
investors.

The premise is a joke. The calculation engine, the verdict thresholds and the 107-test suite are
not. Everything runs in the browser — no accounts, no backend, no API keys.

---

## Features

**Meal building**

- Beef, pork, chicken and seafood categories over an 18-item typed food dataset
- House / Standard / Premium quality tiers, which change estimated pricing but never nutrition
- Small (100 g), Regular (155 g) and Large (220 g) serving sizes
- Adjustable plate counts, with identical selections merged into a single tab line
- Editable running tab — adjust quantities or remove a line at any point

**Session setup**

- Optional restaurant name, printed on the final report
- Configurable AYCE price per diner and diner count, validated and clamped

**The numbers**

- Live retail damage meter tracking recovered value against total admission
- Estimated supermarket retail value and estimated restaurant ingredient cost
- Estimated ingredient margin and food-cost percentage
- Calories, protein, fat and carbohydrates
- Total food weight in grams, kilograms and pounds
- Retail break-even estimate — how many more average plates it would take

**The payoff**

- A deterministic verdict system, from _Corporate Sponsor_ up to _Do Not Return_
- A final AYCE Damage Report with the full breakdown
- Copy Result to the clipboard, Web Share where the browser supports it, and a downloadable PNG
  result card
- Sessions persisted to `localStorage`, so a mid-meal refresh doesn't cost you your tab

**Everything else**

- Responsive from 320 px phones to desktop, with original SVG food illustrations
- Keyboard-operable tabs, labelled controls, live-region confirmations, reduced-motion support
- 110 automated tests

## Tech stack

| Concern   | Choice                             |
| --------- | ---------------------------------- |
| Framework | Next.js 16 (App Router)            |
| UI        | React 19                           |
| Language  | TypeScript 5.9, strict             |
| Styling   | Tailwind CSS 4 with a custom theme |
| Icons     | lucide-react                       |
| Testing   | Vitest 4 + React Testing Library   |
| Tooling   | ESLint 9, Prettier 3               |
| Hosting   | Vercel                             |

No component library, no state-management library, no backend, no external data services.

## Architecture

The interesting part of this project isn't the joke — it's that the joke is backed by a real
separation of concerns.

**Typed domain data.** The food dataset lives in `src/data/foods.ts` as readonly, strongly typed
records. No component anywhere hardcodes a price or a macro value.

**Pure calculation engine.** Weights, retail value, ingredient cost, nutrition, aggregates and
break-even estimates are all plain functions in `src/lib/` with no React dependency. They're
trivially testable, and every division is guarded so no code path can produce `NaN` or `Infinity` —
including the empty-meal case.

**Deterministic verdict engine.** Verdicts come from explicit ratio thresholds in a single ordered
table, not randomness. The same totals always produce the same verdict, and every boundary has a
test on both sides of it.

**Central session state.** One reducer owns restaurant name, price, diner count and every meal
action. Hydration from storage is tracked as committed state rather than a ref, which is what stops
the persistence effect from overwriting a saved session on first mount.

**Versioned local persistence.** Stored sessions carry a schema version and are re-validated field
by field on load. Corrupt JSON, an unknown version, an unavailable `localStorage` or individually
invalid meal items all degrade to sensible defaults instead of crashing.

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

Values are held at full precision throughout and rounded only for display.

## Retail value is not restaurant cost

This distinction matters, so the app is careful about it.

Retail value is what _you_ would have paid at a supermarket. Restaurant ingredient cost is what the
_restaurant_ may have paid a wholesaler. They are different numbers answering different questions,
and beating one says nothing about the other.

The estimated ingredient margin is **not** restaurant profit. It excludes labour, rent, utilities,
tax, waste, sauces, side dishes, supplier variation and every other operating cost. A restaurant can
comfortably lose the retail-value comparison and still have had a perfectly good night.

## Testing

```bash
npm run test:run
```

110 tests across seven files, covering:

- the calculation engine — weights, pricing, quality multipliers, nutrition scaling, aggregation
- verdict boundaries, tested just below and exactly at every threshold
- number and currency formatting, including signed values and rounding
- storage recovery from corrupt, stale or malformed persisted data
- session reducer behaviour — merging, clamping, removal, reset
- the main user flows, from empty state through report to reset

`npm run test` runs Vitest in watch mode; `npm run test:run` runs once and exits.

## Getting started

Requires Node.js 20.9 or newer.

```bash
git clone https://github.com/lorenzodarioben-lgtm/ayce-damage-calculator.git
cd ayce-damage-calculator
npm install
npm run dev
```

Then open the local URL that Next.js prints in the terminal.

Other useful commands:

```bash
npm run build      # production build
npm run start      # serve the production build
npm run lint       # ESLint
npm run typecheck  # TypeScript, no emit
npm run test:run   # run the test suite once
npm run verify     # format check, lint, typecheck, tests and build in sequence
```

## Project structure

```text
src/
├── app/          Next.js entry, layout, global theme, app icon
├── components/   meal builder, session setup, summary, results, methodology, UI primitives
├── data/         the 18-item food dataset
├── hooks/        session reducer and status messaging
├── lib/          calculations, verdicts, formatting, storage, sharing, card rendering
└── types/        domain types

tests/            calculation, verdict, formatting, storage, reducer and user-flow tests
```

## About the data

The prices and nutrition figures are illustrative estimates, not a survey. Real numbers move around
based on supplier, meat grade, location, the restaurant itself, serving size, trimming, marinade and
preparation.

Treat the output as entertainment and rough estimation. It will not hold up in a dispute with a
restaurant, and you should not try.

## Future ideas

Not implemented — possible directions for later versions:

- Restaurant-specific menus and pricing
- Regional price datasets and currencies beyond AUD
- User-defined food presets
- Saved meal history across visits
- Other buffet formats such as hotpot or sushi
- Richer share cards

## License

[MIT](LICENSE)
