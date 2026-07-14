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
# Disable the guard's parallel-run reminder by default so the fresh-index cases
# assert the guard's steady-state (post-cutover) silence; case 5b re-enables it.
export BEATS_PARALLEL_RUN_END=1970-01-01

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
  while [ -d "$build/.compile.lock" ] && [ "$i" -lt "$cap" ]; do
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
if [ "$rc" -eq 0 ] && [ ! -e "$c2_build/beats.db" ] && [ ! -d "$c2_build/.compile.lock" ]; then
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

# === Case 5b: fresh index INSIDE the parallel-run window -> search mandate ===
# Same fresh corpus as case 5; with the window open the guard must emit the
# one-line parallel-run search reminder (valid additionalContext JSON, exit 0)
# instead of silence.
out="$(env BEATS_CORPUS="$c5_corpus" BEATS_BUILD="$c5_build" BEATS_PARALLEL_RUN_END=9999-12-31 bash "$GUARD" 2>/dev/null)"; rc=$?
if [ "$rc" -eq 0 ] && printf '%s' "$out" | grep -q "PARALLEL RUN" \
  && printf '%s' "$out" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert "beats.py search" in d["additionalContext"]' 2>/dev/null; then
  pass "case5b fresh index inside the parallel-run window emits the search mandate (exit 0)"
else
  failcase "case5b expected parallel-run mandate JSON exit 0 got rc=$rc out='$out'"
fi

# === Case 6: guard on a STALE index -> STALE line + fail-closed compile -> fresh
# (Fail-closed: the recompile is SYNCHRONOUS, so the index is fresh before the guard
# returns. wait_idle below is now a no-op but is left as a harmless belt-and-braces.)
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
  pass "case6 fail-closed compile made the index fresh (verify exit 0)"
else
  failcase "case6 index not fresh after guard-kicked compile (verify rc=$vrc :: $vout)"
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

# === Case 12: STALE -> guard compiles SYNCHRONOUSLY (fail-closed) -> fresh NOW ===
# Fail-closed means the drift is compiled BEFORE the guard returns, so the index
# is fresh immediately (NO wait_idle). The old behavior kicked a background rebuild
# and trusted the stale index in the meantime; that is what this pins shut.
c12="$(newtmp)"; c12_corpus="$c12/corpus"; c12_build="$c12/build"
make_corpus "$c12_corpus"
python3 "$BEATS_PY" compile --corpus "$c12_corpus" --build "$c12_build" >/dev/null 2>&1
printf '\nappended to drift the index\n' >> "$c12_corpus/beta.md"
out="$(env BEATS_CORPUS="$c12_corpus" BEATS_BUILD="$c12_build" bash "$GUARD" 2>/dev/null)"; rc=$?
vrc_after=0; python3 "$BEATS_PY" verify --corpus "$c12_corpus" --build "$c12_build" >/dev/null 2>&1 || vrc_after=$?
if [ "$rc" -eq 0 ] && [ "$vrc_after" -eq 0 ] && printf '%s' "$out" | grep -q "STALE"; then
  pass "case12 stale index triggers a SYNCHRONOUS compile (fresh immediately, no background wait)"
else
  failcase "case12 expected synchronous fresh index (verify 0) got rc=$rc verify=$vrc_after out='$out'"
fi

# === Case 13: STALE + a FAILING compile -> loud warning, stale index NOT trusted =
# A compile that fails (nonzero exit) must NOT install anything: the live stale
# index is left byte-for-byte intact AND the guard warns loudly that retrieval is
# unreliable. The forbidden failure mode is silently trusting stale or claiming FRESH.
c13="$(newtmp)"; c13_corpus="$c13/corpus"; c13_build="$c13/build"
make_corpus "$c13_corpus"
python3 "$BEATS_PY" compile --corpus "$c13_corpus" --build "$c13_build" >/dev/null 2>&1
printf '\nappended to drift the index\n' >> "$c13_corpus/beta.md"
out="$(env BEATS_CORPUS="$c13_corpus" BEATS_BUILD="$c13_build" BEATS_COMPILE_CMD='exit 4' bash "$GUARD" 2>/dev/null)"; rc=$?
vrc_after=0; python3 "$BEATS_PY" verify --corpus "$c13_corpus" --build "$c13_build" >/dev/null 2>&1 || vrc_after=$?
if [ "$rc" -eq 0 ] \
   && printf '%s' "$out" | grep -qi "FAILED" \
   && ! printf '%s' "$out" | grep -qi "FRESH" \
   && [ "$vrc_after" -eq 6 ]; then
  pass "case13 a failed compile warns loudly and leaves the stale index untouched (not trusted)"
else
  failcase "case13 expected loud FAILED warning + still-stale (verify 6) got rc=$rc verify=$vrc_after out='$out'"
fi

