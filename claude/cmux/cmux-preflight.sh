#!/bin/sh
# cmux-preflight.sh - presence + version guard for the cmux external dependency.
#
# WHY THIS EXISTS
# cmux is an external, unvendored macOS app (/Applications/cmux.app). Nothing in
# this repo pins its version, so a missing or too-old cmux otherwise surfaces as
# a cryptic failure mid-run (a screenshot that never lands, a `cmux claude-teams`
# that dies with an unhelpful error). This preflight catches that EARLY: it
# resolves the cmux binary the SAME way the PATH shim (claude/cmux/cmux) and the
# close-guard (claude/hooks/cmux-close-guard.sh) do, reads the required version
# from cmux.version (the pin), and by default FAILS CLOSED with an actionable
# message when cmux is absent or below the pin.
#
# This is the shared helper the active cmux consumers call before they run the
# binary. It is NOT wired into the always-on guard hooks in fail-closed mode:
# those fire on every Bash call / every session, including on machines with no
# cmux at all, and must stay fail-soft (see decision_cmux_hardening_proposal.md).
# Such callers pass --warn to get the check without the hard exit.
#
# USAGE
#   cmux-preflight.sh            # fail closed (exit non-zero) if missing/old
#   cmux-preflight.sh --warn     # never exit non-zero; print a warning instead
#   cmux-preflight.sh --print    # report resolved binary + found/required version
#   cmux-preflight.sh --quiet    # suppress the OK line (errors still print)
#
# EXIT CODES
#   0  cmux present and >= required (or --warn, or version unparseable)
#   1  cmux not found                              (fail closed)
#   2  cmux present but older than the pin         (fail closed)
#
# A version we cannot PARSE is deliberately treated as a non-blocking WARNING
# (exit 0) even in fail-closed mode: the pin guards against a KNOWN-old cmux, and
# hard-failing on an unrecognized `--version` string would recreate the exact
# format-drift fragility this dependency work is meant to reduce.
#
# OVERRIDE SEAM (tests): CMUX_PREFLIGHT_CMUX, when set, is AUTHORITATIVE - it is
# resolved or cmux is treated as absent; resolution never falls through to the
# real app. Mirrors the close-guard's CMUX_CLOSE_GUARD_CMUX seam.

set -u

MODE_WARN=0
PRINT=0
QUIET=0
for arg in "$@"; do
  case "$arg" in
    --warn)  MODE_WARN=1 ;;
    --print) PRINT=1 ;;
    --quiet) QUIET=1 ;;
    -h|--help)
      sed -n '2,40p' "$0"
      exit 0
      ;;
    *)
      printf 'cmux-preflight: unknown argument: %s\n' "$arg" >&2
      exit 1
      ;;
  esac
done

# Directory this script lives in, so cmux.version resolves from any CWD.
SELF_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
VERSION_FILE="$SELF_DIR/cmux.version"

# --- required version (the pin) ---------------------------------------------
# First non-comment, non-blank line of cmux.version.
REQUIRED=""
if [ -r "$VERSION_FILE" ]; then
  REQUIRED=$(sed -e 's/#.*$//' -e 's/[[:space:]]*$//' "$VERSION_FILE" \
             | grep -E '[0-9]+\.[0-9]+\.[0-9]+' \
             | head -n 1 \
             | tr -d '[:space:]')
fi
if [ -z "$REQUIRED" ]; then
  printf 'cmux-preflight: could not read a required version from %s\n' "$VERSION_FILE" >&2
  # No pin to check against. Do not brick callers over a missing pin file.
  exit 0
fi

# --- resolve the cmux binary (reuse the shim / close-guard chain) -----------
# Priority: explicit override seam, cmux-injected env paths, PATH (which resolves
# the shim inside a cmux session), the shim directly, then the bundled binary.
CMUX_BIN=""
_try() {
  # $1 candidate path; sets CMUX_BIN and returns 0 on first executable hit.
  [ -n "${1:-}" ] || return 1
  [ -f "$1" ] && [ -x "$1" ] || return 1
  CMUX_BIN="$1"
  return 0
}

if [ -n "${CMUX_PREFLIGHT_CMUX:-}" ]; then
  # Authoritative override: resolve it or treat cmux as absent. No fall-through.
  _try "$CMUX_PREFLIGHT_CMUX" || CMUX_BIN=""
