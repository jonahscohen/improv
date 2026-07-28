#!/bin/bash
# test-installer-skill-retirement.sh - retiring a skill must take it OFF machines that
# already have it, and must not take anything else.
#
# THE DEFECT CLASS. When design-build and design-references were retired (0 invocations
# each in two months), the obvious edit was to delete their component keys, arrays, status
# cases and deactivate lines together. Those `rm -rf` lines were the ONLY code anywhere
# that could remove the directories from an installed machine, and they were reachable only
# through the component keys being deleted in the same breath. Do that and every machine
# keeps both skills forever with the model still loading them. The same mechanism already
# produced the `improv` orphan (session_2026-07-26_orphan-improv-skill.md), so this is a
# recurring shape, not a one-off.
#
# The existing prune cannot cover it: it walks DIRECT CHILDREN of ~/.claude/skills and
# considers only SYMLINKS whose target is gone, and a copy-mode machine has real
# DIRECTORIES. remove_retired_skills is the answer, and this file is what holds it honest.
#
# THE TWO THINGS THAT MUST BOTH BE TRUE, and why one row cannot check them:
#   - a retired skill THIS INSTALLER installed is removed
#   - a directory of the same name it did NOT install is left alone
# A sweep that removes everything satisfies the first. A sweep that removes nothing
# satisfies the second. So every "left alone" row runs in the SAME installer invocation as
# a "removed" row, and the removal is that row's positive control: if both survive, the
# sweep never ran and the negative proves nothing.
#
# THE REPO_DIR TRAP, hit by three separate agents today and designed around here.
# install.sh recomputes REPO_DIR from its own script location, so an env override does
# NOTHING and every comparison silently runs against the REAL repo - which reports a
# comfortable "0 removable" that agrees with whatever you expected. This suite never
# overrides REPO_DIR. It drives a STAGED COPY of the installer, so the path the installer
# derives for itself IS the sandbox, and it asserts a positive control in every negative
# scenario so a fixture that quietly did nothing cannot read as a clean result.
#
# Exit codes:
#   0  every row passed
#   1  one or more rows failed
#   2  harness/setup error - the subject could not be located or staged
#
# Containment: every run uses a sandbox $HOME under $TMPROOT and a staged repo copy.
# Nothing here reads or writes the live ~/.claude, ~/.zshrc, or the checkout.

set -u

TARGET_REPO="${IMPROV_TEST_TARGET_REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
INSTALLER="$TARGET_REPO/install.sh"
[ -f "$INSTALLER" ] || { echo "HARNESS: install.sh not found at $INSTALLER" >&2; exit 2; }
command -v python3 >/dev/null 2>&1 || { echo "HARNESS: python3 required (the state file is JSON)" >&2; exit 2; }

PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); printf 'PASS %s\n' "$1"; }
bad() { FAIL=$((FAIL+1)); printf 'FAIL %s\n      -> %s\n' "$1" "${2:-}"; }

TMPROOT="$(mktemp -d "${TMPDIR:-/tmp}/improv-retire-XXXXXX")" \
  || { echo "HARNESS: mktemp -d failed" >&2; exit 2; }
trap 'rm -rf "$TMPROOT"' EXIT

LIVE_SKILLS_BEFORE="$(ls -1 "$HOME/.claude/skills" 2>/dev/null | LC_ALL=C sort)"

# stage <name> -> echoes the staged repo dir. A full copy, because the installer resolves
# REPO_DIR from its own location and reads claude/ out of it.
stage() {
  local d="$TMPROOT/$1"
  mkdir -p "$d/repo" "$d/home/.claude/skills" || return 1
  : > "$d/home/.zshrc" || return 1
  cp "$INSTALLER" "$d/repo/install.sh" || return 1
  cp -R "$TARGET_REPO/claude" "$d/repo/" 2>/dev/null || return 1
  printf '%s' "$d"
}

# seed_state <home> <key=val>... - write a state file recording what this installer
# "installed". This is the provenance oracle the sweep consults.
seed_state() {
  local h="$1"; shift
  local kv
  python3 - "$h/.claude/.dotfiles-state" "$@" <<'PY'
import json, sys
path = sys.argv[1]
comps = {}
for kv in sys.argv[2:]:
    k, _, v = kv.partition("=")
    comps[k] = v
json.dump({"version": 1, "first_install_at": "", "last_run_at": "",
           "last_install_sha": "", "components": comps}, open(path, "w"), indent=2)
PY
}

