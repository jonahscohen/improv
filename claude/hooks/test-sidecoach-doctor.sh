#!/bin/bash
# Regression tests for sidecoach-doctor - the capability-graph check.
#
# Run: bash claude/hooks/test-sidecoach-doctor.sh
#
# WHY THIS SUITE EXISTS. sidecoach-doctor's whole value is that it reports honestly about
# whether a capability can be found and called. An instrument that reports confidently while
# structurally unable to see what it claims to check is this project's most expensive recurring
# failure - four of them in two days - so every row here PLANTS a known positive in a fixture
# and asserts the tool fires on it. A row that only asserts "no finding on a clean tree" proves
# nothing about a tool that might be incapable of producing findings at all.
#
# THE THREE DEFECT CLASSES ARE PLANTED WITH THE REAL WORDING of the defects found in this repo
# on 2026-07-29, not with synthetic text:
#   - "six self-contained CLIs" against a registry of a different size.
#   - "<tool> is the only flow-wired tool" while src/ spawns others.
#   - a tool present in bin/ and named in no loadable document.
#
# TWO ROWS ARE FALSE-POSITIVE REGRESSIONS, both from this tool's own first drafts:
#   - a tool required WITHOUT a file extension (require('./x')) was reported UNREACHED.
#   - the doctor script counted ITSELF as a caller of every tool it names in its own prose.
#
# SAFETY: every fixture is a mktemp -d tree. The tool is read-only by construction; the suite
# also snapshots the real loadable surface and fails if it changed.
#
# Exits non-zero if any test fails.

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$HOOK_DIR/../.." && pwd)"
DOCTOR="${DOCTOR:-$REPO_ROOT/sidecoach/bin/sidecoach-doctor.js}"

[ -f "$DOCTOR" ] || { echo "cannot find sidecoach-doctor.js at $DOCTOR"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "node is required"; exit 1; }

PASS=0
FAIL=0
FAIL_LABELS=()
pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1  ($2)"; FAIL_LABELS+=("$1"); FAIL=$((FAIL + 1)); }

REAL_SURFACE="$HOME/.claude/skills/sidecoach"
snap() {
  [ -d "$1" ] || { printf 'ABSENT\n'; return 0; }
  find -L "$1" -type f 2>/dev/null | LC_ALL=C sort
}
REAL_BEFORE="$(snap "$REAL_SURFACE")"

# ------------------------------------------------------------
# Fixture builder: a miniature sidecoach package plus a loadable surface.
#   $1  fixture root
# Creates <root>/repo/{bin,src,dist} and <root>/surface.
# ------------------------------------------------------------
build_fixture() {
  local root="$1"
  mkdir -p "$root/repo/bin" "$root/repo/src" "$root/repo/dist" "$root/surface"

  # A resolver whose STANDALONE_BINS lists two tools.
  cat > "$root/repo/bin/sidecoach.js" <<'EOF'
#!/usr/bin/env node
const STANDALONE_BINS = {
  generative: {
    label: 'Generative',
    bins: [
      ['sidecoach-alpha', 'the alpha tool', 'node bin/sidecoach-alpha.js'],
      ['sidecoach-beta', 'the beta tool', 'node bin/sidecoach-beta.js'],
    ],
  },
};
module.exports = { STANDALONE_BINS };
EOF
  printf '// alpha\n' > "$root/repo/bin/sidecoach-alpha.js"
  printf '// beta\n'  > "$root/repo/bin/sidecoach-beta.js"

  # A flow that SPAWNS alpha, so alpha is genuinely flow-wired.
  cat > "$root/repo/src/flow-thing.ts" <<'EOF'
import * as path from 'path';
export const bin = path.resolve(__dirname, '..', 'bin', 'sidecoach-alpha.js');
EOF

  # An empty verb registry so the verb half is measurable rather than inconclusive.
  cat > "$root/repo/dist/verb-command-registry.js" <<'EOF'
exports.VERB_REGISTRY = {};
EOF

  # A loadable surface that names both listed tools.
  cat > "$root/surface/SKILL.md" <<'EOF'
---
name: fixture
description: fixture skill
---
Two self-contained CLIs ship in bin/.
Run `node bin/sidecoach-alpha.js` and `node bin/sidecoach-beta.js`.
EOF
}

