# DESIGN.md

The design system of record for the AYCE Damage Calculator.

This document is authoritative. Where it disagrees with the code, the code is wrong and is
scheduled to change. Where it disagrees with `PRODUCT.md`, `PRODUCT.md` wins — that file
describes what the product _is_; this one describes how it looks and behaves.

Derived from the design audit of 2026-09-06. Every measured figure quoted here was taken from
the codebase at commit `7fe4ed1` and is stated as a baseline, not a target.

---

## 1. The core principle

> **Keep the room. Make the reading the product.**

The app answers one question — _did we beat the buffet?_ — with one number, continuously,
at a table, in the dark, on somebody's phone. That number is the product. Everything else is
evidence for it.

Three consequences, in priority order. When two of them conflict, the lower number wins.

1. **The reading is the primary object on every screen that has one.** It is not a card in a
   sidebar and it is not a 4px bar. It is persistent, full-width, and readable at arm's length.
2. **Everything else is evidence, and evidence is a register, not a grid of tiles.** Figures
   are ranked. Ten equal boxes is a refusal to rank.
3. **The room stays.** Dark, warm, photographic, grainy, lit from above. We repair it; we do
   not move out of it.

### What this replaces

The audit found a recently and carefully redesigned interface that had solved presentation
while leaving structure alone: a good design system in `globals.css` that 105 component files
route around, a type ramp with no middle, and a report that cannot tell a triumph from a
defeat because both render as the same ten dark rectangles.

This document is the structural half that was missing.

---

## 2. Visual identity

### 2.1 The room

A Korean BBQ table at nine in the evening. Near-black warm browns, one hot light overhead,
charcoal, grain in the air, meat on a grill. The interface sits _in_ that room rather than
depicting it.

The following are load-bearing and are **preserved**:

| Asset                  | Where                                                   | Why it stays                                                                                                                                                                 |
| ---------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Photographic backdrops | `public/images/*.webp` — hero, route mastheads, verdict | Run at full brightness with a scrim anchored to the corner the words occupy. This method is correct; uniform dimming is not.                                                 |
| SVG grain              | `body::after`, `opacity: 0.035`                         | With six near-black browns, the grain is part of what separates surfaces.                                                                                                    |
| Ambient radial light   | `body::before`, three sources                           | Same. The page is lit; scrolling moves through light.                                                                                                                        |
| `grill-texture`        | hero, mastheads, verdict header                         | The one repeated motif that is about _this_ product.                                                                                                                         |
| Food illustrations     | `FoodIllustration.tsx`, ~1,083 lines                    | Hand-authored SVG per cut on a shared five-stop tone ramp. The single most product-specific asset in the repository. Promote it; never replace it with photography or icons. |
| Empty-state plates     | `EmptyState.tsx`                                        | Five glyphs resting on the same overhead plate the food illustrations use, because an empty history and an empty menu are the same absence.                                  |
| `BrandMark` grill bars | `BrandMark.tsx`                                         | Restrained and correct.                                                                                                                                                      |

**Removing the grain or the ambient light is forbidden** unless the border contrast work in
§5.3 has already landed. They are currently doing the surface-separation work that a 1.2:1
border cannot do.

### 2.2 The tension is the product

The copy is a parody of a forensic accountant: _"Margin Compression Event."_ _"Your photo may
already be behind the register."_ _"Restaurant is sleeping well."_ _"No prior incidents on
record."_

A parody needs its subject in the frame. **Deadpan audit language delivered inside a barbecue
room is the joke. Audit language on a document that genuinely looks like an audit is just an
accounting app.**

So: we do not make the interface look like a ledger, and we do not soften the copy. We make
both sides _more themselves_ — the room warmer and more specific, the figures colder and more
precise — and we let them sit next to each other with a straight face.

**Never** rewrite verdict titles, verdict copy, house statuses, route titles or empty-state
copy for visual reasons. The voice is the most valuable asset in the product.

---

## 3. Typography

### 3.1 The scale

Seven steps. Every piece of text in the application is one of these, or it is the
`micro-label`, or it is display type. There are no other sizes.

| Step             | px  | rem    | Role                                                                                          |
| ---------------- | --- | ------ | --------------------------------------------------------------------------------------------- |
| `--text-caption` | 13  | 0.8125 | Hints under fields, footnotes, table sub-values, unit suffixes, legal                         |
| `--text-ui`      | 15  | 0.9375 | **UI default.** Buttons, field labels, list rows, nav, secondary body                         |
| `--text-body`    | 17  | 1.0625 | **Reading default.** Prose, methodology, uncertainty, verdict copy, route-masthead paragraphs |
| `--text-lead`    | 20  | 1.25   | Sub-section headings (`h3`/`h4`), card titles, lead paragraphs                                |
| `--text-title`   | 26  | 1.625  | Section headings (`h2`), supporting figures                                                   |
| `--text-figure`  | 34  | 2.125  | Secondary figures, page titles on routes without a masthead                                   |
| `--text-reading` | 48  | 3      | The reading. Primary figures.                                                                 |

Above the scale, display type only (§3.3): `clamp()` sizes for the hero, route mastheads and
the verdict.

**Baseline being replaced:** 26 distinct sizes, of which `text-sm` (209 uses) and `text-xs`
(193) accounted for 402 of 493 named-size declarations, with **five** uses of `text-lg` and
**four** of `text-xl` in the whole product. The scale was shout-or-whisper with nothing
between. Steps 17, 20 and 26 are the missing middle and are where most migration lands.

### 3.2 Typeface roles

Three faces, self-hosted as local WOFF2 via `next/font/local`. **No font may be added, and no
font may be fetched at build time or at runtime.** This is a hard constraint, not a preference.

#### Inter — everything that is read

The default. Body, UI text, field labels, buttons, list rows, and **every figure**. Chosen for
its tabular numerals: this app is numbers in columns and a total must not shift sideways as it
counts. Any element displaying a number carries `font-variant-numeric: tabular-nums`.

Weights in use: 400 (body), 500 (UI), 600 (emphasis, labels), 700 (figures, primary buttons).
No other weight.

#### Oswald — labels and section headings

Confined to two jobs:

1. **`micro-label`** (§3.4) — weight 500.
2. **Section and sub-section headings** at steps 20 and 26 — weight 600.

Oswald is loaded as a variable font across 200–700 explicitly so the same condensed voice can
be loud or quiet. **That axis must actually be used.** The current `display-type` utility
hard-codes `font-weight: 600` and no component overrides it; that is a paid-for capability
going unused. Headings take 600; labels take 500.

Oswald is **forbidden below 15px** and forbidden for body copy, buttons, and any run of text
longer than about six words.

#### Anton — display only, ≥ 34px

Three permitted uses in the application, and one in a shared artifact:

| Use                                                               | Size                           |
| ----------------------------------------------------------------- | ------------------------------ |
| Home hero                                                         | `clamp(3.5rem, 11vw, 9rem)`    |
| Route masthead                                                    | `clamp(2.75rem, 8vw, 4.75rem)` |
| Verdict                                                           | `clamp(2.5rem, 8vw, 4.75rem)`  |
| `ResultCard` verdict (documented exception, fixed 420px artifact) | 40px                           |

**Anton has a hard floor of 34px.** Its sidebearings are too tight and its counters too small
to survive below that in a dark theme. Current violations to be migrated to Inter tabular:
`QuantityStepper.tsx` at `text-base` (**16px**), `DamageMeter.tsx` compact at `text-2xl` (24px)
and `text-[2rem]` (32px), `ReportSummary.tsx` at `text-3xl` (30px).

The reading itself (§7) is **Inter tabular at 48px**, not Anton. The reading is a measurement,
and measurements are set in the face with the honest numerals.

### 3.3 Body reading style

The app currently has no long-form reading typography anywhere: 52 instances of
`text-xs leading-relaxed` and 41 of `text-sm leading-relaxed`, and the uncertainty
explanation — the content that makes this rigorous rather than a toy — is set two sizes below
body text in the faintest colour on the palette.

The reading style is:

