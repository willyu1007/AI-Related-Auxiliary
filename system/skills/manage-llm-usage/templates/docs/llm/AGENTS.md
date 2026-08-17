# LLM usage ledger — agent entry

## Conclusions

- `docs/llm/usage-registry.yaml` is the **SSOT** for which internal capabilities use LLMs and how.
- Load the registry **before** searching the repo for provider SDKs or model strings.
- Each row is an **orchestrated capability** (agent / use-case / HTTP / job), not a raw SDK call.
- Shared calling rules: see the installed `manage-llm-usage` skill `reference/calling-guidelines.md` (single call surface, no secrets in repo, explicit routing).

## Progressive loading

1. Read this file.
2. Open `docs/llm/usage-registry.yaml` and find the relevant `id` / `entry` / `code_entry`.
3. Open listed prompt paths and code entries only as needed.
4. If the registry is missing or stale, materialize or update it via the `manage-llm-usage` skill before inventing a new LLM integration path.

## Alignment

After changing LLM-related code, update the matching registry row in the same change (or immediately after). Prefer one SSOT even if a web admin edits the file.
