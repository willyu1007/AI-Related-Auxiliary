---
name: manage-llm-config
description: >-
  Use when an LLM-backed feature's provider or model routing, parameters, tool
  exposure, prompt-file loading, or runtime wiring need to be created or
  changed. Not for prompt wording alone.
---

# Manage LLM Config

Keep shared provider connections in `.ai/llm/providers.json` and one independent configuration directory for each LLM-backed feature at `.ai/llm/<feature-id>/`. Application code reads these files through the project's shared LLM configuration loader, making them the source of truth for LLM configuration.

## Configuration Structure

Use this project structure:

```text
.ai/llm/
|-- providers.json
`-- <feature-id>/
    |-- config.json
    `-- prompts/
```

Create `.ai/llm/providers.json` from `assets/providers.json` when the project does not have one, then add only the providers required by the project. Provider entries may add connection fields required by the project client, such as region, API version, organization, or headers.

For each new LLM-backed feature, create `.ai/llm/<feature-id>/config.json` from `assets/config.json` and add the prompt files referenced by the configuration. Use a stable kebab-case feature ID for the directory name. Each directory represents one agent or workflow; a feature with multiple LLM calls keeps them as named entries under `calls`.

Keep workflow control flow and application logic in code. Centralize only the LLM-specific configuration that should be independently adjustable.

## Runtime Contract

Use the project's shared LLM configuration loader. If none exists, add one minimal shared loader.

- Resolve `.ai/llm` from the project root.
- Resolve prompt paths relative to the feature's `config.json`.
- Resolve provider IDs through `.ai/llm/providers.json`.
- Read `api_key_env` from the process environment.
- Pass `parameters` through in the provider's native shape.
- Keep `.ai/llm` available in local, built, and deployed runtime environments.

## Workflow

1. Start from the agent or workflow code involved in the task. Identify its LLM calls by their roles in the feature, such as `planner`, `generate`, or `review`.
2. Follow the code's existing feature configuration reference. For a new feature, derive a stable kebab-case feature ID from its name.
3. Move the provider, model, parameters, prompt-file references, and tool configuration out of code into the feature directory so each value has one runtime source.
4. Wire the feature code to the configuration, keep later changes in the same feature directory, and ensure `.ai/llm` is included in the runtime or deployment artifact.
5. Verify JSON parsing, prompt paths, provider resolution, environment-backed credentials, removal of duplicate hard-coded values, and relevant feature behavior.

When prompt prose alone names a capability that the runtime integration and consumer contract do not provide or require, keep configuration faithful to the capabilities the runtime actually exposes; do not invent or expose a capability merely to satisfy the prose.

## Assets

- `assets/config.json`: Starting structure for one feature's `config.json`; replace its call and provider placeholders with values derived from the relevant code.
- `assets/providers.json`: Starting structure for the project's shared `providers.json`; replace its placeholder with each provider the project actually uses.