state_has() { # <home> <key> -> 0 if the key is present
  python3 -c "
import json,sys
try: d=json.load(open(sys.argv[1]))
except Exception: sys.exit(1)
sys.exit(0 if sys.argv[2] in d.get('components',{}) else 1)
" "$1/.claude/.dotfiles-state" "$2"
}

run_install() { # <staged-dir> <component> -> echoes exit code
  local d="$1" comp="$2"
  HOME="$d/home" bash "$d/repo/install.sh" --only "$comp" --yes > "$d/out.log" 2>&1
  printf '%s' "$?"
}

# ============================================================
# 1. The sweep: owned is removed, unowned is not, in ONE run
# ============================================================
echo "-- retirement sweep --"

D1="$(stage sweep)" || { echo "HARNESS: stage failed" >&2; exit 2; }
mkdir -p "$D1/home/.claude/skills/design-build" "$D1/home/.claude/skills/design-references"
printf 'name: design-build\n' > "$D1/home/.claude/skills/design-build/SKILL.md"
printf 'name: mine, actually\n' > "$D1/home/.claude/skills/design-references/SKILL.md"
# design-build IS recorded as installed by this installer; design-references is NOT.
seed_state "$D1/home" "design-build=active" "brain=active"
RC1="$(run_install "$D1" brain)"

# THE POSITIVE CONTROL, asserted before either verdict is believed. If the owned skill is
# still there, the sweep did not run and the "left alone" row below is measuring an
# installer that did nothing at all.
if [ ! -e "$D1/home/.claude/skills/design-build" ]; then
  ok "sweep: a retired skill THIS installer installed is removed"
else
  bad "sweep: a retired skill THIS installer installed is removed" \
      "still present - the sweep did not run, so every row in this section is vacuous. rc=$RC1"
fi
if [ -f "$D1/home/.claude/skills/design-references/SKILL.md" ]; then
  ok "sweep: a same-named directory it did NOT install is left alone"
else
  bad "sweep: a same-named directory it did NOT install is left alone" \
      "a user's own directory was deleted on the strength of its NAME"
fi
if grep -Fq -- "LEAVING IT ALONE" "$D1/out.log"; then
  ok "sweep: the skipped directory is reported, not silently ignored"
else
  bad "sweep: the skipped directory is reported, not silently ignored" \
      "$(grep -iF 'design-references' "$D1/out.log" | head -2 | tr '\n' ';')"
fi
if [ "$RC1" = "0" ]; then
  ok "sweep: an unremovable stranger does not fail the install"
else
  bad "sweep: an unremovable stranger does not fail the install" "installer exited $RC1"
fi

# ONE-SHOT. The state key is what makes the sweep fire; dropping it is what stops it from
# firing again, and a key left behind advertises a component that no longer exists.
if ! state_has "$D1/home" design-build; then
  ok "sweep: the state key is dropped after removal (the sweep is one-shot)"
else
  bad "sweep: the state key is dropped after removal (the sweep is one-shot)" \
      "the key survives, so the record outlives the component"
fi

# Re-running must be silent and must not fail. A retirement sweep that shouts on every
# subsequent install is one people learn to ignore.
RC1B="$(run_install "$D1" brain)"
if [ "$RC1B" = "0" ] && ! grep -Fq -- "retired skill 'design-build' removed" "$D1/out.log"; then
  ok "sweep: a second run is silent about the already-retired skill"
else
  bad "sweep: a second run is silent about the already-retired skill" "rc=$RC1B"
fi

# A machine that never had the skill must not be told anything at all.
D2="$(stage clean)" || exit 2
seed_state "$D2/home" "brain=active"
RC2="$(run_install "$D2" brain)"
if [ "$RC2" = "0" ] && ! grep -Fq -- "retired skill" "$D2/out.log"; then
  ok "sweep: a machine that never had them says nothing"
