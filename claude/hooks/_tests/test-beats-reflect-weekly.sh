#!/bin/bash
# Regression coverage for beats-reflect-weekly.sh
# Exercises the no-double-fire threshold gate and the timestamp contract without
# ever invoking claude: DRY_RUN previews plus an injected BEATS_REFLECT_CMD stand
# in for the real reflect run. Every case uses env overrides (MEMORY_DIR,
# TIMESTAMP_FILE, LOG_FILE) so nothing touches the real corpus or timestamp.
set -u
SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/beats-reflect-weekly.sh"
PASS=0; FAIL=0

ok()   { echo "PASS: $1"; PASS=$((PASS+1)); }
bad()  { echo "FAIL: $1"; echo "  $2"; FAIL=$((FAIL+1)); }

# Fresh sandbox per case: a corpus dir, a timestamp file, a log file.
new_sandbox() {
  SB="$(mktemp -d "${TMPDIR:-/tmp}/brw-test.XXXXXX")"
  CORPUS="$SB/.claude/memory"
  mkdir -p "$CORPUS"
  TS="$SB/last-reflect-timestamp"
  LOG="$SB/run.log"
}

# Seed N beats into the corpus, all NEWER than the timestamp (touch ts first).
seed_over_threshold() {
  local n="$1" i
  touch -t 202001010000 "$TS"          # ancient timestamp -> everything is newer
  for i in $(seq 1 "$n"); do
    printf 'x\n' > "$CORPUS/session_2026-07-0${i}_topic${i}.md" 2>/dev/null || \
    printf 'x\n' > "$CORPUS/session_beat_${i}.md"
  done
}

ts_mtime() { stat -f %m "$TS" 2>/dev/null || stat -c %Y "$TS" 2>/dev/null; }

# ---------------------------------------------------------------------------
# 1. Below threshold -> skip, exit 0, timestamp untouched.
#    Timestamp is NOW (newer than the seeded beats) so the new-count is 0.
new_sandbox
seed_over_threshold 20
touch "$TS"                            # timestamp newer than all beats -> 0 new
BEFORE="$(ts_mtime)"
OUT="$(MEMORY_DIR="$CORPUS" TIMESTAMP_FILE="$TS" LOG_FILE="$LOG" REFLECT_THRESHOLD=15 \
       bash "$SCRIPT" 2>&1)"; RC=$?
AFTER="$(ts_mtime)"
if [ "$RC" -eq 0 ] && grep -q 'skip:.*below threshold' "$LOG"; then ok "below-threshold skips"; else bad "below-threshold skips" "rc=$RC log=$(cat "$LOG")"; fi
if [ "$BEFORE" = "$AFTER" ]; then ok "below-threshold leaves timestamp untouched"; else bad "below-threshold leaves timestamp untouched" "before=$BEFORE after=$AFTER"; fi
rm -rf "$SB"

# ---------------------------------------------------------------------------
# 2. Over threshold + DRY_RUN -> "would run" preview, exit 0, timestamp untouched.
new_sandbox
seed_over_threshold 20
BEFORE="$(ts_mtime)"
OUT="$(MEMORY_DIR="$CORPUS" TIMESTAMP_FILE="$TS" LOG_FILE="$LOG" REFLECT_THRESHOLD=15 DRY_RUN=1 \
       bash "$SCRIPT" 2>&1)"; RC=$?
AFTER="$(ts_mtime)"
if [ "$RC" -eq 0 ] && printf '%s' "$OUT" | grep -q 'DRY_RUN would run:'; then ok "over-threshold DRY_RUN previews"; else bad "over-threshold DRY_RUN previews" "rc=$RC out=$OUT"; fi
if printf '%s' "$OUT" | grep -q '/reflect'; then ok "DRY_RUN preview names /reflect"; else bad "DRY_RUN preview names /reflect" "$OUT"; fi
if [ "$BEFORE" = "$AFTER" ]; then ok "DRY_RUN leaves timestamp untouched"; else bad "DRY_RUN leaves timestamp untouched" "before=$BEFORE after=$AFTER"; fi
rm -rf "$SB"

