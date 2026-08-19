#!/bin/sh
#
# Smoke test for the project assets task-start ships. Run by `node checks/run.mjs` inside an empty
# throwaway git repo. Not a distributable.
#

set -e

fail() { echo "FAIL: $1"; exit 1; }

[ -n "$AUX_ROOT" ] || fail "AUX_ROOT not set; run via node checks/run.mjs"

CTL="$AUX_ROOT/system/skills/task-start/assets/project/.ai/scripts/ctl-project-governance.mjs"
[ -f "$CTL" ] || fail "task-start does not ship the control script"

# The repository starts with nothing: one command out of the skill must leave it fully provisioned.
if [ -d .ai ] || [ -d dev-docs ]; then fail "target repo is not empty before install"; fi
node "$CTL" install --repo-root . >/dev/null

for f in .ai/scripts/ctl-project-governance.mjs .ai/scripts/lib/yaml-lite.mjs \
         .ai/project/AGENTS.md .ai/project/CLAUDE.md .ai/project/templates/registry.yaml; do
  [ -f "$f" ] || fail "install did not place $f"
done
[ ! -e .ai/project/CONTRACT.md ] || fail "install retained the superseded hub contract"
grep -q 'Follow `AGENTS.md`' .ai/project/CLAUDE.md \
  || fail "hub Claude entry does not route to AGENTS.md"
for d in dev-docs/active dev-docs/archive; do
  [ -d "$d" ] || fail "install did not create $d"
done
for f in dev-docs/README.md dev-docs/CLAUDE.md dev-docs/AGENTS.md; do
  [ -f "$f" ] || fail "install did not place $f"
done
cmp -s dev-docs/CLAUDE.md dev-docs/AGENTS.md \
  || fail "Claude and Agent task-doc pointers drifted"
grep -q 'README.md.*sole authority' dev-docs/CLAUDE.md \
  || fail "task-doc pointer does not route to README.md"
for f in registry.yaml dashboard.md feature-map.md task-index.md changelog.md; do
  [ -f ".ai/project/$f" ] || fail "install did not initialize .ai/project/$f"
done

# Installing again must not disturb what the first run created: shipped assets refresh in place,
# hub files are project data and stay. A second install that resets the registry would silently
# discard every task the repository has.
printf '\n# smoke-marker\n' >> .ai/project/registry.yaml
printf '\nshipped-doc-drift\n' >> dev-docs/README.md
printf '# Superseded contract\n' > .ai/project/CONTRACT.md
node "$CTL" install --repo-root . >/dev/null
grep -q 'smoke-marker' .ai/project/registry.yaml || fail "re-install overwrote hub data"
if grep -q 'shipped-doc-drift' dev-docs/README.md; then
  fail "re-install did not refresh the task-document guidance"
fi
[ ! -e .ai/project/CONTRACT.md ] || fail "re-install did not remove the superseded hub contract"

# Hooks ship with the skill that installs them. AUX_ROOT is set by checks/run.mjs.
mkdir -p .githooks
cp -R "$AUX_ROOT/system/skills/task-sync/assets/githooks/." .githooks/
[ -x .githooks/pre-commit ] || fail ".githooks/pre-commit is not executable"

node .githooks/install.mjs >/dev/null

node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null

# Single-project layout: no per-project subdirectory, no project key in the registry.
if [ -d .ai/project/main ]; then fail "init created a per-project subdirectory"; fi
if grep -qE '^project:' .ai/project/registry.yaml; then fail "registry still has a project block"; fi

mkdir -p dev-docs/active/sample
printf '# Roadmap\n\n## Scope and constraints\n- Scope: smoke test\n\n## Decision alignment\nNone.\n\n## Task relationships\nNone.\n\n## Implementation plan\n\n### Phase 1 — verify\n- Outcome: smoke test passes\n- Approach: exercise governance end to end\n- Planned changes:\n  1. Run the smoke workflow\n- Affected boundaries / entry points: governance script\n- Dependencies: none\n- Exit criteria: smoke test passes\n- Verification: run lint\n- Recovery: restore the fixture\n\n## Kickoff gate\n- Status: ready\n- [x] Every user-owned choice that blocks implementation is decided.\n- [x] Settled design and interfaces are reflected in `02-architecture.md`.\n- [x] The first implementation phase is executable with exit, verification, and recovery criteria.\n- [x] Every current completion condition has a decisive planned check in `verification.md`.\n\n## Risks and recovery\nNone.\n\n## Phase closeout\nCommit the verified fixture.\n' \
  > dev-docs/active/sample/00-roadmap.md
