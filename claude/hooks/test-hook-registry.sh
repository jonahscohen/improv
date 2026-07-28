#!/usr/bin/env bash
# test-hook-registry.sh - hook-registry-guard.sh + hook-registry-stop.sh.
#
# Every assertion here was NEGATIVE-CONTROLLED while writing it: the behavior was broken
# on purpose and the test confirmed red before being trusted. This session shipped a
# visibly torn UI past 110 green assertions because a byte capture structurally could not
# see the defect, so an assertion nobody has watched fail is not evidence.
#
# THIS SUITE WRITES NOTHING OUTSIDE ITS OWN TEMP DIRECTORY. Every fixture goes into a
# sandbox repo copy and every flag file goes under a sandbox HOME. See the mk_sandbox
# comment below for the three false measurements that bought that rule.
set -u
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GUARD="$REPO_DIR/claude/hooks/hook-registry-guard.sh"
STOP="$REPO_DIR/claude/hooks/hook-registry-stop.sh"
pass=0; fail=0
ok(){ echo "PASS $1"; pass=$((pass+1)); }
bad(){ echo "FAIL $1"; fail=$((fail+1)); }

# ONE temp root for everything this run creates, removed on any exit. Each block used to
# take its own mktemp -d and remove it inline, so an abort partway through leaked
# directories; one root plus one trap cannot.
SBROOT="$(mktemp -d)" || { echo "FATAL: mktemp -d failed - refusing to use an unset path" >&2; exit 2; }
trap 'rm -rf "$SBROOT"' EXIT

# ---------------------------------------------------------------------------------
# SANDBOX BUILDER - and why every fixture below is built in one.
#
# This suite used to plant zz-*.sh straight into the REAL claude/hooks/ and keep its flag
# at the REAL $HOME/.claude/.unmanaged-hook. Both produced measured false readings on
# 2026-07-28, not theoretical ones:
#
#   - --audit reads the live directory, so a sweep running in ANOTHER process caught this
#     suite's in-flight fixture and reported `zz-registry-fixture` as a genuine unpackaged
#     hook, blocking a Stop gate over a file that had already been deleted. Measured with
#     the fixtures live: 6 of 18 concurrent sweeps named it, against 0 of 23 on a quiet
#     tree.
#   - the flag file is a single path shared by every process, so two runs of this suite at
#     once armed and cleared each other's state. Measured: both runs went 85/1, one losing
#     its block ("stop blocks on unmanaged hook rc=0") and the other inheriting a stale one
#     ("stop blocks only once rc=2"). Those readings were then reported as a real defect at
#     HEAD, twice.
#
# The guard end of this cannot be fixed: exempting the zz-* prefix was tried and reverted
# (the reasoning is preserved in hook-registry-guard.sh's _is_excluded) because the prefix
# that identifies a transient is the same prefix that identifies this suite's detection
# fixture. The fix belongs here, and it is this function.
#
# WHY A COPY AND NOT AN ENV VAR. The guard and the stop gate resolve their repo from their
# OWN script location, and only fall back to CLAUDE_PROJECT_DIR when that location has no
# browser-tree.json beside it. So a copy of both scripts under <root>/repo/claude/hooks/
# WITH a tree resolves to <root>/repo, while a copy without one silently resolves back to
# the real repo. Every block below therefore asserts the isolation before trusting a row.
#
# Sets: sbhome sbrepo sbg sbs sbtree sbflag sback
mk_sandbox() {
  local root="$1"
  sbhome="$root/home"; sbrepo="$root/repo"
  mkdir -p "$sbhome/.claude" "$sbrepo/claude/hooks"
  cp "$GUARD" "$STOP" "$sbrepo/claude/hooks/"
  sbg="$sbrepo/claude/hooks/hook-registry-guard.sh"
  sbs="$sbrepo/claude/hooks/hook-registry-stop.sh"
  sbtree="$sbrepo/claude/hooks/browser-tree.json"
  sbflag="$sbhome/.claude/.unmanaged-hook"; sback="$sbhome/.claude/.unmanaged-hook-acked"
  chmod +x "$sbg" "$sbs"
  cat > "$sbtree" <<'J'
{"pinned_hooks":["hook-registry-guard","hook-registry-stop"],
 "hook_owner":{"good-hook":"demo"},
 "hook_desc":{"good-hook":"a properly packaged hook"}}
J
  printf 'picked demo && install_app_hooks demo good-hook.sh\n' > "$sbrepo/install.sh"
  for h in good-hook test-sb-suite sb-fake-lib; do
    printf '#!/usr/bin/env bash\n:\n' > "$sbrepo/claude/hooks/$h.sh"
  done
}

# Run a sandbox script with the sandbox HOME and a CLAUDE_PROJECT_DIR pointing at the REAL
# repo. The foreign project dir is deliberate: it is the fallback the resolver would use if
# self-resolution failed, so every row driven through this helper is also proof that the
# copy resolved itself rather than reaching back into the live tree.
sbrun(){ HOME="$sbhome" CLAUDE_PROJECT_DIR="$REPO_DIR" "$@"; }

# LEAK DETECTOR. A suite that cleans up after itself and a suite that never wrote are
# indistinguishable from a green result, which is exactly how the defect above survived
# this long. Fingerprint the paths this suite used to mutate, and assert at the end that
# they are untouched.
#
# It fingerprints only THIS SUITE'S OWN FIXTURE NAMESPACE, never the raw state of
# the shared paths. The first cut compared the two real flag files by existence and
# contents, and went red inside an hour when a SIBLING session's Stop gate created and
# cleared ~/.claude/.unmanaged-hook-acked mid-run - a false finding about live state,
# produced by the very row written to detect false findings about live state. The shared
# paths belong to every process on this machine; only a name from this suite's own
# namespace appearing in them is evidence of a leak from HERE.
#
# Same reason it does not list the whole hooks directory: a sibling agent adding an
# unrelated hook would turn a broad listing red, and a row that goes red on someone else's
# work is a row you learn to ignore.
# The namespace is spelled out rather than reduced to a zz-/sb- prefix, because this
# suite's fixtures are not all prefixed (Codex 2026-07-28): good-hook and test-sb-suite
# are its packaged-hook fixtures, and detect-session-model borrows the name of a hook that
# ALREADY EXISTS in the live tree. That last one is the case a name listing structurally
# cannot see - the name is present before and after either way - so that file is
# CHECKSUMMED instead. An overwritten real hook is the worst leak this suite could cause
# and it was the one shape neither half of the fingerprint covered.
_FIXTURE_RE='^(zz-|sb-|good-hook|test-sb-suite|detect-session-model)'
_COLLIDING="detect-session-model.sh"
_real_footprint() {
  # (1) this suite's fixture-name space in the live hooks dir
  ls -A "$REPO_DIR/claude/hooks" 2>/dev/null | grep -E "$_FIXTURE_RE" | sort
  printf -- '--\n'
  # (2) content of any live hook whose name this suite also uses as a fixture
  for _c in $_COLLIDING; do
    [ -f "$REPO_DIR/claude/hooks/$_c" ] && shasum "$REPO_DIR/claude/hooks/$_c"
  done
  printf -- '--\n'
  # (3) this suite's synthetic names inside the real flag files, not the files themselves.
  #     test-sb-suite and detect-session-model are excluded names the guard never arms, so
  #     only the names that CAN reach a flag are looked for here.
  cat "$HOME/.claude/.unmanaged-hook" "$HOME/.claude/.unmanaged-hook-acked" 2>/dev/null \
    | grep -oE '(zz|sb)-[A-Za-z0-9._-]+|good-hook' | sort -u
}
REAL_BEFORE="$(_real_footprint)"

