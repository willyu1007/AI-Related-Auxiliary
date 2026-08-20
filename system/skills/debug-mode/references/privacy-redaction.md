# Debug evidence privacy and redaction

Collect the minimum evidence needed.

## Never request, collect, or record

- passwords, access/refresh tokens, API keys, private keys, auth headers
- payment, government, medical, or other highly sensitive identifiers

## Avoid unless necessary and authorized

- full request/response bodies
- raw email, phone, address, account identifier, or unique device ID

## Prefer

- presence: `token_present=true`
- length/count: `payload_bytes=...`, `items_count=...`
- category: `error_kind=timeout|validation|auth`
- random or non-sensitive correlation identifier
- approved keyed hash when stable cross-event correlation is necessary
- short redacted excerpts rather than raw logs

Keep journal evidence to a few redacted lines. If user-provided logs expose a secret, avoid repeating it, warn that it may need rotation or revocation, and continue only with redacted values.
