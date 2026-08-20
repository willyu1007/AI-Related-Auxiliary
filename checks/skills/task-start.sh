#!/bin/sh
#
# Smoke test for the project assets task-start ships. Run by `node checks/run.mjs` inside an empty
# throwaway git repo. Not a distributable.
#

set -e

fail() { echo "FAIL: $1"; exit 1; }

[ -n "$AUX_ROOT" ] || fail "AUX_ROOT not set; run via node checks/run.mjs"

INSTALLER="$AUX_ROOT/system/skills/task-start/scripts/install-project-governance.mjs"
CTL="$AUX_ROOT/system/skills/task-start/assets/project/.ai/scripts/ctl-project-governance.mjs"
[ -f "$INSTALLER" ] || fail "task-start does not ship the installer"
[ -f "$CTL" ] || fail "task-start does not ship the control script"

# The repository starts with nothing: one command out of the skill must leave it fully provisioned.
if [ -d .ai ] || [ -d dev-docs ]; then fail "target repo is not empty before install"; fi
PREINSTALL_WT="${TMPDIR:-/tmp}/aux-preinstall-wt.$$"
git -c user.email=ci@local -c user.name=ci commit --allow-empty -qm "test base"
git worktree add -q "$PREINSTALL_WT" -b test/preinstall-sibling
node "$INSTALLER" --repo-root . >/dev/null

for f in .ai/scripts/ctl-project-governance.mjs \
         .ai/scripts/lib/governance-read.mjs \
         .ai/scripts/lib/governance-lint.mjs \
         .ai/scripts/lib/governance-write.mjs \
         .ai/project/AGENTS.md .ai/project/CLAUDE.md .ai/project/templates/registry.json; do
  [ -f "$f" ] || fail "install did not place $f"
done
[ ! -e .ai/scripts/install-project-governance.mjs ] || fail "install distributed the skill-source installer"
grep -q 'Follow `AGENTS.md`' .ai/project/CLAUDE.md \
  || fail "hub Claude entry does not route to AGENTS.md"
for d in dev-docs/active dev-docs/archive; do
  [ -d "$d" ] || fail "install did not create $d"
done
for f in dev-docs/CLAUDE.md dev-docs/AGENTS.md; do
  [ -f "$f" ] || fail "install did not place $f"
done
[ ! -e dev-docs/README.md ] || fail "install retained a redundant task-document README"
grep -q 'Follow `AGENTS.md`' dev-docs/CLAUDE.md \
  || fail "task-doc Claude entry does not route to AGENTS.md"
for f in registry.json dashboard.md feature-map.md; do
  [ -f ".ai/project/$f" ] || fail "install did not initialize .ai/project/$f"
done
node -e "const r=require('./.ai/project/registry.json');const keys=Object.keys(r).sort().join(',');process.exit(keys==='features,ideas,milestones,tasks,version'?0:1)" \
  || fail "registry did not use the exact project-graph schema"
node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null \
  || fail "first sync was blocked by a linked worktree created before governance installation"
git worktree remove --force "$PREINSTALL_WT"
git branch -D test/preinstall-sibling >/dev/null 2>&1 || true

# Only the repository's top-level dev-docs directory is a task root.
mkdir -p modules/foo/dev-docs/active/ignored
node .ai/scripts/ctl-project-governance.mjs query --json \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.exit(JSON.parse(s).length===0?0:1))" \
  || fail "query treated a nested dev-docs directory as a task root"
node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null
[ ! -e modules/foo/dev-docs/active/ignored/.ai-task.json ] \
  || fail "sync wrote task metadata outside the top-level dev-docs root"
rm -rf modules

printf '# Conflicting task-document entry\n' > dev-docs/README.md
if node .ai/scripts/ctl-project-governance.mjs lint >/dev/null 2>&1; then
  fail "lint accepted a second task-document authority"
fi
if node "$INSTALLER" --repo-root . >/dev/null 2>&1; then
  fail "installer accepted a second task-document authority"
fi
rm dev-docs/README.md

cp dev-docs/CLAUDE.md dev-docs/CLAUDE.tmp
printf '# Task documentation\n\nAGENTS.md is also relevant.\n' > dev-docs/CLAUDE.md
if node .ai/scripts/ctl-project-governance.mjs lint >/dev/null 2>&1; then
  fail "lint accepted a non-pointer task-document CLAUDE entry"
fi
mv dev-docs/CLAUDE.tmp dev-docs/CLAUDE.md

mv dev-docs/active dev-docs/active.tmp
if node .ai/scripts/ctl-project-governance.mjs lint >/dev/null 2>&1; then
  fail "lint accepted a missing active task directory"
fi
mv dev-docs/active.tmp dev-docs/active

mv dev-docs/archive dev-docs/archive.tmp
if node .ai/scripts/ctl-project-governance.mjs lint >/dev/null 2>&1; then
  fail "lint accepted a missing archive task directory"
fi
mv dev-docs/archive.tmp dev-docs/archive

mkdir installer-dry-run
node "$INSTALLER" --repo-root installer-dry-run --dry-run >/dev/null
[ ! -e installer-dry-run/.ai ] || fail "installer dry-run wrote project assets"
rmdir installer-dry-run

# Installer and runtime CLI mistakes must fail explicitly.
if node "$INSTALLER" --bogus >/dev/null 2>&1; then
  fail "installer accepted an unknown option"
fi
if node "$INSTALLER" --repo-root >/dev/null 2>&1; then
  fail "installer accepted a missing option value"
fi
if node "$INSTALLER" --dry-run --dry-run >/dev/null 2>&1; then
  fail "installer accepted a duplicate option"
fi
if node "$INSTALLER" --repo-root "$AUX_ROOT/system/skills/task-start/assets/project" --dry-run >/dev/null 2>&1; then
  fail "installer accepted its own asset source as the target repository"
fi
if node .ai/scripts/ctl-project-governance.mjs query --bogus >/dev/null 2>&1; then
  fail "query accepted an unknown option"
fi
if node .ai/scripts/ctl-project-governance.mjs query --status typo >/dev/null 2>&1; then
  fail "query accepted an invalid status filter"
fi
if node .ai/scripts/ctl-project-governance.mjs query --id T-1 >/dev/null 2>&1; then
  fail "query accepted an invalid task ID filter"
fi
if node .ai/scripts/ctl-project-governance.mjs sync --dry-run --apply >/dev/null 2>&1; then
  fail "sync accepted conflicting write modes"
fi
if node .ai/scripts/ctl-project-governance.mjs resume --limit nope >/dev/null 2>&1; then
  fail "resume accepted a non-numeric commit limit"
fi

mkdir sync-missing-hub
if node "$CTL" sync --repo-root sync-missing-hub --dry-run > sync-error.txt 2>&1; then
  fail "sync accepted a repository without a project hub"
fi
grep -q 'Project hub missing' sync-error.txt || fail "sync did not render its missing-hub error"
[ ! -e sync-missing-hub/.ai ] || fail "sync dry-run initialized a missing project hub"
rm -rf sync-missing-hub sync-error.txt

# JSON-only rejection applies to actual task bundles, not unrelated fixtures with the same name.
mkdir -p fixtures/yaml-example
printf 'fixture: true\n' > fixtures/yaml-example/.ai-task.yaml
node "$INSTALLER" --repo-root . >/dev/null \
  || fail "installer treated an unrelated YAML fixture as task metadata"
rm -rf fixtures