printf '# Status\n\n## Goal\nSmoke test.\n\n## Progress\n- State: in-progress\n- Current phase: verify\n- Next step: wire verification\n- Blocker: none\n\n## Done when\n- [ ] Smoke test passes\n' \
  > dev-docs/active/sample/01-status.md
printf '# Architecture\n' > dev-docs/active/sample/02-architecture.md
printf '# Verification\n\n## Completion matrix\n' > dev-docs/active/sample/verification.md
printf '# Pitfalls\n\n| Hazard | Evidence | Prevention | Applies until |\n|---|---|---|---|\n| Repeating a stale path | failed run | use the supported path | guard is encoded |\n' > dev-docs/active/sample/pitfalls.md

git checkout -q -b feat/T-001-sample
git add -A
git -c user.email=ci@local -c user.name=ci commit -qm "feat(sample): add task bundle" >/dev/null

# pre-commit should have allocated the ID and synced the hub before the commit landed.
[ -f dev-docs/active/sample/.ai-task.yaml ] || fail "pre-commit did not allocate .ai-task.yaml"
grep -q 'task_id: T-001' dev-docs/active/sample/.ai-task.yaml || fail "unexpected task id"
grep -q 'id: T-001' .ai/project/registry.yaml || fail "registry was not synced"
if grep -qE '^project:' dev-docs/active/sample/.ai-task.yaml; then
  fail "task meta still carries a project field"
fi
git log -1 --format='%B' | git interpret-trailers --parse | grep -q '^Task: T-001$' \
  || fail "trailer missing on the task branch"

node .ai/scripts/ctl-project-governance.mjs lint --strict >/dev/null || fail "lint --strict failed"

# A task cannot claim completion while its completion conditions remain unchecked.
cp dev-docs/active/sample/01-status.md dev-docs/active/sample/01-status.tmp
sed -i 's/State: in-progress/State: done/' dev-docs/active/sample/01-status.md
if node .ai/scripts/ctl-project-governance.mjs lint --check >/dev/null 2>&1; then
  fail "lint accepted a done task with unchecked completion conditions"
fi
mv dev-docs/active/sample/01-status.tmp dev-docs/active/sample/01-status.md

# A pending seed is valid before kickoff, but ready requires every gate item.
cp dev-docs/active/sample/00-roadmap.md dev-docs/active/sample/00-roadmap.tmp
sed -i 's/Status: ready/Status: pending/; s/\[x\]/[ ]/g' dev-docs/active/sample/00-roadmap.md
node .ai/scripts/ctl-project-governance.mjs lint --check >/dev/null \
  || fail "lint rejected a valid pending kickoff seed"
mv dev-docs/active/sample/00-roadmap.tmp dev-docs/active/sample/00-roadmap.md

# The worked example must function as a valid pending seed, not merely resemble the template.
cp dev-docs/active/sample/00-roadmap.md dev-docs/active/sample/00-roadmap.tmp
cp "$AUX_ROOT/system/skills/task-start/examples/sample-roadmap-seed.md" \
  dev-docs/active/sample/00-roadmap.md
node .ai/scripts/ctl-project-governance.mjs lint --check >/dev/null \
  || fail "lint rejected the worked pending roadmap seed"
node .ai/scripts/ctl-project-governance.mjs resume --json > seed-resume.json
grep -q '"kickoff_status":"pending"' seed-resume.json \
  || fail "worked roadmap seed did not recover as kickoff pending"
rm -f seed-resume.json
mv dev-docs/active/sample/00-roadmap.tmp dev-docs/active/sample/00-roadmap.md

