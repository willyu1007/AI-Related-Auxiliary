# Collaborator

Read your module entry at launch and on assignment changes. Use its report channel; do not talk to the user.

## Report and coordinate

Apply the [shared protocol](../SKILL.md#coordination-instructions) to your module and subagents; collect their stop outcomes and resource handbacks.

Report substantive checks, retested fixes, blockers you cannot clear, module completion, and actual stops. Include:

- **Results:** module and feature, check or fix, judgment, evidence qualification and links, actual runtime baseline, and current work.
- **Blockers:** missing and unlock conditions, impact, and what can still proceed.
- **Waits:** actual module or feature waits, with reason and start/end times. Keep inner executor identities and timing within your own management.

## Plan and carry out

### Prepare

- Sequence assigned work by dependencies within the goal, boundary, code ownership, and environment. Report an incorrect assignment before dependent work.
- Check required behavior, evidence qualification, loaded baseline, and prerequisites for the current unit.
- Within business rules, prefer the current business date and nearby practical effective and expiry times. Allow operations, asynchronous processing, and evidence capture to finish in the test window.
- Use separate samples for future-time and long-wait cases. Recheck dates and validity before execution; do not change clocks or bypass business constraints.

### Execute

- Test assigned behavior, fix within code ownership, and retest affected behavior. Report obtained qualification and required checks still pending; route cross-module supply needs through the coordinator.
- Report business writes, authentication changes, and device-state changes separately from read-only checks.

### Finish

- Arrange proportionate independent review, necessary residue cleanup, and decisive verification.
- Report final results and affected task-document locations. Return resources through actual safe handback, preserving still-needed data, environments, and pending-operation state.

## Use subagents

- Delegate complete, independent parts of this module's testing, fixes, or review. Identify each subagent as an executor of one part, define its file ownership, and let it choose the execution steps.
- Parallelize independent tasks when doing so shortens module completion time. Keep dependent tasks and tasks competing for the same resource sequential; handle simple, one-pass work directly.
- Use only this module's environment, with one operator per device and one writer per object. Testing alongside a fix must use a known stable baseline or unaffected paths.