mkdir -p dev-docs/active/yaml-task
printf 'task_id: T-999\n' > dev-docs/active/yaml-task/.ai-task.yaml
printf '\nyaml-guard-marker\n' >> dev-docs/AGENTS.md
if node "$INSTALLER" --repo-root . >/dev/null 2>&1; then
  fail "installer accepted YAML metadata in a task bundle"
fi
grep -q 'yaml-guard-marker' dev-docs/AGENTS.md \
  || fail "failed installer partially refreshed fixed assets"
rm -rf dev-docs/active/yaml-task
node "$INSTALLER" --repo-root . >/dev/null

# Empty governance data is a hard error.
cp .ai/project/registry.json registry.tmp
: > .ai/project/registry.json
if node .ai/scripts/ctl-project-governance.mjs lint >/dev/null 2>&1; then
  fail "lint accepted an empty registry"
fi
if node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null 2>&1; then
  fail "sync accepted an empty registry"
fi
mv registry.tmp .ai/project/registry.json

cp .ai/project/registry.json registry.tmp
node -e "const fs=require('fs');const p='.ai/project/registry.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));r.unexpected=[];fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n')"
registry_hash_before="$(git hash-object .ai/project/registry.json)"
if node .ai/scripts/ctl-project-governance.mjs lint >/dev/null 2>&1; then
  fail "lint accepted an unknown registry collection"
fi
if node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null 2>&1; then
  fail "sync accepted an unknown registry collection"
fi
if node .ai/scripts/ctl-project-governance.mjs feature --title "Invalid graph allocation" --apply >/dev/null 2>&1; then
  fail "feature allocation accepted an unknown registry collection"
fi
[ "$registry_hash_before" = "$(git hash-object .ai/project/registry.json)" ] \
  || fail "a rejected project-graph write changed the registry"
mv registry.tmp .ai/project/registry.json

# Project-owned graph items reject extra semantic fields instead of silently preserving extensions.
cp .ai/project/registry.json registry.tmp
node -e "const fs=require('fs');const p='.ai/project/registry.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));r.features[0].unexpected='second meaning';fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n')"
registry_hash_before="$(git hash-object .ai/project/registry.json)"
if node .ai/scripts/ctl-project-governance.mjs lint >/dev/null 2>&1; then
  fail "lint accepted an unknown Feature field"
fi
if node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null 2>&1; then
  fail "sync accepted an unknown Feature field"
fi
[ "$registry_hash_before" = "$(git hash-object .ai/project/registry.json)" ] \
  || fail "a rejected Feature field changed the registry"
mv registry.tmp .ai/project/registry.json

# Exact graph values are not normalized by readers; padded IDs/statuses must stop writes.
cp .ai/project/registry.json registry.tmp
node -e "const fs=require('fs');const p='.ai/project/registry.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));r.features[0].status=' in-progress ';fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n')"
if node .ai/scripts/ctl-project-governance.mjs lint >/dev/null 2>&1; then
  fail "lint accepted a padded Feature status"
fi
if node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null 2>&1; then
  fail "sync accepted a padded Feature status"
fi
mv registry.tmp .ai/project/registry.json

cp .ai/project/registry.json registry.tmp
node -e "const fs=require('fs');const p='.ai/project/registry.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));r.tasks.push({id:'T-999',slug:'nested',status:'planned',dev_docs_path:'modules/foo/dev-docs/active/nested',feature_id:'F-000'});fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n')"
registry_hash_before="$(git hash-object .ai/project/registry.json)"
if node .ai/scripts/ctl-project-governance.mjs lint >/dev/null 2>&1; then
  fail "lint accepted a task projection outside the top-level task root"
fi
if node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null 2>&1; then
  fail "sync accepted a task projection outside the top-level task root"
fi
if node .ai/scripts/ctl-project-governance.mjs map --task T-999 --feature F-000 --apply >/dev/null 2>&1; then
  fail "mapping accepted a registry-only task projection outside the top-level task root"
fi
[ "$registry_hash_before" = "$(git hash-object .ai/project/registry.json)" ] \
  || fail "a rejected registry-only mapping changed the registry"
mv registry.tmp .ai/project/registry.json

cp .ai/project/registry.json registry.tmp
node -e "const fs=require('fs');const p='.ai/project/registry.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));delete r.milestones[0].status;fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n')"
if node .ai/scripts/ctl-project-governance.mjs lint >/dev/null 2>&1; then
  fail "lint accepted a Milestone without status"
fi
mv registry.tmp .ai/project/registry.json

# Installing again must not disturb what the first run created: shipped assets refresh in place,
# hub files are project data and stay. A second install that resets the registry would silently
# discard every task the repository has.
node -e "const fs=require('fs');const p='.ai/project/registry.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));r.ideas=[{idea:'installer preservation sentinel'}];fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n')"
printf '\nshipped-doc-drift\n' >> dev-docs/AGENTS.md
node "$INSTALLER" --repo-root . >/dev/null
node -e "const r=require('./.ai/project/registry.json');process.exit(r.ideas.some(x=>x.idea==='installer preservation sentinel')?0:1)" \
  || fail "re-install overwrote hub data"
if grep -q 'shipped-doc-drift' dev-docs/AGENTS.md; then
  fail "re-install did not refresh the task-document guidance"
fi

rm .ai/project/dashboard.md
node "$INSTALLER" --repo-root . >/dev/null
[ -f .ai/project/dashboard.md ] || fail "skill-source installer did not restore missing hub data"
node -e "const r=require('./.ai/project/registry.json');process.exit(r.ideas.some(x=>x.idea==='installer preservation sentinel')?0:1)" \
  || fail "skill-source installer overwrote existing hub data"

cp .ai/project/dashboard.md dashboard.tmp
sed -i '/AUTO-GENERATED:START dashboard/d' .ai/project/dashboard.md
derived_state_before="$(git hash-object .ai/project/registry.json .ai/project/dashboard.md .ai/project/feature-map.md)"
if node .ai/scripts/ctl-project-governance.mjs lint >/dev/null 2>&1; then
  fail "lint accepted a derived dashboard without its generation markers"
fi
if node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null 2>&1; then
  fail "sync accepted a derived dashboard without its generation markers"
fi
[ "$derived_state_before" = "$(git hash-object .ai/project/registry.json .ai/project/dashboard.md .ai/project/feature-map.md)" ] \
  || fail "failed derived-view validation changed governance state"
mv dashboard.tmp .ai/project/dashboard.md

# Single-project layout: no per-project subdirectory, no project key in the registry.
if [ -d .ai/project/main ]; then fail "installer created a per-project subdirectory"; fi
node -e "const r=require('./.ai/project/registry.json');process.exit(Object.hasOwn(r,'project')?1:0)" \
  || fail "registry still has a project block"

# Ideas are lightweight project notes. Sync preserves them but gives them no metadata lifecycle.
node -e "const fs=require('fs');const p='.ai/project/registry.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));r.ideas=[{idea:'Remember export'}];fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n')"
node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null
node -e "const r=require('./.ai/project/registry.json');process.exit(r.ideas.some(x=>x.idea==='Remember export')?0:1)" \
  || fail "sync discarded a lightweight Idea"
cp .ai/project/registry.json registry.tmp
node -e "const fs=require('fs');const p='.ai/project/registry.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));r.ideas=[{idea:'Remember export',status:'planned'}];fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n')"
registry_hash_before="$(git hash-object .ai/project/registry.json)"
if node .ai/scripts/ctl-project-governance.mjs lint >/dev/null 2>&1; then
  fail "lint accepted a heavyweight Idea record"
fi
if node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null 2>&1; then
  fail "sync accepted a heavyweight Idea record"
