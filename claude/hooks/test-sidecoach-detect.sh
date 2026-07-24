#!/bin/bash
# Regression coverage for sidecoach-detect.sh (Stage 3b advisory scanner hook).
# Run after editing the hook to confirm the honest-count / permissive-decision contract:
#
#   findings      (CLI exit 1) -> hook exit 0, advisory context naming the finding
#   clean         (CLI exit 0) -> hook exit 0, silent {}
#   inconclusive  (CLI exit 3) -> hook exit 0, a NOT-CLEAN warning (never {}, never a block)
#   infra error   (CLI exit 2) -> hook exit 0, a NOT-CLEAN warning
#   non-UI edit                -> hook exit 0, silent {} (CLI never invoked)
#
# Every case asserts the hook exits 0 (fail-open decision) AND that an inconclusive /
# infra result is DISTINGUISHED from the clean {} - the exact bug the removed fake hook
# had (reporting "could not scan" as clean) is what these assertions exist to catch.
#
# Two tiers:
#   STUB tier (always runs, no engine): a tiny node stub stands in for the CLI via
#     SIDECOACH_DETECT_CLI and emits each documented exit code, so the hook's translation
#     is covered deterministically and fast on any machine, built or not.
#   LIVE tier (runs when sidecoach/dist is built): drives the REAL CLI over the real
#     fixtures and an unroutable URL, proving the CLI genuinely emits those codes and the
#     hook translates them end to end. Skips loudly (not a fail) when the engine is unbuilt.
set -u

# Resolve our own path through any symlink (parity with the hook's realpath resolution),
# so running the test via a ~/.claude/hooks symlink still finds the repo CLI + fixtures.
SELF="$(python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$0")"
HERE="$(cd "$(dirname "$SELF")" && pwd)"
HOOK="$HERE/sidecoach-detect.sh"
CLI="$(cd "$HERE/../.." && pwd)/sidecoach/bin/sidecoach-detect.js"
DEFECT_FIXTURE="$(cd "$HERE/../.." && pwd)/sidecoach/eval/fixtures/known-defect/gradient-text.html"
CLEAN_FIXTURE="$(cd "$HERE/../.." && pwd)/sidecoach/eval/fixtures/known-good/clean-page.html"

PASS=0
FAIL=0
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# --- runners: set OUT (hook stdout) and CODE (hook exit). ---
# $? after `OUT=$(pipe)` is the exit of the pipe's last command = the hook. No pipefail,
# so the printf never masks it.
run() {        # run <file_path>
  OUT="$(printf '{"tool_name":"Write","tool_input":{"file_path":"%s"}}' "$1" | bash "$HOOK")"
  CODE=$?
}
run_cli() {    # run_cli <cli_path> <file_path>   (override the CLI the hook resolves)
  OUT="$(printf '{"tool_name":"Write","tool_input":{"file_path":"%s"}}' "$2" \
         | env "SIDECOACH_DETECT_CLI=$1" bash "$HOOK")"
  CODE=$?
}

# --- assertions ---
ok()  { echo "PASS  $1"; PASS=$((PASS+1)); }
bad() { echo "FAIL  $1"; echo "      $2"; FAIL=$((FAIL+1)); }

expect_code()     { [ "$CODE" = "$2" ] && ok "$1 (exit $CODE)" || bad "$1" "expected exit $2, got $CODE; out=$OUT"; }
expect_contains() { printf '%s' "$OUT" | grep -qF "$2" && ok "$1" || bad "$1" "output missing '$2'; out=$OUT"; }
expect_absent()   { printf '%s' "$OUT" | grep -qiF "$2" && bad "$1" "output unexpectedly contains '$2'; out=$OUT" || ok "$1"; }
expect_silent()   { [ "$OUT" = '{}' ] && ok "$1 (silent {})" || bad "$1" "expected {} got: $OUT"; }
expect_not_silent(){ [ "$OUT" != '{}' ] && ok "$1" || bad "$1" "expected a non-{} advisory, got {}"; }

# A real, existing UI file so the hook clears its extension gate and invokes the (stub) CLI.
PROBE="$TMP/probe.html"
printf '<!doctype html><html><body><p>probe</p></body></html>\n' > "$PROBE"

