#!/bin/bash
# Regression tests for content-guard.sh (broadened emoji ranges) and
# content-guard-stop.sh (prose Stop guard).
# Run: bash ~/.claude/hooks/test-content-guard.sh
#
# All forbidden characters are generated at runtime via chr(0xXXXX) so this test
# file stays pure ASCII (and therefore passes content-guard itself).

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
CG="$HOOK_DIR/content-guard.sh"
CGS="$HOOK_DIR/content-guard-stop.sh"
PASS=0; FAIL=0; FAILS=()

# ---------- content-guard.sh (Write content) ----------
run_cg() {  # $1 = python expr producing the content string
  local content
  content=$(python3 -c "import sys; sys.stdout.write($1)")
  python3 -c 'import json,sys; print(json.dumps({"tool_name":"Write","tool_input":{"content":sys.argv[1]}}))' "$content" | bash "$CG" 2>/dev/null
}
cg_blocks() {
  local label="$1" expr="$2" out; out=$(run_cg "$expr")
  if echo "$out" | grep -q '"permissionDecision": *"deny"'; then echo "PASS [cg]: $label"; ((PASS++)); else echo "FAIL [cg]: $label (got: $out)"; FAILS+=("cg:$label"); ((FAIL++)); fi
}
cg_allows() {
  local label="$1" expr="$2" out; out=$(run_cg "$expr")
  if echo "$out" | grep -q '"permissionDecision": *"deny"'; then echo "FAIL [cg]: $label (unexpected deny: $out)"; FAILS+=("cg:$label"); ((FAIL++)); else echo "PASS [cg]: $label"; ((PASS++)); fi
}

# Real emoji stay blocked (Emoji_Presentation=Yes / supplementary planes / VS16 / keycap)
cg_blocks "emoji white-check U+2705"      "chr(0x2705)+' done'"
cg_blocks "emoji hourglass U+23F3"        "'wait '+chr(0x23F3)"
cg_blocks "emoji sparkles U+2728"         "chr(0x2728)+' shiny'"
cg_blocks "emoji cross-mark U+274C"       "chr(0x274C)+' nope'"
cg_blocks "emoji robot U+1F916"           "chr(0x1F916)"
cg_blocks "emoji rocket U+1F680"          "chr(0x1F680)"
cg_blocks "emoji party U+1F389"           "chr(0x1F389)"
cg_blocks "emoji star U+2B50"             "chr(0x2B50)"
cg_blocks "warning + VS16 (emoji)"        "chr(0x26A0)+chr(0xFE0F)"
cg_blocks "keycap 1 + U+20E3"             "'press '+chr(0x31)+chr(0x20E3)"
cg_blocks "emdash U+2014"                 "'a '+chr(0x2014)+' b'"
# Terminal typography is ALLOWED - text-presentation symbols, not emoji
cg_allows "clean ascii"                   "'just plain professional text'"
cg_allows "trademark U+2122"              "'NSSGA'+chr(0x2122)"
cg_allows "right-arrow U+2192"            "'dev '+chr(0x2192)+' live'"
cg_allows "cmd glyph U+2318"              "'press '+chr(0x2318)+'S'"
cg_allows "bullet U+2022"                 "chr(0x2022)+' item'"
cg_allows "check mark U+2713"             "chr(0x2713)+' taste'"
cg_allows "ballot-x U+2717"               "chr(0x2717)+' polish'"
cg_allows "bare warning U+26A0 (text)"    "chr(0x26A0)+' careful'"
cg_allows "diamond U+25C6"                "chr(0x25C6)+' sidecoach'"
cg_allows "hollow diamond U+25C7"         "chr(0x25C7)+' phase'"
cg_allows "bar block U+25B0"              "chr(0x25B0)*5"
cg_allows "chevron U+203A"                "'a '+chr(0x203A)+' b'"
cg_allows "six-point star U+2736"         "chr(0x2736)"
cg_allows "box-drawing U+2500"            "chr(0x2500)*10"

# ---------- content-guard-stop.sh (prose via fake transcript) ----------
mk_transcript() {  # $1 = python expr for assistant text -> echoes path
  local text path
  text=$(python3 -c "import sys; sys.stdout.write($1)")
  path=$(mktemp)
  python3 -c 'import json,sys; print(json.dumps({"type":"assistant","message":{"content":[{"type":"text","text":sys.argv[1]}]}}))' "$text" > "$path"
  echo "$path"
}
run_cgs() {  # $1 = transcript path, $2 = stop_hook_active (0/1)
  python3 -c 'import json,sys; print(json.dumps({"transcript_path":sys.argv[1],"stop_hook_active":(sys.argv[2]=="1")}))' "$1" "$2" | bash "$CGS" 2>/dev/null
}
cgs_blocks() {
  local label="$1" expr="$2" p out; p=$(mk_transcript "$expr"); out=$(run_cgs "$p" 0); rm -f "$p"
  if echo "$out" | grep -q '"decision": *"block"'; then echo "PASS [cgs]: $label"; ((PASS++)); else echo "FAIL [cgs]: $label (got: $out)"; FAILS+=("cgs:$label"); ((FAIL++)); fi
}
cgs_allows() {
  local label="$1" expr="$2" p out; p=$(mk_transcript "$expr"); out=$(run_cgs "$p" 0); rm -f "$p"
  if echo "$out" | grep -q '"decision": *"block"'; then echo "FAIL [cgs]: $label (unexpected block: $out)"; FAILS+=("cgs:$label"); ((FAIL++)); else echo "PASS [cgs]: $label"; ((PASS++)); fi
}

cgs_blocks "prose emoji U+2705"           "'All '+chr(0x2705)+' done'"
cgs_blocks "prose emoji U+23F3"           "'building '+chr(0x23F3)"
cgs_blocks "prose emoji sparkles U+2728"  "'shiny '+chr(0x2728)"
cgs_blocks "prose emdash U+2014"          "'local '+chr(0x2014)+' remote'"
cgs_allows "prose clean ascii"            "'all done, verified locally'"
cgs_allows "prose arrow U+2192"           "'dev '+chr(0x2192)+' live'"
cgs_allows "prose check mark U+2713"      "'taste '+chr(0x2713)+' pass'"

# stop_hook_active loop guard: even with emoji, must NOT block when active=1.
p=$(mk_transcript "chr(0x2705)+' x'"); out=$(run_cgs "$p" 1); rm -f "$p"
if echo "$out" | grep -q '"decision": *"block"'; then echo "FAIL [cgs]: loop-guard (blocked while active)"; FAILS+=("cgs:loop-guard"); ((FAIL++)); else echo "PASS [cgs]: loop-guard honors stop_hook_active"; ((PASS++)); fi

# ---------- settings.json registration + validity ----------
for f in "$HOME/.claude/settings.json" "/Users/spare3/Documents/Github/improv/claude/settings.json"; do
  if python3 -c "import json,sys
d=json.load(open(sys.argv[1]))
cmds=[h.get('command','') for e in d['hooks']['Stop'] for h in e.get('hooks',[])]
sys.exit(0 if any('content-guard-stop.sh' in c for c in cmds) else 1)" "$f" 2>/dev/null; then
    echo "PASS [settings]: $(basename "$(dirname "$f")")/settings.json valid + registered"; ((PASS++))
  else
    echo "FAIL [settings]: $f invalid or missing content-guard-stop.sh"; FAILS+=("settings:$f"); ((FAIL++))
  fi
done

echo; echo "RESULTS: $PASS passed, $FAIL failed"
if [ "$FAIL" -ne 0 ]; then printf 'FAILED: %s\n' "${FAILS[@]}"; exit 1; fi
exit 0