```
font-family:  Inter
font-size:    17px  (--text-body)
line-height:  1.6
colour:       cream-300  (10.25:1 on a panel)
measure:      62ch–68ch
paragraph gap: 0.75em
```

Applied to: the methodology dialog, `UncertaintyPanel` prose, verdict copy, route-masthead
paragraphs, empty-state paragraphs, and every disclaimer.

**Disclaimers are body copy.** They are the product's honesty and they are currently 12px in
the app's dimmest colour. They get the reading style like everything else.

Measures collapse from twelve values (`40/44/46/48/52/56/58/60/62/65/70/76ch`) to three:
**`44ch`** (centred empty-state and dialog copy), **`62ch`** (default prose), **`68ch`**
(dense reference prose such as methodology definitions).

### 3.4 `micro-label` — reduced and re-scoped

```
font-family:    Oswald
font-weight:    500
font-size:      11px
letter-spacing: 0.14em
text-transform: uppercase
colour:         cream-500
```

**A `micro-label` is the caption of a value or the header of a column. It is never a heading.**

| Permitted                                               | Forbidden       |
| ------------------------------------------------------- | --------------- |
| The label above a figure (`RETAIL DAMAGE`, `ADMISSION`) | Any `h1`–`h4`   |
| A table column header                                   | A section title |
| A fieldset `legend` naming a group of options           | A paragraph     |
| The eyebrow above a masthead title                      | A field label   |

**Baseline:** ~123 uses carrying seven semantic roles at one identical visual weight — `h3`
×36, `h2` ×27, `p` ×24, `dt` ×13, `span` ×5, `legend` ×4, `h4` ×4. So 27 `h2` elements
rendered as an 11px label while three rendered as a 30px heading; a section boundary and a
field caption were pixel-identical.

**Worst instance, and the one that must be fixed first:** `ReportSummary.tsx:141` renders the
report heading as `className="micro-label !text-ember-400"`. On `/share/[token]` and
`/history/[id]`, where the report _is_ the page, its `<h1>` is 11px — the smallest text on the
page.

**Target: ≤ 30 uses.** Everything else becomes a real heading at step 20 or 26, or a field
label at step 15.

`micro-label` must also stop baking its colour into the utility. It currently forces
`color: var(--text-faint)`, which has produced four `!important` escapes across the codebase.
The utility sets type only; colour comes from the caller.

### 3.5 Headings

| Element                          | Style                          |
| -------------------------------- | ------------------------------ |
| `h1` (masthead routes)           | Anton, `clamp()`, cream-50     |
| `h1` (routes without a masthead) | Oswald 600, step 34, cream-50  |
| `h2`                             | Oswald 600, step 26, cream-100 |
| `h3`                             | Oswald 600, step 20, cream-100 |
| `h4`                             | Inter 600, step 17, cream-200  |

Heading levels must never skip — this is asserted across seven routes by
`e2e/accessibility.spec.ts` and is a hard constraint, not a guideline.

### 3.6 Tracking

Nine tracking values collapse to three tokens:

| Token                | Value   | Use                       |
| -------------------- | ------- | ------------------------- |
| `--tracking-label`   | 0.14em  | `micro-label` only        |
| `--tracking-caps`    | 0.08em  | Uppercase buttons and nav |
| `--tracking-display` | 0.005em | Anton display type        |

Body, headings and figures take the face's natural tracking. No arbitrary `tracking-[…]`
values.

---

## 4. Colour

### 4.1 The governing rule

> **Colour communicates measurement and state. If something is coloured, it is telling you
> where you stand.**

Navigation is not coloured. Section headings are not coloured. Borders are not coloured.
Buttons take colour only from their rank. Decoration is not coloured.

**The single explicit exception is the focus ring**, which is ember by deliberate decision so
that keyboard users get one unmistakable, unambiguous signal that never competes with a
measurement. This exception is written down here so that nobody, finding the rule
inconvenient, invents a second accent.

**Baseline being replaced:** ember was simultaneously the brand mark, the focus ring, the
primary CTA, every hover border, every selected segment, every selected card, every money
figure (`text-ember-400`, 51 uses), section-heading accents, link colour, meter sheen, three
ambient page gradients, and a warning state. It meant everything, so it meant nothing — and
because it was also the colour of _money_ and of _action_, the report's five buttons had to be
grey: there was no accent left to rank them with.

### 4.2 The measurement bands

One axis runs through the entire product: **ratio = estimated retail value ÷ total admission.**
Every colour that describes a result is derived from it, and from nothing else.

| Band      | Ratio    | Channel    | Meaning                            |
| --------- | -------- | ---------- | ---------------------------------- |
| Behind    | `< 1.00` | **ember**  | The live reading, below break-even |
| Recovered | `≥ 1.00` | **sesame** | Break-even passed                  |
| Runaway   | `≥ 1.60` | **flame**  | The house is losing badly          |

`flame` is currently **completely dead** — zero component usages — despite being documented as
reserved for "a meter past break-even, a verdict in the diner's favour." Neither of those
moments used it; both used sesame. The Runaway band is what finally wires it up, and it is the
only thing flame is ever allowed to do.

Flame is not a third accent to reach for. Across an entire session, a diner will typically
never see it.

### 4.3 Resolving the contradictions

Three colour contradictions were found. All three are resolved by §4.2.

**(a) The meter and the verdict disagreed between 100% and 125%.** `DamageMeter.tsx` flipped
to sesame at `recoveryPercent >= 100`, while `verdicts.ts` assigns ratio 1.0–1.25 the tone
`'even'`, which mapped to `text-ember-300`. So the meter was green and the verdict headline was
orange, on the same screen, describing the same number.

_Resolution:_ the verdict tone → colour map is presentation and changes here. Thresholds,
titles, copy and the `tone` values themselves are business logic and **do not change**.

| `verdict.tone` | Ratio range | Colour                                                     |
| -------------- | ----------- | ---------------------------------------------------------- |
| `house`        | `< 1.00`    | `cream-50` — a loss is stated plainly; the copy carries it |
| `even`         | `1.00–1.25` | `sesame-400`                                               |
| `diner`        | `≥ 1.25`    | `sesame-400`, or `flame-400` at `≥ 1.60`                   |

**(b) The same red meant both outcomes of the same axis.** `char-500` was used for "Value gap"
(_you lost_) and, three tiles away, for "Estimated ingredient-cost breach" (_you won so hard the
kitchen is underwater_).

_Resolution:_ **every colour on the report answers the question from the diner's frame.** The
house-status severity ramp is a derived reading of the same axis and takes the same bands —
so a house under pressure renders sesame or flame, never red. Red never appears at a moment of
triumph.

**(c) Ember carried both "money" and "action".**

_Resolution:_ money figures are **cream**, not ember. A figure is coloured only when its value
places it in a band. `$59.90` admission is cream; `21%` recovered is ember; `+$7.40` extracted
is sesame.

### 4.4 Role table

| Family     | Role                                                                                   | Never                                                             |
| ---------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **ash**    | Surfaces and ground                                                                    | Text                                                              |
| **cream**  | All text; all figures that are not in a band                                           | A state signal                                                    |
| **ember**  | The reading below break-even; the focus ring (§4.1 exception); the primary button fill | Headings, nav, borders, links, hovers, decoration                 |
| **sesame** | Recovered band: meter fill, verdict, positive deltas                                   | Success toasts, valid fields, generic "good"                      |
| **flame**  | Runaway band only (`ratio ≥ 1.60`)                                                     | Anything else, ever                                               |
| **char**   | Money the diner is down; destructive actions and their confirmations                   | Any positive outcome; any "alert" that is good news for the diner |

Destructive red and negative-value red are the same colour because they are the same idea from
the diner's frame: something is being taken away.

### 4.5 Tokens

**Newly defined — closing the undefined-token bug.** Three colour classes are referenced in
components but never defined in `@theme`, so Tailwind emits nothing and seven elements
silently inherit their parent's colour — two of them delete-button icons. This is the _same_
bug already documented and fixed once for `cream-200` at `globals.css:13`; it has recurred
twice more.

| Token               | Value     | Contrast on ash-850 |
| ------------------- | --------- | ------------------- |
| `--color-cream-400` | `#bcae94` | 8.41                |
| `--color-cream-600` | `#9c8e7a` | 5.73                |
| `--color-char-400`  | `#d68872` | 6.66                |