# run_doctor <repo> <surface>
#
# Sets DOCTOR_JSON and DOCTOR_RC in THIS shell. It deliberately does not print the JSON for a
# caller to capture with `$(run_doctor ...)`: that form runs the function in a SUBSHELL, so an
# exit code assigned inside it is discarded and every rc assertion reads empty. Three rows in
# this suite failed with `rc=` on their first run for exactly that reason, while their
# substantive assertions passed - a suite that cannot see the exit code of a tool whose exit
# code IS its contract.
DOCTOR_JSON=""
DOCTOR_RC=""
run_doctor() {
  local tmp
  tmp="$(mktemp "${TMPDIR:-/tmp}/doctor-out-XXXXXX")"
  node "$DOCTOR" --repo "$1" --surface "$2" --json > "$tmp" 2>/dev/null
  DOCTOR_RC=$?
  DOCTOR_JSON="$(cat "$tmp")"
  rm -f "$tmp"
}

jq_findings() {
  # $1 json, $2 finding id -> count
  printf '%s' "$1" | python3 -c "
import sys,json
try: d=json.load(sys.stdin)
except Exception: print(-1); raise SystemExit
print(sum(1 for f in d.get('findings',[]) if f.get('id')=='$2'))
"
}

FIX="$(mktemp -d "${TMPDIR:-/tmp}/doctor-fixture-XXXXXX")" || exit 1
build_fixture "$FIX"

# ------------------------------------------------------------
# BASELINE: the clean fixture must be clean, and the run must actually have looked.
# ------------------------------------------------------------
run_doctor "$FIX/repo" "$FIX/surface"; J="$DOCTOR_JSON"
BASE_RC=$DOCTOR_RC
DOCS="$(printf '%s' "$J" | python3 -c "import sys,json;print(json.load(sys.stdin)['loadableDocuments'])" 2>/dev/null)"
TOOLS="$(printf '%s' "$J" | python3 -c "import sys,json;print(json.load(sys.stdin)['toolsInventoried'])" 2>/dev/null)"
if [ "$DOCS" = "1" ] && [ "$TOOLS" = "3" ]; then
  pass "baseline: the fixture is measured (1 document, 3 tools inventoried)"
else
  fail "baseline: the fixture is measured (1 document, 3 tools inventoried)" \
       "docs=$DOCS tools=$TOOLS - if these are 0 the tool saw nothing and every later row is meaningless"
fi
if [ "$BASE_RC" = "0" ]; then
  pass "baseline: a clean capability graph exits 0"
else
  fail "baseline: a clean capability graph exits 0" \
       "rc=$BASE_RC findings=$(printf '%s' "$J" | python3 -c "import sys,json;print([f['id'] for f in json.load(sys.stdin)['findings']])" 2>/dev/null)"
fi

# ------------------------------------------------------------
# CLASS 1 - UNNAMED: a tool ships and no loadable document names it.
# ------------------------------------------------------------
F1="$(mktemp -d "${TMPDIR:-/tmp}/doctor-unnamed-XXXXXX")"; build_fixture "$F1"
printf '// gamma\n' > "$F1/repo/bin/sidecoach-gamma.js"
# Reachable and registered nowhere, and unnamed - but only the UNNAMED assertion is made here.
run_doctor "$F1/repo" "$F1/surface"; J="$DOCTOR_JSON"
N="$(jq_findings "$J" capability-unnamed)"
if [ "$N" -ge 1 ]; then
  pass "class 1: a tool named in no loadable document is reported capability-unnamed"
else
  fail "class 1: a tool named in no loadable document is reported capability-unnamed" "count=$N"
