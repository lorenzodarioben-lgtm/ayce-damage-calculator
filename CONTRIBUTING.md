# Contributing

Thanks for looking. This is a small project with strong opinions, and this file exists so you can
tell in five minutes whether a change is likely to be merged.

## Getting set up

Requires Node.js 20.9 or newer. CI runs Node 22 and `.nvmrc` pins the same version, so `nvm use`
lines local work up with the pipeline. Older supported versions are not blocked, just not what the
build is checked against.

```bash
npm install
npm run dev
```

End-to-end tests need the browser once:

```bash
npx playwright install chromium
```

## Before you open a pull request

Run the whole gate. CI runs the same commands, so a green run here is a green run there:

```bash
npm run verify
```

That is format check, lint, typecheck, unit tests and a production build, in that order. Run the
end-to-end suite too if you touched anything a user can click:

```bash
npm run test:e2e
```

## What the code is like

The architecture section of the [README](README.md) explains the shape of the project. A few
conventions matter more than the rest:

- **The engine is pure.** Everything in `src/lib/` is plain functions with no React dependency. If a
  calculation needs a hook to work, it is in the wrong place.
- **Nothing divides unguarded.** No code path may produce `NaN` or `Infinity`, including the
  empty-meal case. `safeRatio` exists for this.
- **Every boundary is untrusted.** Share tokens, imported backups, IndexedDB rows, localStorage and
  the URL are validated field by field. A malformed input fails to `null` and is reported; it never
  throws, and it can never produce a meal the calculator could not have produced itself.
- **One meal model.** Live Meal Mode, the full builder and the report drive the same session reducer
  and the same engine. Please do not add a second meal shape.
- **Persisted shapes are versioned.** Changing what a stored record looks like means bumping its
  schema version and migrating old records forward on read, not discarding them.
- **Comments explain why.** The code says what it does; a comment earns its place by saying why it
  was done that way, or why the obvious alternative was rejected.

## Tests

New behaviour needs a test. Which kind depends on what it is:

- Calculation, parsing, formatting or any pure logic → a Vitest suite in `tests/`
- Component behaviour a user can observe → React Testing Library, queried by role and label
- A whole journey across pages, or anything that needs a real browser → a Playwright spec in `e2e/`

Boundary values are worth testing on both sides. Several existing suites do this; follow them.

## Accessibility

The bar is not negotiable: every control is reachable and operable by keyboard, has an accessible
name, and meets AA contrast. Confirmations go to a live region. Motion respects
`prefers-reduced-motion`. A change that regresses any of these will be asked to fix it first.

## About the data

The prices and nutrition figures in `src/data/foods.ts` are illustrative estimates. Corrections that
make them more representative are welcome; so are new cuts. Two things that are not:

- Real restaurants and their prices. These vary by city, branch and night, and inventing them would
  put made-up figures in front of people under the app's own name. Restaurant presets are the user's
  to write.
- Anything that leaves the device. There is no backend, no account system and no third-party
  service, and additions in that direction are out of scope.

## Commits

Short, imperative, sentence case, describing the change from the outside: `Add restaurant presets`,
not `feat(presets): add`. One coherent change per commit.

## Reporting a bug

Open an issue with what you did, what happened, what you expected, and the browser you saw it in. If
it involves stored data, say whether a reload or a fresh profile changes anything — a lot of this app
is persistence, and that detail usually locates the problem immediately.

A security vulnerability is the exception: report it privately through the route in
[SECURITY.md](SECURITY.md) rather than opening an issue, so a reproduction that could affect other
people is not published before there is a fix.
