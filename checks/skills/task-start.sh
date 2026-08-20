#!/bin/sh
#
# Smoke test for the project assets task-start ships. Run by `node checks/run.mjs` inside an empty
# throwaway git repo. Not a distributable.
#

set -e

fail() { echo "FAIL: $1"; exit 1; }

[ -n "$AUX_ROOT" ] || fail "AUX_ROOT not set; run via node checks/run.mjs"

INSTALLER="$AUX_ROOT/system/skills/task-start/assets/project/.ai/scripts/install-project-governance.mjs"
CTL="$AUX_ROOT/system/skills/task-start/assets/project/.ai/scripts/ctl-project-governance.mjs"
[ -f "$INSTALLER" ] || fail "task-start does not ship the installer"
[ -f "$CTL" ] || fail "task-start does not ship the control script"

# The repository starts with nothing: one command out of the skill must leave it fully provisioned.
if [ -d .ai ] || [ -d dev-docs ]; then fail "target repo is not empty before install"; fi
node "$INSTALLER" --repo-root . >/dev/null

for f in .ai/scripts/install-project-governance.mjs \
         .ai/scripts/ctl-project-governance.mjs \
         .ai/scripts/lib/governance-read.mjs \
         .ai/project/AGENTS.md .ai/project/CLAUDE.md .ai/project/templates/registry.json; do
  [ -f "$f" ] || fail "install did not place $f"
done
[ ! -e .ai/scripts/lib/yaml-lite.mjs ] || fail "install retained the retired YAML parser"
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
for f in registry.json dashboard.md feature-map.md; do
  [ -f ".ai/project/$f" ] || fail "install did not initialize .ai/project/$f"
done
for f in task-index.md changelog.md; do
  [ ! -e ".ai/project/$f" ] || fail "install retained redundant view $f"
  [ ! -e ".ai/project/templates/$f" ] || fail "install retained redundant template $f"
done
node -e "const r=require('./.ai/project/registry.json');process.exit(Array.isArray(r.task_doc_roots)&&r.task_doc_roots.length===0?0:1)" \
  || fail "registry template disabled task-root discovery"

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

# JSON-only rejection applies to actual task bundles, not unrelated fixtures with the same name.
mkdir -p fixtures/yaml-example
printf 'fixture: true\n' > fixtures/yaml-example/.ai-task.yaml
node "$INSTALLER" --repo-root . >/dev/null \
  || fail "installer treated an unrelated YAML fixture as task metadata"
rm -rf fixtures

mkdir -p dev-docs/active/yaml-task
printf 'task_id: T-999\n' > dev-docs/active/yaml-task/.ai-task.yaml
printf '\nyaml-guard-marker\n' >> dev-docs/README.md
if node "$INSTALLER" --repo-root . >/dev/null 2>&1; then
  fail "installer accepted YAML metadata in a task bundle"
fi
grep -q 'yaml-guard-marker' dev-docs/README.md \
  || fail "failed installer partially refreshed fixed assets"
rm -rf dev-docs/active/yaml-task
node "$INSTALLER" --repo-root . >/dev/null

cp .ai/project/registry.json registry.configured-root.tmp
node -e "const fs=require('fs');const p='.ai/project/registry.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));r.task_doc_roots=['docs/tasks'];fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n')"
mkdir -p docs/tasks/active/yaml-task docs/tasks/archive
printf 'task_id: T-999\n' > docs/tasks/active/yaml-task/.ai-task.yaml
printf '\nconfigured-yaml-guard-marker\n' >> dev-docs/README.md
if node "$INSTALLER" --repo-root . >/dev/null 2>&1; then
  fail "installer ignored YAML metadata under the configured task root"
fi
grep -q 'configured-yaml-guard-marker' dev-docs/README.md \
  || fail "configured-root installer failure partially refreshed fixed assets"
rm -rf docs
mv registry.configured-root.tmp .ai/project/registry.json
node "$INSTALLER" --repo-root . >/dev/null

cp .ai/project/registry.json registry.invalid-root.tmp
node -e "const fs=require('fs');const p='.ai/project/registry.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));r.task_doc_roots=[123];fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n')"
if node "$INSTALLER" --repo-root . >/dev/null 2>&1; then
  fail "installer accepted a non-string configured task root"
fi
mv registry.invalid-root.tmp .ai/project/registry.json

# Empty governance data and task roots outside the repository are hard errors.
cp .ai/project/registry.json registry.tmp
: > .ai/project/registry.json
if node .ai/scripts/ctl-project-governance.mjs lint --check >/dev/null 2>&1; then
  fail "lint accepted an empty registry"
fi
if node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null 2>&1; then
  fail "sync accepted an empty registry"
