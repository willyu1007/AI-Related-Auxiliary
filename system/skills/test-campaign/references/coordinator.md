# Coordinator

You own scope, distribution, dependencies, resource allocation, integration timing, acceptance judgments, and the campaign record. Inspect reports and evidence to judge acceptance; assign testing, source fixes, and environment execution to collaborators. Do not manage a collaborator's inner subagents.

## Talk with the user

You own the conversation with the user, including decisions only the user can clear and the finished result. Confirm changes to campaign goals or scope. A user's request to pause is already a pause instruction.

## Initialize

Before the first dispatch:

1. Inventory the features, their ids, acceptance conditions, required evidence qualification, and existing results. Record campaign completion conditions and applicable release gates. Mark unresolved conditions; work independent of them can begin.
2. Cross-check features against existing repository tasks. Record each feature's module, primary task, related tasks, and the task-document locations that a result or fix may affect. Use explicit scope and ownership, not merely a changed file's directory. Record absent or uncertain mappings rather than creating a new task automatically.
3. Plan the parallel modules, environments, dependencies, and integration triggers below.
4. Create `progress.md` and generate the initial `progress.html` from it, grouping related features. Complete each module entry before dispatch.

## Plan the path

### Distribution

Keep the distribution within 6 environments and make the integration environment's allocation explicit. Cut modules for useful independent test-and-fix work, with one dedicated environment and code line per module.

Show which modules run in parallel. A cross-module journey belongs to the integration module and runs after its dependencies have results. Identify non-duplicable devices or external services as shared dependencies with explicit access windows; modules do not borrow each other's environments.

### Integration

Plan integration around observable progress checkpoints. For each checkpoint, state the required module results, changes to adopt, and work it enables. Record one or more triggers:

- **Planned checkpoint:** all its required results are verified, and the next work needs a common baseline.
- **Dependency unlock:** verified supply is ready and adopting it will unblock critical downstream work.
- **Shared repair:** a verified fix for a problem affecting multiple modules needs uniform adoption.

Treat the recorded triggers as alternatives. Ready changes can wait for a planned checkpoint when earlier adoption would not help progress. A blocker starts dependency coordination, not a global stop by itself. On a trigger, begin `## Environments` / `### Global update`; actual handback and verification govern execution and release.

## Manage collaborators

Give a collaborator the whole module, not a sequence of individual actions. The launch prompt includes the collaborator identity, module id, and `progress.md` path and section. Confirm both parties can use the entry's report channel.

Launch according to the distribution, in the background. Resume the same collaborator when available; otherwise give a replacement the current assignment and completed results from the record.

After dispatch, monitor the assigned report channels while modules are active or dependencies, handbacks, or readiness remain pending. Use available event waits or bounded status queries. Assess substantive output and actual module or test-item waits to decide whether assignments or integration timing need to change. Record results and send required decisions or readiness instructions; ordinary reports do not require replanning, and unchanged state needs no repeated receipt.

Before changing an affected assignment, have its collaborator safely finish the current unit and stop. Leave unaffected modules working unless a global integration or pause has been called.