fi
[ "$registry_hash_before" = "$(git hash-object .ai/project/registry.json)" ] \
  || fail "rejected Idea validation changed the registry"
mv registry.tmp .ai/project/registry.json

mkdir -p dev-docs/active/sample
printf '# Roadmap\n\n## Scope and constraints\n- Scope: smoke test\n\n## Decision alignment\nNone.\n\n## Task relationships\nNone.\n\n## Implementation plan\n\n### Phase 1 — verify\n- Outcome: smoke test passes\n- Approach: exercise governance end to end\n- Planned changes:\n  1. Run the smoke workflow\n- Affected boundaries / entry points: governance script\n- Dependencies: none\n- Exit criteria: smoke test passes\n- Verification: run lint\n- Recovery: restore the fixture\n\n## Kickoff gate\n- Status: ready\n- [x] Every user-owned choice that blocks implementation is decided.\n- [x] Settled design and interfaces are reflected in `02-architecture.md`.\n- [x] The first implementation phase is executable with exit, verification, and recovery criteria.\n- [x] Every current completion condition has a decisive planned check in `verification.md`.\n\n## Risks and recovery\nNone.\n\n## Phase closeout\nCommit the verified fixture.\n' \
  > dev-docs/active/sample/00-roadmap.md
printf '# Status\n\n## Goal\nSmoke test.\n\n## Progress\n- State: in-progress\n- Current phase: verify\n- Next step: wire verification\n- Blocker: none\n\n## Done when\n- [ ] Smoke test passes\n' \
  > dev-docs/active/sample/01-status.md
printf '# Architecture\n' > dev-docs/active/sample/02-architecture.md
printf '# Verification\n\n## Completion matrix\n\n| Completion condition | Check / procedure | Latest result | Evidence / limitation |\n|---|---|---|---|\n| Smoke test passes | Run the governance smoke workflow | not-run | Awaiting the final smoke result |\n\n## Outstanding verification\n\n- Run the governance smoke workflow.\n' \
  > dev-docs/active/sample/verification.md
printf '# Pitfalls\n\n| Hazard | Evidence | Prevention | Applies until |\n|---|---|---|---|\n| Repeating a stale path | failed run | use the supported path | guard is encoded |\n' > dev-docs/active/sample/pitfalls.md

git checkout -q -b feat/T-001-sample
node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null
git add -A
git -c user.email=ci@local -c user.name=ci commit -qm "feat(sample): add task bundle" -m "Task: T-001" >/dev/null

# Explicit synchronization allocates the ID and updates the hub before staging.
[ -f dev-docs/active/sample/.ai-task.json ] || fail "sync did not allocate .ai-task.json"
node -e "const m=require('./dev-docs/active/sample/.ai-task.json');const keys=Object.keys(m).sort().join(',');process.exit(m.task_id==='T-001'&&keys==='keywords,slug,task_id,version'?0:1)" \
  || fail "unexpected task metadata"
node -e "const r=require('./.ai/project/registry.json');process.exit(r.tasks.some(x=>x.id==='T-001'&&!Object.hasOwn(x,'milestone_id'))?0:1)" \
  || fail "registry was not synced"
git log -1 --format='%B' | git interpret-trailers --parse | grep -q '^Task: T-001$' \
  || fail "trailer missing on the task branch"

lint_status_before="$(git status --porcelain=v1 --untracked-files=all)"
node .ai/scripts/ctl-project-governance.mjs lint --strict >/dev/null || fail "lint --strict failed"
lint_status_after="$(git status --porcelain=v1 --untracked-files=all)"
[ "$lint_status_before" = "$lint_status_after" ] || fail "lint modified repository state"

# The top-level AGENTS entry remains the task-document semantic authority.
mv dev-docs/AGENTS.md dev-docs/AGENTS.tmp
missing_root_doc_output="$(node .ai/scripts/ctl-project-governance.mjs lint 2>&1 || true)"
printf '%s\n' "$missing_root_doc_output" | grep -q 'Required task-document entry point dev-docs/AGENTS.md is missing' \
  || fail "lint did not report a missing task-document authority"
mv dev-docs/AGENTS.tmp dev-docs/AGENTS.md

# Malformed JSON is reported as task data corruption; lint and sync must fail cleanly.
cp dev-docs/active/sample/.ai-task.json dev-docs/active/sample/.ai-task.tmp
printf '{ invalid json\n' > dev-docs/active/sample/.ai-task.json
if node .ai/scripts/ctl-project-governance.mjs lint >/dev/null 2>&1; then
  fail "lint accepted malformed task metadata"
fi
if node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null 2>&1; then
  fail "sync accepted malformed task metadata"
fi
mv dev-docs/active/sample/.ai-task.tmp dev-docs/active/sample/.ai-task.json

# Task metadata contains identity/search data only; lifecycle facts must not form a second head.
cp dev-docs/active/sample/.ai-task.json dev-docs/active/sample/.ai-task.tmp
node -e "const fs=require('fs');const p='dev-docs/active/sample/.ai-task.json';const m=JSON.parse(fs.readFileSync(p,'utf8'));m.status='in-progress';fs.writeFileSync(p,JSON.stringify(m,null,2)+'\n')"
meta_hash_before="$(git hash-object dev-docs/active/sample/.ai-task.json)"
if node .ai/scripts/ctl-project-governance.mjs lint >/dev/null 2>&1; then
  fail "lint accepted lifecycle state in task metadata"
fi
if node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null 2>&1; then
  fail "sync accepted lifecycle state in task metadata"
fi
[ "$meta_hash_before" = "$(git hash-object dev-docs/active/sample/.ai-task.json)" ] \
  || fail "rejected task metadata changed during sync"
mv dev-docs/active/sample/.ai-task.tmp dev-docs/active/sample/.ai-task.json

# Empty required task documents are invalid content, not valid placeholders.
cp dev-docs/active/sample/01-status.md dev-docs/active/sample/01-status.tmp
: > dev-docs/active/sample/01-status.md
if node .ai/scripts/ctl-project-governance.mjs lint >/dev/null 2>&1; then
  fail "lint accepted an empty status document"
fi
if node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null 2>&1; then
  fail "sync accepted an empty status document"
fi
mv dev-docs/active/sample/01-status.tmp dev-docs/active/sample/01-status.md

# Sync calculates and validates the complete change set before writing. A later invalid bundle
# must not leave an earlier bundle allocated or any hub projection partially refreshed.
mkdir -p dev-docs/active/atomic-valid dev-docs/active/zz-invalid
for f in 00-roadmap.md 01-status.md 02-architecture.md verification.md; do
  cp "dev-docs/active/sample/$f" "dev-docs/active/atomic-valid/$f"
  cp "dev-docs/active/sample/$f" "dev-docs/active/zz-invalid/$f"
done
: > dev-docs/active/zz-invalid/01-status.md
cp .ai/project/registry.json registry.atomic.tmp
cp .ai/project/dashboard.md dashboard.atomic.tmp
cp .ai/project/feature-map.md feature-map.atomic.tmp
if node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null 2>&1; then
  fail "sync accepted an invalid bundle during its write-planning pass"
fi
[ ! -e dev-docs/active/atomic-valid/.ai-task.json ] \
  || fail "failed sync partially allocated an earlier valid bundle"
cmp -s registry.atomic.tmp .ai/project/registry.json \
  || fail "failed sync partially updated the registry"
cmp -s dashboard.atomic.tmp .ai/project/dashboard.md \
  || fail "failed sync partially updated the dashboard"