fi
mv registry.tmp .ai/project/registry.json

cp .ai/project/registry.json registry.tmp
node -e "const fs=require('fs');const p='.ai/project/registry.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));r.task_doc_roots=['../outside/dev-docs'];fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n')"
if node .ai/scripts/ctl-project-governance.mjs lint --check >/dev/null 2>&1; then
  fail "lint accepted a task root outside the repository"
fi
if node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null 2>&1; then
  fail "sync accepted a task root outside the repository"
fi
if node .ai/scripts/ctl-project-governance.mjs query --json >/dev/null 2>&1; then
  fail "query silently ignored a task root outside the repository"
fi
mv registry.tmp .ai/project/registry.json

cp .ai/project/registry.json registry.tmp
node -e "const fs=require('fs');const p='.ai/project/registry.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));delete r.milestones[0].status;fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n')"
if node .ai/scripts/ctl-project-governance.mjs lint --check >/dev/null 2>&1; then
  fail "lint accepted a Milestone without status"
fi
mv registry.tmp .ai/project/registry.json

# Installing again must not disturb what the first run created: shipped assets refresh in place,
# hub files are project data and stay. A second install that resets the registry would silently
# discard every task the repository has.
node -e "const fs=require('fs');const p='.ai/project/registry.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));r.smoke_marker=true;fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n')"
printf '\nshipped-doc-drift\n' >> dev-docs/README.md
printf '# Superseded contract\n' > .ai/project/CONTRACT.md
printf '# Redundant task index\n' > .ai/project/task-index.md
printf '# Redundant changelog\n' > .ai/project/changelog.md
printf '# Redundant task index template\n' > .ai/project/templates/task-index.md
printf '# Redundant changelog template\n' > .ai/project/templates/changelog.md
mkdir -p .ai/scripts/lib
printf 'retired\n' > .ai/scripts/lib/colors.mjs
printf 'retired\n' > .ai/scripts/lib/yaml-lite.mjs
node "$INSTALLER" --repo-root . >/dev/null
node -e "const r=require('./.ai/project/registry.json');process.exit(r.smoke_marker===true?0:1)" \
  || fail "re-install overwrote hub data"
if grep -q 'shipped-doc-drift' dev-docs/README.md; then
  fail "re-install did not refresh the task-document guidance"
fi
[ ! -e .ai/project/CONTRACT.md ] || fail "re-install did not remove the superseded hub contract"
[ ! -e .ai/scripts/lib/colors.mjs ] || fail "re-install retained the retired color helper"
[ ! -e .ai/scripts/lib/yaml-lite.mjs ] || fail "re-install retained the retired YAML parser"
for f in task-index.md changelog.md; do
  [ ! -e ".ai/project/$f" ] || fail "re-install did not remove redundant view $f"
  [ ! -e ".ai/project/templates/$f" ] || fail "re-install did not remove redundant template $f"
done

rm .ai/project/dashboard.md
node .ai/scripts/install-project-governance.mjs --repo-root . >/dev/null
[ -f .ai/project/dashboard.md ] || fail "installed installer did not restore missing hub data"
node -e "const r=require('./.ai/project/registry.json');process.exit(r.smoke_marker===true?0:1)" \
  || fail "installed installer overwrote existing hub data"

# Hooks ship with the skill that installs them. AUX_ROOT is set by checks/run.mjs.
mkdir -p .githooks
cp -R "$AUX_ROOT/system/skills/task-sync/assets/githooks/." .githooks/
[ -x .githooks/pre-commit ] || fail ".githooks/pre-commit is not executable"

node .githooks/install.mjs >/dev/null

mkdir -p modules/foo/dev-docs/active modules/foo/dev-docs/archive
node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null
node -e "const r=require('./.ai/project/registry.json');process.exit(r.task_doc_roots.includes('modules/foo/dev-docs')?0:1)" \
  || fail "sync did not discover the additional task-document root"

# Single-project layout: no per-project subdirectory, no project key in the registry.
if [ -d .ai/project/main ]; then fail "installer created a per-project subdirectory"; fi
node -e "const r=require('./.ai/project/registry.json');process.exit(Object.hasOwn(r,'project')?1:0)" \
  || fail "registry still has a project block"

# Ideas are lightweight project notes. Sync preserves them but gives them no metadata lifecycle.
node -e "const fs=require('fs');const p='.ai/project/registry.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));r.ideas=[{idea:'Remember export'}];fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n')"
node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null
node -e "const r=require('./.ai/project/registry.json');process.exit(r.ideas.some(x=>x.idea==='Remember export')?0:1)" \
  || fail "sync discarded a lightweight Idea"

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
[ -f dev-docs/active/sample/.ai-task.json ] || fail "pre-commit did not allocate .ai-task.json"
node -e "const m=require('./dev-docs/active/sample/.ai-task.json');process.exit(m.task_id==='T-001'&&!Object.hasOwn(m,'project')?0:1)" \
  || fail "unexpected task metadata"
