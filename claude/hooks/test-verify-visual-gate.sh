#!/bin/bash
# Regression tests for the VISUAL verification gate (2026-06-22 hardening).
# Run: bash claude/hooks/test-verify-visual-gate.sh
#
# Covers the three holes that let an unverified CSS change be reported done:
#   1. curl/tests/logs must NOT clear a "visual" flag (only a real screenshot does)
#   2. verify-clear.sh must clear only on a real screenshot, not navigate
#   3. verify-before-done-stop.sh must block ending the turn on a visual flag
# Uses a temp HOME so the real ~/.claude/.needs-verification is untouched.
set -u
HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
VBD="$HOOK_DIR/verify-before-done.sh"
VC="$HOOK_DIR/verify-clear.sh"
VSTOP="$HOOK_DIR/verify-before-done-stop.sh"

TMP=$(mktemp -d)
export HOME="$TMP"
mkdir -p "$HOME/.claude"
# Payloads below carry no session_id, so every hook derives the "global" fallback key.
FLAG="$HOME/.claude/.needs-verification.global"

PASS=0; FAIL=0; FAILED=()
chk() { if [ "$2" = "$3" ]; then echo "PASS: $1"; PASS=$((PASS+1)); else echo "FAIL: $1 (want=[$2] got=[$3])"; FAIL=$((FAIL+1)); FAILED+=("$1"); fi; }
flag() { [ -f "$FLAG" ] && cat "$FLAG" || printf '(absent)'; }
feed() { printf '%s' "$1" | bash "$2" >/dev/null 2>&1; }
feed_out() { printf '%s' "$1" | bash "$2" 2>/dev/null; }
blocked() { echo "$1" | grep -q '"decision": "block"' && echo block || echo allow; }

echo "=== visual flag lifecycle ==="
rm -f "$FLAG"
feed '{"tool_name":"Edit","tool_input":{"file_path":"/proj/styles.css"}}' "$VBD"
chk "css edit sets flag=visual" "visual" "$(flag)"
feed '{"tool_name":"Bash","tool_input":{"command":"curl -s http://localhost:4830/styles.css"}}' "$VBD"
chk "curl localhost does NOT clear visual" "visual" "$(flag)"
feed '{"tool_name":"Bash","tool_input":{"command":"npm test"}}' "$VBD"
chk "npm test does NOT clear visual" "visual" "$(flag)"
feed '{"tool_name":"Read","tool_input":{"file_path":"/tmp/probe.log"}}' "$VBD"
chk "Read /tmp log does NOT clear visual" "visual" "$(flag)"
feed '{"tool_name":"Read","tool_input":{"file_path":"/tmp/hero.png"}}' "$VBD"
chk "Read .png CLEARS visual" "(absent)" "$(flag)"

echo ""
echo "=== non-visual code keeps its off-ramps ==="
rm -f "$FLAG"
feed '{"tool_name":"Edit","tool_input":{"file_path":"/proj/server.ts"}}' "$VBD"
chk "ts edit sets flag=code" "code" "$(flag)"
feed '{"tool_name":"Bash","tool_input":{"command":"curl -s http://localhost:9223/status"}}' "$VBD"
chk "curl localhost CLEARS code flag" "(absent)" "$(flag)"

echo ""
echo "=== cmux screenshot clears visual; code edit does not downgrade ==="
rm -f "$FLAG"
feed '{"tool_name":"Edit","tool_input":{"file_path":"/proj/index.html"}}' "$VBD"
feed '{"tool_name":"Edit","tool_input":{"file_path":"/proj/util.ts"}}' "$VBD"
chk "later code edit does not downgrade visual" "visual" "$(flag)"
feed '{"tool_name":"Bash","tool_input":{"command":"cmux browser --surface surface:1 screenshot --out /tmp/x.png"}}' "$VBD"
chk "cmux screenshot CLEARS visual" "(absent)" "$(flag)"

echo ""
echo "=== verify-clear.sh: navigate vs screenshot ==="
rm -f "$FLAG"; printf 'visual' > "$FLAG"
feed '{"tool_name":"mcp__claude-in-chrome__navigate","tool_input":{"url":"http://x"}}' "$VC"
chk "navigate does NOT clear" "visual" "$(flag)"
feed '{"tool_name":"mcp__claude-in-chrome__computer","tool_input":{"action":"screenshot"}}' "$VC"
chk "computer screenshot CLEARS" "(absent)" "$(flag)"