cmp -s feature-map.atomic.tmp .ai/project/feature-map.md \
  || fail "failed sync partially updated the feature map"
rm -rf dev-docs/active/atomic-valid dev-docs/active/zz-invalid
rm -f registry.atomic.tmp dashboard.atomic.tmp feature-map.atomic.tmp

cp dev-docs/active/sample/00-roadmap.md dev-docs/active/sample/00-roadmap.tmp
: > dev-docs/active/sample/00-roadmap.md
if node .ai/scripts/ctl-project-governance.mjs lint >/dev/null 2>&1; then
  fail "lint accepted an empty roadmap"
fi
mv dev-docs/active/sample/00-roadmap.tmp dev-docs/active/sample/00-roadmap.md

cp .ai/project/registry.json registry.tmp
node -e "const fs=require('fs');const p='.ai/project/registry.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));delete r.tasks.find(x=>x.id==='T-001').status;fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n')"
if node .ai/scripts/ctl-project-governance.mjs lint >/dev/null 2>&1; then
  fail "lint accepted a registry Task without status"
fi
mv registry.tmp .ai/project/registry.json

# A task cannot claim completion without checked conditions and decisive verification evidence.
cp dev-docs/active/sample/01-status.md dev-docs/active/sample/01-status.tmp
cp dev-docs/active/sample/verification.md dev-docs/active/sample/verification.tmp
sed -i 's/State: in-progress/State: done/' dev-docs/active/sample/01-status.md
node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null
if done_lint_output="$(node .ai/scripts/ctl-project-governance.mjs lint 2>&1)"; then
  fail "lint accepted a done task with unchecked completion conditions"
fi
printf '%s\n' "$done_lint_output" | grep -q 'Done when is not fully checked' \
  || fail "lint did not identify unchecked completion conditions"
sed -i 's/- \[ \] Smoke test passes/- [x] Smoke test passes/' \
  dev-docs/active/sample/01-status.md
if done_lint_output="$(node .ai/scripts/ctl-project-governance.mjs lint 2>&1)"; then
  fail "lint accepted a done task without passed verification"
fi
printf '%s\n' "$done_lint_output" | grep -q 'verification is not pass' \
  || fail "lint did not identify incomplete verification evidence"
sed -i 's/| Smoke test passes | Run the governance smoke workflow | not-run | Awaiting the final smoke result |/| Smoke test passes | Run the governance smoke workflow | pass | Smoke workflow passed in this fixture |/' \
  dev-docs/active/sample/verification.md
node .ai/scripts/ctl-project-governance.mjs lint --strict >/dev/null \
  || fail "lint rejected a done task with checked conditions and passed evidence"
sed -i 's/| pass | Smoke workflow passed in this fixture |/| pass |  |/' \
  dev-docs/active/sample/verification.md
if done_lint_output="$(node .ai/scripts/ctl-project-governance.mjs lint 2>&1)"; then
  fail "lint accepted a done task without verification evidence"
fi
printf '%s\n' "$done_lint_output" | grep -q 'verification evidence / limitation is empty' \
  || fail "lint did not identify empty done evidence"
mv dev-docs/active/sample/01-status.tmp dev-docs/active/sample/01-status.md
mv dev-docs/active/sample/verification.tmp dev-docs/active/sample/verification.md
node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null

# A pending seed is valid before kickoff, but ready requires every gate item.
cp dev-docs/active/sample/00-roadmap.md dev-docs/active/sample/00-roadmap.tmp
sed -i 's/Status: ready/Status: pending/; s/\[x\]/[ ]/g' dev-docs/active/sample/00-roadmap.md
node .ai/scripts/ctl-project-governance.mjs lint >/dev/null \
  || fail "lint rejected a valid pending kickoff seed"
mv dev-docs/active/sample/00-roadmap.tmp dev-docs/active/sample/00-roadmap.md

# The worked example must function as a valid pending seed, not merely resemble the template.
cp dev-docs/active/sample/00-roadmap.md dev-docs/active/sample/00-roadmap.tmp
cp "$AUX_ROOT/system/skills/task-start/examples/sample-roadmap-seed.md" \
  dev-docs/active/sample/00-roadmap.md
node .ai/scripts/ctl-project-governance.mjs lint >/dev/null \
  || fail "lint rejected the worked pending roadmap seed"
node .ai/scripts/ctl-project-governance.mjs resume > seed-resume.json
grep -q '"kickoff_status":"pending"' seed-resume.json \
  || fail "worked roadmap seed did not recover as kickoff pending"
rm -f seed-resume.json
mv dev-docs/active/sample/00-roadmap.tmp dev-docs/active/sample/00-roadmap.md

cp dev-docs/active/sample/00-roadmap.md dev-docs/active/sample/00-roadmap.tmp
sed -i '0,/\[x\]/{s/\[x\]/[ ]/}' dev-docs/active/sample/00-roadmap.md
if node .ai/scripts/ctl-project-governance.mjs lint >/dev/null 2>&1; then
  fail "lint accepted ready kickoff with an unchecked gate"
fi
mv dev-docs/active/sample/00-roadmap.tmp dev-docs/active/sample/00-roadmap.md

# A ready kickoff requires a populated verification row and concrete planned check per condition.
cp dev-docs/active/sample/verification.md dev-docs/active/sample/verification.tmp
printf '# Verification\n\n## Completion matrix\n' > dev-docs/active/sample/verification.md
if node .ai/scripts/ctl-project-governance.mjs lint >/dev/null 2>&1; then
  fail "lint accepted ready kickoff without a verification plan"
fi
mv dev-docs/active/sample/verification.tmp dev-docs/active/sample/verification.md

# Verification rows are a one-to-one, executable contract for each completion condition.
cp dev-docs/active/sample/verification.md dev-docs/active/sample/verification.tmp
sed -i '/| Smoke test passes | Run the governance smoke workflow | not-run |/a\
| Smoke test passes | Run the governance smoke workflow | not-run | Duplicate row |' \
  dev-docs/active/sample/verification.md
verification_lint_output="$(node .ai/scripts/ctl-project-governance.mjs lint 2>&1 || true)"
printf '%s\n' "$verification_lint_output" | grep -q 'duplicate verification matrix rows' \
  || fail "lint did not reject duplicate verification rows"
mv dev-docs/active/sample/verification.tmp dev-docs/active/sample/verification.md

cp dev-docs/active/sample/verification.md dev-docs/active/sample/verification.tmp
sed -i 's/| Run the governance smoke workflow |/|  |/' dev-docs/active/sample/verification.md
verification_lint_output="$(node .ai/scripts/ctl-project-governance.mjs lint 2>&1 || true)"
printf '%s\n' "$verification_lint_output" | grep -q 'Verification check / procedure is missing' \
  || fail "lint did not reject an empty verification procedure"
mv dev-docs/active/sample/verification.tmp dev-docs/active/sample/verification.md

cp dev-docs/active/sample/verification.md dev-docs/active/sample/verification.tmp
sed -i 's/| not-run |/| unknown |/' dev-docs/active/sample/verification.md
verification_lint_output="$(node .ai/scripts/ctl-project-governance.mjs lint 2>&1 || true)"
printf '%s\n' "$verification_lint_output" | grep -q 'Invalid verification result "unknown"' \
  || fail "lint did not reject an invalid verification result"
mv dev-docs/active/sample/verification.tmp dev-docs/active/sample/verification.md