# --- stub CLIs: mirror each documented CLI exit code (0/1/2/3) + a malformed variant. ---
cat > "$TMP/stub_clean.js" <<'EOF'
process.stdout.write(JSON.stringify({verdict:"clean",scanned:true,findings:[],severityCounts:{blocking:0,warning:0,info:0}})+"\n");
process.exit(0);
EOF
cat > "$TMP/stub_findings.js" <<'EOF'
process.stdout.write(JSON.stringify({verdict:"blocked",scanned:true,findings:[
  {rule:"ban.gradient-text",severity:"blocking",lens:"static-ban",location:"probe.html:1",detail:"gradient text is decorative"}
],severityCounts:{blocking:1,warning:0,info:0}})+"\n");
process.exit(1);
EOF
cat > "$TMP/stub_inconclusive.js" <<'EOF'
process.stdout.write(JSON.stringify({verdict:"inconclusive",scanned:false,findings:[],unavailableReasons:["objective lens unavailable: net::ERR_UNSAFE_PORT"]})+"\n");
process.exit(3);
EOF
cat > "$TMP/stub_infra.js" <<'EOF'
console.error("sidecoach-detect: failed to load ../dist. Run `npm run build` in sidecoach/ first.");
process.exit(2);
EOF
cat > "$TMP/stub_malformed.js" <<'EOF'
process.stdout.write("this is not json\n");
process.exit(3);
EOF
# Malformed-but-JSON payloads that would crash a naive hook (findings not a list;
# unavailableReasons not a list). A crash is a non-zero exit, which would break fail-open,
# so these must still exit 0 with a not-clean advisory - never silence, never a crash.
cat > "$TMP/stub_findings_null.js" <<'EOF'
process.stdout.write(JSON.stringify({verdict:"blocked",findings:null})+"\n");
process.exit(1);
EOF
cat > "$TMP/stub_reasons_bad.js" <<'EOF'
process.stdout.write(JSON.stringify({verdict:"inconclusive",unavailableReasons:123})+"\n");
process.exit(3);
EOF

echo "=== STUB tier (hook translation of each CLI exit code) ==="

# clean -> silent {}
run_cli "$TMP/stub_clean.js" "$PROBE"
expect_code "stub clean: hook exit 0" 0
expect_silent "stub clean: silent"
CLEAN_OUT="$OUT"

# findings -> exit 0, advisory naming the finding, explicitly non-blocking
run_cli "$TMP/stub_findings.js" "$PROBE"
expect_code "stub findings: hook exit 0 (advisory, not a block)" 0
expect_not_silent "stub findings: advisory present"
expect_contains "stub findings: names the rule" "ban.gradient-text"
expect_contains "stub findings: honest count" "1 finding(s)"
expect_contains "stub findings: says it does not block" "does not block the edit"

# inconclusive -> exit 0, NOT clean, NOT a block
run_cli "$TMP/stub_inconclusive.js" "$PROBE"
expect_code "stub inconclusive: hook exit 0 (does not block)" 0
expect_not_silent "stub inconclusive: advisory present"
expect_contains "stub inconclusive: labeled inconclusive" "INCONCLUSIVE"
expect_contains "stub inconclusive: explicitly not clean" "not clean"
INCONC_OUT="$OUT"

# The load-bearing distinction: inconclusive output must NEVER equal the clean {}.
if [ "$INCONC_OUT" != "$CLEAN_OUT" ] && [ "$INCONC_OUT" != '{}' ]; then
  ok "inconclusive is DISTINGUISHED from clean (not a false clean)"
else
  bad "inconclusive is DISTINGUISHED from clean" "inconclusive output collapsed to the clean form: $INCONC_OUT"
fi

# infra load error (exit 2) -> exit 0, NOT clean
run_cli "$TMP/stub_infra.js" "$PROBE"
expect_code "stub infra(exit2): hook exit 0 (does not block)" 0
expect_not_silent "stub infra(exit2): advisory present"
expect_contains "stub infra(exit2): reports it could not complete" "could not complete"
expect_contains "stub infra(exit2): not a clean result" "not a clean result"

