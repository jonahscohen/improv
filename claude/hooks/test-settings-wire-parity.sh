#!/usr/bin/env bash
# test-settings-wire-parity.sh
#
# THE REVERSE OF test-settings-deploy-parity.sh.
#
#   forward (that file)  every hook WIRED in settings.json must be DEPLOYED on disk.
#                        Catches: settings.json references a script that is not there,
#                        so the event fires and the shell reports command-not-found.
#
#   reverse (this file)  every hook DEPLOYED on disk must be WIRED in settings.json,
#                        or be a documented non-event helper.
#                        Catches: install.sh copies the script out but never adds the
#                        settings entry, so the hook exists, looks installed, and
#                        NEVER FIRES. Nothing errors. There is no signal at all.
#
# WHY THE REVERSE IS THE MORE DANGEROUS DIRECTION: the forward failure is loud (a
# broken command on every matching event). The reverse failure is silent, and silence
# is what let route-intent.json sit un-deployed from 2026-07-26, and what let three
# hooks reach main unpackaged in 2026-07-23. A guard whose failure mode is "nothing
# happens" is indistinguishable from a guard that is working.
#
# Same method as the forward twin, for the same reason it was redesigned in 2026-07-15:
# ask the question PER SELECTION by actually installing into a throwaway HOME. A static
# "is this hook wired by SOME path" check passes while `--only X` ships it inert.
#
# EXIT CODES
#   0  every deployed hook is wired or justifiably unwired
#   1  parity failure - a deployed hook that can never fire
#   2  self-test failure - the checker is broken, findings are not trustworthy
#   3  cannot tell - a sandbox install did not produce a settings.json
#
# PRECEDENCE: 2 outranks everything (a broken checker's findings mean nothing), then
# 1, then 3. A run that finds a real defect AND could not read some selection exits 1
# and prints a COVERAGE INCOMPLETE block naming those selections, so exit 1 is never
# quietly also "partial".
#
# COVERAGE: the default run SKIPS config,sidecoach and config,justify (npm builds with
# real-repo side effects). The run says so out loud. PARITY_FULL=1 includes them.
set -u

# python3 is this suite's only measuring instrument: every payload, every fixture and
# every assertion below is built with it. Without it the suite would not fail loudly -
# it would skip silently and still print a green summary, which is worse than no suite.
command -v python3 >/dev/null 2>&1 || {
  echo "FATAL: python3 not found - this suite cannot verify anything without it." >&2
  exit 2
}

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INSTALL="$REPO_DIR/install.sh"

pass=0
fail=0
ok()  { echo "PASS $1"; pass=$((pass + 1)); }
bad() { echo "FAIL $1"; fail=$((fail + 1)); }

