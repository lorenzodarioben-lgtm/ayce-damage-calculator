# AYCE Damage Calculator

**Did you beat the buffet, or fund their next renovation?**

AYCE Damage Calculator is an unnecessarily serious Korean BBQ meal tracker. It estimates the
supermarket value, restaurant ingredient cost and nutrition of everything you ate at an
all-you-can-eat restaurant, then decides whether you extracted enough value from your admission —
or quietly sponsored the place.

The premise is a joke. The calculation engine, the verdict thresholds and the test suite are not.

---

## Demo

There is no hosted deployment yet. Run it locally with the instructions below; the app is entirely
client-side and needs no API keys, database or backend.

## Features

- **Interactive meal builder** — pick a category, cut, quality tier, plate size and quantity, then
  add it to your tab.
- **18-item Korean BBQ dataset** across beef, pork, chicken and seafood, each with retail price,
  bulk ingredient cost and full macros.
- **Quality tiers** (House / Standard / Premium) that adjust estimated pricing without touching
  nutrition.
- **Portion sizing** at 100 g, 155 g and 220 g per plate.
- **Live retail damage meter** showing recovered value against admission, with a running estimate
  of how many more average plates it would take to break even.
- **Nutrition calculation** for calories, protein, fat and carbohydrates.
- **Restaurant ingredient-cost estimate**, carefully labelled as an ingredient margin rather than
  profit.
- **Deterministic verdict engine** — the same totals always produce the same verdict.
- **Local persistence** so a refresh mid-meal does not lose your tab.
- **Shareable Damage Report** with a clipboard summary, Web Share where supported, and a PNG
  result card rendered directly to canvas.
- **Responsive, accessible UI** — keyboard-operable tabs, labelled controls, live-region
  confirmations and reduced-motion support.
- **Automated tests** covering the calculation engine, verdict boundaries, formatting, storage
  recovery and the main user flows.

## Tech stack

| Concern   | Choice                             |
| --------- | ---------------------------------- |
| Framework | Next.js 16 (App Router)            |
| Language  | TypeScript, strict                 |
| UI        | React 19                           |
| Styling   | Tailwind CSS 4 with a custom theme |
| Icons     | lucide-react                       |
| Testing   | Vitest + React Testing Library     |
| Tooling   | ESLint, Prettier                   |

No component library, no state-management library, no backend and no external data services. Food
artwork is original SVG generated from a small shared illustration system.

## Architecture

The project keeps four concerns separate:

- **Data** (`src/data/foods.ts`) — the food dataset, typed and readonly. Nothing else in the app
  hardcodes a price or macro value.
- **Domain logic** (`src/lib/`) — pure functions with no React dependency: the calculation engine,
  the verdict thresholds, number formatting, storage parsing and the result-card model. Every
  division is guarded so no code path can emit `NaN` or `Infinity`.
- **State** (`src/hooks/useMealSession.ts`) — a single reducer covering session configuration and
  meal actions, plus hydration from and persistence to `localStorage`.
- **Presentation** (`src/components/`) — components render values produced by the domain layer.
  They never perform financial arithmetic inline.

The shareable result card is defined once as a data model and rendered twice: as a DOM preview and
as a canvas image for export, so the two can never drift apart.

## Calculation methodology

For each line item:

```
totalWeightG    = plateSizeGrams × quantity
weightKg        = totalWeightG / 1000

retailPerKg     = food.retailPricePerKg     × quality.retailMultiplier
ingredientPerKg = food.restaurantCostPerKg  × quality.restaurantMultiplier

retailValue     = weightKg × retailPerKg
ingredientCost  = weightKg × ingredientPerKg

calories        = (totalWeightG / 100) × food.caloriesPer100g
```

Protein, fat and carbohydrates use the same per-100 g scaling. Quality tiers do **not** change
nutrition.

Across the session:

```
totalAdmission        = pricePerDiner × dinerCount
retailValueDifference = totalRetailValue - totalAdmission
retailRecoveryPercent = (totalRetailValue / totalAdmission) × 100

estimatedIngredientMargin = totalAdmission - totalIngredientCost
estimatedFoodCostPercent  = (totalIngredientCost / totalAdmission) × 100

remainingRetailGap        = max(0, totalAdmission - totalRetailValue)
averageRetailValuePerPlate = totalRetailValue / totalPlates
platesToBreakEven          = ceil(remainingRetailGap / averageRetailValuePerPlate)
```

The verdict is chosen purely from `totalRetailValue / totalAdmission` against fixed thresholds at
0.55, 0.85, 1.00, 1.25, 1.60 and 2.00. Every boundary is covered by tests.

Values are kept at full precision throughout and rounded only for display.

## Important disclaimer

This app is for entertainment and estimation only. Actual meat prices, restaurant procurement
costs, portion sizes and nutrition vary by supplier, restaurant, preparation, trimming, marinades
and location. The dataset is illustrative rather than surveyed.

**Estimated ingredient margin is not restaurant profit.** It excludes wages, rent, utilities, tax,
waste, side dishes and every other cost of running a restaurant. Beating the buffet on
supermarket-retail value does not mean the restaurant lost money.

## Getting started

Requires Node.js 20.9 or newer.

```bash
npm install
```

```bash
npm run dev
```

Then open <http://localhost:3000>.

To run a production build locally:

```bash
npm run build
```

```bash
npm run start
```

## Testing

```bash
npm run test:run
```

`npm run test` starts Vitest in watch mode; `npm run test:run` executes once and exits, which is
the form to use in CI.

The full verification pipeline is:

```bash
npm run verify
```

which runs `format:check`, `lint`, `typecheck`, `test:run` and `build` in sequence.

### Scripts

| Script                 | Purpose                    |
| ---------------------- | -------------------------- |
| `npm run dev`          | Development server         |
| `npm run build`        | Production build           |
| `npm run start`        | Serve the production build |
| `npm run lint`         | ESLint                     |
| `npm run lint:fix`     | ESLint with autofix        |
| `npm run typecheck`    | TypeScript, no emit        |
| `npm run test`         | Vitest in watch mode       |
| `npm run test:run`     | Vitest once                |
| `npm run format`       | Prettier write             |
| `npm run format:check` | Prettier check             |
| `npm run verify`       | All of the above, in order |

## Project structure

```
src/
  app/               root layout, page, global theme, app icon
  components/
    meal/            category tabs, food grid and cards, illustrations, selectors
    session/         restaurant, price and diner configuration
    summary/         damage meter, running tab, sticky mobile bar
    results/         damage report, result card, share actions
    methodology/     "how we calculate it" dialog
    ui/              button, dialog, confirmation dialog, status toast
  data/foods.ts      the food dataset
  hooks/             session reducer and status messaging
  lib/               calculations, verdicts, formatting, storage, sharing, card rendering
  types/             domain types
tests/               calculation, verdict, formatting, storage, reducer and flow tests
```

## Future improvements

Not implemented — ideas for later versions:

- Restaurant-specific menus and price presets
- User-created food entries
- Session history across visits
- Regional datasets and currencies beyond AUD
- Support for other buffet formats such as hotpot or seafood buffets

## Licence

MIT
