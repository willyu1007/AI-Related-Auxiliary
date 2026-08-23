# Hub maintenance

Apply confirmed project records and relationships or repair hub state without changing task-level
intent or progress.

## Inspect the affected state

Start with `git status --short` and select the smallest relevant evidence set:

- Use `project-query --json` for the cross-worktree Milestone and Feature union and conflicts.
- Use `query --json` for task mappings and task-state evidence.
- Inspect `.ai/project/registry.json` for Ideas or semantic records not surfaced by a query.
- Use `lint` and `sync --dry-run` when consistency or generated projections are in scope.

Unrelated changes may remain when the affected paths and evidence can be isolated. An invalid
affected row, overlapping uncommitted semantic edit, or evidence needed by the operation that
cannot be read blocks writing. A project-graph conflict blocks ordinary graph changes; it may be
the selected repair target only after the intended meaning and affected worktrees are confirmed.

## Project records and relationships

The hub records confirmed project decisions; it does not make them. Follow the project graph and
status semantics in `.ai/project/AGENTS.md`, treating task states as evidence rather than an
automatic rollup.

- Resolve or allocate a confirmed Milestone through the supported command; never choose its ID
  manually:

  ```bash
  node .ai/scripts/ctl-project-governance.mjs milestone --title "<stage outcome>" --description "<accepted outcome>" --apply --json
  ```

- Resolve or allocate a confirmed Feature the same way. A newly allocated Feature starts in
  `M-000`; apply a separately confirmed `milestone_id` relationship as part of the same coherent
  graph change:

  ```bash
  node .ai/scripts/ctl-project-governance.mjs feature --title "<capability>" --description "<confirmed intent>" --apply --json
  ```

- Apply a confirmed task mapping with the mapping command:

  ```bash
  node .ai/scripts/ctl-project-governance.mjs map --task T-### --feature F-### --dry-run
  node .ai/scripts/ctl-project-governance.mjs map --task T-### --feature F-### --apply
  ```

- Add, revise, or remove an Idea only after its exact note or disposition is confirmed. Ideas have
  no ID, status, or generated view; remove one when selected work takes over or it is discarded.

Treat removing project behavior and deleting a registry record as separate decisions. Use status
or relationship changes while the record still carries project meaning. Delete a Milestone or
Feature only when removal of the record itself is confirmed and every dependent relationship is
reconciled.

For a confirmed title, description, status, Feature-to-Milestone relationship, Idea, or permitted
record removal without a dedicated command, apply the smallest coherent set of semantic records
and relationships. When the exact target was not already confirmed, present it for confirmation
before editing. Never add `milestone_id` to a task entry: change its Feature mapping or the owning
Feature relationship.

## Repair drift

Classify the dry-run and query evidence before selecting a repair:

- Projection or generated-view drift: select sync regeneration and execute it through the validated
  preview and apply sequence below.
- A confirmed orphan task projection: preview and remove it with `sync --prune --dry-run`, then
  `sync --prune --apply`; unverifiable or surviving branch evidence must continue to refuse prune.
- An incorrect task mapping: use the confirmed `map` operation above rather than hand-editing the
  task projection.
- A same-ID Milestone or Feature conflict: use `project-query` to preserve every exact version,
  confirm the intended meaning, and update the affected worktree registries as one coordinated
  semantic repair. Never select a version from recency alone.
- Drift originating in another worktree's uncommitted task bundle: coordinate the task record in
  that worktree instead of overwriting it from the current one.

Do not change an active task's goal or `State:` as a hub repair. When a repair removes or reparents
a relationship, apply only the exact confirmed scope. Because sync plans a complete worktree, do
not apply a preview containing changes outside the selected repair.

## Validate and finish

After the selected change or repair, preview the complete projection update in every worktree whose
registry or projections changed:

```bash
node .ai/scripts/ctl-project-governance.mjs sync --dry-run
```

Continue only when every planned change belongs to the selected operation. Then regenerate and
validate in each affected worktree:

```bash
node .ai/scripts/ctl-project-governance.mjs sync --apply
node .ai/scripts/ctl-project-governance.mjs lint
```

Inspect each affected diff and worktree. Stage only the confirmed semantic change, task-record
reconciliation required by `dev-docs/AGENTS.md` and allowed by the working boundaries, and generated
views. Preserve unrelated changes and create coherent checkpoints when repository policy permits.
Include a `Task: T-###` trailer only when exactly one tracked task owns the change. For a user-facing
request, report the affected project records, validation, checkpoints, and preserved changes in the
user's preferred language; otherwise return the needed result to the enclosing workflow.