**Line tokens — raised.** `--color-line` at `#2a241d` on `--surface-raised` `#171411` is
**1.2:1**. The entire panel system — 68 `panel` uses, 21 `well` uses — rested on a border
nobody could see, which is why the app read as brown mush.

| Token                 | Old       | New                     | On ash-950 / ash-900 / ash-850 / ash-800 |
| --------------------- | --------- | ----------------------- | ---------------------------------------- |
| `--color-line-soft`   | `#221d17` | `#4a4038`               | 1.94 / 1.88 / 1.82 / 1.69                |
| `--color-line`        | `#2a241d` | `#63564b`               | 2.76 / 2.68 / 2.59 / 2.41                |
| `--color-line-strong` | _(new)_   | `#726558`               | 3.46 / 3.36 / 3.25 / 3.02                |
| `--color-line-ember`  | `#5c452a` | `#7d5930` (= ember-700) | 3.11 / 3.02 / 2.92 / 2.72                |

- `line-soft` — dividers _inside_ a surface, between sibling sections.
- `line` — the edge of a surface.
- `line-strong` — the boundary of an **interactive component** (field, button, segmented
  track, option card). Meets WCAG 1.4.11 non-text contrast (3:1) on every surface in the app.

**Deleted.** `--ease-out-back` (zero consumers). `--glow-ember`, `--glow-flame`,
`--glow-sesame` and their three `@utility` wrappers (zero consumers). `--radius-card`,
`--radius-panel` (superseded by §5.1). The `elevate-panel` / `elevate-raised` / `elevate-float`
utilities are **not** deleted — they are adopted (§5.2).

### 4.6 Contrast requirements

Measured against the surface the text actually sits on, not against the page ground.

| Content                                    | Minimum                                     | Preferred token                                                           |
| ------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------- |
| Body and prose, including every disclaimer | **7:1**                                     | `cream-300` (10.25 on a panel)                                            |
| UI text, labels, buttons, list rows        | **4.5:1**                                   | `cream-100` / `cream-300`                                                 |
| Secondary and caption text                 | **4.5:1**                                   | `cream-500` (6.73)                                                        |
| Figures in a band                          | **4.5:1**                                   | `ember-300` 9.60 · `sesame-400` 7.77 · `flame-400` 7.17 · `char-400` 6.66 |
| Interactive component boundaries           | **3:1**                                     | `line-strong`                                                             |
| Disabled controls                          | **3:1**, and must not rely on opacity alone | see below                                                                 |

**`cream-700` is retired for text.** At 4.89:1 on a panel and 4.55:1 on `ash-800` it sits on
the AA floor, it is applied almost exclusively at 12px, and it is the app's **most-used text
colour at 174 uses** — carrying every disclaimer and every methodology paragraph. In a dim
restaurant that is the difference between readable and not. Migrate to `cream-500` (secondary)
or `cream-600` (quietest permitted). `cream-700` survives only for non-text ornament.

**`char-500` on `ash-800` is 4.45:1 and fails.** Use `char-400` (6.20 on `ash-800`) wherever
red text lands on a raised surface.

**Disabled controls must not compound.** The current primary sets `disabled:bg-ash-700
disabled:text-cream-700` (4.08:1) _and_ `disabled:opacity-70`, for an effective ≈ 3.0:1 — the
disabled "Calculate the damage" reads as absent rather than unavailable. Disabled state is a
flat unlit fill with `cream-500` ink and **no opacity modifier**.

---

## 5. Surfaces, radius and elevation

### 5.1 One radius

| Token            | Value    | Use                                                |
| ---------------- | -------- | -------------------------------------------------- |
| `--radius`       | **10px** | Every rectangular surface and control              |
| `--radius-inner` | **6px**  | An element nested directly inside a 10px container |
| `--radius-full`  | 9999px   | **Circular geometry only**                         |

`--radius-full` is permitted for exactly three things: the measurement track and its fill, the
circular illustration/plate discs, and the stepper thumb. **It is not permitted for badges,
price chips, tags, buttons or status pills.** Those take `--radius`.

**Baseline:** seven radii in use — `rounded-[10px]` ×100, `[8px]` ×31, `[9px]` ×5, `[12px]` ×4,
`[7px]` ×1, plus `--radius-card` (14px) and `--radius-panel` (18px) used six times _total_.
Four of them sat inside a 3px band. 10px is chosen because a hundred files already use it, so
the migration is subtraction.

### 5.2 Three elevations, and they are utilities

`elevate-panel`, `elevate-raised` and `elevate-float` exist, are documented as the way "a
component asks for a height off the page rather than assembling a shadow of its own", and have
**zero consumers**. Instead there are **31 distinct hand-rolled `shadow-[…]` values** plus
**8 distinct `drop-shadow-[…]`**, including near-duplicate pairs such as
`rgba(13,12,10,0.9)` and `rgba(13,12,10,0.95)`.

| Level | Utility          | What lives here                       |
| ----- | ---------------- | ------------------------------------- |
| 0     | _(none)_         | The page ground                       |
| 1     | `elevate-panel`  | A section of the page                 |
| 2     | `elevate-raised` | The measurement spine; the verdict    |
| 3     | `elevate-float`  | Dialogs, the toast, the sticky header |

**A component may not write its own `box-shadow` or `drop-shadow`.** Depth is requested by
name. The only exceptions are the type drop-shadows over photographic backdrops, which are a
legibility device rather than an elevation, and are consolidated to one value.

### 5.3 Remove nested surfaces; do not merely strengthen every border

This is the most important rule in this section, and the reason §4.5's border lift must never
ship on its own.

Raising `--color-line` from 1.2:1 to 2.59:1 gives **all 108 `panel` and `well` boxes a visible
edge at once**. An app that was tonal mush becomes a wireframe of 108 boxes. The border lift
and the surface reduction are **one change, not two**.

**Nesting rules:**

- A `panel` **may not contain a panel.** A section inside a section is a `border-top` rule plus
  spacing, never a second box.
- A `well` may not contain a `panel` or another `well`.
- Maximum surface depth from the page ground is **two** (page → panel → well). The current worst
  case is four (page → panel → panel → scroller → well).
- **No scroll container inside a scroll container.** `PricingProfileManager` currently nests a
  `max-h-[40dvh]` scroller inside a panel inside `SessionSetup`; `MealTabItem` puts five
  controls inside a `max-h-[38vh]` scroller inside the tab panel inside the page.

**Target: reduce the 108 `panel`/`well` instances by at least half.** Most of them are section
dividers wearing a box.

**Any container that scrolls must show it** — an edge fade or an inset shadow on the
overflowing axis. `TableBreakdown` (`min-w-[580px]`), `UncertaintyPanel` (`min-w-[420px]`) and
the `ResultCard` wrapper currently scroll horizontally on a phone with no affordance at all.

### 5.4 Surface tokens

| Token                     | Value     | Use                       |
| ------------------------- | --------- | ------------------------- |
| `--surface-base`          | `ash-950` | Page ground               |
| `--surface-raised`        | `ash-850` | `panel`                   |
| `--surface-raised-strong` | `ash-800` | `elevate-raised` surfaces |
| `--surface-recessed`      | `ash-900` | `well`, fields            |

The `--fill-panel` top-light gradient (a 2.5% lift at the top edge) is preserved. It is what
makes a panel an object rather than a rectangle, and at that strength it is not a "gradient" in
the sense §12 bans.

---

## 6. Layout

### 6.1 Mobile first, 375–430px

The design target is a phone held one-handed in a dark restaurant. Every layout decision is
made at **375px** first and relaxed upward. A rule that only makes sense at 1280px is not a
rule.

**Baseline:** `sm:` 162 uses, `lg:` 15, `md:` **zero**. Twenty-nine markup files carry no
breakpoint classes at all. The entire `/live` route — the surface built for exactly this scene
— runs on **four** `sm:` classes.