[ -x "$GUARD" ] && ok "guard executable" || bad "guard executable"
[ -x "$STOP" ] && ok "stop executable" || bad "stop executable"
bash -n "$GUARD" 2>/dev/null && ok "guard syntax" || bad "guard syntax"
bash -n "$STOP" 2>/dev/null && ok "stop syntax" || bad "stop syntax"

# --- --check against REAL repo state ---------------------------------------------
# READ-ONLY. --check answers a question about a name; it writes nothing, so these rows
# cannot collide with anything and are the one place the real tree is still consulted.
# A hook the installer genuinely deploys and the tree genuinely owns.
"$GUARD" --check justify-source-guard >/dev/null 2>&1 && ok "managed hook passes --check" || bad "managed hook passes --check"
# Pinned = project-scoped, always on, deliberately not installer-managed.
"$GUARD" --check beats-rebuild >/dev/null 2>&1 && ok "pinned hook counts as managed" || bad "pinned hook counts as managed"
# A name in neither the tree nor install.sh.
#
# DELIBERATELY SYNTHETIC. This used to assert on voice-mandate, a hook that really WAS
# unmanaged at the time - and then went green-to-red the moment voice-mandate got
# packaged. An assertion pinned to a real defect fails when the repo gets HEALTHIER,
# which is backwards: it punishes the fix and pressures the next person to weaken the
# test. The fixture is unmanaged by construction and stays that way.
"$GUARD" --check zz-never-packaged-xyz >/dev/null 2>&1 && bad "unmanaged name flagged" || ok "unmanaged name flagged"
# Exemptions are real and must hold: each is in claude/hooks/ and ends in .sh but is not
# wired to any event, so none has a toggle to own. If one of these ever starts flagging,
# its nature changed and the exemption needs re-justifying, not deleting.
# --check must agree with the live path and --audit; it consults the same exclusion list.
for x in detect-session-model beats-reflect-weekly node-path-default; do
  "$GUARD" --check "$x" >/dev/null 2>&1 && ok "exempt: $x" || bad "exempt: $x"
done

# --- live PostToolUse path (SANDBOXED) --------------------------------------------
# Every fixture here used to be written into the real claude/hooks/ and every flag into
# the real $HOME. Both now live under $SBROOT.
mk_sandbox "$SBROOT/live"

# ISOLATION PRECONDITION, asserted in BOTH directions before a single row below is
# believed. `good-hook` is packaged ONLY in the sandbox and `justify-source-guard` ONLY in
# the real repo, so the pair distinguishes "resolved the sandbox" from "resolved the real
# tree" - which a one-directional check cannot. Without this, a copy that silently read the
# live repo would leave every row below measuring the wrong thing while staying green.
sbrun bash "$sbg" --check good-hook >/dev/null 2>&1 \
  && ok "sandbox resolves itself: a hook only the SANDBOX packages reads as managed" \
  || bad "sandbox resolves itself: a hook only the SANDBOX packages reads as managed"
sbrun bash "$sbg" --check justify-source-guard >/dev/null 2>&1 \
  && bad "sandbox isolation: the guard copy resolved the REAL repo, not the sandbox" \
  || ok "sandbox isolation: a hook only the REAL repo packages is unmanaged in here"

mkfixture(){ printf '#!/usr/bin/env bash\necho fixture\n' > "$sbrepo/claude/hooks/zz-registry-fixture.sh"; }
payload(){ printf '{"tool_input":{"file_path":"%s"}}' "$1"; }

# Writing an unmanaged hook arms the flag AND emits the instructions.
mkfixture
out="$(payload "$sbrepo/claude/hooks/zz-registry-fixture.sh" | sbrun bash "$sbg" 2>/dev/null)"
case "$out" in *"UNMANAGED HOOK"*) ok "unmanaged write emits instructions" ;; *) bad "unmanaged write emits instructions" ;; esac
case "$out" in *"browser-tree.json"*) ok "instructions name the tree" ;; *) bad "instructions name the tree" ;; esac
case "$out" in *"install_app_hooks"*) ok "instructions name the installer line" ;; *) bad "instructions name the installer line" ;; esac
case "$out" in *"app-wirings.json"*) ok "instructions name the wiring file" ;; *) bad "instructions name the wiring file" ;; esac
grep -Fxq "zz-registry-fixture" "$sbflag" 2>/dev/null && ok "flag armed" || bad "flag armed"

# The Stop gate blocks while it is still unmanaged...
sbrun bash "$sbs" >/dev/null 2>&1; rc=$?
[ "$rc" = "2" ] && ok "stop blocks on unmanaged hook" || bad "stop blocks on unmanaged hook (rc=$rc)"
# ...and blocks only ONCE, so a session cannot be trapped.
sbrun bash "$sbs" >/dev/null 2>&1; rc=$?
[ "$rc" = "0" ] && ok "stop blocks only once" || bad "stop blocks only once (rc=$rc)"

# A managed hook does NOT arm the flag and does NOT block.
rm -f "$sbflag" "$sback"
out="$(payload "$sbrepo/claude/hooks/good-hook.sh" | sbrun bash "$sbg" 2>/dev/null)"
[ -z "$out" ] && ok "managed write is silent" || bad "managed write is silent"
[ -f "$sbflag" ] && bad "managed write leaves flag clear" || ok "managed write leaves flag clear"

