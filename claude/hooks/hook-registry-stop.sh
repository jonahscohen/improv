#!/usr/bin/env bash
# hook-registry-stop.sh - the gate half of hook-registry-guard.sh.
#
# The guard detects an unmanaged hook at write time and arms ~/.claude/.unmanaged-hook.
# This blocks the Stop until that hook is actually packaged. A warning with no gate is a
# warning that gets scrolled past - this session shipped a browser whose tree lied about
# which hooks existed, past 110 green assertions, precisely because nothing forced the
# issue at the moment of truth.
#
# RE-CHECKS RATHER THAN TRUSTING THE FLAG. The flag records what WAS unmanaged; by the
# time Stop fires the model may have wired it. Re-deriving from the tree + install.sh
# means the gate opens the instant the work is genuinely done, and cannot be satisfied by
# deleting the flag. It also self-heals if a hook file was removed entirely.
#
# THE FLAG IS NO LONGER THE TRIGGER - THE DISK IS (2026-07-23). Three hooks
# (task-loop-mandate, justify-queue-mandate, justify-queue-drain-stop) were written into
# this repo, escaped the gate entirely, and got committed unpackaged. Root cause, proven
# from the transcripts: all three were written by a session whose project was a DIFFERENT
# repo (cwd /Users/spare3/Documents/Github/ppai, writing into improv by absolute path).
# hook-registry-guard.sh is project-scoped - wired in THIS repo's .claude/settings.json -
# so it never ran, nothing armed the flag, and this gate returned at the `[ -f "$FLAG" ]`
# line on every improv stop for the five days those hooks sat in the tree. The same dead
# end opens for a hook created by the Bash tool (`cat >`, a heredoc, `cp`, `install -m`),
# which the PostToolUse Write|Edit|MultiEdit matcher structurally cannot see, and for one
# that arrives via git pull, merge, or rebase.
#
# So the gate no longer asks "did the write-time guard fire?" - it asks the disk, every
# stop, via the guard's own --audit. A hook created by ANY means, by ANY tool, from ANY
# session, is caught before the next stop in this repo can complete. The flag survives as
# the write-time signal that gives instant feedback; it is no longer load-bearing.
#
# Blocks ONCE per armed hook: if the model chooses not to wire it, the second Stop
# passes, so this cannot trap a session in a loop. Deliberate - the same shape as the
# chrome-tabgroup Stop reminder.

set -uo pipefail

FLAG="$HOME/.claude/.unmanaged-hook"
ACKED="$HOME/.claude/.unmanaged-hook-acked"

