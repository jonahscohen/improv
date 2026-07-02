#!/usr/bin/env bash
# Regression coverage for the stage-4/5 beats hooks:
#   claude/hooks/beats-rebuild.sh          (PostToolUse rebuild-on-write)
#   claude/hooks/beats-staleness-guard.sh  (SessionStart staleness guard)
# Both are exercised DIRECTLY (synthetic hook JSON on stdin) against temp corpus
# + temp build dirs via the BEATS_CORPUS / BEATS_BUILD env overrides, so the real
# corpus is never touched. The deterministic stub embedder makes real compiles
# hermetic and fast. Prints PASS/FAIL per case; exits non-zero if any case fails.
set -u

export BEATS_EMBED_STUB=1

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
REBUILD="$REPO_ROOT/claude/hooks/beats-rebuild.sh"
GUARD="$REPO_ROOT/claude/hooks/beats-staleness-guard.sh"
BEATS_PY="$REPO_ROOT/beats/beats.py"

fails=0
passes=0
pass() { printf 'PASS: %s\n' "$1"; passes=$((passes + 1)); }
failcase() { printf 'FAIL: %s\n' "$1"; fails=$((fails + 1)); }

TMPDIRS=()
cleanup() {
  for d in "${TMPDIRS[@]:-}"; do
    [ -n "$d" ] && rm -rf "$d"
  done
}
trap cleanup EXIT

newtmp() {
  local d
  d="$(mktemp -d)"
  TMPDIRS+=("$d")
  printf '%s\n' "$d"
}

# A minimal 2-beat corpus into $1.
make_corpus() {
  local corpus="$1"
  mkdir -p "$corpus"
  cat > "$corpus/alpha.md" <<'EOF'
---
name: Alpha beat
description: about zeppelins
type: reference
---
This beat is about zeppelin navigation.
EOF
  cat > "$corpus/beta.md" <<'EOF'
---
name: Beta beat
description: about gardening
type: project
---
Prose about gardening and weather.
EOF
}

# PostToolUse hook JSON for a Write to $1.
post_json() {
  python3 -c 'import json,sys; print(json.dumps({"tool_name":"Write","tool_input":{"file_path":sys.argv[1]}}))' "$1"
}

# Wait until the debounce lock in $1/.build clears (background runner done), or a cap.
wait_idle() {
  local build="$1" cap="${2:-40}" i=0
  while [ -d "$build/.lock" ] && [ "$i" -lt "$cap" ]; do
    sleep 0.25; i=$((i + 1))
  done
}

# === Case 1: path MATCH -> a background compile runs =========================
c1="$(newtmp)"; c1_corpus="$c1/corpus"; c1_build="$c1/build"
make_corpus "$c1_corpus"
[ -e "$c1_build/beats.db" ] && failcase "case1 precondition: db already present"
post_json "$c1_corpus/alpha.md" | \
  env BEATS_CORPUS="$c1_corpus" BEATS_BUILD="$c1_build" BEATS_DEBOUNCE_SECS=0 bash "$REBUILD"; rc=$?
if [ "$rc" -eq 0 ]; then
  pass "case1 rebuild hook returns 0 immediately on a corpus write"
else
  failcase "case1 hook expected exit 0 got $rc"
fi
wait_idle "$c1_build"
if [ -e "$c1_build/beats.db" ]; then
  pass "case1 corpus-write path-match triggered a background compile (db built)"
else
  failcase "case1 no db built after a corpus-write path-match"
fi

# === Case 2: path NO-MATCH -> no compile ====================================
c2="$(newtmp)"; c2_corpus="$c2/corpus"; c2_build="$c2/build"; c2_other="$c2/elsewhere"
make_corpus "$c2_corpus"; mkdir -p "$c2_other"
echo "some code" > "$c2_other/main.py"
post_json "$c2_other/main.py" | \
  env BEATS_CORPUS="$c2_corpus" BEATS_BUILD="$c2_build" BEATS_DEBOUNCE_SECS=0 bash "$REBUILD"; rc=$?
wait_idle "$c2_build" 8
if [ "$rc" -eq 0 ] && [ ! -e "$c2_build/beats.db" ] && [ ! -d "$c2_build/.lock" ]; then
  pass "case2 non-corpus write is ignored (no compile, no lock)"
else
  failcase "case2 expected no compile; rc=$rc db=$([ -e "$c2_build/beats.db" ] && echo yes || echo no)"