fi
# ...and naming it in the surface clears it. Without this the row above could pass on a tool
# that reports UNNAMED unconditionally.
printf '\nAlso `node bin/sidecoach-gamma.js` exists.\n' >> "$F1/surface/SKILL.md"
run_doctor "$F1/repo" "$F1/surface"; J="$DOCTOR_JSON"
N="$(printf '%s' "$J" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(sum(1 for f in d['findings'] if f['id']=='capability-unnamed' and f['capability']=='sidecoach-gamma'))
")"
if [ "$N" = "0" ]; then
  pass "class 1: naming the tool in the surface CLEARS capability-unnamed (known negative)"
else
  fail "class 1: naming the tool in the surface CLEARS capability-unnamed (known negative)" \
       "still reported after being documented - the check is not reading the surface"
fi
rm -rf "$F1"

# ------------------------------------------------------------
# CLASS 2 - UNREACHED: nothing imports, spawns, wires or lists it.
# ------------------------------------------------------------
F2="$(mktemp -d "${TMPDIR:-/tmp}/doctor-unreached-XXXXXX")"; build_fixture "$F2"
printf '// orphan\n' > "$F2/repo/bin/sidecoach-orphan.js"
printf '\nSee `node bin/sidecoach-orphan.js`.\n' >> "$F2/surface/SKILL.md"   # named but unreachable
run_doctor "$F2/repo" "$F2/surface"; J="$DOCTOR_JSON"
N="$(printf '%s' "$J" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(sum(1 for f in d['findings'] if f['id']=='capability-unreached' and f['capability']=='sidecoach-orphan'))
")"
if [ "$N" = "1" ]; then
  pass "class 2: a tool nothing invokes is reported capability-unreached"
else
  fail "class 2: a tool nothing invokes is reported capability-unreached" "count=$N"
fi

# FALSE-POSITIVE REGRESSION A: an extensionless require IS a reach. The first draft of this tool
# demanded `<name>.js` and so reported the report renderer - required on every monitor run as
# require('./sidecoach-present') - as invoked by nothing.
printf "const x = require('./sidecoach-orphan');\n" > "$F2/repo/bin/sidecoach-caller.js"
printf '\nAnd `node bin/sidecoach-caller.js`.\n' >> "$F2/surface/SKILL.md"
run_doctor "$F2/repo" "$F2/surface"; J="$DOCTOR_JSON"
N="$(printf '%s' "$J" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(sum(1 for f in d['findings'] if f['id']=='capability-unreached' and f['capability']=='sidecoach-orphan'))
")"
if [ "$N" = "0" ]; then
  pass "regression A: require('./tool') with no extension counts as reachable"
else
  fail "regression A: require('./tool') with no extension counts as reachable" \
       "an extensionless require was still reported UNREACHED - the 2026-07-29 false negative is back"
fi
rm -rf "$F2"

# FALSE-POSITIVE REGRESSION B: the doctor must not count ITSELF as a caller. Its own prose names
# every tool, so a self-inclusive sweep reports every subject as reached and can never find the
# defect it exists for.
F2B="$(mktemp -d "${TMPDIR:-/tmp}/doctor-selfref-XXXXXX")"; build_fixture "$F2B"
printf '// lonely\n' > "$F2B/repo/bin/sidecoach-lonely.js"
printf '\nSee `node bin/sidecoach-lonely.js`.\n' >> "$F2B/surface/SKILL.md"
cp "$DOCTOR" "$F2B/repo/bin/sidecoach-doctor.js"   # the real doctor, whose prose names many tools
run_doctor "$F2B/repo" "$F2B/surface"; J="$DOCTOR_JSON"
N="$(printf '%s' "$J" | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=[x for x in d['rows'] if x['capability']=='sidecoach-lonely']
print('SELF' if r and any('sidecoach-doctor' in h for h in r[0]['reachable']) else 'CLEAN')
")"
if [ "$N" = "CLEAN" ]; then
  pass "regression B: the doctor does not count its own prose as invoking a tool"
