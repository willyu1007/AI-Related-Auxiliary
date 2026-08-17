---
name: manage-llm-usage
description: >-
  Maintain a thin project ledger of how LLM capabilities are used: register or
  update internal capability entries (orchestration entry, model/profile, prompt
  ref, memory/context/cache notes, code entry), align the ledger after code
  changes, and apply shared LLM calling guidelines. Use when adding or changing
  an LLM-backed capability, swapping models/prompts, or asking which interface
  uses which model. Not for building a provider gateway from scratch, not for
  operating a web admin UI, and not for general product feature work that does
  not touch LLM usage.
---

# Manage LLM Usage

Keep a **thin usage ledger** so humans and agents can see, for each internal LLM capability, how the project calls models—without scanning the whole tree for SDK imports.

The ledger is the SSOT for *what uses LLM and how*. An optional web admin may edit the same file; this skill does not implement that UI. Shared **calling guidelines** (single call surface, credentials, routing, reliability) live in `./reference/calling-guidelines.md`.

## When to use

- Add a new LLM-backed capability (agent, job, or HTTP-facing orchestration)
- Change provider, model, profile, prompt, memory, context assembly, or cache
- Answer “which capability uses which model / prompt?”
- Align the ledger after LLM-related code changes

## When not to use

- Scaffolding a full multi-provider gateway or secrets platform
- Building or operating a web management console (use the console; keep the ledger)
- Ordinary app work that does not change LLM usage
- Inventing new env/config keys for secrets in the ledger (store references only)

## Ledger location

Prefer these fixed paths in the target repo (copy from this skill if missing):

| Path | Role |
|------|------|
| `docs/llm/AGENTS.md` | How agents should load the ledger |
| `docs/llm/usage-registry.yaml` | Capability ledger (SSOT) |

Materialize once:

```bash
mkdir -p docs/llm
cp <this-skill>/templates/docs/llm/AGENTS.md docs/llm/AGENTS.md
cp <this-skill>/templates/docs/llm/usage-registry.yaml docs/llm/usage-registry.yaml
```

`<this-skill>` is the installed directory of this skill. Do not overwrite an existing ledger; merge new capabilities into it.

If the project already keeps the same SSOT elsewhere (for example behind an admin API), use that path—but keep one SSOT and point `docs/llm/AGENTS.md` at it.

## Primary key: capability (internal interface)

Register **orchestration entries**, not raw SDK calls.

- One ledger row = one stable `id` (capability)
- `entry` describes how it is reached (`use-case` | `agent` | `http` | `job` | `cli`)
- HTTP paths are optional attributes; agents and jobs are first-class
- Almost all real rows are orchestrated (memory, context, cache, tools)—“bare completion” is an exception, not the default

## Workflow

### A. Discover

1. Open `docs/llm/AGENTS.md`, then `docs/llm/usage-registry.yaml`.
2. Find the capability by `id`, `entry.ref`, or `code_entry`.
3. Only then open implementation or prompt files listed on the row.

### B. Register or update

When adding or changing LLM usage:

1. Confirm the single calling surface the project uses (see guidelines). Do not teach feature modules to import provider SDKs directly.
2. Add or edit one capability row (see template field comments).
3. Keep `credential_ref` non-secret. Never paste API keys into the ledger.
4. Record orchestration briefly: memory, context assembly, cache, tools.
5. Record routing: prefer `profile` when the project uses profiles; otherwise explicit `provider` + `model`. Update the ledger **before** or **with** the code change that swaps models.

### C. Align after code changes

After LLM-related edits:

1. Diff the ledger against reality: every new/changed capability has a row; removed capabilities are deleted or marked `status: retired`.
2. Check `code_entry` still exists.
3. Grep for provider SDK usage outside the approved call surface; new call sites must either use the gateway or get an explicit ledger + architecture exception.
4. Summarize what changed in the ledger for the user.

### D. Optional admin

If a web admin edits the same SSOT, treat UI saves as ledger writes. Do not maintain a second copy in chat or ad-hoc docs.

## Boundaries

- Do not store secrets in the ledger or in chat.
- Do not scatter provider/model magic strings in feature code; route via the project call surface and keep identifiers on the ledger row.
- Do not expand this skill into a full provider-onboarding or CI registry product.
- Do not invent capabilities that have no code entry.

## Assets

| Path | Role |
|------|------|
| `templates/docs/llm/AGENTS.md` | Project entry protocol |
| `templates/docs/llm/usage-registry.yaml` | Empty ledger + field schema comments |
| `examples/usage-registry.sample.yaml` | Two example capabilities |
| `reference/calling-guidelines.md` | Core scheduling / calling norms |