fi

# === Case 2b: a .md OUTSIDE the corpus dir is ignored =======================
c2b="$(newtmp)"; c2b_corpus="$c2b/corpus"; c2b_build="$c2b/build"; c2b_other="$c2b/notes"
make_corpus "$c2b_corpus"; mkdir -p "$c2b_other"
echo "# note" > "$c2b_other/random.md"
post_json "$c2b_other/random.md" | \
  env BEATS_CORPUS="$c2b_corpus" BEATS_BUILD="$c2b_build" BEATS_DEBOUNCE_SECS=0 bash "$REBUILD"; rc=$?
wait_idle "$c2b_build" 8
if [ "$rc" -eq 0 ] && [ ! -e "$c2b_build/beats.db" ]; then
  pass "case2b a .md outside the corpus dir does not trigger a compile"
else
  failcase "case2b expected no compile for an out-of-corpus .md; db=$([ -e "$c2b_build/beats.db" ] && echo yes || echo no)"
fi

# === Case 2c: a .md in a corpus SUBDIR is ignored (compile globs top-level only) ===
c2c="$(newtmp)"; c2c_corpus="$c2c/corpus"; c2c_build="$c2c/build"
make_corpus "$c2c_corpus"; mkdir -p "$c2c_corpus/sub"
echo "# nested" > "$c2c_corpus/sub/nested.md"
post_json "$c2c_corpus/sub/nested.md" | \
  env BEATS_CORPUS="$c2c_corpus" BEATS_BUILD="$c2c_build" BEATS_DEBOUNCE_SECS=0 bash "$REBUILD"; rc=$?
wait_idle "$c2c_build" 8
if [ "$rc" -eq 0 ] && [ ! -e "$c2c_build/beats.db" ]; then
  pass "case2c a nested-subdir .md is ignored (compile indexes only top-level *.md)"
else
  failcase "case2c expected no compile for a nested .md; db=$([ -e "$c2c_build/beats.db" ] && echo yes || echo no)"
fi

# === Case 3: debounce - two rapid fires -> exactly ONE compile ==============
c3="$(newtmp)"; c3_corpus="$c3/corpus"; c3_build="$c3/build"; counter="$c3/counter"
make_corpus "$c3_corpus"; mkdir -p "$c3_build"; : > "$counter"
# A fake compile that records one invocation and takes a moment. The 2s settle
# window guarantees both fires land before the single compile begins.
FAKECMD="printf 'x' >> '$counter'; sleep 0.3"
j="$(post_json "$c3_corpus/alpha.md")"
printf '%s' "$j" | env BEATS_CORPUS="$c3_corpus" BEATS_BUILD="$c3_build" \
  BEATS_DEBOUNCE_SECS=2 BEATS_COMPILE_CMD="$FAKECMD" bash "$REBUILD" >/dev/null 2>&1
printf '%s' "$j" | env BEATS_CORPUS="$c3_corpus" BEATS_BUILD="$c3_build" \
  BEATS_DEBOUNCE_SECS=2 BEATS_COMPILE_CMD="$FAKECMD" bash "$REBUILD" >/dev/null 2>&1
wait_idle "$c3_build" 40
n="$(wc -c < "$counter" | tr -d ' ')"
if [ "$n" = "1" ]; then
  pass "case3 two rapid fires coalesce into exactly one compile"
else
  failcase "case3 expected 1 compile, got $n"
fi

# === Case 4: hook NEVER fails - garbage / empty / no-path stdin -> exit 0 ====
c4="$(newtmp)"; c4_build="$c4/build"
printf '%s' 'this is not json at all {{{{' | \
  env BEATS_CORPUS="$c4/corpus" BEATS_BUILD="$c4_build" bash "$REBUILD"; rc=$?
[ "$rc" -eq 0 ] && pass "case4 garbage JSON -> exit 0" || failcase "case4 garbage JSON expected 0 got $rc"
printf '' | env BEATS_CORPUS="$c4/corpus" BEATS_BUILD="$c4_build" bash "$REBUILD"; rc=$?
[ "$rc" -eq 0 ] && pass "case4 empty stdin -> exit 0" || failcase "case4 empty stdin expected 0 got $rc"
printf '%s' '{"tool_input":{}}' | env BEATS_CORPUS="$c4/corpus" BEATS_BUILD="$c4_build" bash "$REBUILD"; rc=$?
[ "$rc" -eq 0 ] && pass "case4 JSON with no file_path -> exit 0" || failcase "case4 no-path expected 0 got $rc"
if [ ! -e "$c4_build/beats.db" ]; then
  pass "case4 malformed inputs never triggered a compile"
