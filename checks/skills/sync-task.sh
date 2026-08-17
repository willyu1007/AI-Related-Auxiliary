#!/bin/sh
#
# Smoke test for the Git hooks sync-task ships. Run by `node checks/run.mjs` inside an empty
# throwaway git repo. Not a distributable.
#
# Nothing else is installed on purpose: hooks must work in a repository that has no control script,
# which is the case whenever they are installed before any task exists.
#

set -e

fail() { echo "FAIL: $1"; exit 1; }

[ -n "$AUX_ROOT" ] || fail "AUX_ROOT not set; run via node checks/run.mjs"
mkdir -p .githooks
cp -R "$AUX_ROOT/system/skills/sync-task/assets/githooks/." .githooks/
[ -x .githooks/commit-msg ] || fail ".githooks/commit-msg is not executable"
[ -x .githooks/prepare-commit-msg ] || fail ".githooks/prepare-commit-msg is not executable"

if [ -f .ai/scripts/ctl-project-governance.mjs ]; then
  fail "control script present; this is no longer a standalone test"
fi

node .githooks/install.mjs >/dev/null

mkdir -p dev-docs/active/sample
printf '# Sample\n\n## Status\n- State: in-progress\n- Next step: verify\n\n## Goal\nSmoke test.\n' \
  > dev-docs/active/sample/00-overview.md

# Coverage boundary: allocating T-### is a rule an agent follows, so a shell test cannot exercise
# it -- the bundle below starts from an already-allocated id on purpose. What is under test here is
# everything downstream: that the hooks work off .ai-task.yaml alone, with no control script.
printf 'version: 1\ntask_id: T-001\nslug: sample\n' > dev-docs/active/sample/.ai-task.yaml

# The allocation scan the skills document must be executable exactly as written, including on a
# repository with no commits yet (git log fails, the working-tree half still answers).
NEXT=$( { grep -rh '^task_id:' --include='.ai-task.yaml' . 2>/dev/null
          git log --all --format=%B 2>/dev/null | grep -E '^Task: T-[0-9]{3}'
        } | grep -oE 'T-[0-9]{3}' | sort -u | tail -1)
[ "$NEXT" = "T-001" ] || fail "the documented task-id scan returned '$NEXT', expected T-001"

git checkout -q -b feat/T-001-sample
git add -A
git -c user.email=ci@local -c user.name=ci commit -qm "feat(sample): add task bundle"

git log -1 --format='%B' | git interpret-trailers --parse | grep -q '^Task: T-001$' \
  || fail "prepare-commit-msg did not inject the trailer using the shell fallback"

# A branch task ID with no matching .ai-task.yaml must never be injected.
git checkout -q -b feat/T-999-ghost
echo unrelated > unrelated.txt
git add unrelated.txt
git -c user.email=ci@local -c user.name=ci commit -qm "chore: unrelated work"

if git log -1 --format='%B' | git interpret-trailers --parse | grep -q '^Task:'; then
  fail "injected a trailer for a task that does not exist"
fi

# commit-msg must still reject a malformed subject.
git checkout -q feat/T-001-sample
echo more > more.txt
git add more.txt
if SKIP_TASK_TRAILER=1 git -c user.email=ci@local -c user.name=ci \
     commit -qm "not a conventional subject" 2>/dev/null; then
  fail "commit-msg accepted a non-conventional subject"
fi

echo "hooks with no control script, id-scan rule, shell-fallback trailer injection, negative case, format gate"
