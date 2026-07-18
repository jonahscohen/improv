#!/usr/bin/env bash
# Falsification suite for figma-fidelity-arm.sh (the PreToolUse auto-arm hook).
#
# Every property is shown to HOLD when it should AND to FAIL when it should - a
# guard that cannot go red is not a guard. Runs entirely in throwaway temp dirs
# (git rev-parse fails there, so the hook's ROOT falls back to pwd) so the real
# repo-root .figma-fidelity.* markers are never touched.

HOOK="/Users/spare3/Documents/Github/improv/claude/hooks/figma-fidelity-arm.sh"
GATE="/Users/spare3/Documents/Github/improv/claude/hooks/figma-fidelity-stop.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

DGC="mcp__plugin_figma_figma__get_design_context"
DLA="mcp__plugin_figma_figma__download_assets"

pass=0; fail=0
report() { # name expected actual
  if [ "$2" = "$3" ]; then pass=$((pass+1)); printf '  ok   %-56s (%s)\n' "$1" "$3"
  else fail=$((fail+1)); printf '  FAIL %-56s expected [%s] got [%s]\n' "$1" "$2" "$3"; fi
}

# A fresh throwaway repo. $1=scope: "json"|"pending"|"measuring"|"none".
mkrepo() {
  root="$TMP/r$RANDOM$RANDOM"; mkdir -p "$root"
  case "${1:-json}" in
    json)      printf '{"checks":[]}\n' > "$root/.figma-fidelity.json" ;;
    pending)   printf 'site-header\n'    > "$root/.figma-fidelity.pending" ;;
    measuring) : > "$root/.figma-fidelity.measuring" ;;
    none)      : ;;  # no fidelity files -> not a gate-using repo
  esac
  echo "$root"
}

# Emit a PreToolUse payload. $1=tool_name $2=nodeId ($2="__NONE__" omits nodeId).
payload() {
  python3 -c '
import json,sys
tn,nid=sys.argv[1],sys.argv[2]
ti={"fileKey":"ABC123"}
if nid!="__NONE__": ti["nodeId"]=nid
print(json.dumps({"tool_name":tn,"tool_input":ti}))' "$1" "$2"
}

# Run the hook in $root with the given payload. Sets OUT (stdout) and RC (exit).
run_arm() { # root tool_name nodeId
  OUT="$( cd "$1" && payload "$2" "$3" | bash "$HOOK" 2>/dev/null )"; RC=$?
}

# Feed raw stdin bytes to the hook (for malformed-JSON tests). Sets OUT/RC.
run_raw() { # root rawpayload
  OUT="$( cd "$1" && printf '%s' "$2" | bash "$HOOK" 2>/dev/null )"; RC=$?
}

# The gate-parsed tokens in a marker (comment-stripped), one per line.
tokens() { # root
  python3 -c '
import sys
try: raw=open(sys.argv[1]).read()
except OSError: sys.exit(0)
for ln in raw.splitlines():
    t=ln.split("#",1)[0].strip()
    if t: print(t)' "$1/.figma-fidelity.pending"
}
tokcount() { tokens "$1" | grep -c . ; }
has_token() { tokens "$1" | grep -qxF "$2"; }
marker_exists() { [ -f "$1/.figma-fidelity.pending" ] && echo yes || echo no; }

echo "=== fires on the two proof tools in a gate-using repo ==="
r=$(mkrepo json); run_arm "$r" "$DGC" "12:34"
has_token "$r" "12:34" && report "get_design_context arms node 12:34" yes yes || report "get_design_context arms node 12:34" yes no
r=$(mkrepo json); run_arm "$r" "$DLA" "77:88"
has_token "$r" "77:88" && report "download_assets arms node 77:88" yes yes || report "download_assets arms node 77:88" yes no

echo
echo "=== ignores tools that are NOT the two proof tools (over-fire guard) ==="
r=$(mkrepo json); run_arm "$r" "mcp__plugin_figma_figma__get_metadata" "12:34"
report "get_metadata (has nodeId) does NOT arm" no "$(marker_exists "$r")"
r=$(mkrepo json); run_arm "$r" "Bash" "12:34"
report "an unrelated tool does NOT arm" no "$(marker_exists "$r")"
r=$(mkrepo json); run_arm "$r" "mcp__plugin_figma_figma__get_screenshot" "12:34"
report "get_screenshot does NOT arm" no "$(marker_exists "$r")"
# suffix impostor: base name must be EXACT, not a suffix match (Codex Medium).
r=$(mkrepo json); run_arm "$r" "mcp__plugin_figma_figma__not_get_design_context" "12:34"
report "impostor '..not_get_design_context' does NOT arm" no "$(marker_exists "$r")"
r=$(mkrepo json); run_arm "$r" "mcp__x__predownload_assets" "12:34"
report "impostor '..predownload_assets' does NOT arm" no "$(marker_exists "$r")"