# ------------------------------------------------------------------
# UNWIRED BY DESIGN
# ------------------------------------------------------------------
# Deployed on purpose, wired to no Claude Code event on purpose. These four mirror
# hook-registry-guard.sh's own _is_excluded reasoning. An allowlist nobody validates
# is where a genuinely dead hook goes to hide - which is precisely how
# question-enforcement.sh stayed deployed and inert for two months.
#
# So every entry is checked twice, and neither check trusts prose:
#   section 2  the named reacher exists in the REPO and is executable (docs do not
#              count - documentation describes intent, it does not run anything)
#   per-run    the named reacher exists in THAT SANDBOX (below)
#
# The allowlist is a MAP, not a list: each unwired hook names the thing that reaches
# it, as a path INSIDE the sandbox. The suppression then applies per selection, not
# globally - if `--only X` deploys the helper but not its caller, the helper really is
# inert under X and the row still goes red.
#
# A flat global list was the first cut and it was wrong for exactly that reason: it
# would have suppressed detect-session-model.sh even under a selection that shipped
# neither guard that execs it, which is the defect, not the exemption.
#
# Any one path satisfying an entry is enough (a helper with two callers needs one).
UNWIRED_BY_DESIGN_JSON='{
  "detect-session-model.sh": [
    ".claude/hooks/model-router-guard.sh",
    ".claude/hooks/frontier-orchestrator-guard.sh"
  ],
  "frontier-confirm.sh": [
    ".claude/hooks/model-router-guard.sh",
    ".claude/hooks/frontier-orchestrator-guard.sh"
  ],
  "beats-reflect-weekly.sh": [
    "Library/LaunchAgents/com.yesand.beats-reflect-weekly.plist"
  ],
  "codex-review.py": [
    ".claude/hooks/codex-rescue-guard.sh",
    ".claude/hooks/node-path-default.sh"
  ]
}'
# detect-session-model.sh   shared dependency, exec'd BY model-router-guard.sh and
#                           frontier-orchestrator-guard.sh. Never wired standalone.
# beats-reflect-weekly.sh   launchd-scheduled from
#                           com.yesand.beats-reflect-weekly.plist, not event-driven.
# multiple-choice-enforce.sh  NO LONGER LISTED, and its absence is the fix rather than a
#                           gap. It claimed to be the detection twin invoked by
#                           multiple-choice-detect-stop.sh; measured 2026-07-28 that claim
#                           was FALSE - detect-stop carries a byte-identical INLINE copy of
#                           the detection block ("keep the two copies byte-identical") and
#                           execs nothing. An entry here would have been a second exemption
#                           papering over the first. install.sh stopped DEPLOYING it
#                           instead, so there is nothing left to exempt: a hook that does
#                           not ship needs no unwired-by-design licence. Same disposition
#                           as question-enforcement.sh.
# codex-review.py           a CLI invoked by a human or an agent at a prompt. The two
#                           hooks named below only MENTION it in comments and in a
#                           guidance string; neither execs it.

# WHAT KIND OF REACHABILITY EACH ENTRY CLAIMS. These are different claims and a single
# grep cannot tell them apart, which is how a false one survived:
#   exec     some executable line in this repo runs it. Provable, and PROVEN below
#            against COMMENT-STRIPPED source.
#   launchd  a launchd plist names it in an element, not in an XML comment.
#   cli      invoked by a human or an agent at a prompt, never by repo code. NOT
#            grep-provable by construction, so it is accepted on its declaration and
#            printed as the weaker claim it is. This kind is a place a dead hook could
#            hide, so it is spelled out rather than blended into the others.
REACHER_KIND_JSON='{
  "detect-session-model.sh": "exec",
  "frontier-confirm.sh": "exec",
  "beats-reflect-weekly.sh": "launchd",
  "codex-review.py": "cli"
}'

SELECTIONS=(config "config,cmux" "config,fable" "config,reflect" "config,voice-output"
  "config,safety" "config,verification" "config,question-discipline" "config,grounding"
  "config,api-drift" "config,planning-git" "config,surface" "config,model-routing"
  safety bash-guard
  "config,memory" "config,clickup" "config,visualizer" "config,codex"
  "config,chrome" "config,figma")
[ "${PARITY_FULL:-0}" = 1 ] && SELECTIONS+=("config,sidecoach" "config,justify")

