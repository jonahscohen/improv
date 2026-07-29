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

# ---------- masked-credential tails (2026-07-29 adversary precedent) ----------
# Four characters of a live key were committed inside the very test written to prove tails
# do not leak, because a fixture copied a provider 401 echo verbatim and the mask left the
# tail intact. The sweep that missed it judged the hit on its SHAPE and never asked whether
# the visible part was real. This gate cannot know either - it never reads a credential - so
# it requires the write to STATE where the tail came from.
#
# Every masked key below is assembled at runtime, so no contiguous masked-key literal ever
# sits in this file. That keeps the suite passing its own gate, and it is the same reason
# the fixtures upstream use an invented tail.
MASK="'*'*20"
cg_blocks "masked key, no provenance statement"      "'const e = \"Incorrect API key provided: sk-proj-'+$MASK+'Qx7T.\"'"
cg_blocks "masked google key, no statement"          "'AIza'+$MASK+'9xQ2'"
cg_blocks "masked slack token, no statement"         "'xoxb-'+$MASK+'ab12'"
cg_blocks "mask written with bullets"                "'sk-proj-'+chr(0x2022)*10+'Qx7T'"
cg_allows "masked key WITH a synthetic attestation"  "'the tail is SYNTHETIC and must stay that way'+chr(10)+'sk-proj-'+$MASK+'Qx7T'"
cg_allows "incident record saying the tail was real" "'that fragment is not invented, it is the real tail'+chr(10)+'sk-proj-'+$MASK+'ZZZZ'"
cg_allows "CSS comment banner is not a key"          "'/* '+$MASK+'regular code'+$MASK+' */'"
cg_allows "a fully redacted key"                     "'sk-[REDACTED] is how we redact'"
cg_allows "mask with no key prefix at all"           "$MASK+'abcd'"
cg_allows "a key prefix with no mask"                "'sk-proj-notmaskedatall'"

# The attestation may already be in the FILE rather than in the edited span: an Edit hands
# the hook only new_string. Without the on-disk read, a one-line tweak to the upstream
# fixture would be denied for a comment sitting ten lines above it.
FIXTURE="$(cd "$HOOK_DIR/../.." 2>/dev/null && pwd)/sidecoach/src/__tests__/image-generation.test.ts"
run_edit() {  # $1 = python expr for new_string, $2 = file_path
  local s; s=$(python3 -c "import sys; sys.stdout.write($1)")
  python3 -c 'import json,sys; print(json.dumps({"tool_name":"Edit","tool_input":{"new_string":sys.argv[1],"file_path":sys.argv[2]}}))' "$s" "$2" | bash "$CG" 2>/dev/null
}
edit_case() {  # $1 label, $2 expr, $3 path, $4 blocks|allows
  local out; out=$(run_edit "$2" "$3")
  local got=allows; echo "$out" | grep -q '"permissionDecision": *"deny"' && got=blocks
  if [ "$got" = "$4" ]; then echo "PASS [cg]: $1"; ((PASS++)); else echo "FAIL [cg]: $1 (got $got)"; FAILS+=("cg:$1"); ((FAIL++)); fi
}
if [ -f "$FIXTURE" ]; then
  edit_case "edit to an ALREADY-attested fixture passes" "'sk-proj-'+$MASK+'Qx7T'" "$FIXTURE" allows
  edit_case "same literal into an unattested new file is denied" "'sk-proj-'+$MASK+'Qx7T'" "/tmp/cg-probe-new.ts" blocks
else
  echo "SKIP [cg]: upstream fixture absent, on-disk attestation case not exercised"
fi

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

# ---------- registration + validity ----------
# Stage 2: content-guard-stop moved to the safety cluster. Its wiring is now
# declared in cluster-wirings.json (repo source of truth) and deployed into the
# user's settings.json Stop when the safety cluster is installed.
CW="$HOOK_DIR/cluster-wirings.json"
if python3 -c "import json,sys
w=json.load(open(sys.argv[1]))
sys.exit(0 if any(e.get('event')=='Stop' for e in w.get('content-guard-stop.sh',[])) else 1)" "$CW" 2>/dev/null; then
  echo "PASS [registration]: content-guard-stop declared in cluster-wirings.json (safety cluster, Stop)"; ((PASS++))
else
  echo "FAIL [registration]: content-guard-stop missing from cluster-wirings.json"; FAILS+=("cluster-wirings"); ((FAIL++))
fi
# live settings.json validity (if present) - informational
if [ -f "$HOME/.claude/settings.json" ]; then
  if python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$HOME/.claude/settings.json" 2>/dev/null; then
    echo "PASS [settings]: live ~/.claude/settings.json is valid JSON"; ((PASS++))
  else
    echo "FAIL [settings]: live ~/.claude/settings.json invalid JSON"; FAILS+=("live-settings"); ((FAIL++))
  fi
fi

echo; echo "RESULTS: $PASS passed, $FAIL failed"
if [ "$FAIL" -ne 0 ]; then printf 'FAILED: %s\n' "${FAILS[@]}"; exit 1; fi
exit 0
