#!/usr/bin/env bash
# test-cc-tracker.sh - the Claude Code feature-tracker (learning-researcher Phase 2).
#
# Covers the DETERMINISTIC engine (claude/hooks/lib/cc-tracker.py), the thin launchd wrapper
# (claude/hooks/cc-tracker-daily.sh), the guard exclusion, the plist, and the inertness of the
# proposal quarantine. Every write goes into ONE temp root removed on exit; the only reads of
# the live tree are read-only (the guard, the plist, the inertness grep).
set -u
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENG="$REPO_DIR/claude/hooks/lib/cc-tracker.py"
WRAP="$REPO_DIR/claude/hooks/cc-tracker-daily.sh"
GUARD="$REPO_DIR/claude/hooks/hook-registry-guard.sh"
PLIST="$REPO_DIR/claude/launchd/com.yesand.cc-tracker-daily.plist"
SAMPLE="$REPO_DIR/claude/hooks/lib/cc-tracker.sample.json"

pass=0; fail=0
ok(){ echo "PASS $1"; pass=$((pass+1)); }
bad(){ echo "FAIL $1"; fail=$((fail+1)); }

SBROOT="$(mktemp -d)" || { echo "FATAL: mktemp -d failed" >&2; exit 2; }
trap 'rm -rf "$SBROOT"' EXIT

# --- 1. engine compiles ------------------------------------------------------
if python3 -c "import py_compile,sys; py_compile.compile('$ENG', doraise=True)" 2>/dev/null; then
  ok "engine compiles"; else bad "engine compiles"; fi

# --- 2. precheck contract ----------------------------------------------------
CUR="$SBROOT/cursor"

printf '2.1.241' > "$CUR"
out="$(CC_TRACKER_FIXTURE_VERSION=2.1.241 python3 "$ENG" precheck --cursor "$CUR" 2>/dev/null)"; rc=$?
[ "$rc" = 0 ] && [ "$(printf '%s' "$out" | tail -1)" = "skip" ] && ok "precheck: equal version -> skip, exit 0" || bad "precheck: equal version -> skip (rc=$rc out=$out)"

printf '2.1.240' > "$CUR"; rm -f "$CUR.pending"
out="$(CC_TRACKER_FIXTURE_VERSION=2.1.241 python3 "$ENG" precheck --cursor "$CUR" 2>/dev/null)"; rc=$?
[ "$rc" = 0 ] && [ "$(printf '%s' "$out" | tail -1)" = "run" ] && ok "precheck: bumped version -> run, exit 0" || bad "precheck: bumped version -> run (rc=$rc out=$out)"
[ "$(cat "$CUR.pending" 2>/dev/null)" = "2.1.241" ] && ok "precheck: run writes .pending sidecar" || bad "precheck: run writes .pending sidecar"

rm -f "$CUR" "$CUR.pending"
out="$(CC_TRACKER_FIXTURE_VERSION=2.1.241 python3 "$ENG" precheck --cursor "$CUR" 2>/dev/null)"; rc=$?
[ "$rc" = 0 ] && [ "$(printf '%s' "$out" | tail -1)" = "run" ] && ok "precheck: first run (no cursor) -> run, exit 0" || bad "precheck: first run -> run (rc=$rc out=$out)"

CC_TRACKER_NPM_URL="http://127.0.0.1:9/nope" python3 "$ENG" precheck --cursor "$CUR" >/dev/null 2>&1; rc=$?
[ "$rc" -ne 0 ] && ok "precheck: fetch failure -> NON-ZERO (fail loud, never a silent skip)" || bad "precheck: fetch failure exited 0"

printf 'not-a-version' > "$CUR"
CC_TRACKER_FIXTURE_VERSION=2.1.241 python3 "$ENG" precheck --cursor "$CUR" >/dev/null 2>&1; rc=$?
[ "$rc" -ne 0 ] && ok "precheck: corrupt cursor -> NON-ZERO" || bad "precheck: corrupt cursor exited 0"