cp dev-docs/active/sample/00-roadmap.md dev-docs/active/sample/00-roadmap.tmp
sed -i '0,/\[x\]/{s/\[x\]/[ ]/}' dev-docs/active/sample/00-roadmap.md
if node .ai/scripts/ctl-project-governance.mjs lint --check >/dev/null 2>&1; then
  fail "lint accepted ready kickoff with an unchecked gate"
fi
mv dev-docs/active/sample/00-roadmap.tmp dev-docs/active/sample/00-roadmap.md

# A roadmap must be usable, not a copied template with unresolved placeholders.
cp dev-docs/active/sample/00-roadmap.md dev-docs/active/sample/00-roadmap.tmp
printf '\n<!-- unfinished -->\n' >> dev-docs/active/sample/00-roadmap.md
if node .ai/scripts/ctl-project-governance.mjs lint --check >/dev/null 2>&1; then
  fail "lint accepted an unfilled roadmap template placeholder"
fi
mv dev-docs/active/sample/00-roadmap.tmp dev-docs/active/sample/00-roadmap.md

# resume must resolve the active task and carry the current status head.
node .ai/scripts/ctl-project-governance.mjs resume --json > resume.json
grep -q '"id":"T-001"' resume.json || fail "resume did not resolve the task"
grep -q '"status"' resume.json || fail "resume packet did not expose the status head"
grep -q 'wire verification' resume.json || fail "resume packet lost the status next step"
grep -q '"kickoff_status":"ready"' resume.json || fail "resume packet lost kickoff readiness"
grep -q 'Repeating a stale path.*use the supported path' resume.json \
  || fail "resume packet did not parse current pitfalls"
rm -f resume.json
node .ai/scripts/ctl-project-governance.mjs query --all-worktrees --id T-001 --json > query.json
grep -q '"kickoff_status":"ready"' query.json || fail "query did not expose kickoff readiness"
rm -f query.json

# Optional context files are not required, but verification.md is.
rm dev-docs/active/sample/pitfalls.md
node .ai/scripts/ctl-project-governance.mjs lint --strict >/dev/null \
  || fail "lint treated optional pitfalls.md as required"
printf '# Pitfalls\n\n| Hazard | Evidence | Prevention | Applies until |\n|---|---|---|---|\n| Repeating a stale path | failed run | use the supported path | guard is encoded |\n' \
  > dev-docs/active/sample/pitfalls.md
mv dev-docs/active/sample/verification.md dev-docs/active/sample/verification.tmp
if node .ai/scripts/ctl-project-governance.mjs lint --check >/dev/null 2>&1; then
  fail "lint accepted an active bundle without verification.md"
fi
mv dev-docs/active/sample/verification.tmp dev-docs/active/sample/verification.md
# sync is idempotent.
node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null
node .ai/scripts/ctl-project-governance.mjs lint --strict >/dev/null || fail "lint failed after re-sync"

# Feature creation is locked, idempotent, and can feed task mapping.
node .ai/scripts/ctl-project-governance.mjs feature --title "Smoke capability" \
  --description "Exercise feature allocation" --apply --json > feature.json
grep -q '"id":"F-001"' feature.json || fail "feature command did not allocate F-001"
grep -q '"created":true' feature.json || fail "feature command did not report creation"
node .ai/scripts/ctl-project-governance.mjs feature --title "Smoke capability" --apply --json > feature.json
grep -q '"id":"F-001"' feature.json || fail "feature command was not idempotent"
grep -q '"created":false' feature.json || fail "feature command recreated an existing title"
rm -f feature.json

# Quoted YAML scalars must survive a write/read cycle without changing identity.
node .ai/scripts/ctl-project-governance.mjs feature --title "Quoted \"feature\"\\path" \
  --description "Description with \"quotes\" and a \\path" --apply --json > feature.json
grep -q '"id":"F-002"' feature.json || fail "quoted feature did not allocate F-002"
node .ai/scripts/ctl-project-governance.mjs feature --title "Quoted \"feature\"\\path" \
  --apply --json > feature.json