| Breakpoint | Width    | Layout                                                                                    |
| ---------- | -------- | ----------------------------------------------------------------------------------------- |
| Base       | 375–639  | Single column. 16px gutter. Spine fixed to the bottom.                                    |
| `sm:`      | 640–1023 | Single column, 24px gutter, wider measure. Spine still bottom-fixed.                      |
| `lg:`      | 1024+    | Two columns: content + 380px rail. Spine moves to the top of the rail and becomes sticky. |

`md:` remains unused deliberately — three breakpoints is enough, and inventing a fourth invites
the drift this document exists to stop.

**Horizontal overflow must never exceed 1px** at any width. This is asserted across seven
routes by `e2e/accessibility.spec.ts` and by `e2e/layout.spec.ts`, including with a
200-character restaurant name.

### 6.2 One content measure

**Baseline:** six page widths — 1280, 900, 720, 640, 560, `max-w-md` — with header, footer and
hero at 1280 while every section route sits at 900. On six of eight routes the brand mark sat
~190px to the left of the content it heads.

| Token              | Value      | Use                                                          |
| ------------------ | ---------- | ------------------------------------------------------------ |
| `--measure-page`   | **1100px** | Header, footer, and every route's content container          |
| `--measure-narrow` | **640px**  | Error, 404, offline, and share/challenge/menu failure states |

One page measure. The header, the footer and the content align on every route. The calculator's
`1fr / 380px` split sits inside `--measure-page`, which also fixes the report rendering at
1280px on the calculator and 900px everywhere else from the identical component.

### 6.3 The path to the first plate

**Baseline: the mobile calculator is 5,978px tall, and the running tab sits _below_ the entire
meal builder.**

_Metric:_ scroll distance from the top of the document to the primary "add a plate" control, at
390×844, with an empty session.

_Target:_ **< 3,000px.** _Stretch:_ < 1,200px.

The mechanism is **order**, not concealment:

1. **Compact masthead.** The hero is currently `min-h-[clamp(30rem,68vh,46rem)]` and is
   rendered unconditionally, so a returning diner mid-meal scrolls past ~550px of masthead on
   every load. First visit: ≤ 55vh. A session that already has items: a 96px masthead strip.
2. **The builder comes before the configuration.** Session setup is currently twelve stacked
   sub-sections above the builder, including five empty states for features nobody has used.
   The builder moves directly under the masthead; setup follows it.
3. **The food grid becomes a list on mobile.** Seven beef cards in two columns is ~880px. Seven
   list rows at ~72px is ~504px, and a list is easier to hit with a thumb.
4. **Choosing a cut and configuring it are adjacent.** Today you tap a card at the top of the
   grid and the quality/plate/quantity controls appear ~600px below, off-screen, with only
   `"Configuring — {name}"` to remind you what you picked.

**Disclosure is constrained by the test suite and must be verified per spec.** `e2e/helpers.ts`
fills `Restaurant` and `Price per diner` with no disclosure step, and Playwright's `fill()`
throws on a hidden node. **Restaurant, Price per diner, Menu pricing and Diners must remain
rendered and visible by default.** Only sections no spec interacts with may collapse, and each
must be checked against the suite before it does.

---

## 7. The measurement spine

The identity move. This is what makes the product look like itself.

### 7.1 What it is

A persistent, full-width calibrated reading of the one number the app exists to report. It is
present on every screen that has a value: the calculator, live mode, the report, a shared
report, a filed session.

It replaces the 4px unlabelled progress bar currently pinned to the bottom of the phone
viewport, and it replaces the meter-inside-a-card-inside-a-rail on desktop.

### 7.2 Anatomy

```
┌─────────────────────────────────────────────────────────────┐
│ RETAIL DAMAGE                              $12.40 / $59.90  │  micro-label + Inter 15 tabular
│ ▓▓▓▓▓▓▓░░░░┊░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│        │  track, quarter marks, break-even datum
│ $47.50 until break-even                              21%    │  caption 13          reading 48 tabular
└─────────────────────────────────────────────────────────────┘
```

| Part             | Spec                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------- |
| Label            | `micro-label`, cream-500                                                              |
| Value pair       | Inter tabular, step 15; retail in cream-100, admission in cream-500                   |
| Track            | Recessed, `--radius-full`, `line` border, inset shadow; 12px tall mobile, 8px desktop |
| Quarter marks    | 25/50/75%, `cream-50/15`, above the fill so they survive it                           |
| Break-even datum | A 2px cream-100/40 rule at 100%, always visible                                       |
| Fill             | Band colour (§4.2), lit along its own top edge                                        |
| Caption          | Step 13, cream-500 — the gap remaining, or the overshoot                              |
| **The reading**  | **Inter tabular 700, step 48 (`--text-reading`), band colour**                        |

The reading is the largest thing on the screen apart from a verdict. It is set in Inter, not
Anton, because it is a measurement.

### 7.3 Break-even and beyond

| Ratio    | Track                                                       | Reading    | Caption                      |
| -------- | ----------------------------------------------------------- | ---------- | ---------------------------- |
| `< 1.00` | ember fill, width = ratio                                   | ember-300  | `$X until retail break-even` |
| `≥ 1.00` | sesame fill, **track full**, break-even datum still visible | sesame-400 | `You beat the buffet*`       |
| `≥ 1.60` | flame fill, full                                            | flame-400  | `You beat the buffet*`       |

**The bar caps at 100% while the numeric reading keeps climbing.** A 250% meal must not blow
out the layout, and an unreadable width reads as no progress. This behaviour already exists in
`DamageMeter.tsx` and is preserved exactly.

The asterisk keeps its `sr-only` expansion — _"by estimated supermarket retail value, not
restaurant profitability"_ — so the caveat is never lost to a screen reader.

`role="progressbar"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow` and `aria-valuetext`
is preserved. **`aria-valuenow` updates once per committed value change, never per animation
frame.**

### 7.4 Placement

- **Mobile / tablet:** fixed to the bottom edge, above `env(safe-area-inset-bottom)`,
  `elevate-float`. Thumb-reachable. Tapping the reading expands the tab; it does not navigate.
- **Desktop (`lg:`):** the top of the 380px rail, `lg:sticky`, `elevate-raised`.
- **On the report:** inline, directly beneath the verdict, full width, `elevate-raised`. This is
  the one place it is not fixed, because on the report it _is_ the content.

The spine is never hidden while a session has items.

---

## 8. The report

### 8.1 Ranked, not tiled

**Baseline:** ten equal dark tiles. `"Est. retail value $12.40"`, `"Plates ordered 2 plates"`
and `"Carbohydrates 0 g"` received the same box, the same weight, the same treatment — so the
layout was byte-identical at 21% recovery and at 248%. Only one line of text changed colour.
**The report could not tell a triumph from a defeat.**

Three ranks. Nothing sits outside them.

| Rank           | Count         | Treatment                                                                                                                                                                                                                                         |
| -------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Primary**    | 1             | The verdict (Anton, band colour, over the embers backdrop) immediately followed by the measurement spine. One block, full width, `elevate-raised`. This is the answer.                                                                            |
| **Secondary**  | **exactly 3** | Est. retail value · Admission · Value gap/extracted. A three-up ruled register — `micro-label` caption, Inter tabular step 34, band colour on the delta only. Hairline rules between, **no boxes**.                                               |
| **Supporting** | all the rest  | Plates, weight, nutrition, the house ledger, the per-diner split, the meal breakdown, the table breakdown. A plain ruled register: label left, figure right in a tabular column, `line-soft` between rows, no boxes, no tiles, no coloured edges. |

Every supporting figure in the report aligns to **one right-hand number column**. That is what
makes it read as a document rather than a dashboard, and it is the only place the ledger idea
is allowed to surface.

`ResultMetric`'s tone-coloured leading edge is removed. It was a patch on the tile grid — the
grid is gone, so the patch goes with it.

### 8.2 Arrival

The staggered arrival is preserved and is correct: 70ms per step, capped at six (≈ 420ms), so
the verdict lands before the evidence. It runs entirely through properties the reduced-motion
rule neutralises.

### 8.3 Action hierarchy

**Baseline:** six actions of identical weight — Copy share link, Copy result, Download card,
Save to history, Edit meal, Print damage receipt. All `variant="secondary"`. **No primary
action anywhere on the report.** The end of the flow was a wall of equal grey.