# ------------------------------------------------------------------
# The checker. Reads a sandbox HOME, prints one line per orphan.
# Kept separate from the install loop so the negative controls can drive it
# against a doctored sandbox without paying for another install.
# ------------------------------------------------------------------
_check_sandbox() {
  local sb="$1" sel="$2"
  SB="$sb" SEL="$sel" ALLOW="$UNWIRED_BY_DESIGN_JSON" python3 - <<'PY'
import json, os, re, sys

sb, sel = os.environ["SB"], os.environ["SEL"]
allow_map = json.loads(os.environ.get("ALLOW", "{}"))

hd = os.path.join(sb, ".claude", "hooks")
sf = os.path.join(sb, ".claude", "settings.json")

if not os.path.exists(sf):
    print(f"CANNOT-TELL {sel}: no settings.json produced")
    sys.exit(3)
try:
    d = json.load(open(sf))
except Exception as e:
    print(f"CANNOT-TELL {sel}: invalid settings.json ({e})")
    sys.exit(3)

# Selected by EXTENSION, not by the executable bit. A hook that lost its +x is still
# a hook that was meant to fire, and checking os.access(X_OK) would silently drop it
# from this sweep - hiding a second defect behind the one being hunted. Companion DATA
# files (route-intent.json, grounding-intent.json) have neither extension and are
# correctly never wired, which is why they are not swept.
# A ZERO-ITERATION SWEEP IS NOT A PASS. This used to read
#     deployed = [...] if os.path.isdir(hd) else []
# so a sandbox whose hooks directory was never created inspected nothing, found no
# orphans, and printed PASS - a green result that asserted precisely nothing. Re-measured
# 2026-07-28 against the CURRENT selection list (the previous note said "all nine
# selections", which was stale - there are 21): every selection deploys a hooks dir
# holding between 1 and 9 hook files, the floor being `bash-guard` at 1. The
# per-selection lines below now print that count, so a future shrink toward zero shows
# up in the output instead of passing quietly. Both "no directory" and "directory with
# no hooks" therefore mean the install did not
# happen, not that it was clean. Both are CANNOT-TELL, like a missing settings.json.
if not os.path.isdir(hd):
    print(f"CANNOT-TELL {sel}: no hooks directory produced, so nothing was inspected")
    sys.exit(3)
try:
    deployed = sorted(f for f in os.listdir(hd) if f.endswith((".sh", ".py")))
except OSError as e:
    print(f"CANNOT-TELL {sel}: hooks dir unreadable ({e})")
    sys.exit(3)
if not deployed:
    print(f"CANNOT-TELL {sel}: hooks directory holds no .sh/.py, so nothing was inspected")
    sys.exit(3)

# Record HOW MANY files this sweep inspected, so a shrink toward zero is visible in
# the output rather than silent. The count goes to a sidecar file rather than stdout
# because the negative controls in section 1 assert stdout is EMPTY on a clean run,
# and a count line would break them. The comment for row 10 already promised this
# counting; until 2026-07-28 nothing actually emitted it.
try:
    with open(os.path.join(sb, ".inspected"), "w") as fh:
        fh.write(str(len(deployed)))
except OSError:
    pass

# Same pattern as the forward twin: any prefix (~/, $HOME/, absolute), and
# MULTIPLE hook paths per compound command.
#
# The trailing boundary is load-bearing. Without it, a command referencing
# ~/.claude/hooks/foo.sh.disabled (or .bak, or foo.py3) satisfies the search for
# "foo.sh", so a hook that had been deliberately disabled would still read as WIRED
# and this sweep would call it healthy. The forward twin
# (test-settings-deploy-parity.sh) still carries the unbounded version of this
# pattern and has the same blind spot.
pat = re.compile(r"/\.claude/hooks/([A-Za-z0-9_.-]+\.(?:sh|py))(?![A-Za-z0-9_.-])")
wired = set()
for ev, groups in d.get("hooks", {}).items():
    for g in groups:
        for h in g.get("hooks", []):
            wired.update(pat.findall(h.get("command", "")))

orphans = []
for f in deployed:
    if f in wired:
        continue
    reachers = allow_map.get(f)
    if reachers is None:
        orphans.append((f, None))
        continue
    # PER-SELECTION justification: the thing that reaches this helper has to be
    # present in THIS sandbox. Repo-wide reachability is not enough - the promise
    # being tested is that `--only X` never ships an inert file.
    if not any(os.path.exists(os.path.join(sb, p)) for p in reachers):
        orphans.append((f, reachers))

for name, reachers in orphans:
    if reachers is None:
        print(f"DEPLOYED-NOT-WIRED {sel}: {name}")
    else:
        print(f"DEPLOYED-NOT-WIRED {sel}: {name} "
              f"(allowlisted, but none of its reachers shipped here: "
              f"{', '.join(reachers)})")
sys.exit(1 if orphans else 0)
PY
}