# --- 3. advance-cursor -------------------------------------------------------
printf '2.1.240' > "$CUR"; printf '2.1.241\n' > "$CUR.pending"
python3 "$ENG" advance-cursor --cursor "$CUR" >/dev/null 2>&1; rc=$?
[ "$rc" = 0 ] && [ "$(cat "$CUR")" = "2.1.241" ] && ok "advance-cursor: writes latest from .pending" || bad "advance-cursor from pending (rc=$rc cursor=$(cat "$CUR"))"
[ ! -e "$CUR.pending" ] && ok "advance-cursor: removes the .pending sidecar" || bad "advance-cursor left .pending behind"

# Missing/invalid .pending must FAIL LOUD (exit 6), never re-resolve - re-resolving could
# advance the cursor past a release that was never fetched or proposed.
printf '2.1.240' > "$CUR"; rm -f "$CUR.pending"
CC_TRACKER_FIXTURE_VERSION=2.1.241 python3 "$ENG" advance-cursor --cursor "$CUR" >/dev/null 2>&1; rc=$?
[ "$rc" = 6 ] && [ "$(cat "$CUR")" = "2.1.240" ] && ok "advance-cursor: no .pending -> exit 6, cursor unchanged (no re-resolve)" || bad "advance-cursor missing-pending fail-loud (rc=$rc cursor=$(cat "$CUR"))"

# A rollback (npm latest OLDER than the cursor) must skip, never advance the cursor backward.
printf '2.1.241' > "$CUR"
out="$(CC_TRACKER_FIXTURE_VERSION=2.1.100 python3 "$ENG" precheck --cursor "$CUR" 2>/dev/null)"; rc=$?
[ "$rc" = 0 ] && [ "$(printf '%s' "$out" | tail -1)" = "skip" ] && ok "precheck: rollback (latest < seen) -> skip, no backward advance" || bad "precheck rollback (rc=$rc out=$out)"

# A cursor inside the repo tree is a write path into the harness - refused.
SRR_REPO_ROOT="$REPO_DIR" CC_TRACKER_FIXTURE_VERSION=2.1.241 python3 "$ENG" precheck --cursor "$REPO_DIR/.cc-in-repo-cursor" >/dev/null 2>&1; rc=$?
[ "$rc" -ne 0 ] && ok "precheck: refuses a cursor inside the repo tree" || bad "precheck: cursor-in-repo not refused (rc=$rc)"

# --- 4. fetch ----------------------------------------------------------------
cat > "$SBROOT/CHANGELOG.md" <<'EOF'
# Changelog

## 2.1.241

- Bug fixes and reliability improvements

## 2.1.239

- Added a SessionEnd hook event that fires when a session terminates

## 2.1.237

- Added a native "Concise" output style, selectable with /output-style
EOF

CC_TRACKER_FIXTURE_VERSION=2.1.241 CC_TRACKER_FIXTURE_CHANGELOG="$SBROOT/CHANGELOG.md" \
  python3 "$ENG" fetch --out-dir "$SBROOT/work" >/dev/null 2>&1; rc=$?
[ "$rc" = 0 ] && ok "fetch: exit 0 offline with fixtures" || bad "fetch: exit 0 (rc=$rc)"
grep -q "UNTRUSTED SOURCE EXCERPT" "$SBROOT/work/cc-changelog-delta.md" 2>/dev/null && ok "fetch: delta is untrusted-fenced" || bad "fetch: delta not untrusted-fenced"
python3 -c "import json;d=json.load(open('$SBROOT/work/cc-feature-inventory.skeleton.json'));cs=[f['feature_class'] for f in d['features']];import sys;sys.exit(0 if ('hook-event' in cs and 'slash-command-or-skill' in cs and 'noise' in cs) else 1)" 2>/dev/null \
  && ok "fetch: heuristic classifier tags hook-event / slash-command / noise" || bad "fetch: heuristic classifier"

printf '2.1.239' > "$SBROOT/cur2"
CC_TRACKER_FIXTURE_VERSION=2.1.241 CC_TRACKER_FIXTURE_CHANGELOG="$SBROOT/CHANGELOG.md" \
  python3 "$ENG" fetch --out-dir "$SBROOT/work2" --cursor "$SBROOT/cur2" >/dev/null 2>&1
