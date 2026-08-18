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
         .ai/project/CONTRACT.md .ai/project/AGENTS.md .ai/project/templates/registry.yaml; do
  [ -f "$f" ] || fail "install did not place $f"
done
for d in dev-docs/active dev-docs/archive; do
  [ -d "$d" ] || fail "install did not create $d"
done
for f in registry.yaml dashboard.md feature-map.md task-index.md changelog.md; do
  [ -f ".ai/project/$f" ] || fail "install did not initialize .ai/project/$f"
done

# Installing again must not disturb what the first run created: shipped assets refresh in place,
# hub files are project data and stay. A second install that resets the registry would silently
# discard every task the repository has.
printf '\n# smoke-marker\n' >> .ai/project/registry.yaml
node .ai/scripts/ctl-project-governance.mjs install --repo-root . >/dev/null
grep -q 'smoke-marker' .ai/project/registry.yaml || fail "re-install overwrote hub data"

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
printf '# Roadmap\n\n## Phases\n\n### Phase 1 — verify\n- Outcome: smoke test passes\n' \
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

# resume must resolve the active task and carry the canonical status head.
node .ai/scripts/ctl-project-governance.mjs resume --json > resume.json
grep -q '"id":"T-001"' resume.json || fail "resume did not resolve the task"
grep -q '"status"' resume.json || fail "resume packet did not expose the status head"
grep -q 'wire verification' resume.json || fail "resume packet lost the status next step"
grep -q 'Repeating a stale path.*use the supported path' resume.json \
  || fail "resume packet did not parse canonical pitfalls"
rm -f resume.json

# Optional context files are not required, but the canonical verification authority is.
rm dev-docs/active/sample/pitfalls.md
node .ai/scripts/ctl-project-governance.mjs lint --strict >/dev/null \
  || fail "lint treated optional pitfalls.md as required"
printf '# Pitfalls\n\n| Hazard | Evidence | Prevention | Applies until |\n|---|---|---|---|\n| Repeating a stale path | failed run | use the supported path | guard is encoded |\n' \
  > dev-docs/active/sample/pitfalls.md
mv dev-docs/active/sample/verification.md dev-docs/active/sample/verification.tmp
if node .ai/scripts/ctl-project-governance.mjs lint --check >/dev/null 2>&1; then
  fail "lint accepted a canonical bundle without verification.md"
fi
mv dev-docs/active/sample/verification.tmp dev-docs/active/sample/verification.md
cp dev-docs/active/sample/verification.md dev-docs/active/sample/04-verification.md
if node .ai/scripts/ctl-project-governance.mjs lint --check >/dev/null 2>&1; then
  fail "lint accepted duplicate canonical and legacy verification authorities"
fi
rm dev-docs/active/sample/04-verification.md

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
node .ai/scripts/ctl-project-governance.mjs map --task T-001 --feature F-001 --apply >/dev/null
node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null
grep -q 'feature_id: F-001' .ai/project/registry.yaml || fail "map did not retain the feature mapping"

# Requirement mapping writes into the registry.
node .ai/scripts/ctl-project-governance.mjs map --task T-001 --requirement R-001 --apply >/dev/null
grep -q 'R-001' .ai/project/registry.yaml || fail "map did not record the requirement"

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
  printf '# Roadmap\n\n## Phases\n\n### Phase 1 — verify\n- Outcome: pass\n' \
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

node .ai/scripts/ctl-project-governance.mjs query --all-worktrees --text alpha --json > worktrees.json
grep -q "\"id\":\"$ID_A\"" worktrees.json || fail "cross-worktree query missed uncommitted task metadata"
grep -q 'alpha smoke test' worktrees.json || fail "cross-worktree query did not search or return the task goal"
rm -f worktrees.json

git worktree remove --force "$WT_A"
git worktree remove --force "$WT_B"
git branch -D feat/sib-a feat/sib-b >/dev/null 2>&1 || true

# Legacy bundles remain readable but are not new write targets.
mkdir -p dev-docs/active/legacy
printf '# Legacy\n\n## Status\n- State: blocked\n- Next step: migrate the status head\n\n## Goal\nRecover old task records.\n' \
  > dev-docs/active/legacy/00-overview.md
printf '# Pitfalls\n\n## Do-not-repeat summary (keep current)\n- Keep the legacy fallback readable\n' \
  > dev-docs/active/legacy/05-pitfalls.md
node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null
LEGACY_ID=$(grep -oE 'T-[0-9]{3}' dev-docs/active/legacy/.ai-task.yaml)
node .ai/scripts/ctl-project-governance.mjs resume --task "$LEGACY_ID" --json > legacy.json
grep -q 'Recover old task records' legacy.json || fail "resume lost the legacy goal fallback"
grep -q 'migrate the status head' legacy.json || fail "resume lost the legacy next-step fallback"
grep -q 'legacy status file' legacy.json || fail "resume did not identify the legacy fallback"
grep -q 'Keep the legacy fallback readable' legacy.json || fail "resume lost the legacy pitfalls fallback"
grep -q 'legacy pitfalls file' legacy.json || fail "resume did not identify the legacy pitfalls fallback"
rm -f legacy.json

# archiving flips the effective status.
mkdir -p dev-docs/archive
printf '# T-001 · sample\n\nGoal: Smoke test.\n\nOutcome: passed.\n' > dev-docs/active/sample/summary.md
rm dev-docs/active/sample/00-roadmap.md dev-docs/active/sample/01-status.md \
  dev-docs/active/sample/02-architecture.md dev-docs/active/sample/verification.md \
  dev-docs/active/sample/pitfalls.md
mv dev-docs/active/sample dev-docs/archive/
printf '# %s · legacy\n\nGoal: Recover old task records.\n\nOutcome: migration fallback verified.\n' "$LEGACY_ID" \
  > dev-docs/active/legacy/summary.md
rm dev-docs/active/legacy/00-overview.md dev-docs/active/legacy/05-pitfalls.md
mv dev-docs/active/legacy dev-docs/archive/
node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null
grep -q 'status: archived' .ai/project/registry.yaml || fail "archive status not propagated"
node .ai/scripts/ctl-project-governance.mjs lint --strict >/dev/null || fail "lint failed after archive"

echo "install, canonical/legacy docs, optional/required lint, hook sync, feature/map, cross-worktree allocation, archive"