else
  bad "sweep: a machine that never had them says nothing" \
      "rc=$RC2: $(grep -iF 'retired' "$D2/out.log" | head -2 | tr '\n' ';')"
fi

# A DANGLING SYMLINK is the link-mode machine's version of the same orphan: it fails -d,
# so a `[ -d ]`-only sweep would walk straight past the entry Claude Code still tries to
# load. Provenance is present, so it must come off.
D3="$(stage dangling)" || exit 2
ln -s "$TMPROOT/gone-with-the-old-checkout" "$D3/home/.claude/skills/design-build"
seed_state "$D3/home" "design-build=active" "brain=active"
RC3="$(run_install "$D3" brain)"
if [ ! -L "$D3/home/.claude/skills/design-build" ]; then
  ok "sweep: a DANGLING symlink left by a link-mode install is removed too"
else
  bad "sweep: a DANGLING symlink left by a link-mode install is removed too" \
      "rc=$RC3 - a -d test would skip this, and the entry still loads"
fi

# A state value that is not "active" is NOT ownership. The file also carries "inactive"
# and "not-installed", and neither says this installer owns what is on disk right now: a
# user who deactivated the component and later made their own directory of the same name
# would have had it deleted on the strength of a stale key. Flagged by independent review.
#
# The row carries its own positive control in the SAME run - design-build is "active" and
# must come off - so "left alone" cannot be satisfied by a sweep that did nothing.
D7="$(stage inactive)" || exit 2
mkdir -p "$D7/home/.claude/skills/design-references" "$D7/home/.claude/skills/design-build"
printf 'name: rebuilt by hand\n' > "$D7/home/.claude/skills/design-references/SKILL.md"
seed_state "$D7/home" "design-references=inactive" "design-build=active" "brain=active"
RC7="$(run_install "$D7" brain)"
if [ ! -e "$D7/home/.claude/skills/design-build" ]; then
  ok "sweep: the positive control in the inactive-state run was removed"
else
  bad "sweep: the positive control in the inactive-state run was removed" \
      "rc=$RC7 - the sweep did not run, so the row below proves nothing"
fi
if [ -f "$D7/home/.claude/skills/design-references/SKILL.md" ]; then
  ok "sweep: a state of 'inactive' is not ownership - the directory is left alone"
else
  bad "sweep: a state of 'inactive' is not ownership - the directory is left alone" \
      "a stale non-active key authorized deleting a directory the user rebuilt"
fi

# A MALFORMED state file must not abort the install. state_get exits non-zero on unparsable
# JSON, and a bare assignment propagates that under errexit - stopping the whole installer
# from inside a cleanup sweep. Unprovable ownership means leave it alone, never stop.
# Flagged by independent review.
D8="$(stage badstate)" || exit 2
mkdir -p "$D8/home/.claude/skills/design-build"
printf 'name: x\n' > "$D8/home/.claude/skills/design-build/SKILL.md"
printf 'this is not json at all {{{\n' > "$D8/home/.claude/.dotfiles-state"
RC8="$(run_install "$D8" brain)"
# NOT AN EXIT-CODE ROW, deliberately, and the reason is measured rather than assumed. An
# unparsable state file makes the installer exit 1 at HEAD TOO - state_set raises an
# unhandled json traceback long after this sweep has finished, which is a real pre-existing
# defect and somebody else's unit. Asserting rc=0 here would fail on a defect this change
# neither caused nor touches, and would then be "fixed" by weakening something.
#
# What this change DOES own is the two facts below: the sweep deleted nothing on unprovable
# provenance, and the sweep was not what stopped the run - the section AFTER it still ran,
# which is the anchor that separates "handled the bad state" from "died on it".
if [ -f "$D8/home/.claude/skills/design-build/SKILL.md" ] \
   && grep -Fq -- '--- Brain (team rules + workflow) ---' "$D8/out.log"; then
  ok "sweep: an unparsable state file deletes nothing and does not abort the sweep"
else
  bad "sweep: an unparsable state file deletes nothing and does not abort the sweep" \
      "rc=$RC8 (1 is expected here - pre-existing), skill present=$([ -e "$D8/home/.claude/skills/design-build" ] && echo yes || echo no), reached brain=$(grep -cF -- '--- Brain (team rules + workflow) ---' "$D8/out.log")"
