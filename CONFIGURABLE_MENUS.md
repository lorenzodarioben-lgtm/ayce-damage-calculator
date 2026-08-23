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

Current share links are versioned and self-contained. They include the plates,
session setup, active pricing profile and any custom foods on the tab. Version
1 links remain readable with the original built-in Australian menu context.

The JSON backup at `/history/data` includes filed history, saved orders,
pricing profiles, custom foods and saved restaurants. Restore always previews
the file first. Merge keeps the current device's records when IDs collide;
replace is explicit and includes every locally stored category.

The same contents can be exported password-encrypted instead. The file is
sealed on the device with Web Crypto and carries only the non-secret
cryptographic parameters alongside the ciphertext. The password is not stored
anywhere and cannot be recovered.

## Data boundaries

All configurable-menu data stays in browser storage unless a diner explicitly
copies a share link or downloads a backup. No account, cloud sync, restaurant
directory or live pricing feed is involved. The figures remain personal,
illustrative assumptions and should be read as a playful estimate rather than
a restaurant bill.