node -e "const r=require('./.ai/project/registry.json');process.exit(r.tasks.some(x=>x.id==='T-001'&&!Object.hasOwn(x,'milestone_id'))?0:1)" \
  || fail "registry was not synced"
git log -1 --format='%B' | git interpret-trailers --parse | grep -q '^Task: T-001$' \
  || fail "trailer missing on the task branch"

node .ai/scripts/ctl-project-governance.mjs lint --strict >/dev/null || fail "lint --strict failed"

# Malformed JSON is reported as task data corruption; lint and sync must fail cleanly.
cp dev-docs/active/sample/.ai-task.json dev-docs/active/sample/.ai-task.tmp
printf '{ invalid json\n' > dev-docs/active/sample/.ai-task.json
if node .ai/scripts/ctl-project-governance.mjs lint --check >/dev/null 2>&1; then
  fail "lint accepted malformed task metadata"
fi
if node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null 2>&1; then
  fail "sync accepted malformed task metadata"
fi
mv dev-docs/active/sample/.ai-task.tmp dev-docs/active/sample/.ai-task.json

# Empty required task documents are invalid content, not valid placeholders.
cp dev-docs/active/sample/01-status.md dev-docs/active/sample/01-status.tmp
: > dev-docs/active/sample/01-status.md
if node .ai/scripts/ctl-project-governance.mjs lint --check >/dev/null 2>&1; then
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
if node .ai/scripts/ctl-project-governance.mjs lint --check >/dev/null 2>&1; then
  fail "lint accepted an empty roadmap"
fi
mv dev-docs/active/sample/00-roadmap.tmp dev-docs/active/sample/00-roadmap.md

cp .ai/project/registry.json registry.tmp
node -e "const fs=require('fs');const p='.ai/project/registry.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));delete r.tasks.find(x=>x.id==='T-001').status;fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n')"
if node .ai/scripts/ctl-project-governance.mjs lint --check >/dev/null 2>&1; then
  fail "lint accepted a registry Task without status"
fi
mv registry.tmp .ai/project/registry.json

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
node .ai/scripts/ctl-project-governance.mjs resume > seed-resume.json
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
node .ai/scripts/ctl-project-governance.mjs resume > resume.json
grep -q '"id":"T-001"' resume.json || fail "resume did not resolve the task"
grep -q '"status"' resume.json || fail "resume packet did not expose the status head"
grep -q 'wire verification' resume.json || fail "resume packet lost the status next step"
grep -q '"kickoff_status":"ready"' resume.json || fail "resume packet lost kickoff readiness"
grep -q 'Repeating a stale path.*use the supported path' resume.json \
  || fail "resume packet did not parse current pitfalls"
rm -f resume.json
node .ai/scripts/ctl-project-governance.mjs query --id T-001 --json > query.json
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

# A task derives its Milestone through its Feature; task projections never own milestone_id.
node -e "const fs=require('fs');const p='.ai/project/registry.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));r.milestones.push({id:'M-001',title:'Smoke milestone',status:'planned',description:'Exercise derived milestone mapping.'});r.features.find(x=>x.id==='F-001').milestone_id='M-001';r.tasks.find(x=>x.id==='T-001').milestone_id='M-999';fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n')"
if node .ai/scripts/ctl-project-governance.mjs lint --check >/dev/null 2>&1; then
  fail "lint accepted task-owned milestone_id"
fi
node .ai/scripts/ctl-project-governance.mjs sync --apply >/dev/null
node .ai/scripts/ctl-project-governance.mjs query --id T-001 --json > milestone-query.json
node -e "const r=require('./.ai/project/registry.json');const q=require('./milestone-query.json');process.exit(!Object.hasOwn(r.tasks.find(x=>x.id==='T-001'),'milestone_id')&&q[0].milestone_id==='M-001'?0:1)" \
  || fail "task Milestone was not derived from its Feature"
rm -f milestone-query.json

# Declared project status remains manual, but lint must expose obvious contradictions.
node -e "const fs=require('fs');const p='.ai/project/registry.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));r.milestones.find(x=>x.id==='M-001').status='done';fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n')"
node .ai/scripts/ctl-project-governance.mjs lint --check > milestone-lint.txt \
  || fail "Milestone contradiction was treated as a structural error"
grep -q 'Milestone M-001 is done but has non-terminal Features: F-001' milestone-lint.txt \
  || fail "lint did not report the Milestone/Feature status contradiction"
