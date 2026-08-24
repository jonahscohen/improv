#!/usr/bin/env bash
# test-sidecoach-mine.sh - the scheduling contract for the taste miner (the third adapter on the
# shared learning-researcher spine). Covers the precheck run/skip gate, advance cursor, fail-loud
# on a missing cursor, cursor payload shape, and the sidecoach-mine-daily.sh wrapper (syntax +
# DRY_RUN runs the gate and prints the flow WITHOUT invoking claude or advancing the cursor).
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MINE="$REPO_ROOT/sidecoach/bin/sidecoach-mine.js"
WRAPPER="$REPO_ROOT/claude/hooks/sidecoach-mine-daily.sh"
PLIST="$REPO_ROOT/claude/launchd/com.yesand.sidecoach-mine-daily.plist"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "PASS $1"; }
bad() { FAIL=$((FAIL+1)); echo "FAIL $1"; }

SB="$(mktemp -d)"; trap 'rm -rf "$SB"' EXIT
CUR="$SB/cursor.json"

# --- precheck: fresh (no cursor) -> "run", exit 0 -----------------------------------------
out="$(node "$MINE" precheck --cursor "$CUR" 2>/dev/null)"; rc=$?
{ [ "$rc" = 0 ] && [ "$out" = "run" ]; } && ok "precheck: no cursor -> run (exit 0)" || bad "precheck no-cursor (rc=$rc out=$out)"

# --- advance -> writes a cursor, exit 0 ---------------------------------------------------
node "$MINE" advance --cursor "$CUR" >/dev/null 2>&1; rc=$?
{ [ "$rc" = 0 ] && [ -f "$CUR" ]; } && ok "advance: writes cursor (exit 0)" || bad "advance (rc=$rc)"

# --- cursor payload shape: schema + 64-hex sig -------------------------------------------
python3 - "$CUR" <<'PY' && ok "cursor: schema + 64-hex sig + stats present" || bad "cursor payload shape"
import json,re,sys
d=json.load(open(sys.argv[1]))
assert d.get("schema")=="sidecoach-mine-cursor/v1", d.get("schema")
assert re.fullmatch(r"[0-9a-f]{64}", d.get("sig","")), "sig not 64-hex"
assert "stats" in d and "advanced_utc" in d
PY

# --- precheck after advance -> "skip", exit 0 (signature is stable across runs) -----------
out="$(node "$MINE" precheck --cursor "$CUR" 2>/dev/null)"; rc=$?
{ [ "$rc" = 0 ] && [ "$out" = "skip" ]; } && ok "precheck: after advance -> skip (deterministic sig)" || bad "precheck post-advance (rc=$rc out=$out)"

# --- precheck with a mismatched cursor -> "run" ------------------------------------------
echo '{"schema":"sidecoach-mine-cursor/v1","sig":"deadbeef"}' > "$SB/stale.json"
out="$(node "$MINE" precheck --cursor "$SB/stale.json" 2>/dev/null)"
[ "$out" = "run" ] && ok "precheck: stale sig -> run" || bad "precheck stale (out=$out)"

# --- fail loud: precheck/advance require --cursor (nonzero, NO run/skip on stdout) --------
out="$(node "$MINE" precheck 2>/dev/null)"; rc=$?
{ [ "$rc" != 0 ] && [ -z "$out" ]; } && ok "precheck: missing --cursor fails loud (nonzero, no decision)" || bad "precheck missing-cursor (rc=$rc out=$out)"
node "$MINE" advance >/dev/null 2>&1; rc=$?
[ "$rc" != 0 ] && ok "advance: missing --cursor fails loud (nonzero)" || bad "advance missing-cursor (rc=$rc)"

# --- precheck: a CORRUPT cursor fails loud (not a clean "run" that hides corruption) ------
printf '{bad json' > "$SB/corrupt.json"
out="$(node "$MINE" precheck --cursor "$SB/corrupt.json" 2>/dev/null)"; rc=$?
{ [ "$rc" != 0 ] && [ -z "$out" ]; } && ok "precheck: corrupt cursor fails loud (nonzero, no decision)" || bad "precheck corrupt (rc=$rc out=$out)"
printf '{}' > "$SB/nosig.json"
out="$(node "$MINE" precheck --cursor "$SB/nosig.json" 2>/dev/null)"; rc=$?
{ [ "$rc" != 0 ] && [ -z "$out" ]; } && ok "precheck: cursor missing sig fails loud" || bad "precheck no-sig (rc=$rc out=$out)"

