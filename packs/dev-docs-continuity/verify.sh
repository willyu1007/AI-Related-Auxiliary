#!/bin/sh
#
# Smoke test for dev-docs-continuity. Run by `node checks/run.mjs` inside a throwaway git repo
# with this pack already installed. Not part of files/ — never copied into a target project.
#
# No `# depends:` line on purpose: the pack must work entirely on its own, with no control script
# anywhere in the repo.
#

set -e

fail() { echo "FAIL: $1"; exit 1; }

[ -f dev-docs/AGENTS.md ] || fail "dev-docs/AGENTS.md missing"
[ -x .githooks/commit-msg ] || fail ".githooks/commit-msg is not executable"
[ -x .githooks/prepare-commit-msg ] || fail ".githooks/prepare-commit-msg is not executable"

# The whole point of this test: no project-hub control script is present.
if [ -f .ai/scripts/ctl-project-governance.mjs ]; then
  fail "control script present; this is no longer a standalone test"
fi

node .githooks/install.mjs >/dev/null

mkdir -p dev-docs/active/sample
printf '# Sample\n\n## Status\n- State: in-progress\n- Next step: verify\n\n## Goal\nSmoke test.\n' \
  > dev-docs/active/sample/00-overview.md

# Coverage boundary: this pack ships no allocator. Allocating T-### is a rule in the Task Contract
# that start-dev-docs-task follows, so a shell test cannot exercise it -- the bundle below starts
# from an already-allocated id on purpose. What is under test here is everything downstream: that
# the hooks work off .ai-task.yaml alone, with no control script present.
printf 'version: 1\ntask_id: T-001\nslug: sample\n' > dev-docs/active/sample/.ai-task.yaml

# The allocation scan from the Task Contract must be executable exactly as written, including on a
# repository with no commits yet (git log fails, the working-tree half still answers).
NEXT=$( { grep -rh '^task_id:' --include='.ai-task.yaml' . 2>/dev/null
          git log --all --format=%B 2>/dev/null | grep -E '^Task: T-[0-9]{3}'
        } | grep -oE 'T-[0-9]{3}' | sort -u | tail -1)
[ "$NEXT" = "T-001" ] || fail "task-id scan from the Task Contract returned '$NEXT', expected T-001"

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

echo "standalone install, id-scan rule, shell-fallback trailer injection, negative case, format gate"