| Rank                      | Action                                                  | Style                           |
| ------------------------- | ------------------------------------------------------- | ------------------------------- |
| **Primary — exactly one** | **Save to history**                                     | `primary`, full width on mobile |
| Secondary                 | Share / Copy link                                       | `secondary`                     |
| Supporting                | Copy result · Download card · Print receipt · Edit meal | `ghost`, in a single row        |

There must be exactly one primary on the report. Which action holds it is a product decision
that may change; that there is exactly one is not.

The `ResultCard` preview stops floating in a full-width panel with ~300px voids either side.
On mobile it is full-bleed to the gutter; on desktop it is left-aligned in a two-column block
with the share actions beside it.

---

## 9. Components

One pattern per job. Where a second pattern exists today, it is being deleted, not kept as an
alternative.

### 9.1 Buttons

| Variant       | Fill                           | Border        | Ink        | Rule                              |
| ------------- | ------------------------------ | ------------- | ---------- | --------------------------------- |
| `primary`     | ember-400 → ember-600 vertical | none          | ash-950    | **At most one per screen region** |
| `secondary`   | ash-800                        | `line-strong` | cream-100  |                                   |
| `ghost`       | none                           | none          | cream-300  |                                   |
| `destructive` | none                           | `char-600`    | `char-400` | §9.3                              |

| Size | Height   | Type                                  |
| ---- | -------- | ------------------------------------- |
| `sm` | **44px** | step 13, uppercase, `--tracking-caps` |
| `md` | **48px** | step 15, uppercase, `--tracking-caps` |
| `lg` | 56px     | step 17, uppercase, `--tracking-caps` |

`sm` rises from 36px to 44px. There is no button below 44px.

**Link-buttons use the `Button` recipe.** There are currently **seven** link-button recipes,
none of which uses the gradient `Button.tsx` defines as primary — so a new visitor meets a
_flat_ ember rectangle on `/live`, `/404`, error pages and every shared link. `CTA_CLASS` is
copy-pasted verbatim into three route files and `BACK_LINK` is independently defined four
times. All of them collapse into `Button` and one exported `buttonClasses()` helper for
anchors.

### 9.2 Icon buttons

44px minimum hit area regardless of glyph size; 48px on the logging path. Every icon button
carries an `aria-label`. An icon button that performs a destructive action is never placed
within 12px of a constructive one.

**Baseline to fix:** 35–45 interactive elements sit below the app's own 44px standard,
including a **28px** unlabelled delete `X` overlapping the right edge of the add button with
4px clearance in `FavoriteQuickAdd.tsx:90`, and the same pattern in `RestaurantPresets.tsx:118`.

### 9.3 Destructive actions

**`ConfirmDialog` hard-codes `variant="primary"` on the confirming button**, so all fourteen
call sites render the destroying action as the app's glowing ember CTA while the safe path is a
borderless ghost. "Replace everything" — permanent loss of all local history — is the warmest,
most attractive object on screen.

Required:

- `ConfirmDialog` gains a `destructive` prop. When set: confirm is `destructive`, cancel is
  `secondary`. Cancel holds initial focus.
- The default `cancelLabel` of `'Keep my tab'` is removed. Every call site names its own,
  because it is currently rendered verbatim on "Delete this place?" and "Remove this person?".
- **Any destructive action that is not behind a confirm dialog must offer undo.**
  `useUndoableRemove` exists for exactly this, is tested, and is imported by nothing but its own
  test; `StatusAction` exists in `useStatusMessage` for exactly this and has zero consumers.
  Plate removal — the most-tapped destructive control in the product, a 36px unlabelled trash
  icon adjacent to the quantity stepper — currently destroys a line's quality, plate size,
  quantity and consumption state with no toast, no confirmation and no undo. Wire the hook in.

### 9.4 Fields and selects

One pattern. There is currently no `Input`, `Field` or `Select` component: 58 fields are
hand-assembled in four heights and eight text/colour combinations.

```
Label       Inter 600, step 15, cream-100, above the control
Control     48px mobile / 44px desktop, --radius, surface-recessed,
            line-strong border, inset shadow, Inter step 17
Hint        step 13, cream-500, below
Error       step 13, char-400, below, with aria-describedby
```

Focus is an **inset ring**, never an outline — an outline is clipped by scrolling ancestors,
which is already documented in `globals.css` and already fixed for fields. See §11.1.

### 9.5 Pick-one controls

**Baseline: four visual languages and three keyboard models for one job** —
`segmented-track` + `role="tablist"` with arrow keys (`CategoryTabs`), the same visuals with
`role="group"` + `aria-pressed` and no arrow keys (`FoodSort`), `OptionCard` with native radios
where only one of two adjacent groups has glyph discs (`QualitySelector` / `PlateSizeSelector`),
and visible native radios in a plain list (`DamagePlanner`). Counting `HistoryList`, `StatsView`
and `BillAdjustments`, there are **six segmented-control recipes**.

Two patterns survive:

| Pattern               | When                                                             | Anatomy                                                                                                                                                                           |
| --------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Segmented control** | 2–4 options that are a _mode or filter_, labelled by a word      | `segmented-track` recessed housing + `segmented-thumb` raised selected segment. Selection is a **change of shape**, not only of colour, so it survives being read without colour. |
| **Option card**       | 2–4 options that are a _value with detail_ (quality, plate size) | Native `<input type="radio">` inside a `<label>`, card styling, optional glyph.                                                                                                   |

The `OptionCard` glyph is either present on all members of a group or on none.

Native radios in a list are retired; `DamagePlanner`'s strategy picker becomes option cards.

**Locked by tests and unchangeable:** the visually-hidden native radio inside a `<label>`, with
the visible focus outline on the label. `e2e/helpers.ts` does
`getByRole('radio', {name}).locator('..').click()` and `e2e/accessibility.spec.ts:96–114` drives
it with ArrowRight and asserts the wrapping label has non-zero `outlineWidth`. **Plate size and
quality must remain three radios.** No dial, no slider, no custom widget.

### 9.6 Steppers

One: `segmented-track` housing, 48px targets on the logging path, Inter tabular value at step
20 (not Anton at 16px). `− value +`, with `aria-label` on both controls.

### 9.7 Dialogs

Native `<dialog>` with `showModal()`, which supplies the backdrop, inertness and Escape. Focus
trap retained for older engines.

- Surface `elevate-float`, `--radius`, `line-ember` border, `surface-raised`.
- Width `min(38rem, calc(100vw - 2rem))`, `max-height: 85dvh`.
- Sticky opaque header; body scrolls beneath it.
- Title: Oswald 600, step 26.
- **Body copy uses the reading style (§3.3).** The methodology dialog is the app's most
  important trust artifact and is currently its least designed surface: a flat wall of
  term/definition pairs at 14px with no typographic distinction between term and body, and a
  horizontal overflow at the foot. Terms become step 17 Inter 600; definitions become the
  reading style; a `line-soft` rule separates entries; nothing overflows horizontally.
- `transform-origin: center` — a modal is not anchored to a trigger.

**Escape must close only the topmost layer.** `e2e/mobile-navigation.spec.ts` asserts that
Escape closes the methodology dialog while leaving the mobile menu open with
`aria-expanded="true"`, and that `document.body.overflowY` is `'hidden'` while the menu is open
and not afterwards. Both are locked.

### 9.8 Status and toast

**The channel rule** — currently undocumented, which is why both are used for the same kinds of
outcome:

| Channel                    | When                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------ |
| **Inline `role="status"`** | The outcome belongs next to the control that caused it and that control is on screen |
| **Toast**                  | The outcome is not visible where the user is looking, or it carries an undo offer    |

Toast spec: `--radius`, `surface-raised-strong`, `line-ember` border, `elevate-float`, centred,
above the spine. Step 15 cream-100. Plain confirmations 2,600ms; actionable 7,000ms.

**A toast must be dismissible and must animate out.** It currently enters with a 200ms keyframe
and then vanishes on unmount — it blinks out of existence, with no dismiss control and no
swipe. The 7-second actionable variant sits over the content with no way to clear it. Enter
180ms, exit 140ms, plus a close affordance.