# A roadmap must be usable, not a copied template with unresolved placeholders.
cp dev-docs/active/sample/00-roadmap.md dev-docs/active/sample/00-roadmap.tmp
printf '\n<!-- unfinished -->\n' >> dev-docs/active/sample/00-roadmap.md
if node .ai/scripts/ctl-project-governance.mjs lint >/dev/null 2>&1; then
  fail "lint accepted an unfilled roadmap template placeholder"
fi
mv dev-docs/active/sample/00-roadmap.tmp dev-docs/active/sample/00-roadmap.md
cp dev-docs/active/sample/00-roadmap.md dev-docs/active/sample/00-roadmap.tmp
printf '\nproposed:old-follow-up\n' >> dev-docs/active/sample/00-roadmap.md
if node .ai/scripts/ctl-project-governance.mjs lint >/dev/null 2>&1; then
  fail "lint accepted a removed proposed task relationship"
fi
mv dev-docs/active/sample/00-roadmap.tmp dev-docs/active/sample/00-roadmap.md

# resume must resolve the active task and carry the current status head.
node .ai/scripts/ctl-project-governance.mjs resume > resume.json
node -e "const r=require('./resume.json');const s=r.status;process.exit(r.version===4&&r.task.id==='T-001'&&r.task.state==='in-progress'&&s.goal==='Smoke test.'&&s.current_phase==='verify'&&s.next_step==='wire verification'&&s.blocker==='none'&&s.completion_conditions.length===1&&s.completion_conditions[0].condition==='Smoke test passes'&&r.roadmap.kickoff_status==='ready'?0:1)" \
  || fail "resume packet did not expose the complete current status head"
grep -q 'Repeating a stale path.*use the supported path' resume.json \
  || fail "resume packet did not parse current pitfalls"
rm -f resume.json
node .ai/scripts/ctl-project-governance.mjs query --id T-001 --json > query.json
node -e "const q=require('./query.json');const t=q[0];process.exit(q.length===1&&t.kickoff_status==='ready'&&!Object.hasOwn(t,'title')&&!Object.hasOwn(t,'description')&&!Object.hasOwn(t,'updated')?0:1)" \
  || fail "query did not expose only authoritative task fields"
rm -f query.json

# Optional context files are not required, but verification.md is.
rm dev-docs/active/sample/pitfalls.md
node .ai/scripts/ctl-project-governance.mjs lint --strict >/dev/null \
  || fail "lint treated optional pitfalls.md as required"
printf '# Pitfalls\n\n| Hazard | Evidence | Prevention | Applies until |\n|---|---|---|---|\n| Repeating a stale path | failed run | use the supported path | guard is encoded |\n' \
  > dev-docs/active/sample/pitfalls.md
mv dev-docs/active/sample/verification.md dev-docs/active/sample/verification.tmp
if node .ai/scripts/ctl-project-governance.mjs lint >/dev/null 2>&1; then
  fail "lint accepted an active bundle without verification.md"
fi
mv dev-docs/active/sample/verification.tmp dev-docs/active/sample/verification.md
# sync is idempotent.
node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null
node .ai/scripts/ctl-project-governance.mjs lint --strict >/dev/null || fail "lint failed after re-sync"

# Every non-installer write command must honor dry-run without changing tracked or untracked state.
cp dev-docs/active/sample/01-status.md dev-docs/active/sample/01-status.dry-run.tmp
sed -i 's/State: in-progress/State: blocked/' dev-docs/active/sample/01-status.md
dry_run_state_before="$(git status --porcelain=v1 --untracked-files=all; git hash-object \
  .ai/project/registry.json .ai/project/dashboard.md .ai/project/feature-map.md \
  dev-docs/active/sample/.ai-task.json dev-docs/active/sample/01-status.md)"
sync_dry_run_output="$(node .ai/scripts/ctl-project-governance.mjs sync --dry-run)"
printf '%s\n' "$sync_dry_run_output" | grep -q 'update: .ai/project/registry.json' \
  || fail "sync dry-run did not plan a registry update for changed bundle state"
node .ai/scripts/ctl-project-governance.mjs milestone --title "Dry-run milestone" --dry-run >/dev/null
node .ai/scripts/ctl-project-governance.mjs feature --title "Dry-run feature" --dry-run >/dev/null
dry_run_state_after="$(git status --porcelain=v1 --untracked-files=all; git hash-object \
  .ai/project/registry.json .ai/project/dashboard.md .ai/project/feature-map.md \
  dev-docs/active/sample/.ai-task.json dev-docs/active/sample/01-status.md)"
[ "$dry_run_state_before" = "$dry_run_state_after" ] || fail "dry-run modified repository state"
mv dev-docs/active/sample/01-status.dry-run.tmp dev-docs/active/sample/01-status.md

# Feature creation is locked, idempotent, and can feed task mapping.
node .ai/scripts/ctl-project-governance.mjs feature --title "Smoke capability" \
  --description "Exercise feature allocation" --apply --json > feature.json
grep -q '"id":"F-001"' feature.json || fail "feature command did not allocate F-001"
grep -q '"created":true' feature.json || fail "feature command did not report creation"
node .ai/scripts/ctl-project-governance.mjs feature --title "Smoke capability" --apply --json > feature.json
grep -q '"id":"F-001"' feature.json || fail "feature command was not idempotent"
grep -q '"created":false' feature.json || fail "feature command recreated an existing title"
grep -q '"description":"Exercise feature allocation"' feature.json \
  || fail "feature JSON omitted its authoritative description"
grep -q '"milestone_id":"M-000"' feature.json \
  || fail "feature JSON omitted its owning Milestone"
rm -f feature.json

# Task-specific mapping stops on invalid identity metadata before a real mapping change.
cp dev-docs/active/sample/.ai-task.json dev-docs/active/sample/.ai-task.tmp
node -e "const fs=require('fs');const p='dev-docs/active/sample/.ai-task.json';const m=JSON.parse(fs.readFileSync(p,'utf8'));m.status='in-progress';fs.writeFileSync(p,JSON.stringify(m,null,2)+'\n')"
registry_hash_before="$(git hash-object .ai/project/registry.json)"
if node .ai/scripts/ctl-project-governance.mjs map --task T-001 --feature F-001 --apply >/dev/null 2>&1; then
  fail "map accepted invalid task metadata"
fi
[ "$registry_hash_before" = "$(git hash-object .ai/project/registry.json)" ] \
  || fail "invalid task metadata allowed a registry mapping change"
mv dev-docs/active/sample/.ai-task.tmp dev-docs/active/sample/.ai-task.json

map_dry_run_before="$(git status --porcelain=v1 --untracked-files=all; git hash-object \
  .ai/project/registry.json)"
node .ai/scripts/ctl-project-governance.mjs map --task T-001 --feature F-001 --dry-run >/dev/null
map_dry_run_after="$(git status --porcelain=v1 --untracked-files=all; git hash-object \
  .ai/project/registry.json)"
[ "$map_dry_run_before" = "$map_dry_run_after" ] || fail "map dry-run modified repository state"

# Quoted JSON strings must survive a write/read cycle without changing identity.
node .ai/scripts/ctl-project-governance.mjs feature --title "Quoted \"feature\"\\path" \
  --description "Description with \"quotes\" and a \\path" --apply --json > feature.json
grep -q '"id":"F-002"' feature.json || fail "quoted feature did not allocate F-002"
node .ai/scripts/ctl-project-governance.mjs feature --title "Quoted \"feature\"\\path" \
  --apply --json > feature.json
grep -q '"id":"F-002"' feature.json || fail "quoted feature changed identity after JSON round-trip"
grep -q '"created":false' feature.json || fail "quoted feature was recreated after JSON round-trip"
rm -f feature.json