# ==================================================================
# SECTION 1 - negative controls
# ==================================================================
# Prove the checker can go red, and that its allowlist does not swallow everything.
# One sandbox install, reused for every row.

SB0="$(mktemp -d)" || { echo "FATAL: mktemp -d failed - refusing to use an unset path" >&2; exit 2; }
trap 'rm -rf "$SB0"' EXIT
HOME="$SB0" bash "$INSTALL" --only "config,grounding" >/dev/null 2>&1
if [ ! -f "$SB0/.claude/settings.json" ]; then
  echo "FAIL could not build the control sandbox (install produced no settings.json)"
  exit 2
fi

# Row 1: an untouched install is clean. A check that fires on a correct install
# teaches you to ignore it.
out="$(_check_sandbox "$SB0" "control")"; rc=$?
if [ "$rc" = 0 ] && [ -z "$out" ]; then
  ok "control sandbox: every deployed hook is wired"
else
  bad "control sandbox should be clean (rc=$rc, out=$out)"
fi

# Row 2: plant a deployed hook that nothing wires. This is the defect class.
printf '#!/bin/sh\nexit 0\n' > "$SB0/.claude/hooks/planted-orphan.sh"
out="$(_check_sandbox "$SB0" "control")"; rc=$?
if [ "$rc" = 1 ] && printf '%s' "$out" | grep -q "DEPLOYED-NOT-WIRED control: planted-orphan.sh"; then
  ok "planted deployed-but-unwired hook: exit 1 and names it"
else
  bad "planted orphan should be caught (rc=$rc, out=$out)"
fi
rm -f "$SB0/.claude/hooks/planted-orphan.sh"

# Row 3: back to clean once removed - responds to state, not to having fired once.
out="$(_check_sandbox "$SB0" "control")"; rc=$?
if [ "$rc" = 0 ] && [ -z "$out" ]; then
  ok "removing the orphan clears the finding"
else
  bad "removing the orphan should clear the finding (rc=$rc, out=$out)"
fi

# Row 4: a companion DATA file is NOT a hook and must not be reported. grounding-gate.sh
# needs grounding-intent.json on disk and it is correctly wired to no event.
printf '{}\n' > "$SB0/.claude/hooks/planted-data.json"
out="$(_check_sandbox "$SB0" "control")"; rc=$?
if [ "$rc" = 0 ] && [ -z "$out" ]; then
  ok "companion .json data files are not treated as unwired hooks"
else
  bad "data files must not be reported as hooks (rc=$rc, out=$out)"
fi
rm -f "$SB0/.claude/hooks/planted-data.json"

# Row 5: an allowlisted helper is suppressed ONLY when its reacher shipped too.
# Helper alone -> still a finding, because under this selection it really is inert.
printf '#!/bin/sh\nexit 0\n' > "$SB0/.claude/hooks/detect-session-model.sh"
out="$(_check_sandbox "$SB0" "control")"; rc=$?
if [ "$rc" = 1 ] && printf '%s' "$out" | grep -q "none of its reachers shipped here"; then
  ok "allowlisted helper WITHOUT its caller is still reported (per-selection, not global)"
else
  bad "helper without its caller should be reported (rc=$rc, out=$out)"
fi

# Row 6: same helper, now with a caller present -> correctly suppressed.
printf '#!/bin/sh\nexit 0\n' > "$SB0/.claude/hooks/model-router-guard.sh"
out="$(_check_sandbox "$SB0" "control")"; rc=$?
if [ "$rc" = 1 ] && printf '%s' "$out" | grep -q "model-router-guard.sh" \
   && ! printf '%s' "$out" | grep -q "detect-session-model.sh"; then
  ok "allowlisted helper WITH its caller present is suppressed"