The `aria-live="polite"` region is always mounted; only the visual bubble mounts and unmounts.
The container is `pointer-events: none` so a resting toast never intercepts a tap.

---

## 10. Motion

### 10.1 Timing categories

**Baseline: 62 of 69 duration values are `duration-200`.** A button press and a panel hover
moved at the same speed; nothing had its own character.

| Category                             | Duration                   | Easing            |
| ------------------------------------ | -------------------------- | ----------------- |
| Press / tap feedback                 | **120ms**                  | `--ease-out-soft` |
| Hover, colour, border                | **160ms**                  | `--ease-out-soft` |
| Small overlay in / out               | **180 / 140ms**            | `--ease-out-soft` |
| Dialog in / out                      | **220 / 160ms**            | `--ease-out-soft` |
| The reading                          | **420ms**                  | `--ease-out-soft` |
| Report stagger                       | 70ms per step, capped at 6 | `--ease-out-soft` |
| Ambient (ember breathe, meter sheen) | 2.8s / 7s                  | `--ease-out-soft` |

**Exit is always faster than entry.**

Easing tokens:

- `--ease-out-soft: cubic-bezier(0.22, 1, 0.36, 1)` — entering and exiting. Retained; correct.
- `--ease-in-out-strong: cubic-bezier(0.77, 0, 0.175, 1)` — movement on screen. New.
- `--ease-out-back` — **deleted.** Defined, never used. No overshoot in this product.

`ease-in` is forbidden on UI: it delays the initial movement, at the exact moment the user is
watching most closely.

### 10.2 What may animate

Only `transform` and `opacity`. **Four components currently animate `width`**, a layout
property, at up to 500ms: `DamageMeter`, `StickySummaryBar` (×2) and `MealPacing`.

The spine's fill is a full-width element translated inside an `overflow-hidden` track, not a
width transition — this preserves the fill's rounded end and keeps the sheen from stretching.
The quarter marks and the break-even datum belong to the **track**, not the fill, so they do
not move.

### 10.3 Press feedback

One value: `transform: scale(0.97)` at 120ms. There are currently three (`0.95`, `0.985`,
`0.99`) for the same gesture.

### 10.4 Hover gating

**Every transform-based hover state is wrapped in `@media (hover: hover) and (pointer: fine)`.**

There is currently **no such gate anywhere in the codebase**, while six components carry
`hover:-translate-y-*` or `lift-on-hover`. On touch, tapping a food card commonly leaves it
stuck in its lifted, glowing hover state until something else is tapped.

Colour-only hovers may remain ungated; movement may not.

### 10.5 Reduced motion

The current rule collapses **every** animation and transition to `0.001ms`, which also kills
hover feedback, focus transitions and the meter's own colour change.

Reduced motion means _fewer and gentler_, not _none_:

| Removed                                                    | Kept                                           |
| ---------------------------------------------------------- | ---------------------------------------------- |
| All `transform` motion — lifts, slides, scale              | Opacity transitions, capped at 120ms           |
| The report stagger (blocks appear together)                | Colour and border transitions, capped at 120ms |
| `animate-ember-breathe`, `animate-meter-sheen`             | The spine's band **colour** change             |
| The spine's fill translation — the value updates instantly | Focus ring appearance                          |

`prefersReducedMotion()` and `scrollBehaviour()` in `lib/motion.ts` are retained: a scroll asked
for in script carries its own `behavior` and overrides the stylesheet, so the preference has to
be read in both places.

---

## 11. Accessibility

Everything in this section is **preserve or improve**. Nothing here may regress.

### 11.1 Focus

Two structural bugs in the current global rule:

1. It hard-codes `border-radius: 4px` on the ring, so every circular control gets a
   near-rectangular ring around a pill and every 10px control gets a 4px ring around a 10px
   corner.
2. It uses `outline`, which is **clipped by scrolling ancestors**. `globals.css` documents this
   exact problem and fixes it for form fields only — so keyboard focus on a tab-line's trash
   button (inside `max-h-[38vh] overflow-y-auto`) or a diner chip (inside `overflow-x-auto`) is
   clipped today.

Required:

```
:focus-visible {
  outline: 2px solid var(--color-ember-400);
  outline-offset: 2px;
  border-radius: inherit;          /* follows the control's own corner */
}
```

Plus an **inset ring** (`box-shadow`) variant, applied to any control inside a scroll container
and to all form fields, because a ring drawn inside the element's own box survives both
clipping and rounded corners.

The focus ring is ember. This is the one deliberate exception to §4.1 and is not to be
relitigated.

**Locked by `e2e/accessibility.spec.ts`:** the wrapping `<label>` of a quality/plate-size radio
must have non-zero `outlineWidth` when the radio is focused.

### 11.2 Contrast

§4.6. Body prose at 7:1, UI at 4.5:1, interactive boundaries at 3:1, disabled at 3:1 without
opacity compounding.

### 11.3 `forced-colors`

Currently unhandled.

- Structural boundaries come from `border`, never from `box-shadow` alone — a shadow is not
  rendered in forced-colors mode, so a panel defined only by elevation disappears.
- The `segmented-thumb`'s selected state is already a **change of shape**, not only of colour.
  Preserve that; it is what makes selection survive forced colors.
- The spine exposes its state textually via `aria-valuetext`, so the reading is never
  colour-only.
- Verify under `@media (forced-colors: active)` that every control retains a visible boundary
  and that the selected segment is still identifiable.

### 11.4 `prefers-contrast: more`

- `--color-line` → `--color-line-strong`.
- `cream-500` and `cream-600` → `cream-300`.
- Disabled opacity modifiers removed.
- Photographic backdrops drop to a flat `surface-base` behind text blocks.

### 11.5 Keyboard and semantics

Preserved exactly as they are — this is the strongest part of the current build:

- **Zero non-semantic interactive elements.** Every control is a real `button`, `a`, `input`,
  `select` or `textarea`. This must stay at zero.
- Roving tabindex with `ArrowLeft` / `ArrowRight` / `Home` / `End` on the category tablist.
- Native radios inside labels for quality and plate size.
- `role="progressbar"` with `aria-valuetext` on the reading.
- `aria-live="polite"` regions; `role="status"` and `role="alert"` where each belongs.
- Skip link as the first tab stop, navigating to `#main-content`.
- Exactly one `main`, one `banner`, one `contentinfo` and one `h1` per route, with no heading
  level skipped.
- `document.body.overflowY: hidden` while the mobile menu is open, restored on close.
- The mobile menu toggle's accessible name flips between `'Open the menu'` and
  `'Close the menu'`, and Escape returns focus to it.

**`CategoryTabs` currently hard-codes `grid-cols-4` while `visibleCategories()` can return
eight.** At five or more the tablist wraps to two rows while still declaring
`aria-orientation="horizontal"`, and arrow-key navigation crosses visual rows. The grid becomes
a scrolling single row with an overflow affordance, or the orientation is corrected.

### 11.6 Target sizes

| Context                                                         | Minimum                           |
| --------------------------------------------------------------- | --------------------------------- |
| Everything                                                      | **44 × 44px**                     |
| The logging path — add plate, ±, spine controls, live-mode rows | **48 × 48px**                     |
| Adjacent destructive + constructive controls                    | 44px each, **12px apart minimum** |

**Locked by `e2e/layout.spec.ts`:** the measured `boundingBox().height` of
`getByRole('button', { name: 'Calculate the damage' })` must be `>= 44`. This is the suite's
only rendered-pixel assertion.

---

## 12. The shared artifacts

The app is not the only surface. Four artifacts carry the design and three of them are outside
the stylesheet entirely. **They are part of this system and change with it.**

| Artifact                         | File                               | Renderer             | Constraint                                    |
| -------------------------------- | ---------------------------------- | -------------------- | --------------------------------------------- |
| `ResultCard` (on-screen preview) | `results/ResultCard.tsx`           | React, inline styles | Fixed 420px                                   |
| Share image                      | `lib/resultCardImage.ts`           | Hand-written canvas  | Hardcoded `WIDTH 420`, `PADDING 24`, `GAP 18` |
| OG images                        | three `opengraph-image.tsx` routes | Satori               | **Cannot read WOFF2**                         |
| Print receipt                    | `results/DamageReceipt.tsx`        | Print stylesheet     | Monospace docket                              |

