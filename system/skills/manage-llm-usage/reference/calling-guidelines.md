# LLM calling guidelines (core scheduling norms)

Extracted as **principles** for product LLM usage. This is not a gateway implementation guide and does not require the full multi-file registry stack from heavier templates.

## 1. Single calling surface

- Feature / agent / job code MUST call LLM through one project-approved client, gateway, or wrapper.
- Provider SDKs belong only behind that surface (thin adapters).
- Anti-pattern: each feature imports OpenAI/Anthropic/etc. directly with its own timeouts, retries, and error handling.

## 2. Explicit routing (schedule on the ledger)

- Prefer requesting a **profile** (e.g. `balanced`, `quality`, `cheap`) when the project defines profiles; resolve to provider/model inside the LLM layer.
- If profiles do not exist yet, record concrete `provider` + `model` on the capability row in `usage-registry.yaml`.
- Do not scatter raw model strings through business modules. Change routing by updating the ledger (and profile config if any), then the call site.

## 3. Credentials

- Store only **non-secret references** (`credential_ref`, env names, vault paths).
- Never commit API keys or paste them into the ledger, prompts, or chat logs.

## 4. Orchestration ownership

- Memory, context assembly, cache, and tools are part of the **capability**, not accidental details of a single SDK call.
- Document them on the ledger row so agents do not reverse-engineer behavior from scattered helpers.

## 5. Reliability (defaults live in the LLM layer)

- Every call has a deadline/timeout.
- Retries are bounded, centralized, and limited to transient failures (network/5xx).
- Use backoff with jitter; avoid retry storms.
- If a fallback model/profile exists, name it on the ledger `notes` (or a dedicated field if the project extends the schema).

## 6. Observability (minimum)

Emit or plan for: trace/request id, capability id, provider, model or profile, latency, outcome, token usage when available. Do not log raw user content or secrets by default.

## 7. Change control

- Add or change LLM usage → update `docs/llm/usage-registry.yaml` in the same change set when possible.
- Retire capabilities explicitly (`status: retired`) instead of leaving stale rows.
- A web admin, if present, must write the same ledger file—not a parallel store.