# ---------------------------------------------------------------------------
# 3. Over threshold + injected run that produces NO reflection -> exit 4,
#    timestamp untouched (the failure contract).
new_sandbox
seed_over_threshold 20
BEFORE="$(ts_mtime)"
OUT="$(MEMORY_DIR="$CORPUS" TIMESTAMP_FILE="$TS" LOG_FILE="$LOG" REFLECT_THRESHOLD=15 \
       BEATS_REFLECT_CMD='echo did-nothing' \
       bash "$SCRIPT" 2>&1)"; RC=$?
AFTER="$(ts_mtime)"
if [ "$RC" -eq 4 ]; then ok "no-reflection run exits 4"; else bad "no-reflection run exits 4" "rc=$RC log=$(cat "$LOG")"; fi
if grep -q 'produced no new reflection' "$LOG"; then ok "failure logged loudly"; else bad "failure logged loudly" "$(cat "$LOG")"; fi
if [ "$BEFORE" = "$AFTER" ]; then ok "failure leaves timestamp untouched"; else bad "failure leaves timestamp untouched" "before=$BEFORE after=$AFTER"; fi
rm -rf "$SB"

# ---------------------------------------------------------------------------
# 4. Over threshold + injected run that WRITES a reflection -> exit 0,
#    timestamp reset (mtime advances past the old ancient value).
new_sandbox
seed_over_threshold 20
BEFORE="$(ts_mtime)"
sleep 1                                # guarantee a measurable mtime bump
OUT="$(MEMORY_DIR="$CORPUS" TIMESTAMP_FILE="$TS" LOG_FILE="$LOG" REFLECT_THRESHOLD=15 \
       BEATS_REFLECT_CMD="printf 'r\n' > '$CORPUS/reflection_2026-07-06.md'" \
       bash "$SCRIPT" 2>&1)"; RC=$?
AFTER="$(ts_mtime)"
if [ "$RC" -eq 0 ] && grep -q 'success: produced reflection_2026-07-06.md' "$LOG"; then ok "success run exits 0"; else bad "success run exits 0" "rc=$RC log=$(cat "$LOG")"; fi
if [ "$AFTER" -gt "$BEFORE" ]; then ok "success resets timestamp"; else bad "success resets timestamp" "before=$BEFORE after=$AFTER"; fi
rm -rf "$SB"

# ---------------------------------------------------------------------------
# 5. First run: no timestamp file at all -> create it and skip, exit 0.
new_sandbox
seed_over_threshold 20
rm -f "$TS"                            # no timestamp exists yet
OUT="$(MEMORY_DIR="$CORPUS" TIMESTAMP_FILE="$TS" LOG_FILE="$LOG" REFLECT_THRESHOLD=15 \
       bash "$SCRIPT" 2>&1)"; RC=$?
if [ "$RC" -eq 0 ] && [ -f "$TS" ] && grep -q 'no timestamp file' "$LOG"; then ok "first-run creates timestamp and skips"; else bad "first-run creates timestamp and skips" "rc=$RC exists=$([ -f "$TS" ] && echo y || echo n) log=$(cat "$LOG")"; fi
rm -rf "$SB"

# ---------------------------------------------------------------------------
# 6. Missing memory dir -> config error, exit 2.
new_sandbox
OUT="$(MEMORY_DIR="$SB/nope/.claude/memory" TIMESTAMP_FILE="$TS" LOG_FILE="$LOG" REFLECT_THRESHOLD=15 \
       bash "$SCRIPT" 2>&1)"; RC=$?
if [ "$RC" -eq 2 ]; then ok "missing memory dir exits 2"; else bad "missing memory dir exits 2" "rc=$RC log=$(cat "$LOG" 2>/dev/null)"; fi
rm -rf "$SB"

