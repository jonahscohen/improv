#!/bin/bash
# test-figma-optout-block.sh
#
# The Figma-fidelity gate must NOT be escapable by deleting/editing the arming
# record .figma-fidelity.pending. Hardened 2026-07-18 (Jonah) after the agent used
# the old "delete the line to opt out" shortcut to skip fidelity testing on a node it
# had built against. Two tool-level guards enforce it:
#   - bash-guard.sh   blocks rm / mv / sed -i / truncate / redirect on the marker.
#   - content-guard.sh blocks Write / Edit / MultiEdit on the marker.
# Both must ALSO leave legitimate ops (reading the marker, writing the manifest,
# normal file writes) untouched - a guard that blocks everything is as broken as one
# that blocks nothing. Falsified BOTH ways below.
set -u
HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
BG="$HOOK_DIR/bash-guard.sh"
CG="$HOOK_DIR/content-guard.sh"
fail=0

decision() { # hook, json -> BLOCK|ALLOW
  printf '%s' "$2" | bash "$1" 2>/dev/null | python3 -c 'import json,sys
try: d=json.load(sys.stdin)
except: print("ALLOW"); sys.exit()
print("BLOCK" if d.get("hookSpecificOutput",{}).get("permissionDecision")=="deny" else "ALLOW")'
}
bcmd() { python3 -c 'import json,sys; print(json.dumps({"tool_input":{"command":sys.argv[1]}}))' "$1"; }
cwrite() { python3 -c 'import json,sys; print(json.dumps({"tool_name":sys.argv[1],"tool_input":json.loads(sys.argv[2])}))' "$1" "$2"; }
ck() { # desc want got
  local m="PASS"; [ "$2" != "$3" ] && { m="FAIL"; fail=1; }
  echo "[$m] want=$2 got=$3 : $1"
}

echo "--- bash-guard: opt-out vectors must BLOCK ---"
ck "rm marker"        BLOCK "$(decision "$BG" "$(bcmd 'rm -f .figma-fidelity.pending')")"
ck "grep -v then mv"  BLOCK "$(decision "$BG" "$(bcmd 'grep -v 12:34 .figma-fidelity.pending > t && mv t .figma-fidelity.pending')")"
ck "sed -i delete"    BLOCK "$(decision "$BG" "$(bcmd 'sed -i "" /12/d .figma-fidelity.pending')")"
ck "truncate"         BLOCK "$(decision "$BG" "$(bcmd 'truncate -s 0 .figma-fidelity.pending')")"
ck "redirect over"    BLOCK "$(decision "$BG" "$(bcmd 'printf x > .figma-fidelity.pending')")"
echo "--- bash-guard: legit ops must ALLOW ---"
ck "read marker"      ALLOW "$(decision "$BG" "$(bcmd 'cat .figma-fidelity.pending')")"
ck "touch measuring"  ALLOW "$(decision "$BG" "$(bcmd 'touch .figma-fidelity.measuring')")"
ck "write manifest"   ALLOW "$(decision "$BG" "$(bcmd 'python3 b.py > .figma-fidelity.json')")"

echo "--- content-guard: Write/Edit on marker must BLOCK ---"
ck "Write marker"     BLOCK "$(decision "$CG" "$(cwrite Write '{"file_path":"/x/.figma-fidelity.pending","content":"12:34"}')")"
ck "Edit marker empty" BLOCK "$(decision "$CG" "$(cwrite Edit '{"file_path":"/x/.figma-fidelity.pending","old_string":"a","new_string":""}')")"
echo "--- content-guard: normal writes must ALLOW ---"
ck "Write scss"       ALLOW "$(decision "$CG" "$(cwrite Write '{"file_path":"/x/a.scss","content":"a{color:red}"}')")"
ck "Write manifest"   ALLOW "$(decision "$CG" "$(cwrite Write '{"file_path":"/x/.figma-fidelity.json","content":"{}"}')")"

if [ "$fail" = 0 ]; then echo "ALL PASS"; else echo "FAILURES ABOVE"; exit 1; fi
