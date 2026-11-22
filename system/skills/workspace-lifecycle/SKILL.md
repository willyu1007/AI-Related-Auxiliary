---
name: workspace-lifecycle
description: >-
  Use when managing branches, worktrees, or intermediate artifacts during development,
  at a checkpoint or handoff, or in coordinated workspace cleanup. Covers resource
  ownership and retirement, not removal of superseded production code or test pruning.
---

# Workspace Lifecycle

Keep resources needed for current work; release those whose purpose has ended.
Use the user's target branch and retention policy. A main-only checkout is a
requested end state, not a rule for ongoing development.

## Choose the scope

- **Development:** manage this task's branches, worktrees and artifacts. Reuse
  suitable isolation before creating another checkout. At a checkpoint, preserve
  verified work and release resources no longer needed by this task or its consumers.
- **Coordination:** inventory the requested repositories and their active owners,
  agree integration and release order, then retire independently eligible resources.
  One blocked owner does not hold unrelated cleanup.
- A question or inventory request is read-only. Existing authorization covers
  actions within its scope; local cleanup alone does not authorize remote ref
  deletion, publishing, stopping another task or deleting its resources.

## Establish eligibility

Inspect the current repository, index and worktree state before mutation. Capture
the exact target commit and each candidate's identity; recheck them immediately
before acting. Age, a clean tracked status, a closed chat or a merged PR alone
does not establish eligibility.

| Resource | Evidence needed before retirement |
|---|---|
| Branch | Every unique change is accounted for in the intended target or explicitly approved for disposal; no ongoing work or required recovery reference depends on it. |
| Worktree | Commit eligibility, staged/unstaged/untracked work accounted for, needed ignored files preserved, and no task or process still requires the checkout. |
| Intermediate artifact | Exact path, owning task, purpose, consumers and exit condition are known; no acceptance, delivery, recovery or reproducibility requirement still uses it. |

For Git resources:

- Identify the repository's common Git directory, linked worktrees, checked-out
  branches, upstreams and local/remote refs. Distinguish linked worktrees from
  submodules and nested repositories. Include detached heads, unpushed commits,
  untracked files and relevant stashes; never clear stashes as incidental cleanup.
- Check containment against the intended target. After squash or cherry-pick,
  reconcile all unique changes with the actual integration; a PR label or a
  matching patch for one commit does not dispose of the remaining commits.
- Check both the intended local target and remote target when claiming work is
  delivered remotely. Do not delete the last required reference to local-only work.
- Determine application/harness ownership and actual process working directories.
  Inspect command names and cwd without dumping argv, environment or credentials.
  A checkout being idle does not establish that its owner has released it.

## Manage intermediate artifacts

For substantial, shared or retained outputs, record the path, owner, source
identity and removal condition in the existing task or handoff record. Do not
create a second registry for ordinary temporary files.

- Include known task-owned ignored and out-of-repository outputs: temporary
  scripts, diagnostic logs, failed builds, exports, screenshots and copied caches.
  Keep the scan within the authorized task or explicit cleanup roots.
- Separate reproducible disposable output from unique evidence, delivery packages,
  symbols, acceptance inputs, recovery copies and business data. Keep qualified
  reusable outputs while their consumers need them; do not rebuild merely to delete.
- Before removing a checkout, preserve required ignored files separately and
  verify the destination. Git history or a harness snapshot may not contain them.
- Do not treat secrets, private configuration, dependency stores, shared caches,
  databases or volumes as disposable build output. Shared runtime cleanup needs
  its own ownership, data-retention and authorization evidence.
- Remove only exact eligible paths. Unknown ownership or recovery dependencies
  remain listed for resolution; elapsed time is a prioritization signal only.

## Integrate and release

1. **Protect ongoing work.** Separate this task's changes from foreign changes,
   including edits in the same file and the existing index. Do not auto-stash,
   commit unverified work or discard drafts to obtain a clean status.
2. **Resolve content before deleting references.** Integrate approved changes into
   the intended target using repository conventions. Follow any user instruction
   to stop on conflicts; resolve only within the authorized merge scope. Leave
   unaccounted changes intact and continue other independent resources.
3. **Release owners.** For application-managed worktrees, use the available native
   handoff/archive mechanism. Preserve needed ignored artifacts first and verify
   the resulting recovery reference. An active/owned/protected refusal stops that
   candidate: arrange normal release within the existing coordination authority.
   Do not edit application state or remove directories to bypass protection.
4. **Retire exact resources.** For unmanaged Git worktrees use Git's worktree
   operations, then retire eligible local branches. Prefer normal merged-branch
   deletion; a force flag is not proof of eligibility. Prune metadata only for
   genuinely absent worktrees. Do not remove the current checkout or switch a
   shared checkout away from another task's branch.
5. **Handle remotes separately.** Verify the remote, target and exact candidate
   ref/commit under explicit remote-deletion authorization. Use a conditional
   deletion tied to that commit where supported. If the ref moves, stop that
   deletion and reassess its new content; never retry by name alone or force-push
   the target. Detaching an application attachment does not delete a Git ref.
6. **Verify and hand back.** Read back the target, refs, worktrees, retained outputs
   and ownership. Check that preserved files and recovery references remain
   usable and deleted resources are actually gone. State completed actions and
   each retained resource's purpose, owner and release condition; do not claim
   main-only or fully cleaned while exceptions remain.

Pure ref, worktree or disposable-output cleanup needs metadata, ownership and
preservation checks, not fresh business tests, dependency installation or builds.
If integration changes source or configuration, run the repository's required
checks on the resulting input; keep prior results only where their inputs and
coverage still hold. Leave build and environment execution within existing
specific authorization.