grep -q '"id":"F-002"' feature.json || fail "quoted feature changed identity after YAML round-trip"
grep -q '"created":false' feature.json || fail "quoted feature was recreated after YAML round-trip"
rm -f feature.json

node .ai/scripts/ctl-project-governance.mjs map --task T-001 --feature F-001 --apply >/dev/null
node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null
grep -q 'feature_id: F-001' .ai/project/registry.yaml || fail "map did not retain the feature mapping"

# Requirements use the same locked, monotonic allocation model as features. Mapping only accepts
# an existing requirement; it must not silently invent a user-supplied ID.
node .ai/scripts/ctl-project-governance.mjs requirement --title "Smoke requirement" \
  --feature F-001 --description "Exercise requirement allocation" --apply --json > requirement.json
grep -q '"id":"R-001"' requirement.json || fail "requirement command did not allocate R-001"
grep -q '"created":true' requirement.json || fail "requirement command did not report creation"
node .ai/scripts/ctl-project-governance.mjs requirement --title "Smoke requirement" \
  --feature F-001 --apply --json > requirement.json
grep -q '"id":"R-001"' requirement.json || fail "requirement command was not idempotent"
grep -q '"created":false' requirement.json || fail "requirement command recreated an existing title"
rm -f requirement.json
node .ai/scripts/ctl-project-governance.mjs map --task T-001 --requirement R-001 --apply >/dev/null
grep -q 'R-001' .ai/project/registry.yaml || fail "map did not record the requirement"
if node .ai/scripts/ctl-project-governance.mjs map --task T-001 --requirement R-999 --apply >/dev/null 2>&1; then
  fail "map silently created a missing requirement"
fi

# Registry IDs and references are integrity constraints, not advisory metadata.
cp .ai/project/registry.yaml registry.tmp
sed -i '0,/id: F-002/{s/id: F-002/id: F-001/}' .ai/project/registry.yaml
if node .ai/scripts/ctl-project-governance.mjs lint --check >/dev/null 2>&1; then
  fail "lint accepted duplicate feature IDs"
fi
mv registry.tmp .ai/project/registry.yaml
cp .ai/project/registry.yaml registry.tmp
sed -i '/^tasks:/,$ s/feature_id: F-001/feature_id: F-999/' .ai/project/registry.yaml
if node .ai/scripts/ctl-project-governance.mjs lint --check >/dev/null 2>&1; then
  fail "lint accepted a dangling task feature mapping"
fi
mv registry.tmp .ai/project/registry.yaml

# Two linked worktrees branched from the same base must not allocate the same id,
# even while the first task metadata is still uncommitted.
#
# The second worktree's registry is the one committed at BASE, so it knows only T-001. The first
# worktree's T-002 exists solely on its own branch. Only git history reveals it -- which is the
# point: branching both worktrees from HEAD would let the shared registry answer, and the test
# would pass even with history scanning removed.
BASE=$(git rev-parse HEAD)

prepare_worktree_task() { # <path> <branch> <slug>
  rm -rf "$1"
  git worktree add -q "$1" -b "$2" "$BASE"
  mkdir -p "$1/dev-docs/active/$3"
  printf '# Roadmap\n\n## Scope and constraints\n- Scope: allocate one task\n\n## Decision alignment\nNone.\n\n## Task relationships\nNone.\n\n## Implementation plan\n\n### Phase 1 — discovery\n- Outcome: allocation evidence is available\n- Approach: exercise allocation without beginning implementation\n- Planned changes:\n  1. Allocate the task ID\n- Affected boundaries / entry points: governance script\n- Dependencies: none\n- Exit criteria: allocation succeeds\n- Verification: inspect metadata\n- Recovery: remove the temporary worktree\n\n## Kickoff gate\n- Status: pending\n- [ ] Every user-owned choice that blocks implementation is decided.\n- [ ] Settled design and interfaces are reflected in `02-architecture.md`.\n- [ ] The first implementation phase is executable with exit, verification, and recovery criteria.\n- [ ] Every current completion condition has a decisive planned check in `verification.md`.\n\n## Risks and recovery\nNone.\n\n## Phase closeout\nRetain the allocated metadata for inspection.\n' \
    > "$1/dev-docs/active/$3/00-roadmap.md"
  printf '# Status\n\n## Goal\n%s smoke test.\n\n## Progress\n- State: planned\n- Current phase: verify\n- Next step: verify\n- Blocker: none\n\n## Done when\n- [ ] Pass\n' "$3" \
    > "$1/dev-docs/active/$3/01-status.md"
}