# Tests and libs are not hooks - demanding an owner for them would be noise.
out="$(payload "$sbrepo/claude/hooks/test-sb-suite.sh" | sbrun bash "$sbg" 2>/dev/null)"
[ -z "$out" ] && ok "test-* excluded" || bad "test-* excluded"
out="$(payload "$sbrepo/claude/hooks/sb-fake-lib.sh" | sbrun bash "$sbg" 2>/dev/null)"
[ -z "$out" ] && ok "*-lib excluded" || bad "*-lib excluded"
# NEGATIVE-RESULT ANCHOR. The two rows above are silences, and a guard that sees nothing
# at all is silent too. The fixture row above fired on a file in this same directory, so
# the guard demonstrably reads it; what is left to prove is that these two names are
# genuinely UNPACKAGED here, or their exclusion is not what produced the silence.
{ sbrun bash "$sbg" --check test-sb-suite >/dev/null 2>&1 \
  && sbrun bash "$sbg" --check sb-fake-lib >/dev/null 2>&1 \
  && ! grep -Fq 'test-sb-suite' "$sbrepo/install.sh" \
  && ! grep -Fq 'sb-fake-lib' "$sbrepo/install.sh"; } \
  && ok "exclusion anchor: both silent names are unpackaged, so exclusion is what silenced them" \
  || bad "exclusion anchor: both silent names are unpackaged, so exclusion is what silenced them"
# Files outside claude/hooks are none of its business.
out="$(payload "$sbrepo/install.sh" | sbrun bash "$sbg" 2>/dev/null)"
# Both branches used to call ok(), so this row could not fail - it would have stayed green
# even if the guard started shouting about install.sh. Caught in cross-model review.
[ -z "$out" ] && ok "non-hook path ignored" || bad "non-hook path ignored"

# The gate self-heals: a hook deleted from disk stops blocking.
rm -f "$sbflag" "$sback"; mkfixture
payload "$sbrepo/claude/hooks/zz-registry-fixture.sh" | sbrun bash "$sbg" >/dev/null 2>&1
rm -f "$sbrepo/claude/hooks/zz-registry-fixture.sh"
sbrun bash "$sbs" >/dev/null 2>&1; rc=$?
[ "$rc" = "0" ] && ok "deleted hook stops blocking" || bad "deleted hook stops blocking (rc=$rc)"
[ -f "$sbflag" ] && bad "deleted hook clears flag" || ok "deleted hook clears flag"

# --- SYNTAX GATE (2026-07-28) -----------------------------------------------------
# A hook in claude/hooks/ is symlinked live into ~/.claude/hooks/, so a half-written
# edit is in production the instant it is saved. A stray apostrophe closed a
# `python3 -c '...'` block 184 lines early, and because that hook runs on PostToolUse
# Bash, every Bash call in every session on this machine failed until it was restored.
# The guard checked whether a hook was PACKAGED but never whether it PARSED.
#
# Driven against a SYNTHETIC repo so these rows assert the GATE, never this repo's
# tidiness (same reasoning as the sandbox block below), and through the SANDBOX guard so
# the valid-file row cannot arm the real $HOME flag. It used to: zz-syntax-fine is not
# packaged in the real tree either, so the guard walked past the syntax gate and armed
# the live flag with a name that never existed on disk.
SYN="$SBROOT/syntax"
mkdir -p "$SYN/claude/hooks"
synpay(){ printf '{"tool_input":{"file_path":"%s"}}' "$1"; }

printf '#!/bin/bash\nif [ x ; then\n' > "$SYN/claude/hooks/zz-syntax-broken.sh"
out="$(synpay "$SYN/claude/hooks/zz-syntax-broken.sh" | sbrun bash "$sbg" 2>&1)"; rc=$?
[ "$rc" = "2" ] && ok "a hook that does not parse is blocked" || bad "unparseable hook blocked (rc=$rc)"
case "$out" in *"does not parse"*) ok "the block names the defect" ;; *) bad "block names the defect" ;; esac
case "$out" in *"symlinked live"*) ok "the block explains why it is already in production" ;; *) bad "block explains symlink urgency" ;; esac
case "$out" in *"heredoc"*) ok "the block names the durable fix (quoted heredoc)" ;; *) bad "block names the durable fix" ;; esac

# The ACTUAL 2026-07-28 defect, reconstructed: an apostrophe inside a character class
# closing the single-quoted python3 -c block early.
cat > "$SYN/claude/hooks/zz-apostrophe.sh" <<'OUTER'
#!/bin/bash
printf '%s' "$1" | python3 -c '
import re
m = re.match(r"""(['"]?)(x)\1""", "x")
'
OUTER
synpay "$SYN/claude/hooks/zz-apostrophe.sh" | sbrun bash "$sbg" >/dev/null 2>&1; rc=$?
[ "$rc" = "2" ] && ok "the real apostrophe-closes-python3 defect is caught" || bad "apostrophe defect caught (rc=$rc)"

printf 'def f(\n' > "$SYN/claude/hooks/zz-broken.py"
synpay "$SYN/claude/hooks/zz-broken.py" | sbrun bash "$sbg" >/dev/null 2>&1; rc=$?
[ "$rc" = "2" ] && ok "a .py hook that does not parse is blocked too" || bad "unparseable .py blocked (rc=$rc)"

# ...and a VALID file must not be touched by the syntax gate, or the gate is noise.
printf '#!/bin/bash\nexit 0\n' > "$SYN/claude/hooks/zz-syntax-fine.sh"
out="$(synpay "$SYN/claude/hooks/zz-syntax-fine.sh" | sbrun bash "$sbg" 2>&1)"; rc=$?
[ "$rc" != "2" ] && ok "a valid hook is not blocked by the syntax gate" || bad "syntax gate misfires on valid hook"
case "$out" in *"does not parse"*) bad "the syntax gate says nothing about a valid hook" ;; *) ok "the syntax gate says nothing about a valid hook" ;; esac
# ANCHOR for the two rows above (Codex 2026-07-28). Both are NOT-FOUNDs, and a guard that
# exited before the syntax gate ever ran would satisfy both while proving nothing. This
# file is valid but UNPACKAGED in the sandbox, so a guard that really walked PAST the
# syntax gate must land in the packaging check and say so. That positive is what turns the
# two silences into "the gate looked and let it through" instead of "nothing looked".
#
# It is also why the row above is no longer labelled "stays silent": the guard's output
# here is NOT empty, and a row whose name overstates what it checks is the same defect as
# a row that checks nothing. Full silence on a valid AND packaged file is asserted by
# "managed write is silent" in the live-path block.
case "$out" in
  *"UNMANAGED HOOK"*) ok "the valid file reached the packaging check, so the syntax gate passed it rather than the guard exiting early" ;;
  *) bad "the valid file never reached the packaging check (out=$out)" ;;
esac