# ---------------------------------------------------------------------------
# 7. Watchdog timeout: injected run sleeps past a 1s timeout, produces nothing
#    -> exit 5, timestamp untouched. Poll interval dropped to 1s for speed.
new_sandbox
seed_over_threshold 20
BEFORE="$(ts_mtime)"
OUT="$(MEMORY_DIR="$CORPUS" TIMESTAMP_FILE="$TS" LOG_FILE="$LOG" REFLECT_THRESHOLD=15 \
       BEATS_REFLECT_TIMEOUT_SECS=1 BEATS_REFLECT_POLL_SECS=1 BEATS_REFLECT_GRACE_SECS=1 \
       BEATS_REFLECT_CMD='sleep 30' \
       bash "$SCRIPT" 2>&1)"; RC=$?
AFTER="$(ts_mtime)"
if [ "$RC" -eq 5 ]; then ok "timeout run exits 5"; else bad "timeout run exits 5" "rc=$RC log=$(cat "$LOG")"; fi
if grep -q 'timed out' "$LOG"; then ok "timeout logged loudly"; else bad "timeout logged loudly" "$(cat "$LOG")"; fi
if [ "$BEFORE" = "$AFTER" ]; then ok "timeout leaves timestamp untouched"; else bad "timeout leaves timestamp untouched" "before=$BEFORE after=$AFTER"; fi
rm -rf "$SB"

# ---------------------------------------------------------------------------
# 8. Timeout BEATS a partial reflection: a run that writes reflection_*.md and
#    then hangs past the timeout must exit 5 (not 0) and NOT touch the timestamp.
new_sandbox
seed_over_threshold 20
BEFORE="$(ts_mtime)"
OUT="$(MEMORY_DIR="$CORPUS" TIMESTAMP_FILE="$TS" LOG_FILE="$LOG" REFLECT_THRESHOLD=15 \
       BEATS_REFLECT_TIMEOUT_SECS=1 BEATS_REFLECT_POLL_SECS=1 BEATS_REFLECT_GRACE_SECS=1 \
       BEATS_REFLECT_CMD="printf r > '$CORPUS/reflection_partial.md'; sleep 30" \
       bash "$SCRIPT" 2>&1)"; RC=$?
AFTER="$(ts_mtime)"
if [ "$RC" -eq 5 ]; then ok "timeout beats partial reflection (exit 5)"; else bad "timeout beats partial reflection (exit 5)" "rc=$RC log=$(cat "$LOG")"; fi
if [ "$BEFORE" = "$AFTER" ]; then ok "timeout-with-partial leaves timestamp untouched"; else bad "timeout-with-partial leaves timestamp untouched" "before=$BEFORE after=$AFTER"; fi
rm -rf "$SB"

# ---------------------------------------------------------------------------
# 9. Non-zero exit with a partial reflection -> exit 4, timestamp untouched.
new_sandbox
seed_over_threshold 20
BEFORE="$(ts_mtime)"
OUT="$(MEMORY_DIR="$CORPUS" TIMESTAMP_FILE="$TS" LOG_FILE="$LOG" REFLECT_THRESHOLD=15 \
       BEATS_REFLECT_CMD="printf r > '$CORPUS/reflection_nz.md'; exit 3" \
       bash "$SCRIPT" 2>&1)"; RC=$?
AFTER="$(ts_mtime)"
if [ "$RC" -eq 4 ]; then ok "non-zero exit with partial file (exit 4)"; else bad "non-zero exit with partial file (exit 4)" "rc=$RC log=$(cat "$LOG")"; fi
if grep -q 'exited non-zero' "$LOG"; then ok "non-zero exit logged loudly"; else bad "non-zero exit logged loudly" "$(cat "$LOG")"; fi
if [ "$BEFORE" = "$AFTER" ]; then ok "non-zero-exit leaves timestamp untouched"; else bad "non-zero-exit leaves timestamp untouched" "before=$BEFORE after=$AFTER"; fi
rm -rf "$SB"