else
  bad "helper with caller should be suppressed (rc=$rc, out=$out)"
fi
rm -f "$SB0/.claude/hooks/detect-session-model.sh" "$SB0/.claude/hooks/model-router-guard.sh"

# Row 7: a disabled variant must not satisfy the wiring search for the real hook.
# Without a trailing boundary, ".../grounding-gate.sh.disabled" matches
# "grounding-gate.sh" and a switched-off hook reads as healthy.
python3 - "$SB0" <<'PY'
import json, os, sys
sf = os.path.join(sys.argv[1], ".claude", "settings.json")
d = json.load(open(sf))
d.setdefault("hooks", {}).setdefault("Stop", []).append(
    {"hooks": [{"type": "command",
                "command": "~/.claude/hooks/boundary-probe.sh.disabled"}]})
json.dump(d, open(sf, "w"), indent=2)
PY
printf '#!/bin/sh\nexit 0\n' > "$SB0/.claude/hooks/boundary-probe.sh"
out="$(_check_sandbox "$SB0" "control")"; rc=$?
if [ "$rc" = 1 ] && printf '%s' "$out" | grep -q "boundary-probe.sh"; then
  ok "a .disabled reference does not count as wiring the real hook"
else
  bad ".disabled suffix must not satisfy the real hook name (rc=$rc, out=$out)"
fi
rm -f "$SB0/.claude/hooks/boundary-probe.sh"
python3 - "$SB0" <<'PY'
import json, os, sys
sf = os.path.join(sys.argv[1], ".claude", "settings.json")
d = json.load(open(sf))
d["hooks"]["Stop"] = [g for g in d["hooks"].get("Stop", [])
                      if not any("boundary-probe" in h.get("command", "")
                                 for h in g.get("hooks", []))]
if not d["hooks"]["Stop"]:
    del d["hooks"]["Stop"]
json.dump(d, open(sf, "w"), indent=2)
PY

# Row 6: a missing settings.json is CANNOT-TELL, never "clean". Same lesson as
# hook-registry-guard's exit 3: an unreadable answer must not read as a good one.
mv "$SB0/.claude/settings.json" "$SB0/.claude/settings.json.hidden"
out="$(_check_sandbox "$SB0" "control")"; rc=$?
if [ "$rc" = 3 ] && printf '%s' "$out" | grep -q "CANNOT-TELL"; then
  ok "missing settings.json reports cannot-tell (exit 3), not clean"
else
  bad "missing settings.json should be exit 3 (rc=$rc, out=$out)"
fi
mv "$SB0/.claude/settings.json.hidden" "$SB0/.claude/settings.json"

# Rows 8-9: A SWEEP THAT INSPECTS NOTHING IS NOT A PASS (2026-07-28).
# `deployed = [...] if os.path.isdir(hd) else []` meant a sandbox whose hooks
# directory was never created iterated zero times, found zero orphans, and printed
# PASS for that selection. Every one of the nine selections is measured to deploy a
# hooks dir with at least one .sh - so zero files is never a legitimate answer, it is
# an install that did not happen. It has to read as CANNOT-TELL, the same as a missing
# settings.json one row above.
mv "$SB0/.claude/hooks" "$SB0/.claude/hooks.hidden"
out="$(_check_sandbox "$SB0" "control")"; rc=$?
if [ "$rc" = 3 ] && printf '%s' "$out" | grep -q "CANNOT-TELL"; then
  ok "missing hooks dir reports cannot-tell (exit 3), not a vacuous pass"
else
  bad "missing hooks dir should be exit 3 (rc=$rc, out=$out)"
fi
mv "$SB0/.claude/hooks.hidden" "$SB0/.claude/hooks"