# --- advance: refuses a cursor path INSIDE the repo (a hostile --cursor override) ---------
node "$MINE" advance --cursor "$REPO_ROOT/sidecoach/data/evil.json" >/dev/null 2>&1; rc=$?
{ [ "$rc" != 0 ] && [ ! -f "$REPO_ROOT/sidecoach/data/evil.json" ]; } && ok "advance: refuses an in-repo cursor path (no write)" || bad "advance in-repo cursor (rc=$rc)"

# --- advance: refuses an out-of-repo cursor that is a SYMLINK pointing back into the repo --
ln -s "$REPO_ROOT/sidecoach/data/evil-symlink.json" "$SB/symcursor.json"
node "$MINE" advance --cursor "$SB/symcursor.json" >/dev/null 2>&1; rc=$?
{ [ "$rc" != 0 ] && [ ! -e "$REPO_ROOT/sidecoach/data/evil-symlink.json" ]; } && ok "advance: refuses a symlink-into-repo cursor (realResolve + O_NOFOLLOW, no repo write)" || bad "advance symlink-into-repo (rc=$rc, wrote=$([ -e "$REPO_ROOT/sidecoach/data/evil-symlink.json" ] && echo Y || echo n))"
rm -f "$REPO_ROOT/sidecoach/data/evil-symlink.json" 2>/dev/null

# --- wrapper arms the propose-only fence with the miner's inert roots ---------------------
grep -q "SRR_ALLOWED_WRITE_ROOTS='sidecoach/data/proposed-rules sidecoach/data/taste-candidates.json .claude/memory'" "$WRAPPER" \
  && ok "wrapper: arms SRR_ALLOWED_WRITE_ROOTS (propose-only fence)" || bad "wrapper missing SRR_ALLOWED_WRITE_ROOTS"

# --- wrapper: syntax + it exports the miner SRR_* params ----------------------------------
bash -n "$WRAPPER" && ok "wrapper: bash -n clean" || bad "wrapper bash -n"
grep -q 'SRR_JOB_NAME="sidecoach-mine-daily"' "$WRAPPER" && ok "wrapper: SRR_JOB_NAME set" || bad "wrapper SRR_JOB_NAME"
grep -q 'sidecoach-mine.js" precheck' "$WRAPPER" && grep -q 'sidecoach-mine.js" advance' "$WRAPPER" && ok "wrapper: precheck+advance wired to the engine" || bad "wrapper precheck/advance wiring"

# --- wrapper DRY_RUN: runs the gate + prints the flow, NEVER invokes claude or advances ----
DCUR="$SB/dry-cursor.json"
out="$(DRY_RUN=1 SRR_CURSOR_FILE="$DCUR" bash "$WRAPPER" 2>&1)"; rc=$?
{ [ "$rc" = 0 ] && printf '%s' "$out" | grep -q 'DRY_RUN would run' && [ ! -f "$DCUR" ]; } \
  && ok "wrapper DRY_RUN: prints flow, does not invoke claude or advance the cursor" || bad "wrapper DRY_RUN (rc=$rc cursor_exists=$([ -f "$DCUR" ] && echo y || echo n))"

# --- plist: valid + label + points at the wrapper ----------------------------------------
if command -v plutil >/dev/null 2>&1; then
  plutil -lint "$PLIST" >/dev/null 2>&1 && ok "plist: plutil -lint OK" || bad "plist lint"
fi
grep -q '<string>com.yesand.sidecoach-mine-daily</string>' "$PLIST" && grep -q 'sidecoach-mine-daily.sh</string>' "$PLIST" \
  && ok "plist: label + ProgramArguments point at the wrapper" || bad "plist label/args"

# --- inertness: the engine never imports/writes a live store (structural, mirrors the miner proof)
grep -q "sidecoach-mine-daily) return 0" "$REPO_ROOT/claude/hooks/hook-registry-guard.sh" \
  && ok "wrapper: exempted in hook-registry-guard (launchd-scheduled, not an event hook)" || bad "wrapper not exempted in hook-registry-guard"

echo "== $PASS passed, $FAIL failed =="
[ "$FAIL" = 0 ]