# This script's OWN checkout wins over CLAUDE_PROJECT_DIR, for the reason spelled out in
# hook-registry-guard.sh: a foreign CLAUDE_PROJECT_DIR made every armed name look "gone
# from disk", so the gate cleared a live arm instead of enforcing it. The symlink walk
# matters because ~/.claude/hooks symlinks back into this repo, and an unresolved link
# lands _SELF_REPO on $HOME, which has no tree and falls back to the foreign dir again.
_self="${BASH_SOURCE[0]}"
_hops=0
while [ -L "$_self" ] && [ "$_hops" -lt 40 ]; do
  _link="$(readlink "$_self")"
  case "$_link" in
    /*) _self="$_link" ;;
    *)  _self="$(dirname "$_self")/$_link" ;;
  esac
  _hops=$((_hops + 1))
done
_SELF_REPO="$(cd -P "$(dirname "$_self")/../.." 2>/dev/null && pwd -P)"
if [ -n "$_SELF_REPO" ] && [ -f "$_SELF_REPO/claude/hooks/browser-tree.json" ]; then
  REPO_DIR="$_SELF_REPO"
else
  REPO_DIR="${CLAUDE_PROJECT_DIR:-${_SELF_REPO:-$PWD}}"
fi
GUARD="$REPO_DIR/claude/hooks/hook-registry-guard.sh"

[ -x "$GUARD" ] || exit 0
# No tree means this is not the repo the guard reasons about. Bail BEFORE touching the
# flag: clearing an arm we cannot re-derive would be worse than staying silent.
[ -f "$REPO_DIR/claude/hooks/browser-tree.json" ] || exit 0

# THE SWEEP. Disk-derived and unconditional - no longer gated on the flag existing, which
# is what let three hooks through. --audit is a single python3 pass over claude/hooks/,
# ~0.05s, and it applies the same exclusions as the write-time path.
audit="$("$GUARD" --audit 2>/dev/null)"; audit_rc=$?

# 0 = clean, 1 = found some, anything else = could not tell (torn read of the tree while
# another session rewrote it). On "could not tell", leave FLAG and ACKED exactly as they
# are: a transient parse failure must not silently disarm a real block.
[ "$audit_rc" -le 1 ] || exit 0

still="$(printf '%s\n' "$audit" | sed -n 's/^UNMANAGED: //p' | sort -u)"

# THE OTHER TWO CLASSES (2026-07-27). --audit covers claude/hooks/*.sh and nothing else,
# so a hook's runtime lexicon and a whole skill directory could both go unpackaged with
# no gate anywhere - which is exactly how grounding-intent.json (hook silently dead on
# every fresh install) and the consolidate/tilt-lab skills reached main. These sweeps are
# disk-derived like the one above, so they catch a file created by ANY means.
#
# Each is treated the same way as the hook sweep: rc 0 clean, 1 found, anything else
# "cannot tell" -> contribute nothing rather than risk clearing a real block. A findings
# rc with no parseable names is self-contradictory and is likewise ignored.
# ONE invocation per mode. Every finding line is "<LABEL>: <name> (<why>)", so strip the
# label and the parenthetical to get a bare name list, exactly like the hook sweep above.
_extra() {   # $1 = guard mode
  local out rc
  out="$("$GUARD" "$1" 2>/dev/null)"; rc=$?
  [ "$rc" = "1" ] || return 0        # 0 clean, 3 cannot tell -> contribute nothing
  printf '%s\n' "$out" \
    | sed -n 's/^[A-Z][A-Z ]*: //p' \
    | sed 's/ (.*$//' \
    | sed '/^$/d' | sort -u
}
data_bad="$(_extra --audit-data)"
skills_bad="$(_extra --audit-skills)"

# rc 1 means "completed, and found some". Zero parsed names CONTRADICTS that, so the
# audit did not really complete - and believing it would clear a live arm on the strength
# of a crash. Refuse to act on a self-contradictory answer; leave FLAG and ACKED alone.
if [ "$audit_rc" = "1" ] && [ -z "$still" ]; then
  exit 0
fi

# Nothing unpackaged in ANY of the three classes - clear and let the session end.
if [ -z "$still" ] && [ -z "$data_bad" ] && [ -z "$skills_bad" ]; then
  rm -f "$FLAG" "$ACKED"
  exit 0
fi

# FLAG stays HOOK-ONLY on purpose: hook-registry-guard.sh's write-time path clears
# entries from it by bare hook name, so mixing data/skill names in would leave
# entries nothing can ever clear. The ACK key below is what spans all three classes.
mkdir -p "$(dirname "$FLAG")"
if [ -n "$still" ]; then printf '%s\n' "$still" > "$FLAG"; else rm -f "$FLAG"; fi

acked_key="$(printf 'H:%s\nD:%s\nS:%s\n' "$still" "$data_bad" "$skills_bad")"

# Already blocked once for exactly this set - let the session end.
if [ -f "$ACKED" ] && [ "$(cat "$ACKED" 2>/dev/null)" = "$acked_key" ]; then
  exit 0
fi
printf '%s' "$acked_key" > "$ACKED"

{
  if [ -n "$still" ]; then
    echo "BLOCKED: hook(s) in claude/hooks/ are not packaged, so they will not install"
    echo "anywhere else and the component browser cannot show or toggle them:"
    printf '%s\n' "$still" | sed 's/^/  - /'
    echo ""
    echo "Wire each into claude/hooks/browser-tree.json (hooks list + hook_desc + hook_owner)"
    echo "and install.sh (picked <owner> && install_app_hooks ... <name>.sh), plus"
    echo "claude/hooks/app-wirings.json for its event wiring. If it is repo-only tooling,"
    echo "wire it in .claude/settings.json and add it to pinned_hooks instead."
    echo "Verify: /bin/bash claude/hooks/test-component-browser.sh"
    echo ""
  fi
  if [ -n "$data_bad" ]; then
    echo "BLOCKED: hook COMPANION DATA file(s) are unpackaged. A hook whose lexicon or"
    echo "config does not ship FAILS OPEN SILENTLY - it installs, shows up in the browser,"
    echo "and does nothing (measured: grounding-gate emits 573 bytes with its lexicon, 0"
    echo "without). Affected:"
    printf '%s\n' "$data_bad" | sed 's/^/  - /'
    echo ""
    echo "Register each in claude/hooks/browser-tree.json \"hook_data\" under its owning"
    echo "hook, add it to install.sh's hook_data_files() table, or - if it is not a runtime"
    echo "companion - list it in \"hook_data_excluded\" WITH a reason."
    echo "Verify: /bin/bash claude/hooks/test-hook-data-parity.sh"
    echo ""
  fi
  if [ -n "$skills_bad" ]; then
    echo "BLOCKED: skill(s) in claude/skills/ are never deployed by install.sh, so they"
    echo "ship to no other machine (install.sh enumerates every skill by hand - there is"
    echo "no glob):"
    printf '%s\n' "$skills_bad" | sed 's/^/  - /'
    echo ""
    echo "Add a deploy line to the owning component's install block, following the reflect"
    echo "precedent (mkdir -p \"\$CLAUDE_DIR/skills/<n>\" + safe_cp of its SKILL.md), and"
    echo "name it in that component's FILES entry."
    echo ""
  fi
  echo "Deliberately leaving it unpackaged? Say so plainly and stop again - this blocks once."
} >&2
exit 2