else
  failcase "case4 a malformed input wrongly triggered a compile"
fi

# === Case 5: guard on a FRESH index -> silent ({}) ==========================
c5="$(newtmp)"; c5_corpus="$c5/corpus"; c5_build="$c5/build"
make_corpus "$c5_corpus"
python3 "$BEATS_PY" compile --corpus "$c5_corpus" --build "$c5_build" >/dev/null 2>&1
out="$(env BEATS_CORPUS="$c5_corpus" BEATS_BUILD="$c5_build" bash "$GUARD" 2>/dev/null)"; rc=$?
trimmed="$(printf '%s' "$out" | tr -d '[:space:]')"
if [ "$rc" -eq 0 ] && [ "$trimmed" = "{}" ]; then
  pass "case5 guard on a fresh index is silent ({}) exit 0"
else
  failcase "case5 expected silent {} exit 0 got rc=$rc out='$out'"
fi

# === Case 6: guard on a STALE index -> STALE line + background rebuild -> fresh
c6="$(newtmp)"; c6_corpus="$c6/corpus"; c6_build="$c6/build"
make_corpus "$c6_corpus"
python3 "$BEATS_PY" compile --corpus "$c6_corpus" --build "$c6_build" >/dev/null 2>&1
printf '\nappended line to make the index stale\n' >> "$c6_corpus/beta.md"
out="$(env BEATS_CORPUS="$c6_corpus" BEATS_BUILD="$c6_build" BEATS_DEBOUNCE_SECS=0 bash "$GUARD" 2>/dev/null)"; rc=$?
if [ "$rc" -eq 0 ] && printf '%s' "$out" | grep -q "STALE"; then
  pass "case6 guard flags a stale index with a STALE context line (exit 0)"
else
  failcase "case6 expected STALE line exit 0 got rc=$rc out='$out'"
fi
if printf '%s' "$out" | grep -qE '[0-9]+ added, [0-9]+ removed, [0-9]+ changed'; then
  pass "case6 STALE line carries the added/removed/changed detail"
else
  failcase "case6 STALE line missing the change detail :: $out"
fi
wait_idle "$c6_build"
vout="$(python3 "$BEATS_PY" verify --corpus "$c6_corpus" --build "$c6_build" 2>&1)"; vrc=$?
if [ "$vrc" -eq 0 ]; then
  pass "case6 background rebuild made the index fresh (verify exit 0)"
else
  failcase "case6 index not fresh after guard-kicked rebuild (verify rc=$vrc :: $vout)"
fi

# === Case 7: guard on a BROKEN db -> loud line, no rebuild, exit 0 ===========
c7="$(newtmp)"; c7_corpus="$c7/corpus"; c7_build="$c7/build"
make_corpus "$c7_corpus"
python3 "$BEATS_PY" compile --corpus "$c7_corpus" --build "$c7_build" >/dev/null 2>&1
printf 'not a sqlite database' > "$c7_build/beats.db"
out="$(env BEATS_CORPUS="$c7_corpus" BEATS_BUILD="$c7_build" bash "$GUARD" 2>/dev/null)"; rc=$?
if [ "$rc" -eq 0 ] && printf '%s' "$out" | grep -q "BROKEN"; then
  pass "case7 guard on a broken db emits a LOUD broken line (exit 0)"
else
  failcase "case7 expected BROKEN line exit 0 got rc=$rc out='$out'"
fi

# === Case 8: guard with a MISSING corpus dir -> loud (exit 2 class), exit 0 ==
c8="$(newtmp)"; c8_build="$c8/build"; mkdir -p "$c8_build"
make_corpus "$c8/realcorpus"
python3 "$BEATS_PY" compile --corpus "$c8/realcorpus" --build "$c8_build" >/dev/null 2>&1
out="$(env BEATS_CORPUS="$c8/does-not-exist" BEATS_BUILD="$c8_build" bash "$GUARD" 2>/dev/null)"; rc=$?
if [ "$rc" -eq 0 ] && printf '%s' "$out" | grep -q "MISSING"; then
  pass "case8 guard with a missing corpus dir emits a loud line (exit 0)"
