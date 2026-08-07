# Security model

## The problem

GitHub Pages on a free account only serves **public** repositories. The tool's
database lives in that same repository. Client intake forms carry names, phone
numbers, email addresses, cities and budgets — exactly the data you must not
publish.

So the repository stores ciphertext only. Plaintext exists in two places and
nowhere else: the client's browser while they fill the form, and the advisor's
browser after they unlock it.

## The scheme

```
                        ┌── advisor's browser ──────────────────┐
                        │  ECDH P-256 key pair                  │
                        │  private ── PBKDF2 ─► AES-GCM vault   │
                        │            (localStorage + backup)    │
                        └──────────────┬────────────────────────┘
                                       │ public key committed to
                                       ▼ data/config/advisor-key.json
┌── client's browser ─────────────────────────────────────────────┐
│ 1. generate an EPHEMERAL P-256 key pair                         │
│ 2. ECDH(ephemeral_private, advisor_public) ──► shared secret    │
│ 3. HKDF-SHA256(secret, salt, "LSC/submission/v1") ──► AES key   │
│ 4. AES-256-GCM(answers) ──► ciphertext + auth tag               │
│ 5. discard the ephemeral private key                            │
└─────────────────────────────┬───────────────────────────────────┘
                              ▼
        { v, alg, kid, epk, salt, iv, ct, ts }  ── public-safe
                              │
              ┌───────────────┼────────────────┐
              ▼               ▼                ▼
        relay → repo    share link        download
```

| Layer | Primitive | Parameters |
|---|---|---|
| Key agreement | ECDH | NIST P-256 |
| Key derivation | HKDF | SHA-256, 16-byte random salt, info `LSC/submission/v1` |
| Encryption | AES-GCM | 256-bit key, 96-bit random IV, 128-bit tag |
| Private-key wrapping | PBKDF2 → AES-GCM | SHA-256, 310 000 iterations, 16-byte salt |
| Fingerprint (`kid`) | SHA-256 over `crv|x|y` | first 16 base64url chars |

Everything runs on the browser's WebCrypto implementation. There is no
hand-rolled cryptography and no third-party crypto library.

## What each property buys you

**Forward secrecy per record.** Every submission mints a fresh ephemeral key
pair and throws the private half away. Compromising one record's key material
tells you nothing about any other record.

**Authenticated encryption.** AES-GCM's tag means a modified ciphertext fails to
open rather than decrypting to something plausible. `tests/unit/crypto.test.mjs`
flips a byte mid-ciphertext and asserts the failure.

**Public key is safe to publish.** It can only encrypt. That is the whole point:
anyone can write to the advisor, only the advisor can read.

**Offline-capable.** Sealing needs no network. A client on a bad connection can
complete the form and send it later.

## Console access control

The encryption above answers *what can be read*. A second, independent layer
answers *who gets to open the console at all* — added specifically so a
supervisor or coworker cannot use the tool, or the data in it, without the
advisor's knowledge or consent.

**Unlock throttling.** The first three wrong guesses are free; every one after
that costs an escalating delay (2s, 4s, 8s… capped at 60s), persisted in
`localStorage` so a page reload cannot reset it. It applies identically to the
real passphrase and to temporary codes, and the error message never reveals
which kind was being checked (`tests/e2e/access.spec.js` asserts this).

**Idle / backgrounded-tab auto-lock.** The console re-locks itself after a
configurable period (Ajustes → Seguridad y acceso; default 20 minutes) of no
mouse, keyboard or touch activity, or after the tab has sat in the background
that long — the latter check re-verifies elapsed wall-clock time the moment
the tab becomes visible again, since browsers throttle timers in background
tabs. This is the direct answer to "a coworker walks up to my open laptop":
the passphrase screen alone does nothing if the console was already unlocked
and left unattended.

**Temporary access grants — "authorize someone momentarily".** From Ajustes,
the advisor can generate a random, high-entropy code (16 characters, ~80 bits
— never advisor-chosen, since the wrapped blob it protects may end up public)
that wraps a *second* copy of the same private key, tagged with an expiry the
advisor picks (1 hour to 7 days, or a custom date) and a `revoked` flag. Under
the hood this is exactly the multi-recipient pattern age/PGP use for "any of
these passphrases opens the same file": the vault has one lock with several
keys, not several vaults.

