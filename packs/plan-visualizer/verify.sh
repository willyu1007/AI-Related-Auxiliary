#!/bin/sh
#
# Smoke test for plan-visualizer. Run by `node checks/run.mjs` inside a throwaway git repo with
# this pack already installed. Not part of files/.
#
# No dependencies: the skill is standalone by design.
#

set -e

fail() { echo "FAIL: $1"; exit 1; }

S=.ai/skills/workflows/planning/plan-html-visualizer

[ -f "$S/SKILL.md" ] || fail "SKILL.md missing"
[ -f "$S/templates/base.html" ] || fail "templates/base.html missing"

COMPONENTS=$(find "$S/components" -name '*.html' | wc -l | tr -d ' ')
SCRIPTS=$(find "$S/scripts" -name '*.js' | wc -l | tr -d ' ')
[ "$COMPONENTS" -ge 10 ] || fail "expected >=10 components, found $COMPONENTS"
[ "$SCRIPTS" -ge 7 ] || fail "expected >=7 scripts, found $SCRIPTS"

# Artifacts must render offline: no external hosts in the shipped assets.
if grep -rlE '(src|href)="https?://|@import[[:space:]]+url\(https?://' \
     "$S/templates" "$S/components" "$S/scripts" 2>/dev/null | grep -q .; then
  fail "shipped assets reference an external host; artifacts must be self-contained"
fi

echo "skill assets present ($COMPONENTS components, $SCRIPTS scripts), no external hosts"