node .ai/scripts/ctl-project-governance.mjs map --task T-001 --feature F-001 --apply >/dev/null
node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null
node -e "const r=require('./.ai/project/registry.json');process.exit(r.tasks.some(x=>x.id==='T-001'&&x.feature_id==='F-001')?0:1)" \
  || fail "map did not retain the feature mapping"
grep -q 'Exercise feature allocation' .ai/project/feature-map.md \
  || fail "generated Feature view did not project the registry description"
printf '# Feature Map\n\n<!-- AUTO-GENERATED:START feature-map -->\n## Feature Briefs\n\nOld manual Feature authority.\n<!-- AUTO-GENERATED:END feature-map -->\n' \
  > .ai/project/feature-map.md
if node .ai/scripts/ctl-project-governance.mjs lint >/dev/null 2>&1; then
  fail "lint accepted stale manual content inside the generated Feature map"
fi
node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null
if grep -q 'Old manual Feature authority' .ai/project/feature-map.md; then
  fail "sync retained the removed manual Feature authority"
fi
grep -q 'Exercise feature allocation' .ai/project/feature-map.md \
  || fail "Feature map regeneration lost the registry description"

# A task derives its Milestone through its Feature; task projections never own milestone_id.
node .ai/scripts/ctl-project-governance.mjs milestone --title "Smoke milestone" \
  --description "Exercise derived milestone mapping" --apply --json > milestone.json
grep -q '"id":"M-001"' milestone.json || fail "milestone command did not allocate M-001"
grep -q '"created":true' milestone.json || fail "milestone command did not report creation"
node .ai/scripts/ctl-project-governance.mjs milestone --title "Smoke milestone" \
  --apply --json > milestone.json
grep -q '"id":"M-001"' milestone.json || fail "milestone command changed an existing title ID"
grep -q '"created":false' milestone.json || fail "milestone command recreated an existing title"
grep -q '"changed":false' milestone.json || fail "milestone command rewrote an existing title"
grep -q '"description":"Exercise derived milestone mapping"' milestone.json \
  || fail "Milestone JSON omitted its authoritative description"
rm -f milestone.json
node -e "const fs=require('fs');const p='.ai/project/registry.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));r.features.find(x=>x.id==='F-001').milestone_id='M-001';r.tasks.find(x=>x.id==='T-001').milestone_id='M-999';fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n')"
if node .ai/scripts/ctl-project-governance.mjs lint >/dev/null 2>&1; then
  fail "lint accepted task-owned milestone_id"
fi
node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null
node .ai/scripts/ctl-project-governance.mjs query --id T-001 --json > milestone-query.json
node -e "const r=require('./.ai/project/registry.json');const q=require('./milestone-query.json');process.exit(!Object.hasOwn(r.tasks.find(x=>x.id==='T-001'),'milestone_id')&&q[0].milestone_id==='M-001'?0:1)" \
  || fail "task Milestone was not derived from its Feature"
rm -f milestone-query.json

# Declared project status remains manual, but lint must expose obvious contradictions.
node -e "const fs=require('fs');const p='.ai/project/registry.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));r.milestones.find(x=>x.id==='M-001').status='done';fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n')"
if node .ai/scripts/ctl-project-governance.mjs lint > milestone-lint.txt 2>&1; then
  fail "lint accepted a done Milestone with non-terminal Features"
fi
grep -q 'Milestone M-001 is done but has non-terminal Features: F-001' milestone-lint.txt \
  || fail "lint did not report the Milestone/Feature status contradiction"
node -e "const fs=require('fs');const p='.ai/project/registry.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));r.milestones.find(x=>x.id==='M-001').status='planned';fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n')"
rm -f milestone-lint.txt

node -e "const fs=require('fs');const p='.ai/project/registry.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));r.features.find(x=>x.id==='F-001').status='done';r.tasks.find(x=>x.id==='T-001').status='planned';fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n')"
if node .ai/scripts/ctl-project-governance.mjs lint > feature-lint.txt 2>&1; then
  fail "lint accepted a done Feature with non-terminal mapped Tasks"
fi
grep -q 'Feature F-001 is done but has non-terminal mapped Tasks: T-001' feature-lint.txt \
  || fail "lint did not report the Feature/Task status contradiction"
node -e "const fs=require('fs');const p='.ai/project/registry.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));r.features.find(x=>x.id==='F-001').status='planned';r.tasks.find(x=>x.id==='T-001').status='in-progress';fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n')"
rm -f feature-lint.txt
node .ai/scripts/ctl-project-governance.mjs lint --strict >/dev/null \
  || fail "lint failed after restoring consistent Milestone status"

# Task projections have one generated shape; lint rejects drift and sync rebuilds it canonically.
cp .ai/project/registry.json registry.tmp
node -e "const fs=require('fs');const p='.ai/project/registry.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));r.tasks.find(x=>x.id==='T-001').unexpected=[];fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n')"
if node .ai/scripts/ctl-project-governance.mjs lint >/dev/null 2>&1; then
  fail "lint accepted an unknown task projection field"
fi
node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null \
  || fail "sync could not rebuild a drifted task projection"
node -e "const r=require('./.ai/project/registry.json');process.exit(Object.hasOwn(r.tasks.find(x=>x.id==='T-001'),'unexpected')?1:0)" \
  || fail "sync retained an unknown task projection field"
rm registry.tmp

# Sync may rebuild derived task fields, but it must not choose between duplicate semantic mappings.
cp .ai/project/registry.json registry.tmp
node -e "const fs=require('fs');const p='.ai/project/registry.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));r.tasks.push({...r.tasks.find(x=>x.id==='T-001'),feature_id:'F-000'});fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n')"
registry_hash_before="$(git hash-object .ai/project/registry.json)"
if node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null 2>&1; then
  fail "sync selected one of two task mappings with the same ID"
fi
[ "$registry_hash_before" = "$(git hash-object .ai/project/registry.json)" ] \
  || fail "duplicate task mapping failure changed the registry"
mv registry.tmp .ai/project/registry.json

# Registry IDs and references are integrity constraints, not advisory metadata.
cp .ai/project/registry.json registry.tmp
node -e "const fs=require('fs');const p='.ai/project/registry.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));r.features.find(x=>x.id==='F-002').id='F-001';fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n')"
registry_hash_before="$(git hash-object .ai/project/registry.json)"
if node .ai/scripts/ctl-project-governance.mjs lint >/dev/null 2>&1; then
  fail "lint accepted duplicate feature IDs"
fi
if node .ai/scripts/ctl-project-governance.mjs feature --title "Must not allocate" --apply >/dev/null 2>&1; then
  fail "feature allocation accepted an invalid existing project graph"
fi
[ "$registry_hash_before" = "$(git hash-object .ai/project/registry.json)" ] \
  || fail "rejected project-item allocation changed an invalid registry"
mv registry.tmp .ai/project/registry.json
cp .ai/project/registry.json registry.tmp
node -e "const fs=require('fs');const p='.ai/project/registry.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));r.tasks.find(x=>x.id==='T-001').feature_id='F-999';fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n')"
if node .ai/scripts/ctl-project-governance.mjs lint >/dev/null 2>&1; then
  fail "lint accepted a dangling task feature mapping"
fi
mv registry.tmp .ai/project/registry.json