else
  failcase "case8 expected MISSING line exit 0 got rc=$rc out='$out'"
fi

# === Case 9: guard never fails even with no beats.py reachable ==============
# Point BEATS_PY at a bogus path via a wrapper env; the guard must stay silent
# and exit 0 rather than erroring the session start.
c9="$(newtmp)"; c9_build="$c9/build"; mkdir -p "$c9_build"
out="$(env BEATS_PY="$c9/nope/beats.py" BEATS_CORPUS="$c9/corpus" BEATS_BUILD="$c9_build" bash "$GUARD" 2>/dev/null)"; rc=$?
trimmed="$(printf '%s' "$out" | tr -d '[:space:]')"
if [ "$rc" -eq 0 ] && [ "$trimmed" = "{}" ]; then
  pass "case9 guard with an unreachable beats.py stays silent, exit 0"
else
  failcase "case9 expected silent exit 0 got rc=$rc out='$out'"
fi

# === Case 10: guard with a garbage BEATS_VERIFY_TIMEOUT still exits 0 ========
# A non-integer timeout must be sanitized so arithmetic under set -u cannot abort
# the guard before its final exit 0 (the session must never be failed).
c10="$(newtmp)"; c10_corpus="$c10/corpus"; c10_build="$c10/build"
make_corpus "$c10_corpus"
python3 "$BEATS_PY" compile --corpus "$c10_corpus" --build "$c10_build" >/dev/null 2>&1
out="$(env BEATS_CORPUS="$c10_corpus" BEATS_BUILD="$c10_build" BEATS_VERIFY_TIMEOUT="not-a-number" bash "$GUARD" 2>/dev/null)"; rc=$?
trimmed="$(printf '%s' "$out" | tr -d '[:space:]')"
if [ "$rc" -eq 0 ] && [ "$trimmed" = "{}" ]; then
  pass "case10 guard with a non-integer timeout is sanitized, stays silent, exit 0"
else
  failcase "case10 expected silent exit 0 with garbage timeout got rc=$rc out='$out'"
fi

# === Case 11: a HUNG verify is bounded by the timeout (+ clamp) -> silent, 0 ==
# A fake beats.py that hangs on `verify` must not block the session: the guard's
# timeout fires and it returns silently. Also proves the max-clamp: a huge
# BEATS_VERIFY_TIMEOUT is clamped down by BEATS_VERIFY_TIMEOUT_MAX.
c11="$(newtmp)"; mkdir -p "$c11/build"
cat > "$c11/fakebeats.py" <<'PY'
import sys, time
if len(sys.argv) > 1 and sys.argv[1] == "verify":
    time.sleep(600)
sys.exit(0)
PY
t0=$(date +%s)
out="$(env BEATS_PY="$c11/fakebeats.py" BEATS_CORPUS="$c11/corpus" BEATS_BUILD="$c11/build" \
  BEATS_VERIFY_TIMEOUT=2 bash "$GUARD" 2>/dev/null)"; rc=$?
t1=$(date +%s); el=$((t1 - t0))
trimmed="$(printf '%s' "$out" | tr -d '[:space:]')"
if [ "$rc" -eq 0 ] && [ "$trimmed" = "{}" ] && [ "$el" -lt 15 ]; then
  pass "case11 a hung verify is bounded by the timeout (${el}s), guard stays silent exit 0"
else
  failcase "case11 hung verify not bounded: rc=$rc elapsed=${el}s out='$out'"
fi
t0=$(date +%s)
out="$(env BEATS_PY="$c11/fakebeats.py" BEATS_CORPUS="$c11/corpus" BEATS_BUILD="$c11/build" \
  BEATS_VERIFY_TIMEOUT=999999 BEATS_VERIFY_TIMEOUT_MAX=2 bash "$GUARD" 2>/dev/null)"; rc=$?
t1=$(date +%s); el=$((t1 - t0))
if [ "$rc" -eq 0 ] && [ "$el" -lt 15 ]; then
  pass "case11 a huge timeout is clamped by BEATS_VERIFY_TIMEOUT_MAX (bounded ${el}s)"
else
  failcase "case11 huge timeout not clamped: rc=$rc elapsed=${el}s"
fi

# --- Summary -----------------------------------------------------------------
printf '\n%d passed, %d failed\n' "$passes" "$fails"
[ "$fails" -eq 0 ] || exit 1