else
  fail "regression B: the doctor does not count its own prose as invoking a tool" \
       "a tool was reported reachable via bin/sidecoach-doctor.js"
fi
rm -rf "$F2B"

# ------------------------------------------------------------
# CLASS 3 - CONTRADICTED, with the real wording of both live defects.
# ------------------------------------------------------------
F3="$(mktemp -d "${TMPDIR:-/tmp}/doctor-contradict-XXXXXX")"; build_fixture "$F3"
# The registry lists 2. Claim 6, the exact number the shipped skill claimed.
python3 - "$F3/surface/SKILL.md" <<'PY'
import sys
p=sys.argv[1]; s=open(p).read()
assert 'Two self-contained CLIs' in s
open(p,'w').write(s.replace('Two self-contained CLIs','six self-contained CLIs'))
PY
run_doctor "$F3/repo" "$F3/surface"; J="$DOCTOR_JSON"
N="$(jq_findings "$J" doc-contradicts-registry)"
SUM="$(printf '%s' "$J" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(next((f['summary'] for f in d['findings'] if f['id']=='doc-contradicts-registry'), ''))
")"
if [ "$N" -ge 1 ] && printf '%s' "$SUM" | grep -q "claims 6 standalone tools"; then
  pass "class 3a: a wrong tool COUNT in a loadable document is reported, with both numbers named"
else
  fail "class 3a: a wrong tool COUNT in a loadable document is reported, with both numbers named" \
       "count=$N summary=$SUM"
fi
# Restore the true count; assert the finding clears, so 3a is not passing unconditionally.
python3 - "$F3/surface/SKILL.md" <<'PY'
import sys
p=sys.argv[1]; s=open(p).read()
open(p,'w').write(s.replace('six self-contained CLIs','two self-contained CLIs'))
PY
run_doctor "$F3/repo" "$F3/surface"; J="$DOCTOR_JSON"
if [ "$(jq_findings "$J" doc-contradicts-registry)" = "0" ]; then
  pass "class 3a: the correct count produces NO contradiction finding (known negative)"
else
  fail "class 3a: the correct count produces NO contradiction finding (known negative)" \
       "a true claim was reported as a contradiction"
fi

# 3b: the sole-flow-wired claim. alpha IS flow-wired in the fixture; claiming beta is the only
# one is false and provably so from src/.
printf '\n**`sidecoach-beta` is the only flow-wired tool.**\n' >> "$F3/surface/SKILL.md"
run_doctor "$F3/repo" "$F3/surface"; J="$DOCTOR_JSON"
SUM="$(printf '%s' "$J" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(next((f['summary'] for f in d['findings'] if f['id']=='doc-contradicts-registry'), ''))
")"
if printf '%s' "$SUM" | grep -q "sidecoach-alpha"; then
  pass "class 3b: a false 'only flow-wired tool' claim is reported and names the tool src/ actually spawns"
else
  fail "class 3b: a false 'only flow-wired tool' claim is reported and names the tool src/ actually spawns" \
       "summary=$SUM"
fi
rm -rf "$F3"

# ------------------------------------------------------------
# FAIL-CLOSED: a check that could not run must never look like a pass.
# ------------------------------------------------------------
F4="$(mktemp -d "${TMPDIR:-/tmp}/doctor-failclosed-XXXXXX")"; build_fixture "$F4"
rm -rf "$F4/repo/dist"          # verb registry unloadable
run_doctor "$F4/repo" "$F4/surface"; J="$DOCTOR_JSON"
RC=$DOCTOR_RC
INC="$(printf '%s' "$J" | python3 -c "import sys,json;print(len(json.load(sys.stdin)['inconclusive']))" 2>/dev/null)"
if [ "$RC" = "3" ] && [ "$INC" -ge 1 ]; then
  pass "fail-closed: an unloadable verb registry exits 3 and is recorded as inconclusive"