fi

# ============================================================
# 2. The catalog seeding survived the block it used to live in
# ============================================================
# design-references owned the seeding and was retired. curate owns the catalog now, so
# `--only curate` on a fresh machine has to produce the directory AND the vocabulary file -
# without them, curate's recall mode reads a path nothing ever creates.
echo "-- catalog seeding --"

D4="$(stage seed)" || exit 2
RC4="$(run_install "$D4" curate)"
if [ "$RC4" = "0" ] \
   && [ -f "$D4/home/.claude/design-references/_vocab/categories.txt" ] \
   && grep -Fq 'command-palette' "$D4/home/.claude/design-references/_vocab/categories.txt"; then
  ok "seeding: --only curate creates the catalog and its vocabulary"
else
  bad "seeding: --only curate creates the catalog and its vocabulary" \
      "rc=$RC4; vocab present=$([ -f "$D4/home/.claude/design-references/_vocab/categories.txt" ] && echo yes || echo no)"
fi
if [ -f "$D4/home/.claude/skills/curate/SKILL.md" ]; then
  ok "seeding: --only curate still installs the skill itself"
else
  bad "seeding: --only curate still installs the skill itself" "the skill did not land"
fi

# THE CATALOG IS USER DATA. Seeding must never overwrite one that exists, and this row is
# what stops a future refactor from turning the seed into an unconditional write.
D5="$(stage preserve)" || exit 2
mkdir -p "$D5/home/.claude/design-references/_vocab"
printf 'my-own-category\n' > "$D5/home/.claude/design-references/_vocab/categories.txt"
printf 'a saved reference\n' > "$D5/home/.claude/design-references/keepme.md"
RC5="$(run_install "$D5" curate)"
if [ "$RC5" = "0" ] \
   && grep -Fqx 'my-own-category' "$D5/home/.claude/design-references/_vocab/categories.txt" \
   && [ -f "$D5/home/.claude/design-references/keepme.md" ]; then
  ok "seeding: an existing catalog is preserved untouched"
else
  bad "seeding: an existing catalog is preserved untouched" "rc=$RC5 - user data was overwritten"
fi

# A PARTIAL seed must be repaired, not mistaken for a finished one. Gating on the DIRECTORY
# meant any failure after the mkdir - a full disk, a failed write, a failed rename - left a
# directory that every later run read as "already seeded", so the vocabulary was never
# written and never retried: permanently half-built, permanently reported fine. Flagged by
# independent review. The repair must add only the missing file, because by then the
# directory may hold the user's saved references.
D9="$(stage partial)" || exit 2
mkdir -p "$D9/home/.claude/design-references/_vocab"
printf 'a reference saved before the vocabulary went missing\n' > "$D9/home/.claude/design-references/keepme.md"
RC9="$(run_install "$D9" curate)"
if [ "$RC9" = "0" ] \
   && [ -f "$D9/home/.claude/design-references/_vocab/categories.txt" ] \
   && grep -Fq 'command-palette' "$D9/home/.claude/design-references/_vocab/categories.txt" \
   && [ -f "$D9/home/.claude/design-references/keepme.md" ]; then
  ok "seeding: a catalog missing only its vocabulary is repaired without touching user data"
else
  bad "seeding: a catalog missing only its vocabulary is repaired without touching user data" \
      "rc=$RC9; vocab=$([ -f "$D9/home/.claude/design-references/_vocab/categories.txt" ] && echo yes || echo no), user file=$([ -f "$D9/home/.claude/design-references/keepme.md" ] && echo yes || echo no)"
fi

# A DIRECTORY where categories.txt belongs must be REFUSED, not written through. `mv file
# dir/` succeeds by moving the file inside, so the seeding would report success, leave the
# vocabulary missing, and drop a temp-named file in there on every run. Flagged by
# independent review.
D10="$(stage vocabdir)" || exit 2
mkdir -p "$D10/home/.claude/design-references/_vocab/categories.txt"
RC10="$(run_install "$D10" curate)"
stray="$(find "$D10/home/.claude/design-references/_vocab/categories.txt" -type f 2>/dev/null | wc -l | tr -d ' ')"
if grep -Fq -- 'is not a regular file - refusing to write the catalog vocabulary' "$D10/out.log" \
   && [ "$stray" = "0" ]; then
  ok "seeding: a directory where the vocabulary belongs is refused, not written through"
