# Architecture

## Constraints that shaped everything

1. **Free, forever.** No paid hosting, no paid database, no paid API.
2. **No account that needs a phone number outside Cuba.** That ruled out most
   backend-as-a-service options at build time and made GitHub the only reliable
   substrate.
3. **GitHub Pages is static and its free tier requires a public repo.** The
   database therefore had to be readable by the world — which forced end-to-end
   encryption rather than making it a nice-to-have.
4. **Must be ready for something better later.** Vercel and Cloudflare adapters
   ship in the repo, unused until an account exists.

## The shape that falls out

```
┌─ index.html ─────────┐   ┌─ console.html ───────────┐  ┌─ calculadora.html ─┐
│ schema-driven wizard │   │ CRM over IndexedDB       │  │ public cost tool   │
│ seals with pub key   │   │ unlocks with passphrase  │  │                    │
└──────────┬───────────┘   └────────────┬─────────────┘  └────────────────────┘
           │                            │
           │ envelope                   │ GitHub Contents + Git Data API
           ▼                            ▼
   relay ──┴──► data/submissions/*.json ◄── data/crm/*.json
   (optional)          all sealed                 all sealed
```

## Key decisions

### No build step

Native ES modules, plain CSS, no bundler, no transpiler, no framework.

*Why:* what you read in the repo is byte-for-byte what runs in the browser.
Nothing to rot, nothing to re-install, no lockfile drift, no supply-chain
surface. Deploy is `git push`. A developer opening this in three years needs
nothing but a browser.

*Cost:* more hand-written DOM code, and a small `el()` helper instead of JSX.
Worth it here — the app is ~6 000 lines and there is one developer.

### Schema-driven forms

`schema.js` declares the questionnaire; `fields.js` renders each field type;
`validate.js`, `summary.js` and `exports.js` all consume the same declaration.

*Why:* adding a question is a data change, not a code change, and it
automatically shows up in the wizard, the validator, the review screen, the
advisor's editor, the CSV columns and the printable sheet. `scripts/check.mjs`
enforces the schema's own invariants (unique ids, both languages, options
present) so a typo fails CI rather than shipping.

### The repository as the database

Reads go through `raw.githubusercontent.com` (CDN, anonymous, no rate limit
worth worrying about). Writes go through the Contents API for single files and
the **Git Data API** (blobs → tree → commit → ref) for batches, which is one
commit instead of N and cannot leave a half-written state.

*Why:* free, versioned, backed up by GitHub, diffable, and the advisor already
has an account. Git history is an audit log for free.

*Cost:* no queries, no indexes, no concurrent writers. Fine for one advisor with
hundreds of clients; it would not survive a team of twenty.

### Encryption as a load-bearing wall, not a feature

See [SECURITY.md](SECURITY.md). The short version: the public repo requirement
made E2E encryption mandatory, so it is designed in rather than bolted on — the
form has no code path that writes plaintext to the network when a key is
published, and CI fails if a plaintext record appears under `data/`.

### Three delivery paths, chosen automatically

`relay → share link → download`. The form tries the relay when one is
configured, and otherwise gives the client a one-tap WhatsApp/email/copy/download
choice. The advisor's console ingests all of them identically.

*Why:* the ideal path (real-time relay) needs an account the user cannot create
yet. Rather than block the whole tool on that, the degraded path is a first-class
citizen — and the upgrade is a single URL in Settings.

### IndexedDB for the working set

Decrypted records live in IndexedDB; search, filter and edit never touch the
network.

*Why:* decrypting on every keystroke would be unusable, and localStorage's ~5 MB
would cap the portfolio at a few hundred clients.

### Charts hand-rolled in SVG

No chart library. Each chart plots one series, so identity never rides on colour;
each carries direct value labels and a visually-hidden data table.

*Why:* a charting library would be the single largest dependency in the project,
for four small charts. And the CSP-clean, zero-external-request property is worth
more than the convenience.

## Module map

| Module | Responsibility | Depends on |
|---|---|---|
| `core.js` | DOM helper, icons, i18n, theme, storage, toasts, modals, formatting | — |
| `crypto.js` | seal/open, key vault, share-link packing | — |
| `github.js` | repo-as-database adapter, relay client | — |
| `idb.js` | IndexedDB wrapper with a memory fallback | — |
| `catalogs.js` | auction vocabulary, glossary, VIN + lot-URL parsing | — |
| `schema.js` | the questionnaire | `catalogs` |
| `fees.js` | cost engine, fee tables, inverse bid solver | — |
| `validate.js` | field + step + whole-form validation, completeness | `core`, `schema` |
| `fields.js` | one renderer per field type | `core`, `catalogs`, `schema` |
| `summary.js` | human-readable rendering, derived profile | `core`, `schema`, `catalogs` |
| `exports.js` | CSV, JSON, vCard, iCal, Markdown, print HTML | `core`, `schema`, `summary` |
| `charts.js` | inline-SVG dashboard charts | `core` |
| `calculator.js` | shared cost panel UI | `core`, `catalogs`, `fees` |
| `form.js` | the wizard | most of the above |
| `console.js` | the CRM | most of the above |
| `config.js` | deployment constants | — |

No cycles. Every leaf module is importable in Node, which is why the unit tests
need no DOM.

## Testing strategy

**Unit tests (`node --test`, 127)** cover everything that is pure: the fee
engine's monotonicity and its inverse solver, the crypto round-trip and its
failure modes, validation across every field type, CSV/vCard/iCal shape,
schema invariants, i18n fallback.

**End-to-end tests (Playwright, 62 across desktop and mobile)** cover what only a
browser can prove: that a client can actually complete the form, that a reload
restores the draft, that a conditional field appears, that the submitted payload
contains no plaintext, that the advisor's passphrase gates access, that a share
link decrypts into a client card, that a CSV downloads with the right content.

**Static checks (`scripts/check.mjs`)** cover the class of bug neither catches: a
dangling import, a 404'd asset reference, a schema field missing its English
label, an accidental CDN reference, a non-monotonic fee bracket.

Several real bugs were found this way and fixed: fees charged on a zero bid,
`getRandomValues` overflowing past 64 KB, a sticky footer swallowing clicks and
hiding keyboard-focused controls, unsized inline SVGs stretching to 489 px, an
off-canvas drawer that stayed in the tab order, and a tag input that discarded a
half-typed note.

## What this deliberately does not do

* No multi-user access control — one advisor, one key.
* No server-side search — the portfolio is small enough to hold in memory.
* No automated auction scraping. Copart and IAA prohibit it and block it; the
  console gives you pre-filtered deep links instead.
* No fee data feed. The tables are editable defaults, clearly labelled as
  estimates, because no free authoritative source exists.
