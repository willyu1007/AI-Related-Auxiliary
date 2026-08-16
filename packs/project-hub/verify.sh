#!/bin/sh
#
# Smoke test for project-hub. Run by `node checks/run.mjs` inside a throwaway git repo with this
# pack and its dependencies already installed. Not part of files/.
#
# depends: dev-docs-continuity
#

set -e

fail() { echo "FAIL: $1"; exit 1; }

[ -x .githooks/pre-commit ] || fail ".githooks/pre-commit is not executable"
[ -f .ai/project/templates/registry.yaml ] || fail "hub templates missing"
[ -f dev-docs/AGENTS.md ] || fail "dependency dev-docs-continuity was not installed"

node .githooks/install.mjs >/dev/null
node .ai/scripts/ctl-project-governance.mjs init >/dev/null

for f in registry.yaml dashboard.md feature-map.md task-index.md changelog.md; do
  [ -f ".ai/project/$f" ] || fail "init did not create .ai/project/$f"
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

# archiving flips the effective status.
mkdir -p dev-docs/archive
mv dev-docs/active/sample dev-docs/archive/
node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null
grep -q 'status: archived' .ai/project/registry.yaml || fail "archive status not propagated"
node .ai/scripts/ctl-project-governance.mjs lint --strict >/dev/null || fail "lint failed after archive"

echo "init, hook sync, single-project layout, lint, resume, idempotency, map, archive"