echo ""
echo "=== stop hook teeth ==="
rm -f "$FLAG"; printf 'visual' > "$FLAG"
chk "blocks when flag=visual" "block" "$(blocked "$(feed_out '{"stop_hook_active":false,"transcript_path":""}' "$VSTOP")")"
rm -f "$FLAG"; printf 'code' > "$FLAG"
chk "allows when flag=code" "allow" "$(blocked "$(feed_out '{"stop_hook_active":false,"transcript_path":""}' "$VSTOP")")"
rm -f "$FLAG"; printf 'visual' > "$FLAG"
chk "no loop when stop_hook_active" "allow" "$(blocked "$(feed_out '{"stop_hook_active":true,"transcript_path":""}' "$VSTOP")")"
rm -f "$FLAG"
chk "allows when no flag" "allow" "$(blocked "$(feed_out '{"stop_hook_active":false,"transcript_path":""}' "$VSTOP")")"

echo ""
echo "===== STOP GATE: corroborate the visual flag against the WORKING TREE (2026-07-23) ====="
# The gate demanded a screenshot whenever the flag read "visual", with no check that anything
# visual existed to photograph. The flag can read visual while the tree holds nothing visual -
# a command that only MENTIONED a visual filename armed it (undecidable to fix at the arm site,
# see decision_verify_hook_quoted_mention_arming), or a real change was armed then reverted. The
# demand is then unsatisfiable and can only be cleared by a human override, which is what it cost
# the lead session. It now allows the stop ONLY when git PROVES the tree holds no visual file.
# FAIL CLOSED is the whole contract here, so most rows below are the doubt cases.
GTMP=$(mktemp -d)
gmk() { local d="$GTMP/$1"; mkdir -p "$d"; ( cd "$d" && git init -q . ) >/dev/null 2>&1; echo "$d"; }
# Feed the stop hook a payload carrying a cwd; report block/allow.
stop_cwd() {
  local payload
  payload=$(python3 -c 'import json,sys; print(json.dumps({"stop_hook_active":False,"transcript_path":"","cwd":sys.argv[1]}))' "$1")
  printf '%s' "$payload" | bash "$VSTOP" 2>/dev/null
}
chk_stop() { rm -f "$FLAG"; printf 'visual' > "$FLAG"; chk "$1" "$2" "$(blocked "$(stop_cwd "$3")")"; }

D_NONVIS=$(gmk nonvisual); printf 'x' > "$D_NONVIS/a.sh"; printf 'x' > "$D_NONVIS/b.md"; printf 'x' > "$D_NONVIS/c.pyc"
D_CLEAN=$(gmk cleanrepo)
D_STAGED=$(gmk stagedcss); printf 'a{}' > "$D_STAGED/s.css"; ( cd "$D_STAGED" && git add -A ) >/dev/null 2>&1
D_UNTR=$(gmk untracked); mkdir -p "$D_UNTR/src/brand-new"; printf 'x' > "$D_UNTR/src/brand-new/App.tsx"
D_SPACE=$(gmk spaced); printf 'a{}' > "$D_SPACE/my style.css"
D_TWIG=$(gmk twigged); printf 'x' > "$D_TWIG/page.twig"
D_NOGIT="$GTMP/notarepo"; mkdir -p "$D_NOGIT"; printf 'x' > "$D_NOGIT/a.sh"

# THE reported case: only .sh/.md/.pyc in the tree -> the screenshot demand cannot be satisfied.
chk_stop "tree holds only .sh/.md/.pyc -> allow"        "allow" "$D_NONVIS"
chk_stop "totally clean repo -> allow"                  "allow" "$D_CLEAN"
# RECALL: any real visual evidence must STILL block.
chk_stop "staged .css still BLOCKS"                     "block" "$D_STAGED"
chk_stop "UNTRACKED .tsx in a never-added dir BLOCKS"   "block" "$D_UNTR"
# PRECISION row that pins --untracked-files=all specifically. An untracked directory holding
# ONLY non-visual files must ALLOW. Without -uall git collapses it to a single "?? dir/" record,
# which the directory check below then blocks on - correct but needlessly coarse, and it would
# re-block the very sessions this fix is for. The row above still blocks either way (the .tsx is
# seen with -uall, the collapsed dir is seen by the directory check), so only this row can tell
# the two configurations apart.
D_UNTR_TS=$(gmk untracked-nonvisual); mkdir -p "$D_UNTR_TS/src/brand-new"
printf 'x' > "$D_UNTR_TS/src/brand-new/util.ts"; printf 'x' > "$D_UNTR_TS/src/brand-new/README.md"
chk_stop "untracked dir of ONLY non-visual files allows" "allow" "$D_UNTR_TS"
chk_stop "untracked .css with a SPACE in the name BLOCKS" "block" "$D_SPACE"
chk_stop "untracked .twig (exotic visual ext) BLOCKS"   "block" "$D_TWIG"
# FAIL CLOSED: every uncertainty blocks.
chk_stop "NOT a git repo BLOCKS (cannot tell)"          "block" "$D_NOGIT"
chk_stop "nonexistent cwd BLOCKS"                       "block" "$GTMP/does-not-exist"
chk_stop "empty cwd BLOCKS"                             "block" ""
# ACCEPTED RESIDUAL, asserted deliberately so it can never become a latent surprise: a visual file
# inside a GITIGNORED path is not reported by git status, so the gate allows. Surfacing it would
# need --ignored, which reports ignored DIRECTORIES (node_modules/, dist/, __pycache__/, .backups/)
# as single records that the directory check above then blocks on - measured on this repo, that is
# 6+ such dirs, so the gate would block on EVERY stop and the whole fix would be undone. Ignored
# paths are by definition build output, caches or vendored deps, not source; a visual change that
# matters is made to SOURCE, which git tracks and which still blocks. If this row ever flips,
# someone changed the ignore handling and must re-justify the trade.
D_IGN=$(gmk ignored); printf 'dist/\n' > "$D_IGN/.gitignore"; mkdir -p "$D_IGN/dist"
printf 'a{}' > "$D_IGN/dist/app.css"
chk_stop "gitignored .css allows (accepted residual)"  "allow" "$D_IGN"