# Every hook actually in this repo parses. This is the row that would have gone red
# while the machine was broken. READ-ONLY over the live tree.
_syn_bad=0
for _f in "$REPO_DIR"/claude/hooks/*.sh; do
  bash -n "$_f" 2>/dev/null || { _syn_bad=$((_syn_bad+1)); echo "   unparseable: $_f"; }
done
[ "$_syn_bad" = "0" ] && ok "every hook in claude/hooks/ parses" || bad "$_syn_bad hook(s) in claude/hooks/ do not parse"

# --- audit mode (SANDBOXED) -------------------------------------------------------
# Same lesson as --check above: these used to assert the audit was DIRTY (naming
# voice-mandate), so packaging voice-mandate turned them red. The audit is now driven
# against the FIXTURE, which is unmanaged by construction.
#
# The fixture used to be planted in the REAL claude/hooks/, and this block is where that
# hurt most: --audit globs the live directory, so these five rows spent their whole
# runtime with an unpackaged hook sitting in the tree for any other process to find. It is
# planted in a fresh sandbox now. The real tree gets ONE read-only health row at the end.
mk_sandbox "$SBROOT/audit"
# An exempt name must be present on disk for the exemption row to mean anything.
printf '#!/usr/bin/env bash\n:\n' > "$sbrepo/claude/hooks/detect-session-model.sh"
sbrun bash "$sbg" --audit >/dev/null 2>&1; rc=$?
[ "$rc" = "0" ] && ok "audit exits 0 when every hook is packaged" || bad "audit exits 0 when every hook is packaged (rc=$rc)"

mkfixture
sbrun bash "$sbg" --audit >/dev/null 2>&1; rc=$?
[ "$rc" = "1" ] && ok "audit exits 1 when a hook is unmanaged" || bad "audit exits 1 when a hook is unmanaged (rc=$rc)"
audit_out="$(sbrun bash "$sbg" --audit 2>/dev/null)"
case "$audit_out" in *"UNMANAGED: zz-registry-fixture"*) ok "audit names the unmanaged hook" ;; *) bad "audit names the unmanaged hook" ;; esac
# The two exclusion rows are NOT-FOUNDs, and the positive above is their anchor: the same
# invocation that stayed silent about these names did report the fixture, so the sweep
# demonstrably read this directory. Both excluded files are on disk and unpackaged here.
case "$audit_out" in *"UNMANAGED: test-"*) bad "audit excludes tests" ;; *) ok "audit excludes tests" ;; esac
case "$audit_out" in *"UNMANAGED: detect-session-model"*) bad "audit excludes exemptions" ;; *) ok "audit excludes exemptions" ;; esac
{ [ -f "$sbrepo/claude/hooks/test-sb-suite.sh" ] && [ -f "$sbrepo/claude/hooks/detect-session-model.sh" ]; } \
  && ok "exclusion anchor: both excluded files were on disk during that sweep" \
  || bad "exclusion anchor: both excluded files were on disk during that sweep"

# The ONE row that consults the real tree, and it only reads it. A red here means this
# repo genuinely has an unpackaged hook (or a sibling agent is mid-write) - it says
# nothing about the gate, which the sandbox rows above cover on their own.
real_audit="$("$GUARD" --audit 2>/dev/null)"; rc=$?
[ "$rc" = "0" ] \
  && ok "the real claude/hooks/ has no unpackaged hook" \
  || bad "the real claude/hooks/ audit did not come back clean (rc=$rc): $real_audit"

# --- the escape that put three unmanaged hooks on main (2026-07-23) ------------------
# task-loop-mandate, justify-queue-mandate and justify-queue-drain-stop were written into
# this repo by a session whose PROJECT was a different repo (cwd .../ppai, writing into
# improv by absolute path). The guard is project-scoped, so it never ran; nothing armed
# the flag; and the Stop gate returned at its `[ -f "$FLAG" ]` line on every improv stop
# for five days while all three sat in the tree and got committed. Same dead end for a
# hook made by the Bash tool (`cat >`, heredoc, `cp`), which the Write|Edit|MultiEdit
# matcher structurally cannot see, and for one that arrives by git pull.
#
# These rows run against a SYNTHETIC repo with its own $HOME, so they assert the GATE and
# never this repo's tidiness. A row that goes red merely because the real tree is
# momentarily dirty is a row that trains you to ignore the suite.
SB="$SBROOT/escape"
mk_sandbox "$SB"
sbother="$SB/other"
mkdir -p "$sbother/claude/hooks"
sbclear(){ rm -f "$sbflag" "$sback"; }

# A fully packaged repo must stay SILENT. A gate that fires on everything gets ignored,
# and this one now runs on every single stop.
sbclear
out="$(HOME="$sbhome" CLAUDE_PROJECT_DIR="$sbrepo" bash "$sbs" 2>&1)"; rc=$?
{ [ "$rc" = "0" ] && [ -z "$out" ]; } && ok "packaged repo: stop stays silent" || bad "packaged repo: stop stays silent (rc=$rc out=$out)"

# THE ESCAPE. A hook appears on disk with no write-time guard involvement at all - the
# Bash tool, another project's session, a git pull. The flag is genuinely never armed.
printf '#!/usr/bin/env bash\n:\n' > "$sbrepo/claude/hooks/sb-unpackaged.sh"
[ -f "$sbflag" ] && bad "escape precondition: flag genuinely unarmed" || ok "escape precondition: flag genuinely unarmed"
out="$(HOME="$sbhome" CLAUDE_PROJECT_DIR="$sbrepo" bash "$sbs" 2>&1)"; rc=$?
[ "$rc" = "2" ] && ok "stop blocks a hook no write-time guard ever saw" || bad "stop blocks a hook no write-time guard ever saw (rc=$rc)"
case "$out" in *sb-unpackaged*) ok "stop names the unseen hook" ;; *) bad "stop names the unseen hook" ;; esac
# Exclusions survive the sweep, or the gate becomes noise.
case "$out" in *test-sb-suite*) bad "sweep excludes test-*" ;; *) ok "sweep excludes test-*" ;; esac
case "$out" in *sb-fake-lib*) bad "sweep excludes *-lib" ;; *) ok "sweep excludes *-lib" ;; esac
case "$out" in *good-hook*) bad "sweep leaves packaged hooks alone" ;; *) ok "sweep leaves packaged hooks alone" ;; esac
# Still blocks ONCE - the sweep must not be able to trap a session in a loop.
HOME="$sbhome" CLAUDE_PROJECT_DIR="$sbrepo" bash "$sbs" >/dev/null 2>&1; rc=$?
[ "$rc" = "0" ] && ok "sweep blocks only once" || bad "sweep blocks only once (rc=$rc)"

# A foreign CLAUDE_PROJECT_DIR is exactly the shape of the real incident: it used to make
# --audit glob an empty directory and call the repo clean, and made the Stop gate treat
# every armed name as gone-from-disk and clear the arm.
sbclear
HOME="$sbhome" CLAUDE_PROJECT_DIR="$sbother" bash "$sbg" --audit >/dev/null 2>&1; rc=$?
[ "$rc" = "1" ] && ok "audit resolves its own repo, not CLAUDE_PROJECT_DIR" || bad "audit resolves its own repo, not CLAUDE_PROJECT_DIR (rc=$rc)"
HOME="$sbhome" CLAUDE_PROJECT_DIR="$sbother" bash "$sbs" >/dev/null 2>&1; rc=$?
[ "$rc" = "2" ] && ok "foreign CLAUDE_PROJECT_DIR cannot blind the gate" || bad "foreign CLAUDE_PROJECT_DIR cannot blind the gate (rc=$rc)"
sbclear
out="$(printf '{"tool_input":{"file_path":"%s"}}' "$sbrepo/claude/hooks/sb-unpackaged.sh" | HOME="$sbhome" CLAUDE_PROJECT_DIR="$sbother" bash "$sbg" 2>&1)"
case "$out" in *"UNMANAGED HOOK"*) ok "cross-project write still instructs" ;; *) bad "cross-project write still instructs" ;; esac
grep -Fxq "sb-unpackaged" "$sbflag" 2>/dev/null && ok "cross-project write arms the flag" || bad "cross-project write arms the flag"

# Invoked THROUGH a symlink, the way ~/.claude/hooks does it. BASH_SOURCE plus a plain
# `cd` does not resolve symlinks, so without the walk _SELF_REPO lands on the link's
# grandparent, finds no tree there, falls back to CLAUDE_PROJECT_DIR - and the whole
# foreign-project blind spot reopens under a different name. Review finding.
sbclear
mkdir -p "$sbhome/.claude/hooks"
ln -sf "$sbs" "$sbhome/.claude/hooks/hook-registry-stop.sh"
HOME="$sbhome" CLAUDE_PROJECT_DIR="$sbother" bash "$sbhome/.claude/hooks/hook-registry-stop.sh" >/dev/null 2>&1; rc=$?
[ "$rc" = "2" ] && ok "symlinked invocation still finds the real repo" || bad "symlinked invocation still finds the real repo (rc=$rc)"
rm -f "$sbhome/.claude/hooks/hook-registry-stop.sh"

# Self-heal survives the rewrite: delete the file, the sweep stops reporting it.
sbclear; rm -f "$sbrepo/claude/hooks/sb-unpackaged.sh"
printf 'sb-unpackaged\n' > "$sbflag"
HOME="$sbhome" CLAUDE_PROJECT_DIR="$sbrepo" bash "$sbs" >/dev/null 2>&1; rc=$?
[ "$rc" = "0" ] && ok "sweep self-heals on a deleted hook" || bad "sweep self-heals on a deleted hook (rc=$rc)"
[ -f "$sbflag" ] && bad "sweep clears the flag when clean" || ok "sweep clears the flag when clean"

# TORN READ. The gate now clears a live arm whenever the audit says "clean", so "clean"
# and "I could not parse the tree" must not look alike. Seen for real on 2026-07-23 while
# a concurrent session was rewriting browser-tree.json mid-suite.
printf '#!/usr/bin/env bash\n:\n' > "$sbrepo/claude/hooks/sb-unpackaged.sh"
printf 'sb-unpackaged\n' > "$sbflag"; rm -f "$sback"
cp "$sbtree" "$SB/tree.bak"; printf '{ "pinned_hooks": [' > "$sbtree"
HOME="$sbhome" CLAUDE_PROJECT_DIR="$sbrepo" bash "$sbg" --audit >/dev/null 2>&1; rc=$?
[ "$rc" = "3" ] && ok "torn tree is 'cannot tell', not 'clean'" || bad "torn tree is 'cannot tell', not 'clean' (rc=$rc)"
HOME="$sbhome" CLAUDE_PROJECT_DIR="$sbrepo" bash "$sbs" >/dev/null 2>&1; rc=$?
[ "$rc" = "0" ] && ok "torn tree does not block on a transient" || bad "torn tree does not block on a transient (rc=$rc)"
[ -f "$sbflag" ] && ok "torn tree leaves the arm intact" || bad "torn tree leaves the arm intact"
cp "$SB/tree.bak" "$sbtree"

# A tree that PARSES but is the wrong shape used to crash the batch python, which exited 1
# with nothing printed - and the gate reads 1 as "found some", so an empty found-set
# cleared a live arm. Fail-open, flagged in cross-model review. Now it is a 3 like any
# other incomplete audit.
sbclear
printf '#!/usr/bin/env bash\n:\n' > "$sbrepo/claude/hooks/sb-unpackaged.sh"
printf 'sb-unpackaged\n' > "$sbflag"
cp "$sbtree" "$SB/tree.bak"; printf '[]\n' > "$sbtree"
HOME="$sbhome" CLAUDE_PROJECT_DIR="$sbrepo" bash "$sbg" --audit >/dev/null 2>&1; rc=$?
[ "$rc" = "3" ] && ok "wrong-shaped tree is 'cannot tell', not 'found none'" || bad "wrong-shaped tree is 'cannot tell', not 'found none' (rc=$rc)"
HOME="$sbhome" CLAUDE_PROJECT_DIR="$sbrepo" bash "$sbs" >/dev/null 2>&1
[ -f "$sbflag" ] && ok "wrong-shaped tree leaves the arm intact" || bad "wrong-shaped tree leaves the arm intact"
cp "$SB/tree.bak" "$sbtree"; rm -f "$sbrepo/claude/hooks/sb-unpackaged.sh"

# THE OTHER TWO SWEEPS HAD NO SUCH PROTECTION (2026-07-28). --audit's rc 3 was handled
# above, but _extra() collapsed every non-1 rc into "contributed nothing", so a data or
# skills audit that CANNOT TELL was indistinguishable from one that found nothing - and
# the very next branch does `rm -f "$FLAG" "$ACKED"` on that empty result. An unparseable
# audit therefore cleared a live block and exited 0, the exact inversion the comment
# directly above _extra claims to prevent.
#
# Driven with a STUB guard so the "cannot tell" is unambiguous and not a side effect of
# some other fixture. Each mode is failed on its own, because they are read separately.
sbclear
cp "$sbg" "$SB/guard.bak"
for mode in --audit-data --audit-skills; do
  cat > "$sbg" <<STUB
#!/usr/bin/env bash
# stub: every sweep is clean EXCEPT $mode, which cannot tell (rc 3)
case "\${1:-}" in
  "$mode") exit 3 ;;
  --audit|--audit-data|--audit-skills) exit 0 ;;
esac
exit 0
STUB
  chmod +x "$sbg"
  printf 'sb-live-arm\n' > "$sbflag"; rm -f "$sback"
  out="$(HOME="$sbhome" CLAUDE_PROJECT_DIR="$sbrepo" bash "$sbs" 2>&1)"; rc=$?
  [ -f "$sbflag" ] \
    && ok "$mode 'cannot tell' leaves a live arm intact" \
    || bad "$mode 'cannot tell' cleared a live arm (rc=$rc out=$out)"
  [ -f "$sback" ] \
    && bad "$mode 'cannot tell' wrote an ack it cannot justify" \
    || ok "$mode 'cannot tell' does not ack a block it never proved"
  # Deliberately NOT a block: a torn read is transient, and the --audit rows above
  # already fix that contract. Blocking on a transient trains you to ignore the gate.
  [ "$rc" = "0" ] \
    && ok "$mode 'cannot tell' does not block on a transient" \
    || bad "$mode 'cannot tell' blocked on a transient (rc=$rc out=$out)"
done
cp "$SB/guard.bak" "$sbg"; chmod +x "$sbg"; sbclear

# PERMANENTLY inert is a different animal from transiently unreadable. With no python3
# on PATH every sweep fails forever, so the gate can never block and never will - it
# just returns 0 on every stop, which is indistinguishable from "the repo is clean".
# That one is worth saying out loud, once.
NOPY="$SB/nopy"; mkdir -p "$NOPY"
for b in sed sort cat mkdir rm basename dirname readlink chmod grep printf; do
  src="$(command -v "$b")" && ln -sf "$src" "$NOPY/$b"
done
command -v python3 >/dev/null && [ ! -e "$NOPY/python3" ] \
  && ok "nopy precondition: python3 exists but is off the probe PATH" \
  || bad "nopy precondition: python3 exists but is off the probe PATH"
printf 'sb-live-arm\n' > "$sbflag"; rm -f "$sback"
out="$(HOME="$sbhome" CLAUDE_PROJECT_DIR="$sbrepo" PATH="$NOPY" /bin/bash "$sbs" 2>&1)"; rc=$?
[ -f "$sbflag" ] && ok "no python3: a live arm survives" || bad "no python3: a live arm was cleared (rc=$rc)"
[ "$rc" = "2" ] && ok "no python3: the gate says so instead of passing silently" || bad "no python3: gate passed silently (rc=$rc out=$out)"
case "$out" in *python3*) ok "no python3: the message names the missing interpreter" ;; *) bad "no python3: message names the interpreter (out=$out)" ;; esac
out="$(HOME="$sbhome" CLAUDE_PROJECT_DIR="$sbrepo" PATH="$NOPY" /bin/bash "$sbs" 2>&1)"; rc=$?
[ "$rc" = "0" ] && ok "no python3: still blocks only once" || bad "no python3: blocks more than once (rc=$rc)"

# CROSS-MODEL REVIEW (Codex, 2026-07-28): a CONSTANT ack key acknowledged "no python3"
# once per $HOME, so a NEW unpackaged hook arming the flag later was never reported.
# The key carries the flag contents, so a changed live state speaks again.
printf 'sb-live-arm\nsb-newly-armed\n' > "$sbflag"
out="$(HOME="$sbhome" CLAUDE_PROJECT_DIR="$sbrepo" PATH="$NOPY" /bin/bash "$sbs" 2>&1)"; rc=$?
[ "$rc" = "2" ] && ok "no python3: a NEW live arm is reported despite the earlier ack" || bad "no python3: new arm silently swallowed (rc=$rc)"

# ...and a python3 that RESOLVES but cannot run (an empty version shim) is the same
# class: command -v succeeds, every sweep exits 127, and the gate used to pass silently.
BROKEN="$SB/brokenpy"; mkdir -p "$BROKEN"
for b in sed sort cat mkdir rm basename dirname readlink chmod grep printf; do
  src="$(command -v "$b")" && ln -sf "$src" "$BROKEN/$b"
done
printf '#!/bin/sh\nexit 127\n' > "$BROKEN/python3"; chmod +x "$BROKEN/python3"
printf 'sb-live-arm\n' > "$sbflag"; rm -f "$sback"
out="$(HOME="$sbhome" CLAUDE_PROJECT_DIR="$sbrepo" PATH="$BROKEN" /bin/bash "$sbs" 2>&1)"; rc=$?
[ "$rc" = "2" ] && ok "a python3 that resolves but cannot run blocks loudly" || bad "broken python3 shim passed silently (rc=$rc out=$out)"
case "$out" in *"cannot execute"*) ok "the message distinguishes a broken shim from a missing binary" ;; *) bad "broken-shim message (out=$out)" ;; esac
[ -f "$sbflag" ] && ok "broken python3 shim leaves a live arm intact" || bad "broken python3 shim cleared a live arm"
sbclear

# The batch audit and the per-name --check are two implementations of one question. They
# are asserted equal here so the fast path cannot quietly drift from _is_managed.
#
# managed = pinned OR (in hook_owner AND named by install.sh), so BOTH asymmetric halves
# are fixtured first: sb-tree-only is owned but never deployed (the browser would offer a
# toggle for something no machine installs), sb-installer-only is deployed but unowned
# (the browser under-reports - the original sidecoach 2-vs-6 lie). Without these two, a
# batch rewrite that accepted either half ALONE would still pass this row. Review finding.
sbclear
python3 - "$sbtree" <<'PY'
import json, sys
p = sys.argv[1]
d = json.load(open(p))
d["hook_owner"]["sb-tree-only"] = "demo"
json.dump(d, open(p, "w"), indent=2)
PY
printf 'picked demo && install_app_hooks demo good-hook.sh sb-installer-only.sh\n' > "$sbrepo/install.sh"
printf '#!/usr/bin/env bash\n:\n' > "$sbrepo/claude/hooks/sb-tree-only.sh"
printf '#!/usr/bin/env bash\n:\n' > "$sbrepo/claude/hooks/sb-installer-only.sh"
audit_out="$(HOME="$sbhome" CLAUDE_PROJECT_DIR="$sbrepo" bash "$sbg" --audit 2>/dev/null)"
case "$audit_out" in *sb-tree-only*) ok "tree-only hook is unmanaged" ;; *) bad "tree-only hook is unmanaged" ;; esac
case "$audit_out" in *sb-installer-only*) ok "installer-only hook is unmanaged" ;; *) bad "installer-only hook is unmanaged" ;; esac
audit_set="$(HOME="$sbhome" CLAUDE_PROJECT_DIR="$sbrepo" bash "$sbg" --audit 2>/dev/null | sed -n 's/^UNMANAGED: //p' | sort)"
check_set=""
for f in "$sbrepo"/claude/hooks/*.sh; do
  n="$(basename "$f" .sh)"
  HOME="$sbhome" CLAUDE_PROJECT_DIR="$sbrepo" bash "$sbg" --check "$n" >/dev/null 2>&1 || check_set="$check_set$n"$'\n'
done
check_set="$(printf '%s' "$check_set" | sed '/^$/d' | sort)"
[ "$audit_set" = "$check_set" ] && ok "batch audit agrees with per-name --check" || bad "batch audit agrees with per-name --check ([$audit_set] vs [$check_set])"

# ---------------------------------------------------------------------------
# --audit-skills, and the API COUPLING NOBODY WAS WATCHING (2026-07-28).
#
# The skills audit matched `copy_bundled_skill <name>`. install.sh renamed that
# function to `install_bundled_skill` and NOTHING went red, because no test tied the
# guard's regex to the installer's actual API. The branch was simply dead.
#
# The damage was not a dead branch, it was CONFIDENT FALSE FINDINGS: the modern bundle
# path is `for _skill in ...; do install_bundled_skill "$_skill"; done`, which the old
# check missed on both counts (wrong name, variable arg), so every skill deployed only
# through that loop was reported as shipping nowhere. It said exactly that about
# `sidecoach` and `voice-output`, and an agent nearly added a redundant deploy line to
# satisfy a blind check.
#
# Row 1 is the coupling row. It goes RED if either side is renamed again. READ-ONLY.
DEPLOY_FN="$(sed -n 's/^\([a-z_][a-z0-9_]*\)() {$/\1/p' "$REPO_DIR/install.sh" \
             | grep -x 'install_bundled_skill' || true)"
[ -n "$DEPLOY_FN" ] \
  && ok "install.sh still defines install_bundled_skill (the name --audit-skills matches)" \
  || bad "install.sh no longer defines install_bundled_skill - --audit-skills is matching a name that does not exist, which is exactly the drift that made it report live skills as unpackaged"
# Both rows below scan the guard with COMMENT LINES STRIPPED (Codex 2026-07-28). The
# guard's own prose discusses both function names at length - it is where the rename is
# documented - so a whole-file grep answered from the comments no matter what the code
# did. Stripping comments is what makes these rows read the IMPLEMENTATION.
_guard_code="$(grep -vE '^[[:space:]]*#' "$GUARD")"
printf '%s' "$_guard_code" | grep -qE '(^|[^_[:alnum:]-])install_bundled_skill([^_[:alnum:]-]|$)' \
  && ok "the guard matches the deploy function install.sh actually defines" \
  || bad "the guard does not mention install_bundled_skill - it has drifted off the installer API again"
# This row used to be `grep -Fq 'copy_bundled_skill\s'` - FIXED-STRING, so the \s was two
# literal characters that appear nowhere, and the row could never fire. It always took the
# ok branch. Caught in cross-model review; it is a word-boundary regex now, which does
# match a real stale reference like `copy_bundled_skill foo`.
printf '%s' "$_guard_code" | grep -qE '(^|[^_[:alnum:]-])copy_bundled_skill([^_[:alnum:]-]|$)' \
  && bad "the guard still references the removed copy_bundled_skill" \
  || ok "the guard no longer references the removed copy_bundled_skill"

# Rows 2-5 run against a synthetic repo so they assert on shapes, not on whatever the
# real install.sh happens to say today.
#
# The browser-tree.json below is not decoration and not read by --audit-skills: it is what
# makes the guard copy resolve THIS directory as its repo. Without it _SELF_REPO has no
# tree, the resolver falls through to CLAUDE_PROJECT_DIR, and under any invocation that
# sets that variable (every hook run, and any CI that exports it) these rows would silently
# audit the REAL claude/skills against the REAL install.sh while still printing PASS.
SKB="$SBROOT/skills"
mkdir -p "$SKB/claude/hooks" "$SKB/claude/skills"
cp "$GUARD" "$SKB/claude/hooks/"; chmod +x "$SKB/claude/hooks/hook-registry-guard.sh"
printf '{"pinned_hooks":[],"hook_owner":{},"hook_desc":{}}\n' > "$SKB/claude/hooks/browser-tree.json"
skg="$SKB/claude/hooks/hook-registry-guard.sh"
mkdir -p "$SKB/home/.claude"
skrun(){ HOME="$SKB/home" CLAUDE_PROJECT_DIR="$REPO_DIR" "$@"; }
for s in lit-skill loop-skill path-skill; do mkdir -p "$SKB/claude/skills/$s"; done
cat > "$SKB/install.sh" <<'SH'
install_bundled_skill() { :; }
install_bundled_skill lit-skill
for _skill in loop-skill; do
  install_bundled_skill "$_skill"
done
safe_cp "claude/skills/path-skill" "$HOME/.claude/skills/path-skill"
SH
out="$(skrun bash "$skg" --audit-skills 2>&1)"; rc=$?
{ [ "$rc" = 0 ] && [ -z "$out" ]; } \
  && ok "skills: literal arg, LOOP-passed variable, and path form all count as deployed" \
  || bad "skills: a deployed shape was reported unmanaged (rc=$rc out=$out)"

# A guard that reports nothing is indistinguishable from a guard that SEES nothing, so
# the silence above only means something next to a planted positive. This is also the row
# that proves the copy resolved $SKB: zz-planted-skill exists in no other checkout.
mkdir -p "$SKB/claude/skills/zz-planted-skill"
out="$(skrun bash "$skg" --audit-skills 2>&1)"; rc=$?
{ [ "$rc" = 1 ] && case "$out" in *zz-planted-skill*) true ;; *) false ;; esac; } \
  && ok "skills: a genuinely unpackaged skill is still reported" \
  || bad "skills: planted unpackaged skill not caught (rc=$rc out=$out)"
rm -rf "$SKB/claude/skills/zz-planted-skill"

# CANNOT TELL beats a confident lie. An argument that cannot be resolved statically
# makes the deployed set incomplete, so "not in deployed" stops being evidence.
mkdir -p "$SKB/claude/skills/mystery-skill"
cat > "$SKB/install.sh" <<'SH'
install_bundled_skill() { :; }
install_bundled_skill lit-skill
for _skill in loop-skill; do
  install_bundled_skill "$_skill"
done
safe_cp "claude/skills/path-skill" "$HOME/.claude/skills/path-skill"
install_bundled_skill "$SOME_UNRESOLVABLE_NAME"
SH
out="$(skrun bash "$skg" --audit-skills 2>&1)"; rc=$?
{ [ "$rc" = 3 ] && case "$out" in *"CANNOT TELL"*) true ;; *) false ;; esac; } \
  && ok "skills: an unresolvable deploy argument reports CANNOT TELL (exit 3), not a false finding" \
  || bad "skills: unresolvable argument should be exit 3 (rc=$rc out=$out)"

# Both rows below are Codex findings (2026-07-28) against the first cut of the resolver.
# A COMPOSED argument is not a bare variable. The capture used to stop at `}`, so
# "${_skill}-extra" was truncated to "${_skill", resolved as the bare variable, and the
# loop's words were marked deployed - a fabricated deploy set from an argument that
# names none of them.
rm -rf "$SKB/claude/skills/mystery-skill"
cat > "$SKB/install.sh" <<'SH'
install_bundled_skill() { :; }
for _skill in loop-skill; do
  install_bundled_skill "${_skill}-extra"
done
SH
out="$(skrun bash "$skg" --audit-skills 2>&1)"; rc=$?
{ [ "$rc" = 3 ] && case "$out" in *"CANNOT TELL"*) true ;; *) false ;; esac; } \
  && ok "skills: a COMPOSED argument (\${var}-suffix) is CANNOT TELL, not a fabricated deploy set" \
  || bad "skills: composed argument should be exit 3 (rc=$rc out=$out)"

# A loop variable reused by a LATER loop must not resolve an earlier call against the
# later word list. lit-skill is deployed by the first loop; the second loop reuses the
# same variable for a different skill, and must not launder path-skill into deployed.
cat > "$SKB/install.sh" <<'SH'
install_bundled_skill() { :; }
for _skill in lit-skill; do
  install_bundled_skill "$_skill"
done
for _skill in loop-skill; do
  install_bundled_skill "$_skill"
done
SH
out="$(skrun bash "$skg" --audit-skills 2>&1)"; rc=$?
{ [ "$rc" = 1 ] \
  && case "$out" in *path-skill*) true ;; *) false ;; esac \
  && case "$out" in *lit-skill*) false ;; *) true ;; esac \
  && case "$out" in *loop-skill*) false ;; *) true ;; esac; } \
  && ok "skills: a reused loop variable resolves against its OWN nearest preceding loop" \
  || bad "skills: reused loop variable resolved wrongly (rc=$rc out=$out)"

# SINGLE QUOTES SUPPRESS EXPANSION (Codex 2026-07-28). '$_skill' is the literal text,
# so it deploys nothing; treating it as the variable marked the loop's whole word list
# deployed, which HIDES an unpackaged skill rather than inventing one.
cat > "$SKB/install.sh" <<'SH'
install_bundled_skill() { :; }
for _skill in loop-skill; do
  install_bundled_skill '$_skill'
done
SH
out="$(skrun bash "$skg" --audit-skills 2>&1)"; rc=$?
{ [ "$rc" = 1 ] && case "$out" in *loop-skill*) true ;; *) false ;; esac; } \
  && ok "skills: a SINGLE-QUOTED argument is a literal, not a variable (loop-skill is not laundered into deployed)" \
  || bad "skills: single-quoted arg mishandled (rc=$rc out=$out)"

# A call AFTER `done` is outside the loop body, so the loop's word list says nothing
# about it. Nearest-preceding-header alone accepted this; do/done balancing rejects it.
cat > "$SKB/install.sh" <<'SH'
install_bundled_skill() { :; }
for _skill in loop-skill; do
  :
done
install_bundled_skill "$_skill"
SH
out="$(skrun bash "$skg" --audit-skills 2>&1)"; rc=$?
{ [ "$rc" = 3 ] && case "$out" in *"CANNOT TELL"*) true ;; *) false ;; esac; } \
  && ok "skills: a call OUTSIDE the loop body does not inherit its word list (CANNOT TELL)" \
  || bad "skills: out-of-body call resolved anyway (rc=$rc out=$out)"

# --- the row that proves the rest of this file did what it says ---------------------
# Asserted LAST, against the fingerprint taken before the first row ran. If any block
# above regresses to planting a fixture in the live tree or arming the real flag, this
# goes red even though that block's own assertions would still be green - which is the
# whole failure mode: the suite passed while feeding false findings to every other
# process reading the same directory.
REAL_AFTER="$(_real_footprint)"
[ "$REAL_AFTER" = "$REAL_BEFORE" ] \
  && ok "no fixture name from this suite reached the live tree or the real \$HOME flags" \
  || bad "a fixture name from this suite reached live state: [$REAL_BEFORE] -> [$REAL_AFTER]"

# STATIC BAN - the half a fingerprint structurally CANNOT cover (Codex 2026-07-28).
# Comparing before against after cannot see a write that is UNDONE before the end, and a
# transient write is precisely the failure mode this whole change exists to end: a
# concurrent --audit only needs the file to exist for the length of one glob, which is how
# 6 of 18 sweeps came back naming a fixture that no longer existed. So the ban is enforced
# on this file's SOURCE as well: no line here may redirect into, or aim a mutating command
# at, $REPO_DIR or the real $HOME.
#
# The forms it covers are deliberately broad, because the near misses are all one
# character from the real thing (Codex second and third passes): `${REPO_DIR}` as well as
# `$REPO_DIR`, an fd-numbered `2>`, a clobbering `>|`, and `tee` and `install` alongside
# the other writers. `install` is safe to list despite install.sh, install_app_hooks and
# install_bundled_skill all appearing in this file: the pattern requires WHITESPACE after
# the word, and each of those is followed by `.` or `_`.
#
# KNOWN LIMIT, stated rather than hidden: a path laundered through an intermediate
# variable ($GUARD as a destination, say) would slip past any source scan, and the scanner
# skips its own line by marker. Neither this row nor the fingerprint above is sufficient
# alone - which is why both are here, and why the mutation control plants both a leftover
# and a transient live write and requires a red from each.
_self_src="${BASH_SOURCE[0]}"
_live_writes="$(grep -vE '^[[:space:]]*#|no-live-write-scan' "$_self_src" \
  | grep -E '(^|[[:space:]]|[;&|(])[0-9]*>>?\|?[[:space:]]*"?\$\{?(REPO_DIR|HOME)\}?|(^|[^0-9A-Za-z_])(rm|cp|mv|ln|mkdir|touch|tee|install|sed -i)[[:space:]][^|]*\$\{?(REPO_DIR|HOME)\}?/')"  # no-live-write-scan
[ -z "$_live_writes" ] \
  && ok "no line in this suite writes into the live tree or the real \$HOME" \
  || bad "this suite has a line that writes live state: $_live_writes"

echo "== $pass passed, $fail failed =="
[ "$fail" = 0 ]