# === Case 14: STALE + dirty worktree -> guard REFUSES to auto-mutate, warns ======
# When the (tracked) index worktree is dirty, auto-compiling could clobber local
# work, so the guard must refuse and warn instead of mutating. The index is left
# stale; nothing is installed.
c14="$(newtmp)"; c14_corpus="$c14/corpus"; c14_build="$c14/build"
make_corpus "$c14_corpus"
python3 "$BEATS_PY" compile --corpus "$c14_corpus" --build "$c14_build" >/dev/null 2>&1
printf '\nappended to drift the index\n' >> "$c14_corpus/beta.md"
out="$(env BEATS_CORPUS="$c14_corpus" BEATS_BUILD="$c14_build" BEATS_GUARD_FORCE_DIRTY=1 bash "$GUARD" 2>/dev/null)"; rc=$?
vrc_after=0; python3 "$BEATS_PY" verify --corpus "$c14_corpus" --build "$c14_build" >/dev/null 2>&1 || vrc_after=$?
if [ "$rc" -eq 0 ] \
   && printf '%s' "$out" | grep -qi "REFUS" \
   && ! printf '%s' "$out" | grep -qi "FRESH" \
   && [ "$vrc_after" -eq 6 ]; then
  pass "case14 a dirty worktree is refused (no auto-mutate), warns, index left stale"
else
  failcase "case14 expected REFUSING warning + still-stale (verify 6) got rc=$rc verify=$vrc_after out='$out'"
fi

# === Case 15: another session HOLDS the compile lock -> fail-closed warn ========
# A held lock means a concurrent session is compiling this stale index. The guard
# must NOT proceed trusting stale and must NOT steal the lock (stealing has a TOCTOU
# hole). It emits the SAME loud fail-closed warning as a compile failure and leaves
# the index stale and the lock intact. The old "refreshes shortly" wording (which
# implied the stale index is safe to trust) must be gone.
c15="$(newtmp)"; c15_corpus="$c15/corpus"; c15_build="$c15/build"
make_corpus "$c15_corpus"
python3 "$BEATS_PY" compile --corpus "$c15_corpus" --build "$c15_build" >/dev/null 2>&1
printf '\ndrift the index\n' >> "$c15_corpus/beta.md"
mkdir -p "$c15_build/.compile.lock"   # simulate a concurrent compiler holding the lock
out="$(env BEATS_CORPUS="$c15_corpus" BEATS_BUILD="$c15_build" bash "$GUARD" 2>/dev/null)"; rc=$?
vrc_after=0; python3 "$BEATS_PY" verify --corpus "$c15_corpus" --build "$c15_build" >/dev/null 2>&1 || vrc_after=$?
if [ "$rc" -eq 0 ] \
   && printf '%s' "$out" | grep -qi "another session" \
   && printf '%s' "$out" | grep -qi "unreliable" \
   && ! printf '%s' "$out" | grep -qi "FRESH index" \
   && ! printf '%s' "$out" | grep -qi "refreshes shortly" \
   && [ "$vrc_after" -eq 6 ] \
   && [ -d "$c15_build/.compile.lock" ]; then
  pass "case15 a held compile lock -> fail-closed warn, stale not trusted, lock NOT stolen"
else
  failcase "case15 expected fail-closed warn + still-stale (6) + lock intact got rc=$rc verify=$vrc_after lock=$([ -d "$c15_build/.compile.lock" ] && echo intact || echo GONE) out='$out'"
fi
rmdir "$c15_build/.compile.lock" 2>/dev/null || true

# === Case 16: timeout kills the whole PROCESS GROUP (a backgrounded child dies) ==
# The compile backgrounds a child that would touch a marker AFTER the budget, then
# blocks. If the guard kills only the wrapper pid, the detached child survives and
# creates the marker; a process-GROUP kill takes it out too. The marker must be
# absent after we wait past the child's sleep.
c16="$(newtmp)"; c16_corpus="$c16/corpus"; c16_build="$c16/build"; marker16="$c16/child-survived"
make_corpus "$c16_corpus"
python3 "$BEATS_PY" compile --corpus "$c16_corpus" --build "$c16_build" >/dev/null 2>&1
printf '\ndrift the index\n' >> "$c16_corpus/beta.md"
CMD16="( sleep 3; touch '$marker16' ) & sleep 10"
t0=$(date +%s)
out="$(env BEATS_CORPUS="$c16_corpus" BEATS_BUILD="$c16_build" BEATS_COMPILE_CMD="$CMD16" BEATS_COMPILE_TIMEOUT=1 bash "$GUARD" 2>/dev/null)"; rc=$?
t1=$(date +%s); el=$((t1 - t0))
sleep 4   # wait past the backgrounded child's 3s sleep
if [ "$rc" -eq 0 ] && [ "$el" -lt 8 ] && [ ! -e "$marker16" ] && printf '%s' "$out" | grep -qi "FAILED"; then
  pass "case16 timeout kills the whole process group (backgrounded child did not survive)"
else
  failcase "case16 group-kill failed: rc=$rc elapsed=${el}s marker=$([ -e "$marker16" ] && echo SURVIVED || echo gone) out='$out'"
