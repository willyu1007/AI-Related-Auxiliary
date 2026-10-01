# Coordinator

Own scope, distribution, dependencies, resources, integration timing, acceptance, and records. Delegate tests, source fixes, and runtime operations to collaborators; do not manage their inner subagents. Handle user-only decisions and the final report, and confirm scope or goal changes with the user.

## Initialize and plan

Before first dispatch:

1. Inventory feature ids, acceptance conditions, required evidence qualification, and existing results. Record completion conditions, release gates, and unresolved conditions.
2. Map features to primary and related repository tasks and affected task-document locations using scope and ownership, not file directories alone. Record missing or uncertain mappings rather than automatically creating tasks.
3. Map prerequisites and cross-module dependencies; distinguish executable work from missing implementation, accounts, or environment preparation. Group checks and fixes into modules with dedicated environments and code lines under `### Distribution`. Assign cross-module supply to its owner and cross-module journeys to the integration module.
4. Order tasks by release needs and dependencies, prioritizing supply that unlocks downstream validation. Reuse valid results and set later work's entry conditions. Define integration checkpoints by required verified results, changes to adopt, and validation enabled.
5. Create `progress.md` with the plan, task mappings, and complete module entries, then generate the initial `progress.html` before launch.

## Manage collaborators

### Distribution

1. **Allocate:** stay within 6 environments, including an explicitly allocated integration environment. Give non-duplicable devices and external services explicit shared access windows; modules do not borrow each other's environments.
2. **Assign:** give each collaborator a whole module. Include its role, module id, and record path and section; confirm a usable report channel for both parties.
3. **Launch or reconnect:** launch in the background. Reuse the collaborator when available; give replacements the current assignment and completed results.

### Follow progress