else
  bad "seeding: a directory where the vocabulary belongs is refused, not written through" \
      "rc=$RC10, files dropped inside the directory=$stray"
fi

# A SYMLINKED vocabulary is honoured, not replaced. The user owns this file, so a link into
# their own dotfiles is a legitimate arrangement - the opposite of the rule for the skills
# tree, which the installer owns and must replace links in rather than follow.
D11="$(stage vocablink)" || exit 2
mkdir -p "$D11/home/.claude/design-references/_vocab" "$D11/home/mydotfiles"
printf 'my-linked-category\n' > "$D11/home/mydotfiles/categories.txt"
ln -s "$D11/home/mydotfiles/categories.txt" "$D11/home/.claude/design-references/_vocab/categories.txt"
RC11="$(run_install "$D11" curate)"
if [ "$RC11" = "0" ] \
   && [ -L "$D11/home/.claude/design-references/_vocab/categories.txt" ] \
   && grep -Fqx 'my-linked-category' "$D11/home/mydotfiles/categories.txt"; then
  ok "seeding: a symlinked vocabulary is left alone, link and target both intact"
else
  bad "seeding: a symlinked vocabulary is left alone, link and target both intact" \
      "rc=$RC11 - the installer wrote through or replaced a file the user owns"
fi

# The bundle path must seed too, not just the a la carte one. These were two byte-identical
# heredocs before; one implementation is the point, and this proves both callers reach it.
D6="$(stage bundle)" || exit 2
RC6="$(run_install "$D6" skills)"
if [ "$RC6" = "0" ] && [ -f "$D6/home/.claude/design-references/_vocab/categories.txt" ]; then
  ok "seeding: the skills bundle seeds the catalog through the same function"
else
  bad "seeding: the skills bundle seeds the catalog through the same function" "rc=$RC6"
fi
# And the retired skills must not come back through the bundle loop.
if [ ! -e "$D6/home/.claude/skills/design-build" ] && [ ! -e "$D6/home/.claude/skills/design-references" ]; then
  ok "seeding: the skills bundle no longer installs the retired skills"
else
  bad "seeding: the skills bundle no longer installs the retired skills" \
      "the bundle loop still deploys a skill the repo does not ship"
fi

# ============================================================
# 3. deactivate_skills must still end on a safe status
# ============================================================
# THE TRAP THIS ROW EXISTS FOR. As the LAST command of a function, `[ -d X ] && rm -rf X`
# returns 1 when X is already absent - "nothing to remove" reported as failure -
# deactivate_component captures that status directly, and apply_pending then treats the
# component as failed and ABANDONS THE REST OF THE PLAN. The `if` block that absorbed this
# was the design-references one. Removing it promotes whatever precedes it into the
# trailing position, which is how deleting retired code re-arms a bug that was already
# fixed twice.
echo "-- deactivate_skills trailing status --"

DS="$TMPROOT/deact.sh"
awk '/^deactivate_skills\(\) \{/,/^\}/' "$INSTALLER" > "$DS"
if [ -s "$DS" ]; then
  ok "deactivate_skills could be extracted"
else
  bad "deactivate_skills could be extracted" "every row below is vacuous"
fi
EMPTY_CD="$TMPROOT/empty-claude"; mkdir -p "$EMPTY_CD/skills"
rc_deact=0
CLAUDE_DIR="$EMPTY_CD" bash -c 'set -u; source "$1"; deactivate_skills' _ "$DS" >/dev/null 2>&1 || rc_deact=$?
if [ "$rc_deact" = "0" ]; then
  ok "deactivate_skills returns 0 when every skill is already absent"
else
  bad "deactivate_skills returns 0 when every skill is already absent" \
      "returned $rc_deact - apply_pending reads this as a failed component and abandons the plan"