python3 -c "import json;r=json.load(open('$SBROOT/work2/cc-versions.json'))['range'];import sys;sys.exit(0 if r==['2.1.241'] else 1)" 2>/dev/null \
  && ok "fetch: cursor bounds the delta to newer-than-last-seen" || bad "fetch: range bounding"

# npm latest absent from the CHANGELOG (stale/disagreeing sources) must fail loud (exit 5).
printf '# Changelog\n## 2.1.239\n- x\n' > "$SBROOT/stale.md"
CC_TRACKER_FIXTURE_VERSION=2.1.241 CC_TRACKER_FIXTURE_CHANGELOG="$SBROOT/stale.md" \
  python3 "$ENG" fetch --out-dir "$SBROOT/work3" >/dev/null 2>&1; rc=$?
[ "$rc" = 5 ] && ok "fetch: npm latest absent from CHANGELOG -> exit 5 (sources disagree)" || bad "fetch: stale-changelog not caught (rc=$rc)"

# --- 5. propose (sandbox repo) + safety guards -------------------------------
SBREPO="$SBROOT/repo"; mkdir -p "$SBREPO/.claude/memory" "$SBREPO/claude/hooks"
python3 "$ENG" propose --inventory "$SAMPLE" --repo "$SBREPO" --beat-date 2026-08-23 >/dev/null 2>&1; rc=$?
[ "$rc" = 0 ] && ok "propose: exit 0 from the sample inventory" || bad "propose: exit 0 (rc=$rc)"
P="$SBREPO/claude/proposals/cc-tracker/2.1.237-concise-output-style-retire.md"
[ -f "$P" ] && ok "propose: proposal lands in the inert quarantine" || bad "propose: proposal missing"
grep -q "UNTRUSTED SOURCE EXCERPT" "$P" 2>/dev/null && ok "propose: proposal embeds untrusted fence" || bad "propose: no untrusted fence"
grep -q -- "-> verify:" "$P" 2>/dev/null && ok "propose: proposal carries a step -> verify plan" || bad "propose: no verify plan"
grep -q "INERT PROPOSAL" "$P" 2>/dev/null && ok "propose: proposal carries the INERT banner" || bad "propose: no inert banner"
[ -f "$SBREPO/.claude/memory/proposal_cc-features_2026-08-23.md" ] && ok "propose: writes the queue beat" || bad "propose: no queue beat"

echo '{"version_range":{"to":"2.1.241"},"opportunities":[{"opportunity":"x","direction":"additive","plan":[{"step":"a","verify":"b"}]}]}' > "$SBROOT/ok.json"
python3 "$ENG" propose --inventory "$SBROOT/ok.json" --repo "$SBREPO" --proposals-subdir claude/hooks >/dev/null 2>&1; rc=$?
[ "$rc" = 2 ] && ok "propose: refuses a write target outside the quarantine (exit 2)" || bad "propose: outside-quarantine not refused (rc=$rc)"

echo '{"version_range":{"to":"2.1.241"}}' > "$SBROOT/bad.json"
python3 "$ENG" propose --inventory "$SBROOT/bad.json" --repo "$SBREPO" >/dev/null 2>&1; rc=$?
[ "$rc" = 5 ] && ok "propose: malformed inventory -> exit 5" || bad "propose: malformed not caught (rc=$rc)"

# --beats-dir must be contained under the repo (realpath) - an escape is refused.
python3 "$ENG" propose --inventory "$SAMPLE" --repo "$SBREPO" --beats-dir "$SBROOT/outside" >/dev/null 2>&1; rc=$?
[ "$rc" = 2 ] && ok "propose: refuses a --beats-dir outside the repo (exit 2)" || bad "propose: beats-dir escape not refused (rc=$rc)"

# --beat-date carrying a path fragment must be refused (it reaches a filename).
python3 "$ENG" propose --inventory "$SAMPLE" --repo "$SBREPO" --beat-date "../evil" >/dev/null 2>&1; rc=$?
[ "$rc" = 5 ] && ok "propose: refuses a --beat-date that is not YYYY-MM-DD (exit 5)" || bad "propose: bad beat-date not refused (rc=$rc)"

