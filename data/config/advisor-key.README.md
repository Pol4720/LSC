# advisor-key.json

Drop the advisor's **public** ECDH P-256 key here, exactly as the console
exports it (Settings → Encryption keys → *Publish public key*):

```json
{ "kty": "EC", "crv": "P-256", "x": "…", "y": "…", "kid": "…" }
```

The intake form fetches this file and seals every submission against it.

* Publishing this file is safe. A public key can only **encrypt**.
* The matching private key lives only in the advisor's browser, wrapped with a
  passphrase (PBKDF2-SHA256 → AES-GCM), plus whatever backup file they saved.
* If this file is missing, the form still works — it just falls back to
  link/download delivery instead of sealed storage.