- Monitor assigned channels while work or dependencies, handbacks, or readiness remain pending. Use event waits or bounded queries; do not repeat receipts for unchanged state.
- Judge substantive results under `## Acceptance` and update records. Ordinary reports do not require replanning.
- For blockers, use reported missing and unlock conditions, impact, and remaining work to assign supply to its owner. Coordinate account, device, or decision prerequisites with the responsible party; ask the user when only they can clear them. After 30 minutes without an answer, reassess executable work; elapsed time is not approval.
- Route verified supply needing a common baseline to `### Integration`. Clear affected blockers only after actual environment checks establish their unlock conditions; retain other blockers with their scope.
- Before reassignment, have the affected collaborator finish the current unit and stop under the [shared protocol](../SKILL.md#coordination-instructions). Unaffected modules continue unless a global stop or pause is called.

### Integration

Trigger on any of:

- **Planned checkpoint:** all required results are verified and next work needs a common baseline.
- **Dependency unlock:** verified supply needs adoption into that baseline to unblock assigned downstream work.
- **Shared repair:** a verified fix affecting multiple modules needs uniform adoption.

Ready changes may wait for a planned checkpoint when earlier adoption would not advance work. Missing prerequisites alone do not trigger a global stop.

On a trigger, perform the global update in order; do not release individual modules early:

1. Send **Finish the current unit and stop** to all active collaborators. Collect actual handbacks and account for verified commits, uncommitted work, and pending operations. Defer environment changes that would lose pending-operation recoverability.
2. Assign integration maintenance to merge verified changes onto the integration line under repository contract, generated-artifact, migration, and commit rules. Preserve unfinished or foreign work; record the target baseline and affected features for `## Acceptance`.
3. Update the integration environment and verify affected cross-module behavior. A merge or health response alone does not clear a functional blocker.
4. Bring the verified baseline onto every module code line, update every environment, and check required entry points. Preserve test data, still-needed identities and credentials, and command state; an update is not a reset.
5. Record every environment's loaded baseline, readiness, and maintenance handback. Update evidence validity, include remaining acceptance rechecks in next assignments, and issue one **global continue** only after all environments are ready.

On merge or environment failure, keep business work stopped. Assign bounded repair or restoration to a verified baseline and recheck before release.

## Prepare environments

- Delegate preparation and maintenance to each module's collaborator under repository build, migration, and authorization rules.
- Record worktree and code line, loaded source and contracts, configuration and migration baseline, endpoints, device ids, health and required read routes, permitted operations, holder, and pending operations.
- Declare ready after actual checks. Transfer resources only after actual handback.

## Maintain records

Update `progress.md` and regenerate its HTML after a judged check, verified fix, module completion, or substantive coordination change. Keep current facts and significant decisions rather than reply transcripts.

### Progress and timing

- **Assignments:** keep current module entries, distribution, dependencies, and integration triggers aligned with the plan.
- **Results:** record checks, fixes, retests, judgments, evidence qualification and links, actual runtime baseline, current work, item-level blockers and unlock conditions, and pending or handback state.
- **Integration:** record merged changes, baseline, cleared blockers, actual environment verification, failures or rollback, and schedule or assignment decisions.
- **Response delay:** record report-to-instruction time only when a response is required. Continued work is not a wait.
- **Actual waits:** record module or feature, reason, start, and end. Do not count an item's blockage as a module wait while other work continues.
- **Stops and updates:** record instruction, acknowledgment, actual stop/handback, environment readiness, and global continue times.

### Task synchronization

- After a fix or decisive result, cross-check actual impact against task mappings and arrange synchronization of the affected task-document locations through the repository workflow.
- Related-task mappings do not expand campaign scope or require completing the whole related task. Do not copy task bundles into the record or overwrite their goals and completion conditions.

### HTML

Group related features and show id, test item, acceptance condition, current status, evidence qualification, and evidence/runtime links. Keep subitem findings and blockers visible; derive judgments from `## Acceptance`.

## Acceptance

- Use not tested, testing, partially passed, passed, failed, and blocked as statuses. A known unresolved required-check failure makes the feature failed even if other parts pass. Use blocked for missing prerequisites and partially passed for passed coverage with required qualifications still unverified.
- Pass only the required scope and qualification actually established. Mark development identities and fixtures; lower-level evidence does not qualify the whole feature.
- When behavior changes or a baseline is adopted, identify affected features and qualifications. Preserve prior evidence as historical and exclude affected passes until qualified retests.
- Keep known failures unresolved until a retest of the failed qualification clears them. Reuse unaffected evidence with a recorded basis.
- Assign rechecks only to affected work, and recalculate statuses and counts for the current baseline.

## Pause and resume

On a user pause:

- Stop dispatching and send **Finish the current unit and stop**. Immediately stop operations that cannot safely continue.
- Record actual outcomes, stopped and running modules, pending operations, resource ownership, and recovery instructions. After actual handbacks, suspend coordination and preserve follow-ups for explicit resume.
- A pause does not complete the campaign or authorize environment teardown.

On explicit resume, read the latest records and reports; check actual worktrees, loaded baselines, services, devices, and pending operations before sending **Resume**. Old readiness claims require fresh checks.

## Finish and clean up

- Before accepting module completion, obtain proportionate independent review, necessary residue cleanup, decisive verification, and correct task-document synchronization.
- Close execution only when every in-scope feature has a current judgment with evidence or a reason it is missing; remaining failed, blocked, or unverified work has a disposition consistent with completion conditions; and actual stops, handbacks, pending operations, and task records are accounted for. Required executable work remains unfinished until completed or deferred or excluded under agreed conditions or a user decision.
- Report tested and untested scope, outstanding failures and blockers with dispositions, verified baseline, and release gates. Distinguish execution closure from release readiness; keep unmet or unverified gates explicit.
- After closure, clean up only unused campaign-owned resources, checking ownership, active users, and dependencies. Keep shared, active, or unknown-owned resources and prefer recoverable worktree archival. Apply the [shared preservation requirements](../SKILL.md#documents) before removing worktrees, branches, or temporary files.
- Follow existing authorization and repository rules for merging into the user's main line.