echo
echo "=== normalisation: hyphen nodeId is armed as the colon form ==="
r=$(mkrepo json); run_arm "$r" "$DGC" "858-11438"
has_token "$r" "858:11438" && report "858-11438 -> token 858:11438 (colon)" yes yes || report "858-11438 -> token 858:11438 (colon)" yes no
has_token "$r" "858-11438" && report "the hyphen form is NOT stored" absent present || report "the hyphen form is NOT stored" absent absent
# fullwidth / non-ASCII digits must NOT parse as a Figma id (Codex Low: re.ASCII).
r=$(mkrepo json); run_arm "$r" "$DGC" $'１２-３４'
report "fullwidth-digit nodeId does NOT arm" no "$(marker_exists "$r")"

echo
echo "=== append, never clobber: a manual token and prior nodes survive ==="
r=$(mkrepo pending)   # seeded with manual token 'site-header'
run_arm "$r" "$DGC" "12:34"
run_arm "$r" "$DLA" "56:78"
report "manual 'site-header' preserved" yes "$(has_token "$r" site-header && echo yes || echo no)"
report "node 12:34 appended"           yes "$(has_token "$r" 12:34 && echo yes || echo no)"
report "node 56:78 appended"           yes "$(has_token "$r" 56:78 && echo yes || echo no)"
report "exactly 3 tokens (nothing clobbered)" 3 "$(tokcount "$r")"

echo
echo "=== idempotent: the same node armed twice yields ONE token ==="
r=$(mkrepo json)
run_arm "$r" "$DGC" "12:34"
run_arm "$r" "$DGC" "12:34"     # again, same tool
run_arm "$r" "$DLA" "12:34"     # again, other tool, same node
report "12:34 present exactly once" 1 "$(tokens "$r" | grep -xc '12:34')"
report "total tokens still 1"        1 "$(tokcount "$r")"

echo
echo "=== the armed line carries the NO-opt-out guidance, and strips to just the token ==="
r=$(mkrepo json); run_arm "$r" "$DGC" "12:34"
grep -q 'ONLY way to clear this' "$r/.figma-fidelity.pending" \
  && report "no-opt-out guidance present on the armed line" yes yes \
  || report "no-opt-out guidance present on the armed line" yes no
grep -q 'delete this line to opt out' "$r/.figma-fidelity.pending" \
  && report "old opt-out affordance is GONE" no yes \
  || report "old opt-out affordance is GONE" no no
grep -q 'armed by figma get_design_context' "$r/.figma-fidelity.pending" \
  && report "provenance comment names the tool" yes yes \
  || report "provenance comment names the tool" yes no
# The gate reads only the token (everything after '#' is a comment). Prove it.
report "gate-parse of the armed line == the bare token" "12:34" "$(tokens "$r")"

echo
echo "=== does NOT arm outside a gate-using repo (scoping) ==="
r=$(mkrepo none); run_arm "$r" "$DGC" "12:34"
report "no .figma-fidelity.* -> no arm" no "$(marker_exists "$r")"
# a lone lockfile must NOT self-scope a repo into arming.
r=$(mkrepo none); : > "$r/.figma-fidelity.pending.lock"; run_arm "$r" "$DGC" "12:34"
report "a lone .pending.lock does NOT scope-in" no "$(marker_exists "$r")"
# ...but DOES arm when scoped in via any of the three fidelity files:
r=$(mkrepo pending);   run_arm "$r" "$DGC" "9:9";  report "scoped-in via .pending arms"   yes "$(has_token "$r" 9:9 && echo yes || echo no)"
r=$(mkrepo measuring); run_arm "$r" "$DGC" "9:9";  report "scoped-in via .measuring arms" yes "$(has_token "$r" 9:9 && echo yes || echo no)"
r=$(mkrepo json);      run_arm "$r" "$DGC" "9:9";  report "scoped-in via .json arms"      yes "$(has_token "$r" 9:9 && echo yes || echo no)"

echo
echo "=== bad / missing input never arms and never blocks the tool ==="
r=$(mkrepo json); run_arm "$r" "$DGC" "__NONE__"
report "no nodeId -> no arm"        no  "$(marker_exists "$r")"
report "no nodeId -> exit 0"        0   "$RC"
report "no nodeId -> stdout {}"     "{}" "$OUT"
r=$(mkrepo json); run_arm "$r" "$DGC" "not-a-node"
report "garbage nodeId -> no arm"   no  "$(marker_exists "$r")"
r=$(mkrepo json); run_arm "$r" "$DGC" "12:"      # half a node id
report "malformed nodeId -> no arm" no  "$(marker_exists "$r")"
r=$(mkrepo json); run_raw "$r" 'this is not json'
report "malformed JSON -> no arm"   no  "$(marker_exists "$r")"
report "malformed JSON -> exit 0"   0   "$RC"
report "malformed JSON -> stdout {}" "{}" "$OUT"
r=$(mkrepo json); run_raw "$r" ''
report "empty stdin -> exit 0"      0   "$RC"
report "empty stdin -> stdout {}"   "{}" "$OUT"