else
  _try "${CMUX_CLAUDE_HOOK_CMUX_BIN:-}" \
    || _try "${CMUX_BUNDLED_CLI_PATH:-}" \
    || _try "${CMUX_CLAUDE_TEAMS_CMUX_BIN:-}" \
    || _try "$(command -v cmux 2>/dev/null || true)" \
    || _try "$HOME/.claude/cmux/cmux" \
    || _try "/Applications/cmux.app/Contents/Resources/bin/cmux" \
    || CMUX_BIN=""
fi

# --- helpers ----------------------------------------------------------------
# Split a dotted version into _M/_m/_p, defaulting missing components to 0. The
# case guards each shape so a short string ("5", "1.2") cannot smear one field
# across the others. In practice both operands are always full N.N.N (grepped as
# such), but keeping the split correct in isolation avoids a latent trap.
_ver_split() {
  _M=0; _m=0; _p=0
  case "$1" in
    *.*.*) _M=${1%%.*}; _r=${1#*.}; _m=${_r%%.*}; _p=${_r#*.}; _p=${_p%%.*} ;;
    *.*)   _M=${1%%.*}; _r=${1#*.}; _m=${_r%%.*} ;;
    *)     _M=${1:-0} ;;
  esac
  [ -n "$_M" ] || _M=0; [ -n "$_m" ] || _m=0; [ -n "$_p" ] || _p=0
}

# Numeric MAJOR.MINOR.PATCH compare: is $1 >= $2 ?
_ver_ge() {
  _ver_split "$1"; _a1=$_M; _a2=$_m; _a3=$_p
  _ver_split "$2"; _b1=$_M; _b2=$_m; _b3=$_p
  if [ "$_a1" -ne "$_b1" ]; then [ "$_a1" -gt "$_b1" ]; return; fi
  if [ "$_a2" -ne "$_b2" ]; then [ "$_a2" -gt "$_b2" ]; return; fi
  [ "$_a3" -ge "$_b3" ]
}

# Emit a failure per the active mode: fail-closed prints to stderr + exits with
# $2; --warn prints a softer note + exits 0.
_fail() {
  _msg="$1"; _code="$2"
  if [ "$MODE_WARN" -eq 1 ]; then
    printf 'cmux-preflight: WARNING - %s (continuing; --warn)\n' "$_msg" >&2
    exit 0
  fi
  printf 'cmux-preflight: %s\n' "$_msg" >&2
  exit "$_code"
}

# --- missing ----------------------------------------------------------------
if [ -z "$CMUX_BIN" ]; then
  [ "$PRINT" -eq 1 ] && printf 'cmux: NOT FOUND (required >= %s)\n' "$REQUIRED"
  _fail "cmux not found. This repo requires cmux >= $REQUIRED. Install or update cmux.app (https://cmux.io), or ensure the CLI is resolvable on PATH, at ~/.claude/cmux/cmux, or inside /Applications/cmux.app. See reference_cmux_dependency.md." 1
fi

# --- version ----------------------------------------------------------------
RAW=$("$CMUX_BIN" --version 2>/dev/null || true)
FOUND=$(printf '%s\n' "$RAW" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n 1)

if [ -z "$FOUND" ]; then
  # Unparseable version: never brick on format drift, even fail-closed.
  printf 'cmux-preflight: WARNING - could not parse a version from "cmux --version" (%s); cannot confirm >= %s. Proceeding.\n' "$(printf '%s' "$RAW" | head -n 1)" "$REQUIRED" >&2
  [ "$PRINT" -eq 1 ] && printf 'cmux: %s (version unparseable) at %s; required >= %s\n' "$RAW" "$CMUX_BIN" "$REQUIRED"
  exit 0
fi

if [ "$PRINT" -eq 1 ]; then
  printf 'cmux: %s at %s (required >= %s)\n' "$FOUND" "$CMUX_BIN" "$REQUIRED"
fi

if _ver_ge "$FOUND" "$REQUIRED"; then
  [ "$QUIET" -eq 1 ] || [ "$PRINT" -eq 1 ] || printf 'cmux-preflight: OK - cmux %s >= %s\n' "$FOUND" "$REQUIRED"
  exit 0
fi

_fail "cmux $FOUND is older than the required $REQUIRED. Update cmux.app (https://cmux.io) to at least $REQUIRED; the in-repo cmux consumers are only verified against that. See reference_cmux_dependency.md." 2
