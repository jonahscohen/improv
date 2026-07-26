#!/usr/bin/env bash
# Regression tests for cmux-preflight.sh.
#
# The preflight is the presence + version guard for the external, unvendored
# cmux dependency. It must:
#   1. PASS when cmux is present and >= the pin in cmux.version.
#   2. FAIL CLOSED (non-zero) when cmux is absent (1) or older than the pin (2),
#      with an actionable message - so a missing/old cmux is caught before a
#      consumer runs the binary, not cryptically mid-run.
#   3. Never brick under --warn (always exit 0) - the mode the always-on guard
#      hooks would use, since they run on non-cmux machines too.
#   4. Never hard-fail on an UNPARSEABLE version string (format drift is a
#      warning, not a block).
#
# Hermetic: CMUX_PREFLIGHT_CMUX points the resolver at stub binaries with fixed
# --version output, so the real cmux session is never touched.
#
# Run:  bash claude/cmux/test-cmux-preflight.sh
set -uo pipefail

PF="$(cd "$(dirname "$0")" && pwd)/cmux-preflight.sh"
VERSION_FILE="$(cd "$(dirname "$0")" && pwd)/cmux.version"
TMP="$(mktemp -d)"
PASS=0
FAIL=0

cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

# Required pin, read the same way the script does (first N.N.N line).
REQUIRED=$(sed -e 's/#.*$//' "$VERSION_FILE" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n1)

# Build a stub cmux that prints "$1" for --version.
mk_stub() {
  local path="$TMP/$1"; local ver="$2"
  printf '#!/bin/sh\necho "%s"\n' "$ver" > "$path"
  chmod +x "$path"
  printf '%s' "$path"
}

# check <label> <expected-exit> <override-path> [extra args...]
check() {
  local label="$1"; local want="$2"; local ov="$3"; shift 3
  local out got
  out=$(CMUX_PREFLIGHT_CMUX="$ov" sh "$PF" "$@" 2>&1); got=$?
  if [ "$got" -eq "$want" ]; then
    printf 'PASS  %-46s (exit %s)\n' "$label" "$got"; PASS=$((PASS+1))
  else
    printf 'FAIL  %-46s (want %s, got %s)\n      out: %s\n' "$label" "$want" "$got" "$out"; FAIL=$((FAIL+1))
  fi
}

# check_msg <label> <override> <grep-pattern> [args...] - asserts stderr matches
check_msg() {
  local label="$1"; local ov="$2"; local pat="$3"; shift 3
  local out
  out=$(CMUX_PREFLIGHT_CMUX="$ov" sh "$PF" "$@" 2>&1)
  if printf '%s' "$out" | grep -qE "$pat"; then
    printf 'PASS  %-46s (msg ~ /%s/)\n' "$label" "$pat"; PASS=$((PASS+1))
  else
    printf 'FAIL  %-46s (msg !~ /%s/)\n      out: %s\n' "$label" "$pat" "$out"; FAIL=$((FAIL+1))
  fi
}

echo "=== cmux-preflight.sh regression (pin = $REQUIRED) ==="

OK=$(mk_stub cmux-ok    "cmux $REQUIRED (100) [abc]")   # exact pin match
NEW=$(mk_stub cmux-new  "cmux 9.9.9 (999) [def]")       # well above
OLD=$(mk_stub cmux-old  "cmux 0.1.0 (1) [old]")         # well below
JUNK=$(mk_stub cmux-junk "cmux (dev)")                  # unparseable
MINOR_LOW=$(mk_stub cmux-minorlow "cmux 0.63.99 (1) [x]")  # minor below pin's minor

# 1. present + exact pin -> PASS
check "present, == pin"            0 "$OK"
# 2. present + newer -> PASS
check "present, > pin"             0 "$NEW"
# 3. present + older -> FAIL CLOSED, code 2
check "present, < pin (patch)"     2 "$OLD"
check "present, < pin (minor)"     2 "$MINOR_LOW"
# 4. absent -> FAIL CLOSED, code 1
check "absent"                     1 "/no/such/cmux"
# 5. --warn never bricks
check "absent  --warn"             0 "/no/such/cmux" --warn
check "old     --warn"             0 "$OLD"           --warn
# 6. unparseable version -> WARN, exit 0 (both default and warn)
check "unparseable version"        0 "$JUNK"
check "unparseable  --warn"        0 "$JUNK"          --warn
# 7. --print reports without changing the exit contract
check "print, present"             0 "$OK"  --print
check "print, old still fails"     2 "$OLD" --print

# message assertions (actionable, name the version)
check_msg "absent msg names required"  "/no/such/cmux" "requires cmux >= $REQUIRED"
check_msg "old msg names both versions" "$OLD"         "0\\.1\\.0 is older than the required $REQUIRED"
check_msg "warn msg is non-blocking"    "$OLD"         "WARNING" --warn
check_msg "unparseable warns"           "$JUNK"        "could not parse"

# 8. the deployed script must be executable. The launcher invokes it DIRECTLY
#    ("$_cmux_pf" --quiet), not via `sh`, and gates on [ -x ] - so a regression
#    to mode 644 would make the launcher silently skip the guard forever. This
#    suite runs the script via `sh "$PF"`, which bypasses the exec bit, so the
#    other 15 cases cannot catch that; assert it explicitly.
if [ -x "$PF" ]; then
  printf 'PASS  %-46s (mode)\n' "preflight script is executable"; PASS=$((PASS+1))
else
  printf 'FAIL  %-46s (not executable; run: chmod +x %s)\n' "preflight script is executable" "$PF"; FAIL=$((FAIL+1))
fi

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
