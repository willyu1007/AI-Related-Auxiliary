#!/bin/sh
#
# Smoke test for project-hub. Run by `node checks/run.mjs` inside a throwaway git repo with this
# pack and its dependencies already installed. Not part of files/.
#
# depends: dev-docs-continuity
#

set -e

fail() { echo "FAIL: $1"; exit 1; }

[ -f .ai/project/templates/registry.yaml ] || fail "hub templates missing"
[ -f dev-docs/AGENTS.md ] || fail "dependency dev-docs-continuity was not installed"

# Hooks ship with the sync-task skill, not with either pack. AUX_ROOT is set by checks/run.mjs.
[ -n "$AUX_ROOT" ] || fail "AUX_ROOT not set; run via node checks/run.mjs"
mkdir -p .githooks
cp -R "$AUX_ROOT/system/skills/sync-task/assets/githooks/." .githooks/
[ -x .githooks/pre-commit ] || fail ".githooks/pre-commit is not executable"

node .githooks/install.mjs >/dev/null

# The skills route hub setup through --init-if-missing rather than an explicit init, so the smoke
# test enters the same way: one command must initialize the hub on first use.
node .ai/scripts/ctl-project-governance.mjs sync --apply --init-if-missing >/dev/null

for f in registry.yaml dashboard.md feature-map.md task-index.md changelog.md; do
  [ -f ".ai/project/$f" ] || fail "init-if-missing did not create .ai/project/$f"
done

# Single-project layout: no per-project subdirectory, no project key in the registry.
if [ -d .ai/project/main ]; then fail "init created a per-project subdirectory"; fi
if grep -qE '^project:' .ai/project/registry.yaml; then fail "registry still has a project block"; fi

mkdir -p dev-docs/active/sample
printf '# Sample\n\n## Status\n- State: in-progress\n- Next step: verify\n\n## Goal\nSmoke test.\n' \
  > dev-docs/active/sample/00-overview.md

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

# resume must resolve the active task and carry the overview head.
node .ai/scripts/ctl-project-governance.mjs resume --json > resume.json
grep -q '"id":"T-001"' resume.json || fail "resume did not resolve the task"
grep -q 'wire\|verify' resume.json || fail "resume packet lost the overview next step"
rm -f resume.json

# sync is idempotent.
node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null
node .ai/scripts/ctl-project-governance.mjs lint --strict >/dev/null || fail "lint failed after re-sync"

# mapping writes into the registry.
node .ai/scripts/ctl-project-governance.mjs map --task T-001 --requirement R-001 --apply >/dev/null
grep -q 'R-001' .ai/project/registry.yaml || fail "map did not record the requirement"

# Two linked worktrees branched from the same base must not allocate the same id.
#
# The second worktree's registry is the one committed at BASE, so it knows only T-001. The first
# worktree's T-002 exists solely on its own branch. Only git history reveals it -- which is the
# point: branching both worktrees from HEAD would let the shared registry answer, and the test
# would pass even with history scanning removed.
BASE=$(git rev-parse HEAD)

new_worktree_task() { # <path> <branch> <slug>
  rm -rf "$1"
  git worktree add -q "$1" -b "$2" "$BASE"
  mkdir -p "$1/dev-docs/active/$3"
  printf '# %s\n\n## Status\n- State: planned\n- Next step: verify\n\n## Goal\nSmoke test.\n' "$3" \
    > "$1/dev-docs/active/$3/00-overview.md"
  ( cd "$1" && node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null )
  grep -oE 'T-[0-9]{3}' "$1/dev-docs/active/$3/.ai-task.yaml"
}

WT_A="${TMPDIR:-/tmp}/aux-wt-a.$$"
WT_B="${TMPDIR:-/tmp}/aux-wt-b.$$"

ID_A=$(new_worktree_task "$WT_A" feat/sib-a alpha)
[ "$ID_A" = "T-002" ] || fail "first worktree allocated $ID_A, expected T-002"
( cd "$WT_A" && git add -A && git -c user.email=ci@local -c user.name=ci \
    commit -qm "feat(alpha): sibling work

Task: $ID_A" >/dev/null )

ID_B=$(new_worktree_task "$WT_B" feat/sib-b beta)
[ "$ID_B" = "T-003" ] || fail "second worktree allocated $ID_B, expected T-003 (collides with $ID_A)"

git worktree remove --force "$WT_A"
git worktree remove --force "$WT_B"
git branch -D feat/sib-a feat/sib-b >/dev/null 2>&1 || true

# archiving flips the effective status.
mkdir -p dev-docs/archive
mv dev-docs/active/sample dev-docs/archive/
node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null
grep -q 'status: archived' .ai/project/registry.yaml || fail "archive status not propagated"
node .ai/scripts/ctl-project-governance.mjs lint --strict >/dev/null || fail "lint failed after archive"

echo "init, hook sync, single-project layout, lint, resume, idempotency, map, worktree ids, archive"
