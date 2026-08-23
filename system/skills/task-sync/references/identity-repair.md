# Identity repair

Use this procedure only when query reports `invalid: true`.

1. Inspect the reported metadata errors, bundle path, registry projection, and exact task trailers.
2. Make `.ai-task.json` contain exactly `version: 1`, `task_id`, directory `slug`, and `keywords`.
3. Preserve a valid `task_id` only when the durable sources do not disagree. Recover an existing ID
   only when they identify exactly one; otherwise stop and request identity evidence.
4. Preserve only valid, unique, non-empty keyword strings and remove every other field.
5. If the durable sources prove that the bundle has never received an ID, remove the invalid
   metadata file and let `sync --apply` allocate it. Absence of one source alone is not that proof.
6. Re-query the task and continue only after its identity is valid.

Repair may preserve or recover an existing ID; never guess or manually allocate a new one.