else
  fail "fail-closed: an unloadable verb registry exits 3 and is recorded as inconclusive" "rc=$RC inconclusive=$INC"
fi

# Inconclusive must OUTRANK findings in the exit code: a run that could not finish must not
# report 1 as though its verdict were complete.
printf '// ghost\n' > "$F4/repo/bin/sidecoach-ghost.js"
node "$DOCTOR" --repo "$F4/repo" --surface "$F4/surface" --json >/dev/null 2>&1
RC=$?
if [ "$RC" = "3" ]; then
  pass "fail-closed: inconclusive outranks findings in the exit code"
else
  fail "fail-closed: inconclusive outranks findings in the exit code" "rc=$RC, expected 3"
fi
rm -rf "$F4"

# A missing loadable surface is exit 3, never a clean 0 - discoverability is unmeasurable
# without one, and reporting clean there would be the worst possible answer.
F5="$(mktemp -d "${TMPDIR:-/tmp}/doctor-nosurface-XXXXXX")"; build_fixture "$F5"
node "$DOCTOR" --repo "$F5/repo" --surface "$F5/does-not-exist" >/dev/null 2>&1
RC=$?
if [ "$RC" = "3" ]; then
  pass "fail-closed: a missing loadable surface exits 3, not 0"
else
  fail "fail-closed: a missing loadable surface exits 3, not 0" "rc=$RC"
fi

# An unparseable resolver registry must be INCONCLUSIVE, not an empty registry. An empty
# registry would report every tool as unlisted and bury the reader in false findings.
F6="$(mktemp -d "${TMPDIR:-/tmp}/doctor-noreg-XXXXXX")"; build_fixture "$F6"
printf '#!/usr/bin/env node\n// no registry here\n' > "$F6/repo/bin/sidecoach.js"
run_doctor "$F6/repo" "$F6/surface"; J="$DOCTOR_JSON"
RC=$DOCTOR_RC
NREG="$(jq_findings "$J" tool-not-in-resolver-registry)"
if [ "$RC" = "3" ] && [ "$NREG" = "0" ]; then
  pass "fail-closed: an unparseable registry is inconclusive, not an empty registry producing false findings"
else
  fail "fail-closed: an unparseable registry is inconclusive, not an empty registry producing false findings" \
       "rc=$RC registry-findings=$NREG"
fi
rm -rf "$F5" "$F6"

# ------------------------------------------------------------
# Usage and read-only guarantees.
# ------------------------------------------------------------
node "$DOCTOR" --nonsense-flag >/dev/null 2>&1
[ $? -eq 2 ] && pass "usage: an unknown flag exits 2" || fail "usage: an unknown flag exits 2" "wrong rc"

FIX_BEFORE="$(find "$FIX" -type f | LC_ALL=C sort; find "$FIX" -type f -exec cksum {} \; 2>/dev/null | LC_ALL=C sort)"
node "$DOCTOR" --repo "$FIX/repo" --surface "$FIX/surface" --json >/dev/null 2>&1
FIX_AFTER="$(find "$FIX" -type f | LC_ALL=C sort; find "$FIX" -type f -exec cksum {} \; 2>/dev/null | LC_ALL=C sort)"
if [ "$FIX_BEFORE" = "$FIX_AFTER" ]; then
  pass "read-only: the doctor writes nothing into the trees it inspects"
else
  fail "read-only: the doctor writes nothing into the trees it inspects" "the fixture changed"
fi

if [ "$REAL_BEFORE" = "$(snap "$REAL_SURFACE")" ]; then
  pass "safety: the real loadable surface was not modified"
else
  fail "safety: the real loadable surface was not modified" "the installed skill directory changed"
fi

rm -rf "$FIX"

echo ""
echo "sidecoach-doctor: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  printf 'failed rows:\n'
  for l in "${FAIL_LABELS[@]}"; do printf '  - %s\n' "$l"; done
  exit 1
fi
exit 0
