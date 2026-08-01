#!/usr/bin/env bash
# Falsification suite for `--preset justify`.
#
# Jonah, 2026-08-01: his boss wants to work with Justify alone. `--only justify` was
# already complete and self-contained (measured: exit 0, 3499 files, nothing escaping a
# redirected HOME), but it could not express "Justify plus the supporting cast that
# makes it good". The preset is that set.
#
# The risk this suite exists to catch is DRIFT, not breakage. A preset is a list of key
# names; rename a component and the preset silently installs less than it promises. So
# every case here asserts the picked SET, both directions - what must be in, and what
# must stay out.
#
# Every run uses --dry-run under a fake HOME, so no case can touch real state. The
# dry-run path is verified to write nothing as its own case.

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
INSTALL="$REPO/install.sh"

pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  ok   %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  FAIL %s\n' "$1"; }

# picks <preset> -> the keys marked [x], one per line, ANSI stripped
picks() {
  local h; h="$(mktemp -d)"
  HOME="$h" bash "$INSTALL" --preset "$1" --dry-run --yes 2>/dev/null \
    | sed $'s/\033\\[[0-9;]*m//g' \
    | awk '/^  \[x\]/ {print $2}'
  rm -rf "$h"
}

echo "=== --preset justify: the set it promises ==="

SET="$(picks justify)"

# IN. Each is load-bearing and the reason is recorded in install.sh's apply_preset.
for key in justify memory safety verification grounding; do
  grep -qx "$key" <<<"$SET" \
    && ok "$key is installed" \
    || bad "$key is installed (preset no longer selects it)"
done

# OUT. Sidecoach is deliberately absent until it is ready to be the taste layer;
# the rest are simply not needed to run Justify well and would be noise on day one.
for key in sidecoach discord voice-input voice-output statusline task-list tilt-lab; do
  grep -qx "$key" <<<"$SET" \
    && bad "$key is NOT in the justify preset (it crept in)" \
    || ok "$key stays out"
done

echo
echo "=== the set is exactly five, no more ==="
n="$(grep -c . <<<"$SET")"
[ "$n" = "5" ] && ok "exactly 5 components (got $n)" || bad "exactly 5 components (got $n)"

echo
echo "=== safety properties ==="

# A dry run that writes anything would make this whole suite unsafe to run.
H="$(mktemp -d)"
HOME="$H" bash "$INSTALL" --preset justify --dry-run --yes >/dev/null 2>&1
written="$(find "$H" -type f 2>/dev/null | wc -l | tr -d ' ')"
[ "$written" = "0" ] && ok "--dry-run writes nothing" || bad "--dry-run writes nothing (wrote $written)"
rm -rf "$H"

# The preset routes through apply_only, so a key that no longer exists must ABORT
# rather than quietly install a smaller set. This is the drift alarm.
H="$(mktemp -d)"
out="$(HOME="$H" bash "$INSTALL" --only justify,not-a-real-key --dry-run --yes 2>&1)"; rc=$?
{ [ "$rc" != "0" ] && grep -qi "unknown component" <<<"$out"; } \
  && ok "an unknown key aborts loudly rather than installing less" \
  || bad "an unknown key aborts loudly (rc=$rc)"
rm -rf "$H"

# The other presets must be untouched by this addition.
[ "$(picks none | grep -c .)" = "0" ] && ok "preset none still selects nothing" || bad "preset none still selects nothing"
[ "$(picks minimal | grep -c .)" -ge 5 ] && ok "preset minimal still selects its set" || bad "preset minimal still selects its set"

H="$(mktemp -d)"
out="$(HOME="$H" bash "$INSTALL" --preset nonsense --dry-run --yes 2>&1)"; rc=$?
{ [ "$rc" != "0" ] && grep -qi "unknown preset" <<<"$out"; } \
  && ok "an unknown preset still aborts" || bad "an unknown preset still aborts (rc=$rc)"
rm -rf "$H"

# The help text has to name it or nobody finds it.
grep -q -- "--preset NAME.*justify" "$INSTALL" \
  && ok "help text lists justify as a preset" || bad "help text lists justify as a preset"

echo
echo "== $pass passed, $fail failed =="
[ "$fail" -eq 0 ]
