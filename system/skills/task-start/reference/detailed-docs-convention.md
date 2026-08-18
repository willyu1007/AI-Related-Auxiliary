# Task bundle convention

New tracked tasks use one flat bundle:

```text
dev-docs/active/<slug>/
├── .ai-task.yaml
├── 00-roadmap.md
├── 01-status.md
├── 02-architecture.md
└── verification.md
```

- `00-roadmap.md`: open questions, assumptions, decisions, scope, current-task relationships, phases, risks, and phase closeout.
- `01-status.md`: current goal, state, phase, next step, blocker, and high-level completion conditions.
- `02-architecture.md`: settled technical design, interfaces, and migration implications; it states the design, while optional `implementation.md` maps that design to realized code and runtime facts.
- `verification.md`: current completion-condition matrix, latest decisive evidence, outstanding checks, and material limitations. Replace superseded runs; store bulky logs under `artifacts/`.

Optional files:

- `implementation.md`: current map of non-obvious implementation, integration, migration, or operational facts. It is not a history or TODO list.
- `pitfalls.md`: current evidence-backed recurring hazards and their prevention. Curate or remove obsolete entries instead of appending forever.
- `requirement.md`: separate requirement alignment when needed.
- `artifacts/`: bulky or raw evidence that should not obscure the current record.

Do not introduce another plan, status, goal, decision log, or verification authority.

Legacy bundles may contain `roadmap.md`, `00-overview.md`, `01-plan.md`, `03-implementation-notes.md`, `04-verification.md`, or `05-pitfalls.md`. Governance tooling may read those paths for compatibility, but the next full synchronization migrates useful current content into canonical files and removes the obsolete path. New work never recreates a legacy file.
