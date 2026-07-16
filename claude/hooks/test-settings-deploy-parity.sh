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
  safety bash-guard)
[ "${PARITY_FULL:-0}" = 1 ] && SELECTIONS+=("config,sidecoach")

fail=0
for sel in "${SELECTIONS[@]}"; do
  SB="$(mktemp -d)"
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
pat = re.compile(r"/\.claude/hooks/([A-Za-z0-9_.-]+\.(?:sh|py))")
bad = []
for ev, groups in d.get("hooks", {}).items():
    for g in groups:
        for h in g.get("hooks", []):
            for name in pat.findall(h.get("command", "")):
                if not os.path.exists(os.path.join(sb, ".claude", "hooks", name)):
                    bad.append(name)
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