echo
echo "=== ALWAYS allows the tool: exit 0 + {} on every branch, armed or not ==="
r=$(mkrepo json); run_arm "$r" "$DGC" "12:34"; report "armed path exit 0"    0 "$RC"; report "armed path {}"    "{}" "$OUT"
r=$(mkrepo none); run_arm "$r" "$DGC" "12:34"; report "unscoped path exit 0" 0 "$RC"; report "unscoped path {}" "{}" "$OUT"
r=$(mkrepo json); run_arm "$r" "Bash" "12:34"; report "other-tool exit 0"    0 "$RC"; report "other-tool {}"    "{}" "$OUT"

echo
echo "=== concurrency: 20 parallel arms of DISTINCT nodes -> 20 clean tokens ==="
r=$(mkrepo json)
for i in $(seq 1 20); do ( cd "$r" && payload "$DGC" "$i:$i" | bash "$HOOK" >/dev/null 2>&1 ) & done
wait
report "20 distinct tokens, no loss"      20 "$(tokcount "$r")"
report "20 UNIQUE tokens, no dupes"       20 "$(tokens "$r" | sort -u | grep -c .)"
report "no torn/blank lines in the marker" 0 "$(grep -c '^[[:space:]]*$' "$r/.figma-fidelity.pending")"

echo
echo "=== concurrency: 20 parallel arms of the SAME node -> ONE token ==="
r=$(mkrepo json)
for i in $(seq 1 20); do ( cd "$r" && payload "$DGC" "42:42" | bash "$HOOK" >/dev/null 2>&1 ) & done
wait
report "same node under race -> exactly 1 token" 1 "$(tokcount "$r")"

echo
echo "=== survives a Stop-style clear: the arm is not lost to a concurrent rm ==="
# The Stop gate rm's the marker (lock-free) on a pass. The atomic os.replace must
# recreate it rather than write to an unlinked fd (Codex High). Simulate the clear
# by removing the marker between two arms.
r=$(mkrepo json)
run_arm "$r" "$DGC" "10:10"                 # marker created via rename
rm -f "$r/.figma-fidelity.pending"           # Stop clears it after a pass
run_arm "$r" "$DGC" "20:20"                  # fresh arm must NOT be lost
report "marker recreated after a clear" yes "$(marker_exists "$r")"
report "fresh token 20:20 landed"       yes "$(has_token "$r" 20:20 && echo yes || echo no)"

echo
echo "=== END TO END: an armed token is consumed by the REAL Stop gate ==="
# Covering manifest: the gate should PASS and clear the marker. The .pending line
# below is written verbatim in the exact shape figma-fidelity-arm.sh emits, to
# prove the gate consumes the hook's real output (token + trailing '#' comment).
r=$(mkrepo none)
printf 'border-radius: 10px\n' > "$r/evidence.css"
printf '858:11438  # armed by figma get_design_context @ 2026-07-17T00:00:00Z; cover this node in .figma-fidelity.json or delete this line to opt out\n' > "$r/.figma-fidelity.pending"
python3 -c '
import json,sys
json.dump({"checks":[{"element":"stat icon","node":"858:11438","property":"border-radius",
 "figma":"10px","measured":"10px","dom":"10px","dom_status":"read",
 "evidence":{"file":"evidence.css","grep":"border-radius: 10px"}}]},
 open(sys.argv[1]+"/.figma-fidelity.json","w"))' "$r"
rc=$( cd "$r" && bash "$GATE" >/dev/null 2>&1; echo $? )
report "gate PASSES when manifest covers the armed node" 0 "$rc"
report "gate cleared the marker on pass"                 no "$(marker_exists "$r")"

# Non-covering manifest: same armed token, manifest points at a different node.
r=$(mkrepo none)
printf 'border-radius: 10px\n' > "$r/evidence.css"
printf '858:11438  # armed by figma get_design_context @ 2026-07-17T00:00:00Z; cover this node in .figma-fidelity.json or delete this line to opt out\n' > "$r/.figma-fidelity.pending"
python3 -c '
import json,sys
json.dump({"checks":[{"element":"other thing","node":"1:1","property":"border-radius",
 "figma":"10px","measured":"10px","dom":"10px","dom_status":"read",
 "evidence":{"file":"evidence.css","grep":"border-radius: 10px"}}]},
 open(sys.argv[1]+"/.figma-fidelity.json","w"))' "$r"
rc=$( cd "$r" && bash "$GATE" >/dev/null 2>&1; echo $? )
report "gate BLOCKS when manifest does not cover the armed node" 2 "$rc"
report "gate RETAINED the marker on block"                       yes "$(marker_exists "$r")"

echo
echo "================================================================"
printf 'passed %d, failed %d\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
