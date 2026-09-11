# C++ Code Style Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the C++ style CLI explicit about its source/runtime boundary, easier to operate from an agent, and diagnosable on Windows without adding rollback machinery.

**Architecture:** Keep `system/skills/cpp-code-style` as the only repository source. Treat `.skills-manager` as the external global skill manager and `.codex` as its linked runtime view; document this boundary without making the repository installer manage a second source. Keep proposal writes atomic and preflight-validated, add structured diagnostics and clear error classes, and do not expand the existing write/recovery behavior into a new rollback subsystem.

**Tech Stack:** Python 3.9+, argparse, PyYAML, jsonschema, unittest, PowerShell on Windows.

**Spec:** The user's cpp-code-style usage report and follow-up constraints in the conversation dated 2026-09-11.

## Global Constraints

- `system/skills/cpp-code-style` is the sole development source.
- `.skills-manager` is an external global skill manager; `.codex/cpp-code-style` is a Windows-linked runtime view and must not become a second source.
- Manual `rules.yaml` editing is emergency fallback only after explicit authorization; normal writes use `propose` and `apply`.
- Do not add rollback logic, retries, background writer threads, or a new transaction subsystem.
- Preserve JSON output as the machine-readable interface and keep diagnostics on stderr.
- Do not lock Python to one minor release; document and enforce the actual Python 3.9+ floor.

---

### Task 1: Establish runtime boundary and manual-edit contract

**Files:**
- Modify: `system/skills/cpp-code-style/SKILL.md`
- Modify: `system/skills/cpp-code-style-manager/SKILL.md`
- Modify: `system/skills/cpp-code-style/references/cli.md`
- Modify: `system/skills/cpp-code-style/references/data-contract.md`
- Modify: `system/skills/cpp-code-style/requirements.txt`

**Interfaces:**
- Documents `<skill-root>/scripts/style.py` as the CLI resolved from the loaded `SKILL.md` directory.
- Documents repository source, `.skills-manager`, and linked `.codex` roles.
- Defines Python 3.9+ as the supported runtime floor.
- Makes manual edits an explicitly authorized fallback followed by `validate`.

- [ ] Add documentation tests/grep assertions for the source/runtime boundary and Python floor.
- [ ] Run the assertions and confirm they fail before the documentation is changed.
- [ ] Update the skill and references without changing the storage format.
- [ ] Run the assertions and the existing CLI test suite.
- [ ] Commit the contract-only unit.

### Task 2: Improve CLI argument discoverability and proposal output modes

**Files:**
- Modify: `system/skills/cpp-code-style/scripts/style.py`
- Modify: `system/skills/cpp-code-style/tests/test_cli.py`
- Modify: `system/skills/cpp-code-style/references/cli.md`

**Interfaces:**
- `propose --input-file` aliases `--input`.
- `propose --proposal-file` aliases `--out`.
- `apply --proposal-file` aliases `--proposal`.
- Missing `--layer` reports a copyable command example.
- Proposal output defaults to a compact summary; `--diff` includes full write diffs; `--quiet` suppresses stdout while preserving the proposal file.
- The proposal file remains complete and digestable; only stdout presentation changes.

- [ ] Add failing subprocess tests for aliases, missing-layer guidance, summary output, diff output, and quiet output.
- [ ] Run those tests and confirm the current parser/output fails them.
- [ ] Implement argument aliases and a presentation-only serializer in `style.py`.
- [ ] Run the focused tests, then the full CLI suite.
- [ ] Commit the CLI UX unit.

### Task 3: Classify digest/stale errors and add apply diagnostics

**Files:**
- Modify: `system/skills/cpp-code-style/scripts/proposals.py`
- Modify: `system/skills/cpp-code-style/scripts/style.py`
- Modify: `system/skills/cpp-code-style/tests/test_cli.py`
- Modify: `system/skills/cpp-code-style/references/cli.md`

**Interfaces:**
- Digest errors distinguish missing confirmation, provided digest mismatch, and modified proposal content, including `providedDigest`, `proposalDigest`, and `actualDigest` where available.
- Stale errors distinguish changed rules/details/schema, changed `.clang-format`, changed target hash, foreign project/user, and invalid layer.
- `--verbose` emits phase messages to stderr: validate proposal, preflight targets, write target, complete.
- Write failures identify the target path and operation, while leaving the existing atomic write/recovery behavior unchanged.

- [ ] Add failing tests for each digest/stale category and verbose phase output.
- [ ] Run the focused tests and record the current generic errors/no diagnostics.
- [ ] Implement classification and stderr diagnostics without changing the JSON success contract.
- [ ] Run focused and full tests, including a forced write failure that proves the error is actionable without adding a new rollback mechanism.
- [ ] Commit the diagnostics unit.

### Task 4: Normalize check result semantics and rule-group filtering

**Files:**
- Modify: `system/skills/cpp-code-style/scripts/handlers.py`
- Modify: `system/skills/cpp-code-style/scripts/style.py`
- Modify: `system/skills/cpp-code-style/tests/test_cli.py`
- Modify: `system/skills/cpp-code-style/references/cli.md`
- Modify: `system/skills/cpp-code-style/references/data-contract.md`

**Interfaces:**
- `--rule format` selects the effective enabled clang-format rule group and keeps the aggregate result ID `format` with concrete `ruleIds`.
- Check JSON separates `automated`, `semantic`, and `complete` summaries while preserving per-result statuses for compatibility.
- Semantic `needs-review` is reported as pending review, not as an automated failure.
- `apply` success output contains only actual writes, effective rules, layer, and digest; no user-confirmation note.

- [ ] Add failing tests for `--rule format`, automated/semantic summaries, and confirmation-note absence.
- [ ] Run them to confirm the current behavior fails or lacks the fields.
- [ ] Implement group expansion and result normalization.
- [ ] Run the full CLI suite and inspect representative JSON output.
- [ ] Commit the check-contract unit.

### Task 5: Add Windows-oriented write and test coverage without rollback

**Files:**
- Modify: `system/skills/cpp-code-style/tests/test_cli.py`
- Modify: `system/skills/cpp-code-style/references/cli.md`
- Modify: `system/skills/cpp-code-style/references/data-contract.md`

**Interfaces:**
- Tests cover Python 3.9+ compatible behavior, writable/readonly targets where the host permits, Chinese paths, CRLF input, UTF-8 without BOM, stale proposals, invalid digests, invalid layers, detail files, deletion proposals, and paths outside the selected layer.
- Tests assert bounded, actionable errors for preflight/write failures; they do not require or introduce rollback.
- The documented matrix distinguishes portable tests from Windows-only tests.

- [ ] Add focused tests first and verify each new test fails or is skipped for an explicit environmental reason.
- [ ] Implement only the smallest test seams needed; do not add production rollback.
- [ ] Run the Windows test suite and report skipped cases explicitly.
- [ ] Commit the test/documentation unit.

### Task 6: Final verification and source/runtime consistency check

**Files:**
- Verify: all files above plus installed runtime copies when present; no repository source changes.

- [ ] Verify `system/skills/cpp-code-style` and `cpp-code-style-manager` remain the only repository sources.
- [ ] Verify linked `.codex` and external `.skills-manager` copies are not edited by repository code.
- [ ] Run `python -B -m unittest discover -s system/skills/cpp-code-style/tests -v`.
- [ ] Run `node --check system/skills/cpp-code-style/scripts/style.py` is not applicable; run Python compilation and repository static checks instead.
- [ ] Run `git diff --check`, inspect status, and report any environment-only check failures.