# ---------------------------------------------------------------------------
# 10. Non-numeric REFLECT_THRESHOLD -> config error, exit 2.
new_sandbox
seed_over_threshold 20
OUT="$(MEMORY_DIR="$CORPUS" TIMESTAMP_FILE="$TS" LOG_FILE="$LOG" REFLECT_THRESHOLD=abc \
       bash "$SCRIPT" 2>&1)"; RC=$?
if [ "$RC" -eq 2 ] && grep -q 'REFLECT_THRESHOLD must be' "$LOG"; then ok "non-numeric threshold exits 2"; else bad "non-numeric threshold exits 2" "rc=$RC log=$(cat "$LOG")"; fi
rm -rf "$SB"

# ---------------------------------------------------------------------------
# 11. Reflection produced but the timestamp reset FAILS -> exit 6, not a silent 0.
#     The injected run writes the reflection, then removes the timestamp and makes
#     its parent dir unwritable so the final touch cannot recreate it.
new_sandbox
mkdir -p "$SB/tsdir"; TS="$SB/tsdir/ts"
seed_over_threshold 20                 # sets TS ancient, seeds newer beats
OUT="$(MEMORY_DIR="$CORPUS" TIMESTAMP_FILE="$TS" LOG_FILE="$LOG" REFLECT_THRESHOLD=15 \
       BEATS_REFLECT_CMD="printf r > '$CORPUS/reflection_ok.md'; rm -f '$TS'; chmod 000 '$SB/tsdir'" \
       bash "$SCRIPT" 2>&1)"; RC=$?
chmod -R 755 "$SB" 2>/dev/null || true
if [ "$RC" -eq 6 ] && grep -q 'FAILED to reset' "$LOG"; then ok "failed timestamp reset exits 6"; else bad "failed timestamp reset exits 6" "rc=$RC log=$(cat "$LOG")"; fi
rm -rf "$SB"

# ---------------------------------------------------------------------------
# 12. On timeout, a descendant that IGNORES SIGTERM must still be SIGKILLed by
#     the watchdog's group sweep - the wrapper must not tear the watchdog down
#     before its KILL runs. The injected run spawns a perl grandchild that traps
#     TERM and, if it survives, writes a SURVIVED marker at t+6s. With timeout=1,
#     grace=2, the group KILL lands at ~t+3s, so SURVIVED must NEVER appear.
new_sandbox
seed_over_threshold 20
DESC="$SB/desc.sh"
cat > "$DESC" <<EOF
perl -e '\$SIG{TERM}="IGNORE"; sleep 6; open F,">","$SB/SURVIVED"; print F "x"; close F;' &
sleep 30
EOF
OUT="$(MEMORY_DIR="$CORPUS" TIMESTAMP_FILE="$TS" LOG_FILE="$LOG" REFLECT_THRESHOLD=15 \
       BEATS_REFLECT_TIMEOUT_SECS=1 BEATS_REFLECT_POLL_SECS=1 BEATS_REFLECT_GRACE_SECS=2 \
       BEATS_REFLECT_CMD="bash '$DESC'" \
       bash "$SCRIPT" 2>&1)"; RC=$?
sleep 5                                # walk past the descendant's t+6s write window
if [ "$RC" -eq 5 ]; then ok "timeout with TERM-ignoring descendant exits 5"; else bad "timeout with TERM-ignoring descendant exits 5" "rc=$RC log=$(cat "$LOG")"; fi
if [ ! -f "$SB/SURVIVED" ]; then ok "TERM-ignoring descendant was group-KILLed (no survivor)"; else bad "TERM-ignoring descendant was group-KILLed (no survivor)" "SURVIVED marker exists - watchdog torn down before KILL"; fi
rm -rf "$SB"

echo ""
echo "beats-reflect-weekly: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
