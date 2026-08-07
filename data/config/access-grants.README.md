# access-grants.json

The list of **temporary access codes** the advisor has issued (Consola →
Ajustes → Seguridad y acceso → *Nuevo código*).

```json
[
  {
    "id": "GR-20260807-AB12",
    "label": "Cubriéndome el sábado",
    "createdAt": "2026-08-07T14:00:00.000Z",
    "expiresAt": "2026-08-08T14:00:00.000Z",
    "revoked": false,
    "vault": { "v": 1, "kdf": "PBKDF2-SHA256", "iterations": 310000, "salt": "…", "iv": "…", "ct": "…" }
  }
]
```

* `vault` is the advisor's private key, wrapped a second time under a
  freshly generated, high-entropy code (not the advisor's real passphrase —
  see [`docs/SECURITY.md`](../../docs/SECURITY.md#temporary-access-grants)).
  Unlocking with a valid code opens the console exactly like the real
  passphrase does; that is the point of a temporary grant.
* `label`, `createdAt` and `expiresAt` are plain text. Don't put anything
  sensitive in `label` — it's operational metadata, not client data.
* Setting `revoked: true` (via the console's *Revocar* button) is how a
  grant is disabled before its natural expiry. Every unlock attempt with a
  temporary code re-fetches this file (bounded to a few seconds) so a
  revocation published here is honoured on any device, not just the one
  that created it.
* This file is only ever written by the console when the advisor's own
  repository token is configured. Without a token, temporary codes still
  work — just only on the browser that created them.

Publishing this file is safe: each `vault` blob is only as strong as its own
code (generated with ~80 bits of entropy, never advisor-chosen), the same way
`advisor-key.json`'s public key is safe to publish because it can only
encrypt.