# malformed stdout + nonzero exit -> still treated as not-clean, never silent
run_cli "$TMP/stub_malformed.js" "$PROBE"
expect_code "stub malformed: hook exit 0" 0
expect_not_silent "stub malformed: not silent (never a false clean on unparseable output)"

# findings=null on exit 1 -> must not crash the hook; exit 0, advisory, never silent
run_cli "$TMP/stub_findings_null.js" "$PROBE"
expect_code "stub findings=null: hook exit 0 (no crash, fail-open holds)" 0
expect_not_silent "stub findings=null: advisory present, not a false clean"

# unavailableReasons=123 on exit 3 -> must not crash; exit 0, inconclusive, not clean
run_cli "$TMP/stub_reasons_bad.js" "$PROBE"
expect_code "stub reasons=non-list: hook exit 0 (no crash, fail-open holds)" 0
expect_contains "stub reasons=non-list: still labeled inconclusive" "INCONCLUSIVE"

echo ""
echo "=== non-UI + routing (no engine needed) ==="

# non-UI file (.md) -> skipped silently, CLI never invoked
MD="$TMP/notes.md"
printf '# notes\n' > "$MD"
run "$MD"
expect_code "non-UI .md: hook exit 0" 0
expect_silent "non-UI .md: skipped silently"

# a non-Write/Edit tool -> silent
OUT="$(printf '{"tool_name":"Bash","tool_input":{"command":"ls"}}' | bash "$HOOK")"; CODE=$?
expect_code "non-edit tool: hook exit 0" 0
expect_silent "non-edit tool: silent"

# a UI extension that does not exist on disk -> silent (nothing to scan)
run "$TMP/does-not-exist.html"
expect_code "missing UI file: hook exit 0" 0
expect_silent "missing UI file: silent"

echo ""
echo "=== LIVE tier (real CLI over real fixtures + unroutable URL) ==="

if node "$CLI" --help >/dev/null 2>&1; then
  # (1) real defect fixture -> exit 0, advisory names gradient-text
  cp "$DEFECT_FIXTURE" "$TMP/gradient-text.html"
  run "$TMP/gradient-text.html"
  expect_code "LIVE defect: hook exit 0 (advisory, not a block)" 0
  expect_contains "LIVE defect: names gradient-text" "gradient-text"
  expect_contains "LIVE defect: does not block" "does not block the edit"

  # (2) real clean fixture -> silent {}. If this machine lacks a working browser the
  #     rendered lenses come back inconclusive; that is a render-env limitation, not a
  #     hook bug, so downgrade to a loud SKIP rather than a false fail.
  cp "$CLEAN_FIXTURE" "$TMP/clean-page.html"
  run "$TMP/clean-page.html"
  if [ "$OUT" = '{}' ]; then
    ok "LIVE clean: silent {} (exit $CODE)"
    [ "$CODE" = 0 ] && ok "LIVE clean: hook exit 0" || bad "LIVE clean: hook exit 0" "got $CODE"
  elif printf '%s' "$OUT" | grep -qF "INCONCLUSIVE"; then
    echo "SKIP  LIVE clean: rendered lenses unavailable on this machine (no browser); clean fixture came back inconclusive, not a hook fault"
  else
    bad "LIVE clean: expected {}" "got: $OUT"
  fi

  # (3a) the CLI itself returns exit 3 on the unroutable URL (the contract the hook relies on)
  node "$CLI" http://127.0.0.1:1 --quiet >/dev/null 2>&1
  [ $? -eq 3 ] && ok "LIVE url: real CLI exits 3 (inconclusive)" || bad "LIVE url: real CLI exits 3" "got a different exit"

  # (3b) the hook over the unroutable URL -> exit 0, INCONCLUSIVE, not clean, not a block
  run "http://127.0.0.1:1"
  expect_code "LIVE url: hook exit 0 (does not block)" 0
  expect_contains "LIVE url: labeled inconclusive" "INCONCLUSIVE"
  expect_contains "LIVE url: explicitly not clean" "not clean"
  expect_not_silent "LIVE url: not a false clean {}"
else
  echo "SKIP  LIVE tier: sidecoach/dist is not built (run \`npm run build\` in sidecoach/)."
  echo "      Stub tier already proved the hook's exit-code translation; live end-to-end skipped."
fi

echo ""
echo "sidecoach-detect: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