### 12.1 One source of truth

`lib/resultCard.ts` holds `CARD_COLOURS` and the figure model. It is the single source for the
palette and the stat set across the preview, the canvas painter and all three OG routes.
**Any palette change lands in `resultCard.ts` in the same commit as the stylesheet change**, or
the shared artifacts silently keep the old product.

Also in that commit: `src/app/icon.svg` (`fill="#0D0C0A"`), `apple-icon.png`, the three
`public/icon-*.png` files, and `THEME_COLOUR` in `lib/constants.ts`.

`e2e/pwa.spec.ts:72` asserts `manifest.theme_color === '#0d0c0a'`. The room stays dark, so this
assertion stays true — but any future change to it is a test edit and must be treated as one.

### 12.2 The OG constraint

`opengraph-image.tsx` states it outright: the display faces ship as WOFF2, "which this renderer
cannot read." **An OG card's identity therefore cannot come from the typeface.** It comes from
layout, palette, and the reading. Design the OG cards on that basis rather than approximating
Anton with the renderer's default and hoping.

### 12.3 The print receipt is a deliberately separate register

`DamageReceipt.tsx` is monospace, `'='.repeat(44)` rules, `"DAMAGE RECEIPT"`, `"FINDING"`,
`"THANK YOU FOR YOUR CUSTOM"`. It is the one place the ledger idea is fully expressed, and it
is correct: a printed page cannot be clicked, so it carries no interactive elements at all.

**It is preserved as-is.** It uses `font-mono` — a fourth typeface supplied by the OS — and
that is now a _declared_ decision rather than an accident.

The three registers relate like this, and the relationship is deliberate:

| Register   | Artifact                 | Shares with the others                                          |
| ---------- | ------------------------ | --------------------------------------------------------------- |
| **Screen** | the app                  | the verdict copy, the figure set, the palette                   |
| **Social** | `ResultCard`, canvas, OG | the verdict copy, the figure set, the palette                   |
| **Paper**  | `DamageReceipt`          | the verdict copy and the figure set — _not_ the visual language |

Six e2e tests cover the receipt. The print stylesheet — visibility-based rather than
display-based, so the receipt keeps its place in the layout tree while every ancestor stops
painting — is preserved exactly.

---

## 13. Anti-patterns

Explicitly forbidden. If a change introduces one of these, it is wrong regardless of how it
looks in a screenshot.

### 13.1 Generic

- **Generic SaaS settings-dashboard styling.** `PRODUCT.md` names this as the anti-reference in
  so many words, and the home page currently _is_ one below the fold.
- **The stat-tile grid.** N equal boxes each with a small label and a big number. This is the
  single most category-interchangeable pattern available and it is what §8.1 exists to delete.
- **The template empty state** — grey circle, generic glyph, centred headline, centred
  paragraph, button — where a product-specific one is possible. `EmptyState` already draws
  plates; use it instead of hand-building a nineteenth dashed box.
- **Excessive cards.** A section is a rule and some space. See §5.3.
- **Excessive pills.** `--radius-full` is for circular geometry only (§5.1).
- **Glass / heavy backdrop blur.** The three existing `backdrop-blur` uses on the header, the
  spine and the toast are the ceiling; no new ones.
- **Decorative gradients.** The permitted gradients are: the `--fill-panel` 2.5% top-light, the
  primary button, the segmented thumb, the spine fill, and the photographic scrims. Nothing
  else. Gradient text exists in exactly one place — the words "the buffet?" in the hero — and
  gains no second instance.
- **Giant meaningless headings.** Anton appears three times in the application and each
  instance says something specific.
- **Decorative animation.** Motion needs a purpose from §10.1 or it does not ship. The current
  build has none and must keep none.

### 13.2 Specific to this product

- **Hardware / Braun / Teenage Engineering cosplay.** No machined bezels, no engraved legends,
  no detents, no needles that settle, no knobs, no dials. The spine is a _calibrated reading_,
  which is a typographic and structural idea, not a skeuomorphic one. This is the single most
  likely way this redesign goes wrong: the bezels are the fun part, and building them would
  replace 31 hand-rolled shadows with 31 hand-rolled inset highlights — the identical defect in
  a new costume.
- **Inverting to a light theme.** A bone-white full-bleed phone screen in a dim restaurant is a
  flashlight in five people's faces, and a light ground shows every fingerprint on a greasy
  screen. The room is dark for a reason.
- **Making the app look genuinely like an audit document.** See §2.2. That kills the joke.
- **More per screen.** The scene is ten seconds, one hand, low light, half-drunk. The answer is
  _one thing bigger_, never _thirty things smaller_.
- **A second accent colour.** If a colour is needed and §4.4 does not supply one, the design is
  wrong, not the palette.
- **Hand-written `box-shadow`, `border-radius` or `font-size`.** Ask for a token.

---

## 14. Success criteria

Every criterion is measurable, has a baseline from the audit, and is checkable without
judgement.

| #   | Criterion                                                                           | Baseline                                               | Target                                     |
| --- | ----------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------ |
| 1   | Scroll distance to the primary add-a-plate control, 390×844, empty session          | 5,978px document height                                | **< 3,000px** (stretch < 1,200px)          |
| 2   | References to undefined colour tokens                                               | **7** (`cream-400` ×2, `cream-600` ×4, `char-400` ×1)  | **0**                                      |
| 3   | Distinct corner radii                                                               | 7                                                      | **1** + `--radius-inner` + `--radius-full` |
| 4   | Distinct hand-rolled `shadow-[…]` / `drop-shadow-[…]` recipes                       | 31 + 8                                                 | **≤ 4**, all in `globals.css`              |
| 5   | `micro-label` uses                                                                  | ~123, across 7 semantic roles                          | **≤ 30**, one role                         |
| 6   | `micro-label` on any heading element                                                | 67 (`h2` ×27, `h3` ×36, `h4` ×4)                       | **0**                                      |
| 7   | Distinct text sizes                                                                 | ~26                                                    | **7** + `micro-label` + 3 display clamps   |
| 8   | Anton below 34px                                                                    | 3 components                                           | **0**                                      |
| 9   | Segmented-control recipes                                                           | 6                                                      | **1**                                      |
| 10  | Empty-state recipes                                                                 | 6 hand-built + the component (19 hand-built instances) | **1**                                      |
| 11  | Link-button recipes                                                                 | 7                                                      | **1**                                      |
| 12  | Page `max-w` values                                                                 | 6                                                      | **2**                                      |
| 13  | Colour classes outside the band rules on a result figure                            | many                                                   | **0**                                      |
| 14  | `--color-line` contrast on `--surface-raised`                                       | 1.2:1                                                  | **≥ 2.5:1**                                |
| 15  | Interactive component boundary contrast                                             | 1.2:1                                                  | **≥ 3:1**                                  |
| 16  | Body prose contrast                                                                 | 4.89:1 at 12px                                         | **≥ 7:1 at 17px**                          |
| 17  | `panel` + `well` instances                                                          | 108                                                    | **≤ 54**                                   |
| 18  | Surface nesting depth                                                               | 4                                                      | **≤ 2**                                    |
| 19  | Interactive targets below 44px                                                      | 35–45                                                  | **0**                                      |
| 20  | Transform hovers not gated by `(hover: hover)`                                      | 6 components                                           | **0**                                      |
| 21  | Distinct `duration-*` values                                                        | 5, of which 62/69 uses are `duration-200`              | **6 named categories**                     |
| 22  | Layout properties animated (`width`, `height`, …)                                   | 4                                                      | **0**                                      |
| 23  | Actions on the report at primary rank                                               | 0                                                      | **exactly 1**                              |
| 24  | Non-semantic interactive elements                                                   | 0                                                      | **0** — must not regress                   |
| 25  | Impeccable detector findings                                                        | 2 (both false positives)                               | **≤ 2**                                    |
| 26  | `npm run verify`                                                                    | passing                                                | **passing**                                |
| 27  | Playwright suite (37 specs)                                                         | passing                                                | **passing, unmodified**                    |
| 28  | Business logic, calculations, routes, storage schemas, share/print/export behaviour | —                                                      | **unchanged**                              |