# A dirty SUBMODULE surfaces as a DIRECTORY entry whose contents we cannot enumerate -> block.
D_SUBM=$(gmk submod-inner); printf 'a{}' > "$D_SUBM/s.css"
( cd "$D_SUBM" && git add -A && git -c user.email=t@t -c user.name=t commit -qm i ) >/dev/null 2>&1
D_SUPER=$(gmk submod-super)
( cd "$D_SUPER" && printf 'x' > readme.md && git add -A && git -c user.email=t@t -c user.name=t commit -qm i \
  && git -c protocol.file.allow=always -c user.email=t@t -c user.name=t submodule add -q "$D_SUBM" vendor \
  && git -c user.email=t@t -c user.name=t commit -qm sub ) >/dev/null 2>&1
printf 'b{ }' > "$D_SUPER/vendor/s.css" 2>/dev/null
if [ -f "$D_SUPER/vendor/s.css" ]; then
  chk_stop "dirty SUBMODULE holding a .css BLOCKS"      "block" "$D_SUPER"
else
  chk "submodule fixture could not be built (row not verified)" "built" "missing"
fi
# The loop guard and the flag-content gate are unaffected by corroboration.
rm -f "$FLAG"; printf 'visual' > "$FLAG"
chk "stop_hook_active still allows (loop guard)" "allow" "$(blocked "$(printf '%s' "{\"stop_hook_active\":true,\"transcript_path\":\"\",\"cwd\":\"$D_NONVIS\"}" | bash "$VSTOP" 2>/dev/null)")"
rm -f "$FLAG"; printf 'code' > "$FLAG"
chk "flag=code still allows regardless of tree" "allow" "$(blocked "$(stop_cwd "$D_STAGED")")"
rm -f "$FLAG"
chk "no flag at all still allows" "allow" "$(blocked "$(stop_cwd "$D_STAGED")")"
# The stop hook keeps its OWN copy of VISUAL_EXTS. If the arm side ever learns an extension the
# stop side does not know, a real visual change to that extension would be corroborated away and
# the gate would fail OPEN on it - a silent false negative. Assert the coupling mechanically
# rather than trusting the comment at either end.
EXT_CHECK=$(python3 - "$HOOK_DIR/verify-before-done.sh" "$HOOK_DIR/verify-before-done-stop.sh" <<'PY'
import re, sys
def grab(p):
    m = re.search(r"VISUAL_EXTS = \{(.*?)\}", open(p).read(), re.S)
    return set(re.findall(r'"([^"]+)"', m.group(1))) if m else set()
arm, stop = grab(sys.argv[1]), grab(sys.argv[2])
print("ok" if arm and stop and not (arm - stop) else "MISSING:" + ",".join(sorted(arm - stop)))
PY
)
chk "stop VISUAL_EXTS is a superset of the arm side" "ok" "$EXT_CHECK"

rm -rf "$GTMP"

echo ""
echo "============================================================"
echo "RESULTS: $PASS passed, $FAIL failed"
rm -rf "$TMP"
if [ "$FAIL" -gt 0 ]; then printf '  - %s\n' "${FAILED[@]}"; exit 1; fi
echo "All tests pass."
exit 0
