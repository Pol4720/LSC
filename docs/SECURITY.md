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

## Threat model

| Threat | Outcome |
|---|---|
| Someone browses the public repo | Sees only ciphertext, timestamps and key fingerprints |
| Someone clones the full git history | Same — history has never held plaintext |
| A share link is intercepted (WhatsApp, email, screenshot) | The link carries a sealed envelope; useless without the private key |
| The relay endpoint is compromised | It only ever handled ciphertext; it cannot decrypt what it stored |
| GitHub is compromised | Same as above |
| The advisor's laptop is stolen, screen locked | The vault is passphrase-wrapped with 310 000 PBKDF2 iterations |
| The advisor's laptop is stolen, console unlocked | **Full compromise.** Lock the console when you step away. |
| The advisor loses the passphrase and the backup | **Permanent data loss.** Nobody can recover it. |
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