mkdir -p "$SB0/.claude/hooks.hidden"
mv "$SB0/.claude/hooks" "$SB0/.claude/hooks.real"
mv "$SB0/.claude/hooks.hidden" "$SB0/.claude/hooks"
out="$(_check_sandbox "$SB0" "control")"; rc=$?
if [ "$rc" = 3 ] && printf '%s' "$out" | grep -q "CANNOT-TELL"; then
  ok "empty hooks dir reports cannot-tell (exit 3), not a vacuous pass"
else
  bad "empty hooks dir should be exit 3 (rc=$rc, out=$out)"
fi
rmdir "$SB0/.claude/hooks"
mv "$SB0/.claude/hooks.real" "$SB0/.claude/hooks"

# Row 10: and the sweep must still count what it inspected, so a future shrink to
# near-zero is visible rather than silent.
out="$(_check_sandbox "$SB0" "control" 2>&1)"; rc=$?
[ "$rc" = 0 ] && ok "restored sandbox is clean again after the two doctored rows" \
              || bad "sandbox not restored (rc=$rc, out=$out)"

# ==================================================================
# SECTION 2 - every allowlist entry must justify itself
# ==================================================================
# An entry here is a claim that the hook is reachable some OTHER way. Check the claim.
# Referenced by install.sh alone does not count - that only proves it gets copied out,
# which is the very thing under suspicion.
# claude/docs is deliberately NOT searched. A hook mentioned only in prose is not
# reachable by anything - documentation describes intent, it does not execute. Letting
# a doc mention satisfy this check would make the allowlist exactly the hiding place
# the comment above says it must not be.
# THIS LOOP WAS VACUOUS UNTIL 2026-07-28. It was a bare `grep -rl -- "$h"`, so any
# COMMENT mentioning the hook satisfied it - including the comments in this very file
# and the ones in multiple-choice-detect-stop.sh that describe the twin rather than
# invoke it. Two of the four entries were justified by nothing but prose, which is
# precisely the hiding place the header above says this allowlist must never become.
# The header already stated the rule ("documentation describes intent, it does not
# execute"); the code simply did not implement it. It does now.
#
# A false claim here is NOT a broken checker - the checker is fine and the finding is
# real. So these failures are recorded as PARITY findings (exit 1, section 3 still
# runs), not as self-test failures (exit 2, which would halt the sweep).
claim_fail=0
claim_fail_names=""

# Strip shell comments so a sentence ABOUT a hook cannot pass as a call TO it.
_code_only() { sed 's/[[:space:]]#.*$//; /^[[:space:]]*#/d' "$1"; }