- Unlocking with a valid code opens the console exactly like the real
  passphrase would — full read/write access to whatever the advisor already
  synced. That is the point: a genuine, revocable substitute for handing over
  the real passphrase.
- Codes tried against this device's own cache resolve instantly, offline. If
  no match is found locally, the console gives the repository a short, bounded
  window (a few seconds) to answer before giving up — enough for a code
  published from a different device to work, without risking an indefinite
  hang on a bad connection.
- Revoking a code (or just letting it expire) is checked on every future
  unlock attempt, from any device, because that check re-fetches the published
  list rather than trusting a local cache. A temporary session also carries
  its own hard stop: it force-locks itself the moment its grant's expiry
  passes, checked every 15 seconds, independent of the idle timer.
- **What this cannot do:** revocation and expiry are checked at the moment of
  unlocking, not continuously enforced afterwards. A browser tab that is
  already unlocked keeps the decrypted key in memory until it locks on its own
  (idle, expiry, or a manual click) — revoking the code that opened it does
  not reach into that tab and close it. No purely client-side system, this one
  included, can promise otherwise; the same limitation applies to a shared
  physical key or an OS screen lock. Treat a revoke as "stop this from being
  used *again*", not as a remote kill switch for a session already in
  progress.

See `docs/GUIA-ASESOR.md` for the day-to-day walkthrough of creating and
revoking a code.

## Threat model

| Threat | Outcome |
|---|---|
| Someone browses the public repo | Sees only ciphertext, timestamps and key fingerprints |
| Someone clones the full git history | Same — history has never held plaintext |
| A share link is intercepted (WhatsApp, email, screenshot) | The link carries a sealed envelope; useless without the private key |
| The relay endpoint is compromised | It only ever handled ciphertext; it cannot decrypt what it stored |
| GitHub is compromised | Same as above |
| A coworker or supervisor opens the console cold, doesn't know the passphrase | Sees only the lock screen; guessing is throttled |
| A coworker or supervisor sits at the advisor's laptop while it's unlocked | Auto-lock closes the session after the configured idle/background period |
| The advisor's laptop is stolen, screen locked | The vault is passphrase-wrapped with 310 000 PBKDF2 iterations |
| The advisor's laptop is stolen, console unlocked | **Full compromise for that session.** Lock the console (or let auto-lock do it) whenever you step away. |
| A temporary code leaks after its grant is revoked or expired | Rejected on the next unlock attempt, from any device that can reach the repository |
| The advisor loses the passphrase, every backup, and has no active session | **Permanent data loss.** Nobody can recover it. |
| A malicious script is injected into the site | Could read plaintext in the page. Mitigated by shipping zero third-party code — see below. |

## Supply chain

The site loads **no external resources**: no CDN, no web fonts, no analytics,
no tag manager, no third-party JavaScript. `scripts/check.mjs` fails CI if a
`src`/`href` pointing at an unapproved external origin appears anywhere in the
shipped HTML, CSS or JS.

The only runtime dependency is the browser. The only build-time dependency is
Playwright, and it never ships to users.

## The GitHub token

The advisor's fine-grained PAT is stored in `localStorage` under
`lsc.console.settings`, in the advisor's browser only.

It is never:
* committed to the repository,
* placed in a URL, a query string or a hash fragment,
* sent anywhere except `api.github.com`.

Recommended scope: **one repository**, **Contents: Read and write**. Nothing
else. If it leaks, an attacker can write to this repo's contents — annoying,
recoverable from git history, and it still does not decrypt anything.

## CI guard rails

`.github/workflows/data-index.yml` runs `scripts/check-encrypted.mjs` on every
push that touches `data/`. It fails the build if any file under
`data/submissions/` or `data/crm/` is not a well-formed envelope, and names the
plaintext keys it found. A plaintext record can never land on `main` silently.

## Key rotation

1. In the console, create a new key pair (Settings → generate).
2. Publish the new public key.
3. Old records stay readable with the old private key — keep the old backup.

Records are not re-encrypted automatically. To migrate: export everything to
JSON while unlocked with the old key, then re-import under the new one.

## Reporting

Found a problem? Open an issue in the repository. Do not include client data,
share links or key material in the report.