Criteria 24, 26, 27 and 28 are **gates**: a phase that fails any of them does not land.

---

## 15. Implementation plan

Eight phases. Every step is small, independently reversible, and lands with `npm run verify`
and the Playwright suite green. **No step modifies a test.** Where a step would require a test
change, the step is wrong and is redesigned.

Phases 1–4 are internal consolidation and should produce almost no visible change. The product
starts looking different at Phase 5.

### Phase 1 — Token hygiene

_Pure token work. No component should change appearance except where it was already broken._

1.1 Define `--color-cream-400`, `--color-cream-600`, `--color-char-400`. Seven elements that
were silently inheriting now render as intended. **Fixes criterion 2.**
1.2 Delete `--ease-out-back`, `--glow-ember`, `--glow-flame`, `--glow-sesame` and the three
`glow-*` utilities. All have zero consumers.
1.3 Introduce `--radius` (10px), `--radius-inner` (6px), `--radius-full`. Keep the old radius
tokens temporarily so nothing breaks.
1.4 Introduce the type-scale tokens and the three tracking tokens alongside the existing
utilities.
1.5 Introduce `--color-line-strong`. Do not change `--color-line` yet.

_Exit:_ criterion 2 met. No visual diff except the seven corrected colours.

### Phase 2 — Radius and elevation consolidation

2.1 Replace `rounded-[8px]`, `[9px]`, `[7px]`, `[12px]` with `--radius` or `--radius-inner`
(41 sites). **Criterion 3.**
2.2 Replace the 31 hand-rolled `shadow-[…]` with `elevate-panel` / `elevate-raised` /
`elevate-float`. Consolidate the 8 `drop-shadow-[…]` to one type-over-photography value.
**Criterion 4.**
2.3 Retire `--radius-card` and `--radius-panel`.
2.4 Audit `rounded-full`: keep it on the track, the discs and the stepper thumb; move badges,
chips and tags to `--radius`.

_Exit:_ criteria 3 and 4 met.

### Phase 3 — Typography

3.1 Migrate `text-xs` / `text-sm` / `text-base` to `--text-caption` / `--text-ui` /
`--text-body`. Remove the 22 arbitrary `text-[…]` values. **Criterion 7.**
3.2 Move Anton off 16px, 24px, 30px and 32px onto Inter tabular. **Criterion 8.**
3.3 Re-scope `micro-label`: strip its baked colour, then convert all 67 heading uses to real
headings at step 20 or 26 and all field-label uses to step 15. **Criteria 5, 6.**
3.4 Fix `ReportSummary.tsx:141` — the report `h1` stops being 11px.
3.5 Apply the reading style (§3.3) to the methodology dialog, `UncertaintyPanel` and every
disclaimer. Collapse twelve `ch` measures to three. **Criterion 16.**
3.6 Use the Oswald weight axis: 500 for labels, 600 for headings.

_Exit:_ criteria 5, 6, 7, 8, 16 met. Heading-level assertions still pass.

### Phase 4 — Surfaces

_4.1 and 4.2 land together in one commit. Shipping 4.2 alone produces a wireframe of 108 boxes._

4.1 Remove nested surfaces: panel-in-panel becomes a ruled section; eliminate scroll-inside-
scroll in `PricingProfileManager` and `MealTab`. **Criteria 17, 18.**
4.2 Raise `--color-line-soft`, `--color-line`, `--color-line-ember`; apply `--color-line-strong`
to interactive boundaries. **Criteria 14, 15.**
4.3 Add scroll affordances to `TableBreakdown`, `UncertaintyPanel` and the `ResultCard` wrapper.
4.4 Unify to two page measures. **Criterion 12.**

_Exit:_ criteria 12, 14, 15, 17, 18 met.

### Phase 5 — Colour semantics

5.1 Implement the three measurement bands as a single derivation from ratio. **Wires up
`flame`.**
5.2 Remap `verdict.tone` → colour. `even` becomes sesame, resolving the meter/verdict
disagreement between 100% and 125%. **Thresholds, titles, copy and tone values unchanged.**
5.3 Remap the house-status severity ramp to the same bands. Red no longer appears at a moment
of triumph.
5.4 Money figures move from ember to cream. Ember is removed from headings, nav, links, borders
and hovers. **Criterion 13.**
5.5 Retire `cream-700` for text — migrate 174 uses to `cream-500` / `cream-600`. Move
`char-500` on `ash-800` to `char-400`. Fix the disabled state. **Criterion 16.**

_Exit:_ criteria 13, 16 met. All three colour contradictions resolved.

### Phase 6 — The spine and the report

_The first phase that is visibly a redesign._

6.1 Build the measurement spine per §7 as a single component, and replace the 4px bar.
6.2 Place it: bottom-fixed on mobile, top-of-rail on desktop, inline on the report.
6.3 Verify break-even and above-100% behaviour, including the cap, the datum and
`aria-valuetext`.
6.4 Rebuild the report into primary / three secondary / supporting register. Delete the
ten-tile grid and `ResultMetric`'s coloured edge. **Criterion 13.**
6.5 Report action hierarchy — exactly one primary. **Criterion 23.**
6.6 Fix the `ResultCard` presentation so it is not a 420px card in a 1050px void.

_Exit:_ criterion 23 met; the report at 21% and at 248% are visibly different documents.

### Phase 7 — Controls and motion

7.1 One `Button` + `buttonClasses()`; delete the seven link-button recipes, `CTA_CLASS` ×3 and
`BACK_LINK` ×4. Raise `sm` to 44px. **Criteria 11, 19.**
7.2 Extract `Field` / `Select`; migrate 58 fields.
7.3 One segmented control, one option card, one stepper. Retire the other five recipes.
**Criterion 9.** _`OptionCard` keeps its native-radio-in-a-label structure — locked by tests._
7.4 `ConfirmDialog` gains `destructive`; cancel takes initial focus; remove the default
`cancelLabel`. Wire `useUndoableRemove` and `StatusAction` into plate removal, favourite
removal and preset deletion.
7.5 Migrate the 19 hand-built empty states to `EmptyState`. **Criterion 10.**
7.6 Motion timing categories; one press value; gate transform hovers behind
`(hover: hover) and (pointer: fine)`; move the four `width` animations to `transform`; add
dialog and toast enter/exit with a toast dismiss control; rewrite the reduced-motion rule per
§10.5. **Criteria 20, 21, 22.**
7.7 Raise every sub-44px target; separate adjacent destructive and constructive controls.
**Criterion 19.**

_Exit:_ criteria 9, 10, 11, 19, 20, 21, 22 met.

### Phase 8 — Mobile budget, shared artifacts, accessibility

8.1 Compact masthead; builder-before-configuration; food grid to a list on mobile; join the cut
picker and its configurator. **Criterion 1.** _Verify each reorder against the suite before it
lands; anything a spec fills stays visible._
8.2 Update `resultCard.ts`, `resultCardImage.ts`, the three OG routes, `icon.svg`, the PNG icons
and `THEME_COLOUR` — in one commit.
8.3 Focus ring: `border-radius: inherit`, plus an inset variant for controls inside scroll
containers.
8.4 `forced-colors` and `prefers-contrast: more` support.
8.5 Fix `CategoryTabs` `grid-cols-4` vs eight categories.
8.6 Run the Impeccable detector, re-measure every criterion in §14, and record the results.

_Exit:_ all 28 criteria met.

---

## 16. Amending this document

This file is the design system of record. It changes by decision, not by drift.

- A change to a **token value** is an edit here first, then in `globals.css`.
- A change to a **rule** requires a stated reason recorded in the section it changes.
- **§2.1 (the room), §4.1 (the colour rule), §11 (accessibility) and §13 (anti-patterns) do not
  change as a side effect of shipping a feature.**
- If the code and this document disagree, that is a bug in the code.