# Two linked worktrees branched from the same base must not allocate the same id,
# even while the first task metadata is still uncommitted.
#
# The second worktree's registry is the one committed at BASE, so it knows only T-001. The first
# worktree's T-002 exists solely on its own branch. Only git history reveals it -- which is the
# point: branching both worktrees from HEAD would let the shared registry answer, and the test
# would pass even with history scanning removed.
cp .ai/project/registry.json registry.worktree.tmp
node -e "const fs=require('fs');const p='.ai/project/registry.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));r.tasks.find(x=>x.id==='T-001').feature_id='F-000';fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n')"
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

( cd "$WT_A" && node .ai/scripts/ctl-project-governance.mjs milestone \
    --title "Alpha milestone" --apply --json > milestone.json ) &
PID_A=$!
( cd "$WT_B" && node .ai/scripts/ctl-project-governance.mjs milestone \
    --title "Beta milestone" --apply --json > milestone.json ) &
PID_B=$!
wait "$PID_A"
wait "$PID_B"
MILESTONE_A=$(sed -n 's/.*"id":"\(M-[0-9][0-9][0-9]\)".*/\1/p' "$WT_A/milestone.json")
MILESTONE_B=$(sed -n 's/.*"id":"\(M-[0-9][0-9][0-9]\)".*/\1/p' "$WT_B/milestone.json")
[ "$MILESTONE_A" != "$MILESTONE_B" ] \
  || fail "parallel worktrees both allocated $MILESTONE_A"
MILESTONE_IDS=$(printf '%s\n%s\n' "$MILESTONE_A" "$MILESTONE_B" | sort | tr '\n' ' ')
[ "$MILESTONE_IDS" = "M-002 M-003 " ] \
  || fail "parallel worktrees allocated '$MILESTONE_IDS', expected M-002 and M-003"
( cd "$WT_B" && node .ai/scripts/ctl-project-governance.mjs milestone \
    --title "Alpha milestone" --apply --json > milestone-copy.json )
grep -q "\"id\":\"$MILESTONE_A\"" "$WT_B/milestone-copy.json" \
  || fail "milestone command did not copy the linked-worktree identity"
grep -q '"created":false' "$WT_B/milestone-copy.json" \
  || fail "copied Milestone was incorrectly reported as newly created"
grep -q '"changed":true' "$WT_B/milestone-copy.json" \
  || fail "copied Milestone was not reported as a local registry change"
( cd "$WT_B" && node .ai/scripts/ctl-project-governance.mjs milestone \
    --title "Alpha milestone" --apply --json > milestone-copy.json )
grep -q '"changed":false' "$WT_B/milestone-copy.json" \
  || fail "copied Milestone was not idempotent"

( cd "$WT_A" && node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null ) &
PID_A=$!
( cd "$WT_B" && node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null ) &
PID_B=$!
wait "$PID_A"
wait "$PID_B"

ID_A=$(grep -oE 'T-[0-9]{3}' "$WT_A/dev-docs/active/alpha/.ai-task.json")
ID_B=$(grep -oE 'T-[0-9]{3}' "$WT_B/dev-docs/active/beta/.ai-task.json")
[ "$ID_A" != "$ID_B" ] || fail "parallel worktrees both allocated $ID_A"
IDS=$(printf '%s\n%s\n' "$ID_A" "$ID_B" | sort | tr '\n' ' ')
[ "$IDS" = "T-002 T-003 " ] || fail "parallel worktrees allocated '$IDS', expected T-002 and T-003"
cp "$WT_A/dev-docs/active/alpha/.ai-task.json" "$WT_A/task-meta.tmp"
( cd "$WT_A" && node -e "const fs=require('fs');const p='dev-docs/active/alpha/.ai-task.json';const m=JSON.parse(fs.readFileSync(p,'utf8'));m.status='planned';fs.writeFileSync(p,JSON.stringify(m,null,2)+'\n')" )
node .ai/scripts/ctl-project-governance.mjs query --id "$ID_A" --json > invalid-meta-query.json
node -e "const q=require('./invalid-meta-query.json');process.exit(q.length===1&&q[0].id==='$ID_A'&&q[0].invalid&&q[0].metadata_errors.length===1?0:1)" \
  || fail "query hid a valid task ID carried by invalid metadata"
set +e
node .ai/scripts/ctl-project-governance.mjs resume --task "$ID_A" > invalid-meta-resume.json
resume_exit=$?
set -e
[ "$resume_exit" -eq 2 ] || fail "resume did not stop on invalid linked-worktree metadata"
node -e "const r=require('./invalid-meta-resume.json');process.exit(r.error.reason==='invalid-metadata'?0:1)" \
  || fail "resume did not explain the invalid metadata stop"
rm invalid-meta-query.json invalid-meta-resume.json
registry_hash_before="$(git hash-object .ai/project/registry.json)"
if invalid_meta_output="$(node .ai/scripts/ctl-project-governance.mjs sync --apply 2>&1)"; then
  fail "sync accepted invalid task metadata from a linked worktree"
fi
printf '%s\n' "$invalid_meta_output" | grep -q 'Invalid cross-worktree task metadata' \
  || fail "sync did not identify invalid linked-worktree task metadata"
[ "$registry_hash_before" = "$(git hash-object .ai/project/registry.json)" ] \
  || fail "linked-worktree metadata failure changed the current registry"
mv "$WT_A/task-meta.tmp" "$WT_A/dev-docs/active/alpha/.ai-task.json"
cp "$WT_A/dev-docs/active/alpha/.ai-task.json" "$WT_A/task-meta.tmp"
: > "$WT_A/dev-docs/active/alpha/.ai-task.json"
if empty_meta_output="$(node .ai/scripts/ctl-project-governance.mjs sync --apply 2>&1)"; then
  fail "sync treated empty linked-worktree task metadata as missing"
fi
printf '%s\n' "$empty_meta_output" | grep -q 'Invalid cross-worktree task metadata' \
  || fail "sync did not report empty linked-worktree task metadata"
mv "$WT_A/task-meta.tmp" "$WT_A/dev-docs/active/alpha/.ai-task.json"
set +e
node .ai/scripts/ctl-project-governance.mjs resume --task "$ID_A" > other-worktree-resume.json
resume_exit=$?
set -e
[ "$resume_exit" -eq 4 ] || fail "resume used the wrong exit code for a task in another worktree"
node -e "const r=require('./other-worktree-resume.json');process.exit(r.version===4&&r.error.reason==='other-worktree'&&r.error.candidates[0].id==='$ID_A'&&r.error.candidates[0].worktree_path?0:1)" \
  || fail "resume did not identify the task's owning worktree"
rm other-worktree-resume.json

( cd "$WT_A" && node .ai/scripts/ctl-project-governance.mjs feature \
    --title "Alpha feature" --description "Parallel feature allocation" --apply --json > feature.json ) &
PID_A=$!
( cd "$WT_B" && node .ai/scripts/ctl-project-governance.mjs feature \
    --title "Beta feature" --description "Parallel feature allocation" --apply --json > feature.json ) &
PID_B=$!
wait "$PID_A"
wait "$PID_B"

FEATURE_A=$(sed -n 's/.*"id":"\(F-[0-9][0-9][0-9]\)".*/\1/p' "$WT_A/feature.json")
FEATURE_B=$(sed -n 's/.*"id":"\(F-[0-9][0-9][0-9]\)".*/\1/p' "$WT_B/feature.json")
[ "$FEATURE_A" != "$FEATURE_B" ] || fail "parallel worktrees both allocated $FEATURE_A"
FEATURE_IDS=$(printf '%s\n%s\n' "$FEATURE_A" "$FEATURE_B" | sort | tr '\n' ' ')
[ "$FEATURE_IDS" = "F-003 F-004 " ] \
  || fail "parallel worktrees allocated '$FEATURE_IDS', expected F-003 and F-004"