if node .ai/scripts/ctl-project-governance.mjs lint --strict >/dev/null 2>&1; then
  fail "lint --strict accepted the Milestone/Feature status contradiction"
fi
node -e "const fs=require('fs');const p='.ai/project/registry.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));r.milestones.find(x=>x.id==='M-001').status='planned';fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n')"
rm -f milestone-lint.txt

node -e "const fs=require('fs');const p='.ai/project/registry.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));r.features.find(x=>x.id==='F-001').status='done';fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n')"
node .ai/scripts/ctl-project-governance.mjs lint --check > feature-lint.txt \
  || fail "Feature contradiction was treated as a structural error"
grep -q 'Feature F-001 is done but has active mapped Tasks: T-001' feature-lint.txt \
  || fail "lint did not report the Feature/Task status contradiction"
node -e "const fs=require('fs');const p='.ai/project/registry.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));r.features.find(x=>x.id==='F-001').status='planned';fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n')"
rm -f feature-lint.txt
node .ai/scripts/ctl-project-governance.mjs lint --strict >/dev/null \
  || fail "lint failed after restoring consistent Milestone status"

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
node -e "const r=require('./.ai/project/registry.json');process.exit(r.tasks.some(x=>x.id==='T-001'&&x.requirement_ids.includes('R-001'))?0:1)" \
  || fail "map did not record the requirement"
if node .ai/scripts/ctl-project-governance.mjs map --task T-001 --requirement R-999 --apply >/dev/null 2>&1; then
  fail "map silently created a missing requirement"
fi

# Registry IDs and references are integrity constraints, not advisory metadata.
cp .ai/project/registry.json registry.tmp
node -e "const fs=require('fs');const p='.ai/project/registry.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));r.features.find(x=>x.id==='F-002').id='F-001';fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n')"
if node .ai/scripts/ctl-project-governance.mjs lint --check >/dev/null 2>&1; then
  fail "lint accepted duplicate feature IDs"
fi
mv registry.tmp .ai/project/registry.json
cp .ai/project/registry.json registry.tmp
node -e "const fs=require('fs');const p='.ai/project/registry.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));r.tasks.find(x=>x.id==='T-001').feature_id='F-999';fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n')"
if node .ai/scripts/ctl-project-governance.mjs lint --check >/dev/null 2>&1; then
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

ID_A=$(grep -oE 'T-[0-9]{3}' "$WT_A/dev-docs/active/alpha/.ai-task.json")
ID_B=$(grep -oE 'T-[0-9]{3}' "$WT_B/dev-docs/active/beta/.ai-task.json")
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

# The committed T-001 bundle appears in all three worktrees. Equal occurrences are one logical
# query row; a divergent occurrence is one conflicted row with no selected top-level fact source.
cp .ai/project/registry.json registry.tmp
node -e "const fs=require('fs');const p='.ai/project/registry.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));r.tasks.find(x=>x.id==='T-001').feature_id='F-000';fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n')"
node .ai/scripts/ctl-project-governance.mjs query --id T-001 --json > shared-task.json
node -e "const q=require('./shared-task.json');const t=q[0];process.exit(q.length===1&&!t.conflict&&t.occurrence_count===3&&t.worktrees.length===3?0:1)" \
  || fail "query did not merge equal worktree occurrences"

sed -i 's/State: in-progress/State: blocked/' "$WT_A/dev-docs/active/sample/01-status.md"
node .ai/scripts/ctl-project-governance.mjs query --id T-001 --json > conflicted-task.json
node -e "const q=require('./conflicted-task.json');const t=q[0];const c=t.conflicts.find(x=>x.field==='status');process.exit(q.length===1&&t.conflict&&t.status===null&&t.worktree_path===null&&t.occurrence_count===3&&c&&c.values.some(x=>x.value==='blocked')?0:1)" \
  || fail "query selected a fact source for divergent worktree occurrences"
node .ai/scripts/ctl-project-governance.mjs query --status blocked --json > conflicted-filter.json
node -e "const q=require('./conflicted-filter.json');process.exit(q.some(x=>x.id==='T-001'&&x.conflict)?0:1)" \
  || fail "status filter hid a matching conflicted occurrence"
sed -i 's/State: blocked/State: in-progress/' "$WT_A/dev-docs/active/sample/01-status.md"
mv registry.tmp .ai/project/registry.json
rm -f shared-task.json conflicted-task.json conflicted-filter.json

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

echo "install/guidance refresh, strict CLI/data guards, root discovery, pending seed example, kickoff/completion gates, roadmap and registry lint, resume, validation-atomic sync, Milestone progress and feature/requirement mapping, lightweight Ideas, JSON round-trip, worktree allocation and query reconciliation, archive"
