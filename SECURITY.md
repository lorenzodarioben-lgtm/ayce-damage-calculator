# Security Policy

## Supported versions

This is a single deployed web application, not a library with maintained release lines. Only the
current `main` branch and the live deployment built from it receive fixes. Older tags are kept for
history and are not patched — if you are running your own copy, update to the latest `main` before
reporting.

## Reporting a vulnerability

Please report suspected vulnerabilities privately through the
[GitHub security advisory form](https://github.com/lorenzodarioben-lgtm/ayce-damage-calculator/security/advisories/new).
Do not open a public issue containing reproduction details that could put other people's data at
risk. If the advisory form is unavailable, contact the repository owner through GitHub and keep the
report private until a fix is released.

Expect an acknowledgement within a week. This is a small project maintained in spare time, so
please allow reasonable time for a fix before disclosing publicly.

### What makes a report useful

- What you did, what happened, and what you expected instead
- The affected route or component, and the commit or deployment you saw it on
- The browser and version, since much of this application is storage and platform behaviour
- A minimal reproduction — a short crafted token, a small malformed CSV, or a trimmed backup file

Please use synthetic data. A reproduction built from your own meal history, diner names or notes is
harder to act on and shares information nobody needs.

## Architecture, and what that means for security

The application is local-first and has no server-side state:

- There is no account system, no backend, no database and no third-party service. Nothing you
  record is transmitted anywhere.
- Meals, history, saved orders, restaurants, diners, pricing profiles and custom foods live in the
  browser's own storage on the device that created them.
- Analytics are derived on the device from local records. No usage is collected or sent.

Consequently there is no server to compromise and no shared datastore to breach. The security
surface is what the browser does with data a user already holds, and what it does with data a user
chooses to accept from somewhere else.

## Untrusted input

Every boundary below is treated as untrusted and validated field by field. Malformed input is meant
to fail to a reported `null` rather than throw, and must never produce a meal the calculator could
not have produced itself. Reports about any of these are especially welcome:

- **Shared report links** (`/share/<token>`) — the meal snapshot travels inside the URL itself.
- **Shared menu links** (`/menu/<token>`) — price assumptions, custom foods and an optional
  restaurant setup, imported only when the recipient chooses to.
- **Shared challenge links** (`/challenge/<token>`) — two completed meals, recalculated locally.
- **Imported CSV menus** — arbitrary text from an arbitrary source, parsed into catalogue entries.
- **Backup files** — the plain JSON export, and the password-encrypted vault.
- **Stored records** — IndexedDB rows, `localStorage` values and the URL, all of which a user or
  another script on the same origin can have altered between visits.

Findings worth reporting include input that crashes the application, escapes validation, is
persisted in a shape the app cannot read back, causes one meal's data to appear in another, or
inflates a figure beyond the bounds the code declares.

## Encrypted backups

An encrypted backup is sealed in the browser with Web Crypto: a random salt, PBKDF2-HMAC-SHA-256, a
random IV and AES-256-GCM, with the non-secret parameters carried in a versioned envelope. The
password is never stored and cannot be recovered, which is also why a lost password means a file
that cannot be opened.

Report anything affecting confidentiality, integrity, key derivation, password handling, envelope
validation or decryption behaviour through the private route above rather than in a public issue.

## Scope

Out of scope, because they are not properties this architecture claims:

- Data being readable by someone who already controls the device, the browser profile, or another
  script running on the same origin
- A share link being readable by anyone it is given to — that is what sharing a link does
- The illustrative prices and nutrition figures in `src/data/foods.ts` being inaccurate; these are
  estimates, documented as such, and corrections belong in an ordinary issue
- Missing hardening headers on a deployment you control yourself
