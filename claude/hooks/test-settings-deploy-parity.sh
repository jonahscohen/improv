#!/usr/bin/env bash
# test-settings-deploy-parity.sh
#
# INVARIANT: for any install selection, every hook WIRED into the resulting
# settings.json must have its script DEPLOYED on disk. A hook that is referenced
# in settings.json but never copied dangles at runtime (command-not-found /
# exit 127) on every matching event.
#
# WHY PER-SELECTION (redesigned 2026-07-15): the first cut of this test asked,
# statically, "is this hook deployed by SOME install path?" That passed a hook
# like sidecoach's (base-wired but only deployed by the sidecoach component)
# while `--only config` still dangled it. The only sound check is to actually
# install a selection into a throwaway HOME and compare the produced settings.json
# against the produced hooks dir. (Codex flagged the static version; this is the fix.)
#
# The default selections are hook-only and side-effect-free (no npm, fast). The
# sidecoach selection triggers npm builds with real-repo side effects, so it is
# gated behind PARITY_FULL=1 (run it in a clean checkout / CI, or manually).
set -u

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INSTALL="$REPO_DIR/install.sh"

SELECTIONS=(config "config,cmux" "config,fable" "config,reflect" "config,voice-output"
  "config,safety" "config,verification" "config,question-discipline" "config,grounding"
  "config,api-drift" "config,planning-git" "config,surface" "config,model-routing"
  safety bash-guard
  "config,memory" "config,clickup" "config,visualizer" "config,codex"
  "config,chrome" "config,figma")
[ "${PARITY_FULL:-0}" = 1 ] && SELECTIONS+=("config,sidecoach" "config,justify")

fail=0

# ---------------------------------------------------------------------------
# Matcher self-test. Runs ONCE, and its exit code actually counts.
# ---------------------------------------------------------------------------
# This deliberately does NOT live inside the per-selection python below: that one runs
# in a captured "$(...)" whose exit code is discarded (only stdout starting with FAIL
# sets fail=1), so an assert there prints a traceback and the suite still exits 0. A
# check that cannot fail the suite is decorative. Verified by removing the boundary and
# watching THIS row go red.
if python3 - <<'PY'
import re, sys
pat = re.compile(r"/\.claude/hooks/([A-Za-z0-9_.-]+\.(?:sh|py))(?![A-Za-z0-9_.-])")
cases = [
    # A wiring that points at a path which never runs must yield NOTHING. Unbounded,
    # this returns ["foo.sh"], so the suite confirms foo.sh is deployed and says PASS
    # while settings.json actually references foo.sh.disabled.
    ("~/.claude/hooks/foo.sh.disabled", []),
    ("~/.claude/hooks/foo.sh", ["foo.sh"]),
    ("$HOME/.claude/hooks/a.py && ~/.claude/hooks/b.sh", ["a.py", "b.sh"]),
    ("/Users/x/.claude/hooks/c-d_e.sh", ["c-d_e.sh"]),
]
bad = [(s, pat.findall(s), want) for s, want in cases if pat.findall(s) != want]
for s, got, want in bad:
    print(f"  matcher self-test: {s!r} -> {got}, want {want}")
sys.exit(1 if bad else 0)
PY
then
  echo "PASS matcher self-test (hook-path regex is bounded on the right)"
else
  echo "FAIL matcher self-test - the hook-path regex is wrong; every row below is untrustworthy"
  fail=1
fi

for sel in "${SELECTIONS[@]}"; do
  SB="$(mktemp -d)" || { echo "FATAL: mktemp -d failed - refusing to use an unset path" >&2; exit 2; }
  HOME="$SB" bash "$INSTALL" --only "$sel" >/dev/null 2>&1
  rc=$?
  if [ "$rc" != 0 ]; then
    echo "FAIL $sel: install exited $rc"
    fail=1; rm -rf "$SB"; continue
  fi
  out="$(python3 - "$SB" "$sel" <<'PY'
import json, sys, os, re
sb, sel = sys.argv[1], sys.argv[2]
sf = os.path.join(sb, ".claude", "settings.json")
if not os.path.exists(sf):
    print(f"FAIL {sel}: no settings.json produced"); sys.exit(0)
try:
    d = json.load(open(sf))
except Exception as e:
    print(f"FAIL {sel}: invalid settings.json ({e})"); sys.exit(0)
# Match any hook under .claude/hooks/ regardless of prefix (~/, $HOME/, absolute),
# and MULTIPLE hook paths per compound command (findall, not search).
#
# The trailing lookahead is load-bearing. Without it the name is unbounded on the right,
# so a command wiring `foo.sh.disabled` yields the capture `foo.sh` - and this check then
# confirms that `foo.sh` is deployed and reports PASS, while the thing settings.json
# actually points at is a path that never runs. Same blind spot the reverse suite
# (test-settings-wire-parity.sh) fixed on its own side.
pat = re.compile(r"/\.claude/hooks/([A-Za-z0-9_.-]+\.(?:sh|py))(?![A-Za-z0-9_.-])")
bad = []
seen = 0
for ev, groups in d.get("hooks", {}).items():
    for g in groups:
        for h in g.get("hooks", []):
            for name in pat.findall(h.get("command", "")):
                seen += 1
                if not os.path.exists(os.path.join(sb, ".claude", "hooks", name)):
                    bad.append(name)
# A SWEEP THAT INSPECTED NOTHING IS NOT A PASS. A settings.json with "hooks": {} or
# with no hook commands walked zero iterations, found zero missing files, and printed
# PASS - a green row asserting nothing (Codex review 2026-07-28). Every selection here
# wires at least one hook, so zero wired hooks means the install did not happen.
if seen == 0:
    print(f"FAIL {sel}: settings.json wires NO hooks at all, so nothing was inspected")
    sys.exit(0)
if bad:
    print(f"FAIL {sel}: wired but NOT deployed -> {sorted(set(bad))}")
else:
    print(f"PASS {sel}")
PY
)"
  echo "$out"
  case "$out" in FAIL*) fail=1 ;; esac
  rm -rf "$SB"
done

if [ "$fail" = 0 ]; then
  echo "ALL PARITY CHECKS PASSED"
  exit 0
else
  echo "PARITY FAILURES - a wired hook is not deployed for some selection"
  exit 1
fi
