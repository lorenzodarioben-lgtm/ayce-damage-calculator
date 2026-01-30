# Configurable Menus

AYCE Damage Calculator starts with the built-in Australian KBBQ estimates, so a
casual diner can begin a tab straight away. Configurable menus are optional,
local additions for diners who know their restaurant's prices or want to track
an item that is not in the starter catalogue.

## Pricing profiles

A pricing profile names the money context used for a meal and may override the
retail and estimated restaurant ingredient price for individual foods. The app
does not fetch exchange rates or claim conversion accuracy: each profile uses
an explicit currency and locale chosen by the diner.

The selected profile applies to the meal builder, live logging, report, saved
history, comparisons, result cards and shared reports. Changing a profile
changes the current tab's calculations; filed sessions keep a snapshot of the
profile that was used when they were saved.

## Custom foods

Custom foods use the same calculation contract as the built-in catalogue:
name, category, retail value per kilogram, estimated ingredient cost, nutrition
per 100 g and the existing plate and quality controls. The editor supplies
category-matched artwork, so personal additions retain the app's visual
language without needing uploaded images.

Custom foods can be added from the regular meal builder and Live Meal Mode.
They work with favourites, saved sessions, history and sharing. A filed or
shared meal includes only the custom-food definitions it needs, making the
record readable even if the local catalogue later changes.

## Sharing and backups

Current share links are versioned, compressed and self-contained. They include
the plates, session setup, active pricing profile and any custom foods on the
tab. Compression is what makes a full personal catalogue shareable at all: a
menu link is typically a fraction of the size the same document used to need.

Every superseded token version keeps its own reader. Version 1 report links
remain readable with the original built-in Australian menu context, and version
2 report links, version 1 menu links and version 1 challenge links all still
decode into exactly the menu they were written with. There is no server behind
a link, so nothing could ever reissue one that had stopped working.

A link still has a size limit, because the payload lives in the address. When a
menu genuinely will not fit, the app says so and explains why, rather than
offering a link that is quietly missing.

The JSON backup at `/history/data` includes filed history, saved orders,
pricing profiles, custom foods and saved restaurants. Restore always previews
the file first. Merge keeps the current device's records when IDs collide;
replace is explicit and includes every locally stored category.

The same contents can be exported password-encrypted instead. The file is
sealed on the device with Web Crypto and carries only the non-secret
cryptographic parameters alongside the ciphertext. The password is not stored
anywhere and cannot be recovered.

## Charges and discounts

A real all-you-can-eat bill is rarely the entry price multiplied by heads. A
voucher comes off, a weekend surcharge goes on, the card takes its fee,
somebody orders a drink that was never included.

A session can therefore carry bounded, labelled bill adjustments alongside the
entry price. Each is a charge or a discount with a name and an amount, applied
to the whole table or — when Table Mode is in use — to one diner. The entry
price per diner remains the simple default, and a meal with no adjustments
calculates exactly as it always did.

Where there are adjustments, the app distinguishes four figures and never
conflates them: base admission, what was charged, what was discounted, and the
final paid total. Everything downstream — recovery, break-even, uncertainty,
diner totals, the planner, history, comparisons, restaurant summaries,
receipts, result cards, CSV, share links and backups — measures against the
final paid total, because that is what the evening actually cost. A bill
reduced past zero settles at zero; the restaurant does not owe the table money.

Migration is by version, as everywhere else. In-progress sessions read at
storage version 7, filed records at schema version 10, and backups at file
version 5. Anything written before those versions is read as having been paid
at its entry price — which is the truth about it, not a gap in it.

## Eaten and left

Ordered plates stay whole numbers. Alongside them, a line may carry an optional
consumed quantity in quarter plates, so a table can record that some of what
arrived went back.

Absence is meaningful and is the default. A line with no consumed quantity was
eaten in full, which is what every session recorded before this existed is
saying and what ordinary logging keeps saying without anyone touching a
control. The consumption slider is folded away until it is asked for, or until
there is already something to show.

Eaten quantity drives retail value, nutrition and therefore recovery, because
value nobody ate is not value anyone extracted. The ordered figures are kept
alongside, so the tab still says what reached the table. Estimated ingredient
cost deliberately follows the ordered quantity: the restaurant bought the plate
whether or not it came back.

Consumption can never be negative and can never exceed the ordered quantity —
reducing an order brings the eaten figure down with it. Changes are recorded in
the meal ledger, so replay, history, reports, receipts, sharing, backups and CSV
all agree. Migration is by version: in-progress sessions at storage version 8
and filed records at schema version 11 read anything older as fully eaten.

## Data boundaries

All configurable-menu data stays in browser storage unless a diner explicitly
copies a share link or downloads a backup. No account, cloud sync, restaurant
directory or live pricing feed is involved. The figures remain personal,
illustrative assumptions and should be read as a playful estimate rather than
a restaurant bill.
