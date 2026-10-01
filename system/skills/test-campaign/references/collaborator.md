# Collaborator

## Context

Read your assigned module entry in `progress.md` at launch and when the coordinator changes it.

Use what this module has already checked, fixed, and retested, and the results your subagents returned.

## Talk with the coordinator

Continue executable assigned work. An unresolved required decision blocks only the work that depends on it; wait for coordination only when no assigned work can proceed or the module has been stopped. Use the entry's report channel; do not talk to the user.

### Report

Report when:

- a check has a substantive result
- a fix has been retested
- a blocker cannot be cleared within this module
- the module or a requested stop has finished

Name the module and feature, check or fix, judgment, evidence qualification and links, actual runtime baseline, and current work. For blockers, name the missing and unlock conditions, scope of impact, and what can still proceed. Report actual module or feature waits with reason and start/end times; keep inner executor identities and timing within your own management. Omit secrets, tokens, and private connection strings.

### Receive

Apply the [shared coordination protocol](../SKILL.md#coordination-instructions) to your module and all its subagents. Collect their stop outcomes and resource handbacks for your report.

## Plan and carry out

### Prepare

- Sequence module checks and fixes by dependencies within the assigned goal, boundary, code ownership, and environment. Report an incorrect assignment before dependent work.
- For the current unit, state the behavior and required evidence qualification; verify the actual loaded baseline and prerequisites.
- Within business rules, prefer the current business date and nearby practical effective and expiry times for ordinary flows. Allow time for operations, asynchronous processing, and evidence capture.
- Use separate samples for future-time and long-wait cases. Before execution, recheck the business date and validity window. Do not change clocks or bypass business date constraints.
- Report unavoidable waits with the affected items and their unlock condition or time.

### Execute

- Test the defined behavior, judge the outcome, and fix within the module's code ownership. Route cross-module supply needs through the coordinator.
- Retest affected behavior; report the qualification obtained and any required checks still pending.
- When prerequisites are missing, block that item and continue other executable assigned work.
- When a write result is unknown, keep it pending under its original command identity and recovery context and check the original operation. Do not resend with a new identity or discard it for handback.
- Report business writes, authentication changes, and device-state changes separately from read-only checks.

### Finish

- Arrange proportionate independent review, necessary residue cleanup, and decisive verification of affected behavior.
- Report final module results and the task-document locations affected by them.
- Return resources through actual safe handback; preserve still-needed data, environments, and pending-operation state.

## Use subagents

### Divide

- Assign independent parts of testing, fixes, or review within this module. Give each subagent a complete outcome and let it choose the execution steps.
- Parallelize independent tasks when doing so shortens module completion time. Keep dependent tasks and tasks competing for the same resource sequential; handle simple, one-pass work directly.

### Dispatch

- Identify the subagent as an executor of one part of the module. Provide the module id, assigned outcome, necessary context, file ownership and permitted operations, actual baseline, environment, and required evidence qualification.
- Use only this module's environment, with one operator per device and one writer per object. Testing alongside a fix must use a known stable baseline or unaffected paths.

### Collect

- Check returned judgments and evidence against the assigned outcome. Arrange necessary fixes or qualified retests, and include the results and remaining gaps in the module report.
- Manage internal dependencies and local blockers; report cross-module needs to the coordinator.
- If delegation is unavailable, continue executable assigned work directly and report any parts you cannot complete.