for h in $(printf '%s' "$UNWIRED_BY_DESIGN_JSON" | python3 -c 'import json,sys; print(" ".join(json.load(sys.stdin)))'); do
  kind="$(printf '%s' "$REACHER_KIND_JSON" \
          | python3 -c "import json,sys; print(json.load(sys.stdin).get('$h',''))")"
  case "$kind" in
    exec)
      # THE DECLARED REACHERS, each checked on its OWN contents - not a global scan.
      # Codex review 2026-07-28: an earlier cut asked only whether SOME non-comment
      # line anywhere under claude/hooks named the helper. That is a different claim
      # from the one the map makes. `_check_sandbox` suppresses a helper per selection
      # based on THESE paths, so a stale or wrong path could keep suppressing an
      # orphan while some unrelated hook supplied the global hit. Ask the map's own
      # question: does the file this entry NAMES actually run it.
      #
      # Comment-stripped, and only executable source. claude/agents is deliberately
      # unreachable from here: those are markdown, where `#` opens a HEADING rather
      # than a comment and ordinary prose carries no marker at all, so a sentence
      # ABOUT a hook would satisfy kind=exec and reopen the prose-proves-reachability
      # hole this loop exists to close. A hook named only in an agent file is invoked
      # by an agent - that is what kind=cli is for; declare it there and take the
      # weaker claim.
      #
      # while-read over a process substitution, not `for f in $(...)`: an unquoted
      # command substitution word-splits, so a checkout path containing a space would
      # split into fragments. A process substitution is not a pipe, so `hit` survives.
      hit=""
      while IFS= read -r p; do
        [ -n "$p" ] || continue
        case "$p" in
          .claude/hooks/*) src="$REPO_DIR/claude/hooks/${p#.claude/hooks/}" ;;
          *) continue ;;
        esac
        [ -f "$src" ] || continue
        if _code_only "$src" | grep -qF -- "$h"; then hit="$src"; break; fi
      done < <(printf '%s' "$UNWIRED_BY_DESIGN_JSON" \
               | python3 -c "import json,sys; [print(p) for p in json.load(sys.stdin).get('$h', [])]")
      if [ -n "$hit" ]; then
        ok "allowlist justified (exec): $h is run by $(basename "$hit")"
      else
        echo "FAIL allowlist entry $h claims kind=exec but none of its DECLARED reachers runs it (non-comment)"
        claim_fail=1; claim_fail_names="$claim_fail_names $h"
      fi ;;
    launchd)
      # Same rule as exec: the DECLARED plist, checked on its own contents, and the
      # name must sit in an <string> ELEMENT rather than an XML comment. (The old
      # `grep -rl ... | while read` form also lost `hit` to the pipe's subshell.)
      hit=""
      while IFS= read -r p; do
        [ -n "$p" ] || continue
        case "$p" in
          Library/LaunchAgents/*) src="$REPO_DIR/claude/launchd/${p#Library/LaunchAgents/}" ;;
          *) continue ;;
        esac
        [ -f "$src" ] || continue
        if grep -q "<string>[^<]*$h" "$src"; then hit="$src"; break; fi
      done < <(printf '%s' "$UNWIRED_BY_DESIGN_JSON" \
               | python3 -c "import json,sys; [print(p) for p in json.load(sys.stdin).get('$h', [])]")
      if [ -n "$hit" ]; then
        ok "allowlist justified (launchd): $h is named in an element of $(basename "$hit")"
      else
        echo "FAIL allowlist entry $h claims kind=launchd but its declared plist does not name it in an element"
        claim_fail=1; claim_fail_names="$claim_fail_names $h"
      fi ;;
    cli)
      ok "allowlist DECLARED (cli, not grep-provable): $h is invoked by a human or an agent, not by repo code" ;;
    *)
      bad "allowlist entry $h has no declared reacher kind - add one to REACHER_KIND_JSON" ;;
  esac
done

# Every declared reacher path must be one the installer can actually produce. A typo
# in the map ("Library/LaunchAgent/..." for "LaunchAgents") would silently make an
# entry unsatisfiable, turning a documented exemption into a permanent red row that
# looks like a product defect. Assert the shape here instead.
for p in $(printf '%s' "$UNWIRED_BY_DESIGN_JSON" \
           | python3 -c 'import json,sys; print(" ".join(p for v in json.load(sys.stdin).values() for p in v))'); do
  case "$p" in
    .claude/hooks/*)
      base="${p#.claude/hooks/}"
      if [ -f "$REPO_DIR/claude/hooks/$base" ]; then
        ok "reacher path resolves in the repo: $p"
      else
        bad "reacher path $p names a hook this repo does not have"
      fi ;;
    Library/LaunchAgents/*)
      base="${p#Library/LaunchAgents/}"
      if [ -f "$REPO_DIR/claude/launchd/$base" ]; then
        ok "reacher path resolves in the repo: $p"
      else
        bad "reacher path $p names a plist this repo does not have"
      fi ;;
    *) bad "reacher path $p is not a shape this check knows how to verify" ;;
  esac
done

if [ "$fail" != 0 ]; then
  echo ""
  echo "== $pass passed, $fail failed =="
  echo "SELF-TEST FAILED - the checker or its allowlist is broken, so the per-selection"
  echo "results below cannot be trusted. Fix this section first."
  exit 2
fi

# ==================================================================
# SECTION 3 - the real per-selection sweep
# ==================================================================
echo ""
echo "--- reverse wiring parity, per selection ---"
if [ "${PARITY_FULL:-0}" != 1 ]; then
  echo "NOTE: PARTIAL RUN. config,sidecoach and config,justify are skipped because"
  echo "      they trigger npm builds with real-repo side effects. A defect in those"
  echo "      two selections is NOT covered here. Run PARITY_FULL=1 for the full set."
fi
real_fail=0
cannot_tell=0
cannot_tell_names=""
for sel in "${SELECTIONS[@]}"; do
  SB="$(mktemp -d)" || { echo "FATAL: mktemp -d failed - refusing to use an unset path" >&2; exit 2; }
  HOME="$SB" bash "$INSTALL" --only "$sel" >/dev/null 2>&1
  rc=$?
  if [ "$rc" != 0 ]; then
    echo "CANNOT-TELL $sel: install exited $rc"
    cannot_tell=1; cannot_tell_names="$cannot_tell_names $sel"; rm -rf "$SB"; continue
  fi
  out="$(_check_sandbox "$SB" "$sel")"; crc=$?
  n="$(cat "$SB/.inspected" 2>/dev/null || echo '?')"
  case "$crc" in
    0) echo "PASS $sel ($n hooks inspected)" ;;
    1) echo "$out"; real_fail=1 ;;
    *) echo "$out"; cannot_tell=1; cannot_tell_names="$cannot_tell_names $sel" ;;
  esac
  rm -rf "$SB"
done

echo ""
echo "== $pass passed, $fail failed (self-test) =="

# PRECEDENCE, stated so exit 1 is never ambiguous: a real finding outranks an
# incomplete sweep, because a named defect is actionable now and an unreadable
# selection is not. When both happen, exit is 1 AND the incomplete selections are
# printed immediately below, so "findings" is never silently also "partial".
if [ "$cannot_tell" = 1 ]; then
  echo ""
  echo "COVERAGE INCOMPLETE - these selections produced no readable install:"
  echo "  ${cannot_tell_names# }"
  echo "  Results above are a statement about the selections that DID run."
fi

if [ "$claim_fail" = 1 ]; then
  echo ""
  echo "ALLOWLIST CLAIM FALSE - these entries name a reacher that does not reach them:"
  echo "  ${claim_fail_names# }"
  cat <<'EOF'
  Each is DEPLOYED by install.sh, wired to no event, and reached by no executable
  line - the entry in UNWIRED_BY_DESIGN is the only thing keeping it out of the
  per-selection findings below, and it is not true. This is the same deployed-and-
  inert shape as question-enforcement.sh, which sat dead for two months behind
  exactly this kind of unvalidated exemption.
  Fix in install.sh (NOT here): either wire it in cluster-wirings.json, or drop it
  from its cluster_hooks list so a fresh machine stops carrying a dead file.
EOF
  real_fail=1
fi

if [ "$real_fail" = 1 ]; then
  cat <<'EOF'

REVERSE PARITY FAILURE - a hook is deployed but wired to no event.

It will sit in ~/.claude/hooks/ looking installed and will never run. Nothing will
error. This is the same silent-inert shape as the 2026-07-26 route-intent.json bug.

Two valid fixes, and which one is right is a judgment call about the hook:
  1. WIRE IT. Add the entry to claude/hooks/cluster-wirings.json (cluster hooks) or
     app-wirings.json (app hooks), matching how its siblings are wired.
  2. STOP DEPLOYING IT. If it is superseded, remove it from its cluster_hooks list
     in install.sh so a fresh machine does not carry a dead file.
Do NOT simply add it to UNWIRED_BY_DESIGN unless it is genuinely reached another way -
section 2 verifies that claim and will fail if it is not.
EOF
  exit 1
fi

if [ "$cannot_tell" = 1 ]; then
  echo "CANNOT TELL - at least one selection did not produce a readable install."
  exit 3
fi

echo "ALL REVERSE PARITY CHECKS PASSED"
exit 0