( cd "$WT_B" && node .ai/scripts/ctl-project-governance.mjs feature \
    --title "Alpha feature" --apply --json > feature-copy.json )
grep -q "\"id\":\"$FEATURE_A\"" "$WT_B/feature-copy.json" \
  || fail "feature command did not copy the linked-worktree identity"
cp "$WT_A/.ai/project/registry.json" "$WT_A/registry.semantic.tmp"
( cd "$WT_A" && node -e "const fs=require('fs');const p='.ai/project/registry.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));r.features.find(x=>x.id==='$FEATURE_A').description='Divergent meaning';fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n')" )
feature_conflict_hash_before="$(git hash-object "$WT_B/.ai/project/registry.json")"
if ( cd "$WT_B" && node .ai/scripts/ctl-project-governance.mjs feature \
    --title "Alpha feature" --apply >/dev/null 2>&1 ); then
  fail "feature allocation ignored a cross-worktree semantic conflict"
fi
[ "$feature_conflict_hash_before" = "$(git hash-object "$WT_B/.ai/project/registry.json")" ] \
  || fail "Feature semantic conflict handling changed the target registry"
mv "$WT_A/registry.semantic.tmp" "$WT_A/.ai/project/registry.json"

cp "$WT_B/.ai/project/registry.json" "$WT_B/registry.parent.tmp"
( cd "$WT_B" && node -e "const fs=require('fs');const p='.ai/project/registry.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));r.features.push({id:'F-099',title:'Parented feature',milestone_id:'$MILESTONE_B',status:'planned',description:'Requires its owning Milestone'});fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n')" )
missing_parent_hash_before="$(git hash-object "$WT_A/.ai/project/registry.json")"
if ( cd "$WT_A" && node .ai/scripts/ctl-project-governance.mjs feature \
    --title "Parented feature" --apply >/dev/null 2>&1 ); then
  fail "feature copy wrote without its owning Milestone"
fi
[ "$missing_parent_hash_before" = "$(git hash-object "$WT_A/.ai/project/registry.json")" ] \
  || fail "missing-parent Feature copy changed the target registry"
mv "$WT_B/registry.parent.tmp" "$WT_B/.ai/project/registry.json"

# The committed T-001 bundle appears in all three worktrees. Equal occurrences are one logical
# query row; a divergent occurrence is one conflicted row with no selected top-level fact source.
node .ai/scripts/ctl-project-governance.mjs query --id T-001 --json > shared-task.json
node -e "const q=require('./shared-task.json');const t=q[0];process.exit(q.length===1&&!t.conflict&&t.occurrence_count===3&&t.worktrees.length===3?0:1)" \
  || fail "query did not merge equal worktree occurrences"
duplicate_map_state_before="$(git status --porcelain=v1 --untracked-files=all; git hash-object \
  .ai/project/registry.json .ai/project/dashboard.md .ai/project/feature-map.md)"
node .ai/scripts/ctl-project-governance.mjs map --task T-001 --feature F-000 --apply >/dev/null \
  || fail "map rejected a no-op for equal duplicate task occurrences"
if duplicate_map_output="$(node .ai/scripts/ctl-project-governance.mjs map \
  --task T-001 --feature F-001 --apply 2>&1)"; then
  fail "map created divergence between equal duplicate task occurrences"
fi
printf '%s\n' "$duplicate_map_output" | grep -q 'occurs in 3 linked worktrees' \
  || fail "map did not explain the duplicate-occurrence stop condition"
duplicate_map_state_after="$(git status --porcelain=v1 --untracked-files=all; git hash-object \
  .ai/project/registry.json .ai/project/dashboard.md .ai/project/feature-map.md)"
[ "$duplicate_map_state_before" = "$duplicate_map_state_after" ] \
  || fail "duplicate-occurrence map guards changed governance state"

sed -i 's/State: in-progress/State: blocked/' "$WT_A/dev-docs/active/sample/01-status.md"
node .ai/scripts/ctl-project-governance.mjs query --id T-001 --json > conflicted-task.json
node -e "const q=require('./conflicted-task.json');const t=q[0];const c=t.conflicts.find(x=>x.field==='status');process.exit(q.length===1&&t.conflict&&t.status===null&&t.worktree_path===null&&t.occurrence_count===3&&c&&c.values.some(x=>x.value==='blocked')?0:1)" \
  || fail "query selected a fact source for divergent worktree occurrences"
node .ai/scripts/ctl-project-governance.mjs query --status blocked --json > conflicted-filter.json
node -e "const q=require('./conflicted-filter.json');process.exit(q.some(x=>x.id==='T-001'&&x.conflict)?0:1)" \
  || fail "status filter hid a matching conflicted occurrence"
set +e
node .ai/scripts/ctl-project-governance.mjs resume --task T-001 > conflicted-resume.json
resume_exit=$?
set -e
[ "$resume_exit" -eq 2 ] || fail "resume used the wrong exit code for a conflicted task"
node -e "const r=require('./conflicted-resume.json');const c=r.error.candidates[0];process.exit(r.version===4&&r.error.reason==='conflict'&&c.id==='T-001'&&c.conflicts.some(x=>x.field==='status')?0:1)" \
  || fail "resume did not return bounded cross-worktree conflict evidence"

conflict_state_before="$(git status --porcelain=v1 --untracked-files=all; git hash-object \
  .ai/project/registry.json .ai/project/dashboard.md .ai/project/feature-map.md \
  dev-docs/active/sample/.ai-task.json "$WT_A/dev-docs/active/sample/01-status.md")"
if conflict_sync_output="$(node .ai/scripts/ctl-project-governance.mjs sync --apply 2>&1)"; then
  fail "sync wrote while a task had divergent worktree facts"
fi
printf '%s\n' "$conflict_sync_output" | grep -q 'Cross-worktree task conflict for T-001' \
  || fail "sync did not report the divergent task"
if node .ai/scripts/ctl-project-governance.mjs map --task T-001 --feature F-000 --apply \
  >/dev/null 2>&1; then
  fail "map wrote while its task had divergent worktree facts"
fi
conflict_state_after="$(git status --porcelain=v1 --untracked-files=all; git hash-object \
  .ai/project/registry.json .ai/project/dashboard.md .ai/project/feature-map.md \
  dev-docs/active/sample/.ai-task.json "$WT_A/dev-docs/active/sample/01-status.md")"
[ "$conflict_state_before" = "$conflict_state_after" ] \
  || fail "a write command changed governance state during a worktree conflict"

sed -i 's/State: blocked/State: in-progress/' "$WT_A/dev-docs/active/sample/01-status.md"
mv registry.worktree.tmp .ai/project/registry.json
rm -f shared-task.json conflicted-task.json conflicted-filter.json conflicted-resume.json

node .ai/scripts/ctl-project-governance.mjs query --text alpha --json > worktrees.json
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
node -e "const r=require('./.ai/project/registry.json');process.exit(r.tasks.some(x=>x.id==='T-001'&&x.status==='archived')?0:1)" \
  || fail "archive status not propagated"
node .ai/scripts/ctl-project-governance.mjs lint --strict >/dev/null || fail "lint failed after archive"

echo "install/guidance refresh, strict CLI/data guards, single task root, pending seed example, kickoff/completion gates, roadmap and registry lint, resume, validation-atomic sync, Milestone progress and Feature mapping, lightweight Ideas, JSON round-trip, worktree allocation and query reconciliation, archive"