Send instructions using the [shared coordination protocol](../SKILL.md#coordination-instructions). Give each integration or environment maintenance assignment its scope, resources, and completion conditions.

## Handle blockers

A blocker report names the module, feature, missing condition, unlock condition, impact on the module, and work that can still proceed. Internal executor identities and scheduling remain with the collaborator.

1. Decide which collaborator supplies the missing functionality or resource. Local fixes stay with their module; cross-module supply is assigned to its owner.
2. Dispatch that supply and keep unrelated, executable work moving. A blocked item does not stop its whole module when other assigned items remain executable.
3. Ask the user when only they can clear a condition. After 30 minutes without an answer, reassess other executable work; elapsed time is not approval. An unresolved account, device, or decision does not by itself call a global integration stop.
4. When supply is verified and ready, assess it against the recorded integration triggers. Other open blockers remain recorded with their exact scope.

## Environments

### Prepare

Assign environment preparation and maintenance to a collaborator. Keep the environment-to-module-to-collaborator correspondence; that collaborator manages its inner subagents.

Record the applicable worktree and code line, loaded source and contracts, configuration and migration baseline, service endpoints, device identifiers, health and required read routes, permitted operations, current holder, and pending operations. Never put secrets in this record. Preparing an environment does not override repository build, migration, or authorization rules.

Declare ready only after actual checks. Committed code is not proof that it is loaded. Release or reassign resources only after actual handback, not their expected finish time.

### Global update

For each integration, use this sequence; do not release individual modules early.

1. Tell every active collaborator to finish the current unit and stop, including its subagents. Wait for actual stops and handbacks, with verified commits, uncommitted work, and pending operations accounted for. Preserve unknown commands and their recovery context; do not change an affected environment if that would lose recoverability.
2. Assign the integration collaborator a maintenance unit to merge verified changes onto the integration line, following repository rules for contracts, generated artifacts, migrations, and commits. Preserve unfinished or foreign work. Record the intended baseline, affected features, and required rechecks under `### Evidence validity`.
3. Assign the integration environment update and verification of affected cross-module behavior there. A merge or health response alone does not clear a functional blocker.
4. Explicitly assign maintenance to bring the verified baseline onto every module code line, update every environment, and check each module's required entry points. Preserve test data and still-needed identities, credentials, and command state; an update is not a default reset.
5. Record actual loaded baselines, readiness and maintenance handbacks for all environments, and current evidence validity. Include outstanding acceptance rechecks in the next assignments, then issue one global continue instruction. If a merge or environment fails, keep business work stopped, assign a bounded repair or restoration to a verified baseline, and recheck before release.

## Write the documents

Keep current module facts and significant integrations or decisions in `progress.md` and its derived human view, rather than a transcript of ordinary replies. Raw evidence remains at its reported location.

### Plan and assignments

Keep the module distribution, integration triggers, and current module entries aligned with the plan. Update them when the distribution changes.

### Modules

Update module entries on substantive reports:

- what was checked, fixed, and retested, including the judgment, evidence qualification, evidence link, and actual runtime baseline
- current work, item-level blockers and unlock conditions, actual waits, and handback or pending-operation state

### Task mappings

Keep the feature-to-module-to-existing-task mapping from initialization. After a fix or decisive result, cross-check its actual impact, then arrange synchronization of the correct task-document locations through the repository's own workflow. A related task neither expands campaign scope nor has to be completed in full. Do not copy whole task bundles into the campaign record or overwrite their goals and completion conditions.

### Merges

- what was merged, the integrated baseline, and the blockers it cleared
- actual environment update and verification results, including failures or rollback
- schedule judgments and assignment changes

After an integration, add the merge and the check.

### Human view

Group related features and show id, test item, acceptance condition, status, evidence qualification, and evidence/runtime links. Update on a judged check, verified fix, module completion, or substantive coordination change. Use not tested, testing, partially passed, passed, failed, and blocked as statuses. A known unresolved failure of a required check makes the feature failed, even if other parts pass. Use blocked for missing prerequisites and partially passed for passed coverage with remaining unverified qualifications; keep subitem findings and blockers visible.

Pass only the scope established by the evidence and required by that feature. Distinguish contract/API, simulator platform, physical device, and cross-module qualifications; mark development identities or fixtures where relevant. A lower-level result does not automatically qualify the whole feature.

### Evidence validity

When tested behavior changes or a new baseline is adopted, identify affected features and qualifications needing recheck. Preserve their prior evidence as historical; exclude affected passes from current acceptance until qualified retests. Keep known failures unresolved until a retest of the failed qualification clears them. Retain unaffected evidence with the basis for reuse, and recalculate statuses and counts for the current baseline. Assign required rechecks to modules without rerunning unrelated checks.

## Record time

- **Response delay:** report time to instruction time, when a response is required. A delayed reply is not a wait if the collaborator kept working.
- **Actual wait:** module or feature, reason, start, and end. Do not count one blocked feature as a whole-module wait while other work continues. Internal subagent timing stays with the collaborator.
- **Stop and integration:** instruction, acknowledgment, actual stop/handback, environment readiness, and global continue times. Expected durations never release resources.

## Pause and resume

On a user pause, stop new dispatches and tell collaborators to finish the current unit and stop. Immediately stop an operation that cannot safely continue. Save actual outcomes, stopped versus still-running modules, pending operations, resource ownership, and recovery instructions; do not call a requested stop complete before handback. After closure, suspend the coordination loop and preserve pending follow-ups for explicit resume.

On an explicit resume, read the latest record and reports, check actual worktrees, loaded baselines, services, devices, and pending operations, then send resume instructions. Do not reuse an old readiness claim without checking. A pause is not campaign completion or permission to dismantle its environments.

## Finish and clean up

Before module completion, obtain proportionate independent review, necessary residue cleanup, decisive verification of affected behavior, and correct task-document synchronization. Do not rerun unrelated checks for every report.

Close campaign execution only when every in-scope feature has a current judgment with evidence or a stated reason evidence is missing, remaining failed, blocked, or unverified work has a disposition consistent with the agreed completion conditions, and actual stops, handbacks, pending operations, and task records are accounted for. Executable work still required by the assignment remains unfinished; deferral or exclusion must follow agreed conditions or a user decision.

The final report states tested and untested scope, outstanding failures and blockers with their dispositions, the verified baseline, and whether applicable release gates are met. Report execution closure separately from release readiness; unmet or unverified release gates remain explicit.

After campaign completion, arrange cleanup only for campaign-owned resources confirmed unused. Follow existing authorization and repository rules for merging into the user's main line. Preserve uncommitted and unpushed work, final records, necessary evidence, and recovery information at a durable location before cleanup.

Prefer recoverable worktree archival. Stop environments or remove branches and temporary files only after checking ownership, active users, and dependencies. Keep shared, active, or unknown-owned resources. Remove the temporary campaign directory only after required contents are preserved.