WT_A="${TMPDIR:-/tmp}/aux-wt-a.$$"
WT_B="${TMPDIR:-/tmp}/aux-wt-b.$$"

prepare_worktree_task "$WT_A" feat/sib-a alpha
prepare_worktree_task "$WT_B" feat/sib-b beta

( cd "$WT_A" && node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null ) &
PID_A=$!
( cd "$WT_B" && node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null ) &
PID_B=$!
wait "$PID_A"
wait "$PID_B"

ID_A=$(grep -oE 'T-[0-9]{3}' "$WT_A/dev-docs/active/alpha/.ai-task.yaml")
ID_B=$(grep -oE 'T-[0-9]{3}' "$WT_B/dev-docs/active/beta/.ai-task.yaml")
[ "$ID_A" != "$ID_B" ] || fail "parallel worktrees both allocated $ID_A"
IDS=$(printf '%s\n%s\n' "$ID_A" "$ID_B" | sort | tr '\n' ' ')
[ "$IDS" = "T-002 T-003 " ] || fail "parallel worktrees allocated '$IDS', expected T-002 and T-003"

( cd "$WT_A" && node .ai/scripts/ctl-project-governance.mjs requirement \
    --title "Alpha requirement" --feature F-000 --apply --json > requirement.json ) &
PID_A=$!
( cd "$WT_B" && node .ai/scripts/ctl-project-governance.mjs requirement \
    --title "Beta requirement" --feature F-000 --apply --json > requirement.json ) &
PID_B=$!
wait "$PID_A"
wait "$PID_B"

REQ_A=$(sed -n 's/.*"id":"\(R-[0-9][0-9][0-9]\)".*/\1/p' "$WT_A/requirement.json")
REQ_B=$(sed -n 's/.*"id":"\(R-[0-9][0-9][0-9]\)".*/\1/p' "$WT_B/requirement.json")
[ "$REQ_A" != "$REQ_B" ] || fail "parallel worktrees both allocated $REQ_A"
REQ_IDS=$(printf '%s\n%s\n' "$REQ_A" "$REQ_B" | sort | tr '\n' ' ')
[ "$REQ_IDS" = "R-002 R-003 " ] \
  || fail "parallel worktrees allocated '$REQ_IDS', expected R-002 and R-003"

node .ai/scripts/ctl-project-governance.mjs query --all-worktrees --text alpha --json > worktrees.json
grep -q "\"id\":\"$ID_A\"" worktrees.json || fail "cross-worktree query missed uncommitted task metadata"
grep -q 'alpha smoke test' worktrees.json || fail "cross-worktree query did not search or return the task goal"
rm -f worktrees.json

git worktree remove --force "$WT_A"
git worktree remove --force "$WT_B"
git branch -D feat/sib-a feat/sib-b >/dev/null 2>&1 || true

# archiving flips the effective status.
mkdir -p dev-docs/archive
printf '# T-001 · sample\n\nGoal: Smoke test.\n\nOutcome: passed.\n' > dev-docs/active/sample/summary.md
rm dev-docs/active/sample/00-roadmap.md dev-docs/active/sample/01-status.md \
  dev-docs/active/sample/02-architecture.md dev-docs/active/sample/verification.md \
  dev-docs/active/sample/pitfalls.md
mv dev-docs/active/sample dev-docs/archive/
node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null
grep -q 'status: archived' .ai/project/registry.yaml || fail "archive status not propagated"
node .ai/scripts/ctl-project-governance.mjs lint --strict >/dev/null || fail "lint failed after archive"

echo "install/guidance refresh, pending seed example, kickoff/completion gates, roadmap and registry lint, resume, hook sync, feature/requirement mapping, YAML round-trip, worktree allocation, archive"