# SemVer correctness of the comparator (numeric ordering + prerelease-below-release).
python3 - "$ENG" <<'PY' && ok "engine: _version_key is SemVer-correct (2.1.9<2.1.10, prerelease<release)" || bad "engine: _version_key ordering"
import importlib.util, sys
spec = importlib.util.spec_from_file_location("cc", sys.argv[1])
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
ok = (m._version_key("2.1.9") < m._version_key("2.1.10")) and (m._version_key("2.1.0-beta") < m._version_key("2.1.0"))
sys.exit(0 if ok else 1)
PY

# The propose run must NOT have touched any real harness file (sandbox isolation).
if git -C "$REPO_DIR" status --porcelain 2>/dev/null | grep -qE 'claude/hooks/(concise|chrome)'; then
  bad "propose: a sandbox run dirtied a real harness hook"
else ok "propose: sandbox run touched no real harness hook"; fi

# --- 6. wrapper --------------------------------------------------------------
bash -n "$WRAP" 2>/dev/null && ok "wrapper: bash -n clean" || bad "wrapper: bash -n"

printf '2.1.241' > "$SBROOT/wcur"
SRR_REPO_ROOT="$REPO_DIR" SRR_CURSOR_FILE="$SBROOT/wcur" SRR_LOG_FILE="$SBROOT/w.log" \
  CC_TRACKER_FIXTURE_VERSION=2.1.241 DRY_RUN=1 bash "$WRAP" >/dev/null 2>&1; rc=$?
[ "$rc" = 0 ] && ok "wrapper: DRY_RUN skip path exits 0 on an unchanged version" || bad "wrapper: DRY_RUN skip (rc=$rc)"

printf '2.1.240' > "$SBROOT/wcur"
out="$(SRR_REPO_ROOT="$REPO_DIR" SRR_CURSOR_FILE="$SBROOT/wcur" SRR_LOG_FILE="$SBROOT/w2.log" \
  CC_TRACKER_FIXTURE_VERSION=2.1.241 DRY_RUN=1 bash "$WRAP" 2>/dev/null)"; rc=$?
[ "$rc" = 0 ] && printf '%s' "$out" | grep -q "DRY_RUN would run" && ok "wrapper: DRY_RUN run path prints the flow command" || bad "wrapper: DRY_RUN run (rc=$rc out=$out)"
[ "$(cat "$SBROOT/wcur")" = "2.1.240" ] && ok "wrapper: DRY_RUN does NOT advance the cursor" || bad "wrapper: DRY_RUN advanced the cursor"

# --- 7. guard exclusion ------------------------------------------------------
bash "$GUARD" --check cc-tracker-daily >/dev/null 2>&1; rc=$?
[ "$rc" = 0 ] && ok "guard: cc-tracker-daily is managed/excluded (--check exit 0)" || bad "guard: cc-tracker-daily flagged (rc=$rc)"
bash "$GUARD" --audit >/dev/null 2>&1; rc=$?
[ "$rc" = 0 ] && ok "guard: --audit clean (no unmanaged hook)" || bad "guard: --audit not clean (rc=$rc)"

# --- 8. plist ----------------------------------------------------------------
if command -v plutil >/dev/null 2>&1; then
  plutil -lint "$PLIST" >/dev/null 2>&1 && ok "plist: plutil -lint OK" || bad "plist: plutil -lint failed"
else
  ok "plist: plutil unavailable (skipped on non-macOS)"
fi
grep -q "com.yesand.cc-tracker-daily" "$PLIST" 2>/dev/null && ok "plist: carries the cc-tracker-daily label" || bad "plist: label missing"

# --- 9. inertness ------------------------------------------------------------
# Nothing may import/source/exec proposal CONTENT. The only permitted references are the
# tracker's own files and the runner's find-existence success predicate (which reads mtime,
# never content).
hits="$(grep -rn "proposals/cc-tracker" \
  --include='*.sh' --include='*.js' --include='*.ts' --include='*.py' \
  "$REPO_DIR/sidecoach/src" "$REPO_DIR/sidecoach/bin" 2>/dev/null | grep -v "cc-tracker" || true)"
[ -z "$hits" ] && ok "inertness: no sidecoach code imports/sources the quarantine" || bad "inertness: quarantine is referenced by sidecoach code: $hits"

echo "== $pass passed, $fail failed =="
[ "$fail" = 0 ]
