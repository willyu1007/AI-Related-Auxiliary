# Debug evidence privacy and redaction

Collect the minimum evidence needed.

## Never record

- passwords, access/refresh tokens, API keys, private keys, auth headers
- payment, government, medical, or other highly sensitive identifiers
- full request/response bodies by default
- raw email, phone, address, or unique device ID unless essential

## Prefer

- presence: `token_present=true`
- length/count: `payload_bytes=...`, `items_count=...`
- category: `error_kind=timeout|validation|auth`
- safe correlation identifier or approved stable hash
- short redacted excerpts rather than raw logs

Keep journal evidence to a few redacted lines. If user-provided logs expose a secret, warn that it may need rotation/revocation and continue only with redacted values.