fi

# === Case 17: CROSS-HOOK exclusion - a held SHARED compile lock defers rebuild ===
# beats-rebuild.sh and beats-staleness-guard.sh share ONE compile lock so only one
# compiler ever runs. With the shared lock held (as if the guard were compiling), a
# rebuild enqueue must NOT start a second compile: it marks work pending (.dirty) and
# defers. The next write re-triggers it. (Direction B - the guard fail-closing when a
# rebuild holds the shared lock - is case15.)
c17="$(newtmp)"; c17_corpus="$c17/corpus"; c17_build="$c17/build"; counter17="$c17/counter"
make_corpus "$c17_corpus"; mkdir -p "$c17_build"; : > "$counter17"
mkdir -p "$c17_build/.compile.lock"     # someone else (the guard) holds the shared lock
FAKE17="printf 'x' >> '$counter17'"
post_json "$c17_corpus/alpha.md" | env BEATS_CORPUS="$c17_corpus" BEATS_BUILD="$c17_build" \
  BEATS_DEBOUNCE_SECS=0 BEATS_COMPILE_CMD="$FAKE17" bash "$REBUILD" >/dev/null 2>&1
sleep 1   # give any (wrongly) spawned runner time to compile
n="$(wc -c < "$counter17" | tr -d ' ')"
if [ "$n" = "0" ] && [ -f "$c17_build/.dirty" ]; then
  pass "case17 a held shared compile lock defers the rebuild (no concurrent compile, work marked pending)"
else
  failcase "case17 rebuild did NOT defer under a held shared lock: compiles=$n dirty=$([ -f "$c17_build/.dirty" ] && echo yes || echo no)"
fi
rmdir "$c17_build/.compile.lock" 2>/dev/null || true

# === Case 18: rebuild compiles to a TEMP dir + atomic move (db-last), like the guard
# A rebuild must never leave a half-written live index: it compiles into a temp dir and
# atomically moves beats.jsonl then beats.db into place. Verify the resulting live index
# is internally consistent (verify exit 0) after a real rebuild.
c18="$(newtmp)"; c18_corpus="$c18/corpus"; c18_build="$c18/build"
make_corpus "$c18_corpus"
post_json "$c18_corpus/alpha.md" | env BEATS_CORPUS="$c18_corpus" BEATS_BUILD="$c18_build" \
  BEATS_DEBOUNCE_SECS=0 bash "$REBUILD" >/dev/null 2>&1
wait_idle "$c18_build"
vrc=0; python3 "$BEATS_PY" verify --corpus "$c18_corpus" --build "$c18_build" >/dev/null 2>&1 || vrc=$?
if [ -e "$c18_build/beats.db" ] && [ -e "$c18_build/beats.jsonl" ] && [ "$vrc" -eq 0 ] \
   && [ ! -e "$c18_build"/.rebuild-compile.* ]; then
  pass "case18 rebuild installs an atomic, internally-consistent index (verify 0, no temp left)"
else
  failcase "case18 rebuild index not clean/consistent: db=$([ -e "$c18_build/beats.db" ] && echo yes || echo no) verify=$vrc"
fi

# === Case 19: a write DEFERRED during a guard compile is drained, not stranded ===
# A PostToolUse write that lands while the guard holds the shared lock sets .dirty but
# cannot spawn a rebuild runner (the guard has the lock). After the guard finishes and
# releases the lock it must hand that deferred work to the background rebuild, so .dirty
# is not stranded until a future write/session. We simulate the deferred write by
# pre-setting .dirty before the guard runs (the guard's compile never reads .dirty until
# its post-release drain).
c19="$(newtmp)"; c19_corpus="$c19/corpus"; c19_build="$c19/build"
make_corpus "$c19_corpus"
python3 "$BEATS_PY" compile --corpus "$c19_corpus" --build "$c19_build" >/dev/null 2>&1
printf '\ndrift the index\n' >> "$c19_corpus/beta.md"
: > "$c19_build/.dirty"          # a write deferred during the (about-to-run) guard compile
out="$(env BEATS_CORPUS="$c19_corpus" BEATS_BUILD="$c19_build" BEATS_DEBOUNCE_SECS=0 bash "$GUARD" 2>/dev/null)"; rc=$?
di=0; while [ -f "$c19_build/.dirty" ] && [ "$di" -lt 40 ]; do sleep 0.25; di=$((di + 1)); done
if [ "$rc" -eq 0 ] && [ ! -f "$c19_build/.dirty" ]; then
  pass "case19 a write deferred during the guard compile is drained by a follow-up rebuild (not stranded)"
else
  failcase "case19 deferred .dirty stranded after guard: rc=$rc dirty=$([ -f "$c19_build/.dirty" ] && echo STRANDED || echo drained) out='$out'"
fi

# --- Summary -----------------------------------------------------------------
printf '\n%d passed, %d failed\n' "$passes" "$fails"
[ "$fails" -eq 0 ] || exit 1