fi
# The positive control: with a skill actually present it must still remove it and still
# return 0, or the row above is satisfied by a function that does nothing.
FULL_CD="$TMPROOT/full-claude"; mkdir -p "$FULL_CD/skills/curate"
printf 'x\n' > "$FULL_CD/skills/curate/SKILL.md"
rc_deact2=0
CLAUDE_DIR="$FULL_CD" bash -c 'set -u; source "$1"; deactivate_skills' _ "$DS" >/dev/null 2>&1 || rc_deact2=$?
if [ "$rc_deact2" = "0" ] && [ ! -e "$FULL_CD/skills/curate" ]; then
  ok "deactivate_skills still removes a present skill and returns 0"
else
  bad "deactivate_skills still removes a present skill and returns 0" \
      "rc=$rc_deact2, curate present=$([ -e "$FULL_CD/skills/curate" ] && echo yes || echo no)"
fi

# ============================================================
# 4. Mutation control
# ============================================================
echo "-- mutation control --"

mutate() { # <file> <old> <new> -> OK | ANCHOR-MISSING | MUTATE-FAILED
  OLD="$2" NEW="$3" perl -e '
    my $f = shift;
    open my $fh, "<", $f or do { print "MUTATE-FAILED(open)"; exit 0 };
    local $/; my $t = <$fh>; close $fh;
    my ($o, $n) = ($ENV{OLD}, $ENV{NEW});
    my $c = () = ($t =~ /\Q$o\E/g);
    if ($c != 1) { print "ANCHOR-MISSING(found $c)"; exit 0 }
    $t =~ s/\Q$o\E/$n/;
    open my $out, ">", $f or do { print "MUTATE-FAILED(write)"; exit 0 };
    print $out $t; close $out; print "OK";
  ' "$1"
}
mutation_row() { # <name> <mutate-result> <violated 0|1>
  case "$2" in
    OK) [ "$3" = 1 ] && ok "$1" || bad "$1" "the assertion still held against mutated code - it is not load-bearing" ;;
    *)  bad "$1" "the mutation anchor is not usable ($2) - the row proves nothing" ;;
  esac
}

# Deleting the call is the exact state the tree was in before this unit: the function
# exists and nothing invokes it.
DM1="$(stage mut_call)" || exit 2
mkdir -p "$DM1/home/.claude/skills/design-build"
seed_state "$DM1/home" "design-build=active" "brain=active"
M1="$(mutate "$DM1/repo/install.sh" 'remove_retired_skills
' ':
')"
run_install "$DM1" brain >/dev/null
mutation_row "mutation: deleting the sweep call leaves the retired skill installed" \
  "$M1" "$( [ -e "$DM1/home/.claude/skills/design-build" ] && echo 1 || echo 0 )"

# Removing the provenance check is the dangerous direction: the sweep would then delete any
# directory that merely shares the name.
DM2="$(stage mut_prov)" || exit 2
mkdir -p "$DM2/home/.claude/skills/design-references"
printf 'name: mine\n' > "$DM2/home/.claude/skills/design-references/SKILL.md"
seed_state "$DM2/home" "brain=active"
M2="$(mutate "$DM2/repo/install.sh" '    if [ "$_rr_state" != "active" ]; then' '    if false; then')"
run_install "$DM2" brain >/dev/null
mutation_row "mutation: dropping the provenance check deletes a directory it never installed" \
  "$M2" "$( [ ! -e "$DM2/home/.claude/skills/design-references" ] && echo 1 || echo 0 )"

# ============================================================
# 5. Containment
# ============================================================
echo "-- containment --"
if [ "$(ls -1 "$HOME/.claude/skills" 2>/dev/null | LC_ALL=C sort)" = "$LIVE_SKILLS_BEFORE" ]; then
  ok "containment: the live ~/.claude/skills is exactly as this suite found it"
else
  bad "containment: the live ~/.claude/skills is exactly as this suite found it" \
      "$(printf '%s\n' "$LIVE_SKILLS_BEFORE" | diff - <(ls -1 "$HOME/.claude/skills" 2>/dev/null | LC_ALL=C sort) | head -6)"
fi

echo ""
printf 'installer-skill-retirement: %s passed, %s failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || { echo "FAIL: retirement is not safe"; exit 1; }
echo "PASS: a retired skill comes off the machines that have it, and nothing else does"
exit 0
