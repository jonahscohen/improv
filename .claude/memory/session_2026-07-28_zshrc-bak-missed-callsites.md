---
name: zshrc .bak defect fixed on the primitive, missed at two call sites
description: Round 1 - the 2026-07-27 fix landed on zshrc_block_delete and got a 40-line hazard write-up while deactivate_discord and deactivate_nvm kept running the exact sed -i.bak it condemns (21/8 red -> 44/0). Round 2 - the same three defects were live against ~/.claude/CLAUDE.md and migrate_legacy_markers; primitive parameterized by path, all seven remaining sed -i sites rerouted, zero left in the file (19/10 red -> 49/0). Independent review found a High I introduced (migrate would rewrite the repo's own tracked source through the ~/.claude/CLAUDE.md symlink) and an unbounded duplicate-append. Driving the REAL installer instead of a mirror exposed that claude/CLAUDE.md carries a COMMITTED improv:brain marker pair, which made the brain block unrefreshable once the delete correctly refused it.
type: project
relates_to: [session_2026-07-27_ampersand-selfheal-fix.md, session_2026-07-27_installer-fix-adversarial-review.md]
author_human: Jonah
author_model: claude-opus-4.8
machine: spare3
source: session
verified: tests
confidence: high
---

# The failure mode: a documented hazard sitting 500 lines above live unsafe code

On 2026-07-27 a third cross-model review found that `sed -i.bak '...' "$ZSHRC"` destroys
a user's shell config in several ways. The fix rewrote `zshrc_block_delete` to snapshot
into `$TMPDIR`, plan and apply against the one snapshot, and write back with
`cat > "$ZSHRC"` (follows a symlink, keeps the inode and permissions, creates no sibling
backup). A 40-line comment above the function spells out all three defects by name.

`deactivate_discord` (install.sh:1856) and `deactivate_nvm` (install.sh:1986) were still
running `sed -i.bak '...' "$ZSHRC"; rm -f "$ZSHRC.bak"`, in committed code, on main.

**Why they were missed.** The claim that closed the last session was "zero unguarded
RANGE-deletes remain." Both survivors are LINE-pattern deletes, so they were outside the
sentence and outside the grep behind it. The range hazard genuinely does not apply to
them. The other two do, in full: they destroy a user's hand-made `~/.zshrc.bak`, and
`sed -i` refuses a non-regular file so they fail outright on a symlinked `~/.zshrc` -
which under `set -euo pipefail` aborts the installer at the sed, not just the function.

**The generalizable lesson.** A hazard write-up attached to a PRIMITIVE certifies the
primitive, not the file. The property is only closed when it is asserted at the CALL
SITES, because a call site is where a future author inlines the pattern again. The new
suite is written that way on purpose: it drives `deactivate_discord` and `deactivate_nvm`
themselves, and its structural row fails on any new `sed -i` touching `$ZSHRC` anywhere
in install.sh. Documentation is not a control. A test that runs the caller is.

A second-order note worth keeping: the write-up was RIGHT, detailed, and completely
ineffective. Being correct in a comment near the code is not the same as being enforced.

# What changed

**One implementation, not three.** `zshrc_block_delete` gained a `--lines` mode: the
caller hands over a literal sed script instead of a marker pair, so there is nothing to
pair and the script IS the plan. Everything below it - snapshot, filter, write back - is
untouched and shared. `zshrc_line_delete` is a one-line wrapper over that mode; it is a
NAME, not a second implementation, which is the whole point.

**Why the mode lives inside `zshrc_block_delete` rather than in a hoisted helper.**
`test-ampersand-shim.sh` builds its harness by awk line-range extraction of functions out
of install.sh (`/^zshrc_block_delete\(\) \{/,/^\}/`). A helper hoisted to file scope falls
outside every extract, and because these call sites use the `|| warn` idiom, a missing
function degrades into a silent no-delete rather than an error - it reads as an installer
bug and points at the wrong file. That already cost one investigation and one 74/0 to
73/1 regression. Keeping the mechanics inside the already-extracted, already-`declare -f`
-asserted function means no extraction change was needed, and `claude/hooks/` (owned by
another teammate this session) was never touched. `zshrc_line_delete` itself is not
extracted and does not need to be: `deactivate_ampersand` uses range mode only.

**Both call sites rerouted**, each with a `|| warn` so a failed edit is loud and the file
is left alone.

# What the sweep found (round 1: reported, not fixed - ALL FIXED IN ROUND 2 BELOW)

1. **A THIRD live `sed -i` against `$ZSHRC`.** `migrate_legacy_markers` (install.sh:2208)
   runs `sed -i.bak -E '...' "$f"` over `$ZSHRC`, `~/.claude/CLAUDE.md`, and
   `~/.claude/CLAUDE.local.md`, then `rm -f "$f.bak"`. Same two defects, same file. It is
   called unconditionally in the main install path AND at the top of every
   `deactivate_component`, so on any pre-rename machine EVERY install and EVERY deactivate
   destroys `~/.zshrc.bak`, and a symlinked `~/.zshrc` aborts the installer. Left alone
   because it is a SUBSTITUTION over three paths, so fixing it means either a substitution
   mode or a path-parameterized primitive - a design call above this unit.
2. **Six unguarded marker-RANGE deletes against `~/.claude/CLAUDE.md`** (install.sh:1710,
   1714, 1841, 3989, 3995, 4011). This is hazard #1 from the zshrc write-up, unfixed, on a
   different user-owned file: a missing or hand-edited end marker makes the range run to
   END OF FILE and take the rest of the user's CLAUDE.md. Plus the same `.bak` collateral
   on `~/.claude/CLAUDE.md.bak`. The symlink half is mostly handled here (three sites skip
   symlinks, one converts first). Needs the same primitive, parameterized by path.
3. **`justify/install.sh:277`** - benign. `$SKILL_DIR/SKILL.md` is rewritten from a
   heredoc immediately above on every run, so the installer owns both it and the `.bak`,
   and it is always a fresh regular file.

# The negative, built first and watched fail

`test-zshrc-safe-edit.sh` (new, repo root next to its subject, matching the
`claude/test-hud.sh` / `claude/cmux/test-*.sh` convention). It extracts the real function
text from install.sh rather than paraphrasing it.

- **Before the fix: 21 passed, 8 failed.** Red rows: both sites destroyed the user's
  `~/.zshrc.bak`; both aborted under `set -e` on a symlinked `~/.zshrc` and never reached
  the target; the structural row counted 2 live `sed -i "$ZSHRC"` sites; and the discord
  delete removed nothing at all.
- **After: 43 passed, 0 failed.**

Every assertion was mutation-controlled - the behavior was broken on purpose and the row
was watched failing before it was trusted. Five mutations, five reds: unanchored discord
pattern (4 red), argument guard removed (1), failed-edit early return removed (1),
snapshot-keeping removed (1), nvm comment clause un-anchored (2).

# Codex review: five findings, all folded

1. **High - the write-back is not atomic.** `cat "$out" > "$ZSHRC"` truncates before it
   writes, so a mid-write failure leaves a truncated shell config. **Why not fixed the
   obvious way:** a sibling temp plus `mv` would be atomic but would REPLACE a symlinked
   `~/.zshrc` with a regular file and change the inode - the exact property this shape
   exists to preserve. **How:** the snapshot still holds the original bytes at that
   instant, so the primitive restores from it; only if the restore ALSO fails does it keep
   the snapshot and print its path. Every other return path deletes the snapshot; that one
   must not. Asserted with a read-only target, and the row checks the printed path really
   resolves to a file holding the original bytes - a recovery hint that does not resolve is
   not a recovery.
2. **Medium - `deactivate_discord` half-deactivated on failure.** It removed the launcher
   symlinks after the zshrc edit regardless of whether the edit worked, so a failed edit
   left a live `source` line pointing at a file that had just been deleted: every new shell
   opens with "no such file or directory", strictly worse than never uninstalling. Now it
   warns and returns 0 without touching the scripts. Returns 0 deliberately - callers reach
   it through a `case` arm under `set -e` and a component's undo must not kill the
   installer. Asserted by inducing the failure honestly (TMPDIR pointing at a directory
   that does not exist, so the primitive's `mktemp` fails), not by stubbing.
3. **Medium - the discord patterns ate a user's own line.** My first repair used
   `discord-chat-launcher\.sh.*[Ii]mprov`, which deletes
   `alias explain='echo discord-chat-launcher.sh came from Improv'`. Substring matching
   against a user's shell config is the hazard this entire file has spent a week fixing,
   and I reintroduced it while fixing it. Both patterns are now whole-line anchored against
   the exact shapes section 9 writes, tolerating only trailing whitespace. The nvm comment
   clause had the same unanchored shape and was anchored in the same pass. The fixtures now
   carry DECOY lines that a loose pattern eats.
4. **Low - `--lines` sentinel collision.** An option-shaped begin marker in range mode is
   now refused before the file is read, so a caller bug can never end with the caller's end
   marker executing as a sed script against the user's config.
5. **Low - test false-green gaps.** Folded: `declare -f zshrc_line_delete` asserted, the
   pre-rename `claude-dotfiles` fixture added, and the structural grep now joins backslash
   continuations and accepts `${ZSHRC}` as well as `$ZSHRC`.

# A defect found while writing the positive control

The discord delete's source-line clause was `discord-chat-launcher\.sh.*improv` -
lower-case. Only two forms have ever been written:

    source <dir>/discord-chat-launcher.sh  # Improv: discord-chat-launcher
    source <dir>/discord-chat-launcher.sh  # claude-dotfiles: discord-chat-launcher

It matched NEITHER, in any install ever shipped. `migrate_legacy_markers` does not save
it either - that rewrite only fires on `=== claude-dotfiles:` and `<!-- claude-dotfiles:`,
never on a bare `# ` prefix. So `deactivate discord` removed the comment line, left the
live `source` line, and `detect_component` kept reporting the component ACTIVE forever
because it greps the same basename the surviving line contains.

This was NOT in the assigned unit. It was fixed because the positive control could not be
written truthfully otherwise: shipping a "safe" version of a delete that provably deletes
nothing would have made the whole unit vacuous. Flagged to the lead as a scope addition.

# Suites

    test-zshrc-safe-edit.sh        43 passed, 0 failed   exit 0   (new)
    test-ampersand-shim.sh        128 passed, 0 failed   exit 0
    test-hook-registry.sh          52 passed, 0 failed   exit 0
    test-installer-manifest.sh     PASS                  exit 0
    test-install-hook-deploy.sh    26 passed, 0 failed   exit 0
    test-settings-deploy-parity.sh ALL PARITY PASSED     exit 0
    test-bin-parity.sh             18 passed, 0 failed   exit 0   (acceptance gate)
    test-settings-wire-parity.sh   18 passed, 0 failed   exit 0   (acceptance gate)

Everything sandboxed with a temp HOME. The live `~/.zshrc` was never written (mtime
unchanged at Jul 17 14:42, no `.bak` beside it), and no snapshot temp files leaked.

Not committed, per instruction.

# ROUND 2 - the same three defects against ~/.claude/CLAUDE.md and the migration

The lead took both sweep findings back. What follows is the second unit.

## The premise I was given was partly wrong, and checking it first mattered

The handoff said `sed -i` was severing the `~/.claude/CLAUDE.md` symlink and silently
disconnecting Jonah's global instructions from the repo. Reproduced all four shapes
against committed code before building anything:

- **Both data-loss hazards: CONFIRMED.** A hand-made `~/.claude/CLAUDE.md.bak` is
  destroyed. And with a begin marker whose end a hand edit removed, the range ran to EOF:
  a 4-line file came back as ONE line, the user's trailing content gone.
- **The symlink severing: NOT REPRODUCED at the named sites.** `deactivate_brain` and
  `deactivate_memory` are both guarded by `[ ! -L ]`, so sed is unreachable for any
  symlink. On the exact shape this machine has, the link is REMOVED by the existing
  `readlink == "$REPO_DIR/"*` branch and the repo source is untouched.
- **The real symlink defect is at the INSTALL path, not deactivate.** install.sh migrates
  a symlink to a real file ONLY when it points into our repo. A link to the user's OWN
  dotfiles falls through to `sed -i`, which fails with "in-place editing only works for
  regular files" and aborts the whole install under `set -euo pipefail`.
- **And `migrate_legacy_markers` was worse than "aborts".** The `sed ... && rm` idiom
  SWALLOWS the failure: exit 0, no warning, markers never migrated. A symlinked `~/.zshrc`
  stays permanently unmigrated with no diagnostic at all. On a regular file it works and
  destroys `~/.zshrc.bak`.

Reporting the correction before building was load-bearing, not pedantry: acting on the
stated premise would have meant making the CLAUDE.md sites follow symlinks, which on this
machine rewrites the repo's own tracked `claude/CLAUDE.md` from a deactivate.

**The record states the corrected version, not the original framing.** The lead verified
both halves independently and asked explicitly that this not be softened, so: the symlink
risk lives at the INSTALL path (install.sh:4032 migrates a symlinked CLAUDE.md only when
`readlink` points into `$REPO_DIR`, so a link into the user's own dotfiles falls straight
through to the `sed -i` at 4043), and the deactivate sites at 1744 and 1748 are guarded
and were never reachable with a link at all.

**The error mode is worth more than the correction** and the lead named it: the escalation
took `readlink -f ~/.claude/CLAUDE.md` resolving into the repo as proof that sed would meet
the link, without checking whether the CALL SITE could reach it. A measurement taken
somewhere other than where the defect would live proves nothing about the defect. Six lines
above the cited line was the guard that made it unreachable. This is the same shape as the
failure that opened this whole beat - a hazard certified at the primitive while the call
sites went unchecked - just pointed in the opposite direction: there the primitive was
clean and the call sites were not; here the call sites were clean and the environment
measurement said otherwise. Both are answered by the same discipline, which is to go and
read the site where the thing would actually happen.

## What changed

`zshrc_block_delete` is now the general safe-edit primitive: an option parser taking
`--file PATH` and `--script SED`, with `safe_block_delete` and `safe_sed_apply` as thin
one-line wrappers. All seven remaining `sed -i` sites rerouted onto it. **install.sh now
contains zero `sed -i`**, and both suites have a structural row that fails if one returns.

**The name stays wrong on purpose.** `zshrc_block_delete` is no longer zshrc-specific, but
`claude/hooks/test-ampersand-shim.sh` awk-extracts that exact symbol and asserts
`declare -f` on it, and that file belongs to another workstream. Renaming would break a
green suite from outside its own half of the repo. The wrappers exist so call sites read
correctly; a comment in the body carries the truth.

**The `[ ! -L ]` guards on deactivate_brain and deactivate_memory were deliberately KEPT.**
For `~/.zshrc` following a symlink is right. For `~/.claude/CLAUDE.md` on this machine it
would rewrite our own tracked source. The primitive takes the path; the caller keeps the
symlink policy. Rows now pin this so a later "make it consistent" cannot drop it.

# Independent review (Codex hung; a fresh Claude reviewer ran instead)

Codex reviewed round 1 fine, then hung twice on round 2 with no output after ~15 and ~9
minutes. Per the standing rule the gate still runs, so a fresh Claude agent with clean
context reviewed the diff instead. It returned seven findings and cleared four areas with
real evidence (a 512-combination option-parser brute force with watchdogs, a 20k-line
sed-equivalence fuzz, an errexit trace, git-history confirmation of the discord shapes).

**1 (High) - I introduced a repo-corruption path.** `migrate_legacy_markers` has no
`[ ! -L ]` guard and runs at the TOP of `deactivate_component` and again in the main
install path - BEFORE `deactivate_brain`'s guard and BEFORE section 11's repo-symlink
migration. It is the one place neither protection covers. `sed -i` REFUSED a symlink, so
the repo's tracked `claude/CLAUDE.md` was protected there BY ACCIDENT; `cat >` follows the
link. Reproduced on this machine's exact shape: the repo source rewritten in place, same
inode, rc=0, silently. My change removed an accidental protection, and my own comment
claimed the opposite. Fixed with a resolved-path check that skips only links into
`$REPO_DIR` - a link to the user's own dotfiles is still followed, and a row pins that the
skip did not become a blanket skip.

**2 (Medium) - the duplicate append was unbounded and unrecoverable.** Warning and
appending anyway adds a full ~66 KB copy per run, and at two begin markers
`deactivate_brain` refuses too, so the user cannot uninstall ANY copy. Measured 1 -> 4
begin markers over three runs. The old delete-to-EOF was destructive but SELF-HEALING on
the next run; this shape never heals. A refused delete now suppresses the append entirely.

**3 (Medium) - the restore branch oversold itself.** The reviewer verified that `sed -i`
on both BSD and GNU writes a temp and renames, so none of the seven sites had a truncation
window before this change - `cat >` introduces one. That is a real regression in
crash-durability, accepted deliberately because rename replaces a symlinked target. The
comment now says so plainly, and marks the restore branch as best-effort and unreachable
by any failure a test can stage (`cat > "$path"` fails the same way twice). The guarantee
that IS tested is the last branch: the snapshot is kept and its path printed.

**4-7 (Low)** - two "option-shaped marker is refused" rows passed via the positional guard
rather than the option-loop arm they were named for (a mutant turning `-*) return 1` into
`-*) break` kept both suites green); a stale comment named a `--lines` sentinel that no
longer exists; the `--` arm was dead code; one row checked a single surviving line. All
folded, including a new row that isolates the option-loop arm in script mode - the one
input where the two guards are not redundant.

# The defect only a REAL installer run could find

My first section-11 rows drove a mirror of the inline code. When I mutated install.sh to
remove the append suppression, **the suite stayed green** - the mirror carried its own copy
of the logic and was testing itself. Rewriting those rows to drive
`install.sh --only brain --yes` against a sandboxed HOME immediately failed, and the
failure was not the one I expected:

**`claude/CLAUDE.md` in this repo carries a COMMITTED `<!-- improv:brain:begin -->` /
`<!-- improv:brain:end -->` pair at lines 134 and 443** (plus a nested `improv:rules` pair).
An earlier install wrote its block into the repo's own source through the
`~/.claude/CLAUDE.md` symlink, and it was committed. Section 11 appends that file verbatim
inside its own markers, so ONE install produces a target with TWO begin markers.

That used to "work" by accident: `sed '/begin/,/end/d'` deletes first-begin through
LAST-end, which happens to span the nested pair exactly. Once the delete correctly REFUSES
two-opens-before-a-close, the brain block became impossible to refresh or uninstall - on
every machine, permanently. My safety fix would have shipped that.

Root-caused in code rather than by editing the contaminated file, because that path IS
Jonah's live `~/.claude/CLAUDE.md` and was explicitly off limits. New invariant:
**a block's payload must never contain the block's own delimiters.** `strip_block_markers`
filters the marker lines out of the payload before wrapping it. Verified end to end: three
consecutive real installs hold at exactly one begin marker, the user's trailing content
survives, and `deactivate_brain` then removes the block cleanly.

**Still outstanding for the lead:** `claude/CLAUDE.md` lines 134/443 are contaminated
source. The code no longer cares, but the file should be cleaned by whoever owns it. It is
Jonah's live global-instructions file via the symlink, so this unit did not touch it.

# Round 2 negative, built first

`test-userfile-safe-edit.sh` (new). Against committed code: **19 passed, 10 failed.**
After: **49 passed, 0 failed.** Red rows included the `.bak` destruction at both CLAUDE.md
sites and in the migration, the range-to-EOF truncation, the foreign-symlink abort, the
migration silently never running on a symlinked `~/.zshrc`, and the structural row
counting 7 surviving `sed -i`.

Mutation-controlled throughout, including the reviewer's own mutants that had stayed
green. Nine mutations, nine reds: repo-symlink skip removed; append suppression removed
(caught only after the rows were rewritten to drive the real installer); option-loop `-*`
arm turned into `break`; `strip_block_markers` neutered; empty-end-marker guard removed;
`--file` arity check removed; empty-path guard removed; plus the round-1 five.

Two defects I introduced and caught myself before review: an omitted end marker made
`e=""`, which the awk planner matches against the first BLANK LINE - so the delete ran
from the begin marker to there and returned 0 (`keep A / begin / junk / <blank> / keep B`
came back as `keep A / keep B`, rc=0). And removing the `--file` arity check makes the
option loop SPIN forever, because `shift 2` fails and `$#` never decreases; that mutation
HUNG the suite rather than failing it, so the row is now deadlined and reports a spin as
its own distinct failure.

# Suites (round 2 final, all exit 0)

    test-userfile-safe-edit.sh     49 passed, 0 failed   (new)
    test-zshrc-safe-edit.sh        44 passed, 0 failed
    test-ampersand-shim.sh        128 passed, 0 failed
    test-hook-registry.sh          52 passed, 0 failed
    test-installer-manifest.sh     PASS
    test-install-hook-deploy.sh    26 passed, 0 failed
    test-settings-deploy-parity.sh ALL PARITY PASSED
    test-bin-parity.sh             18 passed, 0 failed   (acceptance gate)
    test-settings-wire-parity.sh   18 passed, 0 failed   (acceptance gate)

Live `~/.zshrc` mtime still Jul 17 14:42; live `~/.claude/CLAUDE.md` still the symlink into
the repo; `claude/CLAUDE.md` and `claude/RULES.md` clean in `git status`. No `.bak` beside
either live file, no snapshot temps leaked. Every install run used a sandboxed HOME.

# Self-analysis

Three things went wrong that were mine, and they share a shape.

**I reintroduced the hazard I was fixing.** My first discord repair used an unanchored
substring, which would have eaten a user's own alias. Round 2's High is the same mistake
in a different register: I generalized the primitive to follow symlinks without asking
which callers were relying on `sed -i` REFUSING them. In both cases I was thinking about
the mechanism I was adding, not the property the old broken code accidentally held.
The habit that catches it is asking, of every behavior change: what was the old code
accidentally protecting?

**I tested a mirror and believed it.** The section-11 rows were green and worthless for a
full cycle. Inline code that cannot be extracted is exactly the code most likely to drift,
which makes it the code that most needs to be driven for real. A mirror is a restatement
of my own understanding; running the installer is the only thing that can contradict me.
The mutation is what exposed it - a green suite proves nothing until you have watched each
row fail.

**I reported a claim I had not reproduced.** Round 1's report to the lead said
`migrate_legacy_markers` "aborts the installer" on a symlinked `~/.zshrc`. It does not; the
failure is swallowed and the migration silently never happens, which is worse and has a
different fix. I had inferred it from the `set -e` semantics instead of running it. The
correction cost nothing here because I reproduced it before building, but the lesson is
that an inferred failure mode stated in a report is indistinguishable from a measured one
to the person reading it.

# ROUND 3 - two queued installer-registration items

## Item 1: the dangling `sidecoach-modes.json` link IS a class, and the class is the fix

`~/.claude/hooks/sidecoach-modes.json` points at `claude/hooks/sidecoach-modes.json`,
deleted in the modes/vocab collapse. Swept every symlink under `~/.claude`: **1 dangling
out of 125 repo-owned links.** So the INSTANCE is a one-off.

The GAP is not. `install.sh` already had `prune_broken_skill_symlinks`, which removes dead
repo-owned links - **for `~/.claude/skills` only**. Nothing anywhere removes a dead link
under `~/.claude/hooks`, so every future retirement leaves the same residue. Deleting the
one link would have left the mechanism that produced it fully intact.

**Fix: the directory list, not the link.** The existing function now loops over a
`prune_dirs` array covering skills and hooks. Name and single-arg signature unchanged,
because `claude/hooks/test-install-prune-skills.sh` sources install.sh and calls the
symbol directly - the same "name locked by an external suite" constraint as
`zshrc_block_delete`, handled the same way.

**What was deliberately NOT changed:** the prune stays DRY-RUN by default and mutates only
under the explicit `--prune-skills-apply` flag. That was an existing, well-reasoned
decision ("an unattended --yes/--only/--preset install never invokes this"), and quietly
converting it into an automatic sweep on every install would have been a much larger
change than the defect justified. Consequence, stated plainly: the live dangling link is
now DETECTED but is not removed until someone runs the apply flag. Verified live -
`--prune-skills` names the exact link and leaves it in place.

## Item 2: `model-router-guard.sh` is a FALSE POSITIVE, and the reason matters

Reported as "registered but never deployed - the half-registration class the hook-registry
guard was built to catch". All three observations are true and the conclusion does not
follow. The component is simply not installed on this machine.

- `install.sh --manifest` reports `Guardrails/model-routing/model-router-guard = none`.
  The installer's own state machine already says "not installed", correctly.
- Installed into a sandboxed HOME with `--only model-routing --yes`: the hook symlink
  lands in `~/.claude/hooks`, it is wired into `settings.json` under `PreToolUse` for both
  matchers, and the manifest flips to `active`. The registration works end to end.
- `hook-registry-guard --check model-router-guard` returning 0 is also correct. Its
  contract is REPO-SIDE - "listed in browser-tree.json AND named in install.sh" - which is
  exactly true here. It never claimed to check deployment, so this is not a blind spot in
  the guard; it is a different question the guard does not ask.

`model-routing` is an opt-in component Jonah never selected. "Fixing" it would have
force-deployed a hook the user deliberately did not install. The generalizable point:
absent-from-disk plus present-in-a-registry is not evidence of half-registration until you
have checked whether the component was ever SELECTED - the installer's own manifest
answers that in one command, and it was the first thing to ask.

## Codex review of the prune change (Codex recovered)

Codex hung twice during round 2 and answered a liveness probe immediately afterwards, so
the outage was transient rather than an absence. It reviewed this delta and returned five
findings, all folded, all mutation-controlled:

1. **An unreadable prune directory reported CLEAN.** `-d` is true for a directory that
   cannot be listed; the glob then enumerates nothing and the run says "no dead links"
   having examined none - a silent false negative in a tool whose only job is finding
   things. Now returns a distinct code 7.
2-5. **Four of the five were my test asserting rather than proving.** My own comment
   claimed the safety rules were "re-proven per directory, not assumed to carry over", and
   they were not: dry-run, the rc=6 removal-failure path, and direct-children-only were all
   proven for skills only, and the removal assertion checked "not a symlink" rather than
   "gone", which a prune that replaced the link with a regular file would satisfy. Codex's
   own mutant - hooks removal ignoring dry-run - kept the suite green. All four now have
   dedicated fixtures, including a nested dead link inside `__pycache__` and an rc=6 case
   with no skills directory present at all.

Writing that the rules were re-proven, in the same commit that did not re-prove them, is
the identical failure this whole beat is about: a claim in a comment standing in for a
control. Third instance in three rounds, from three different directions.

Six mutations, six reds: hooks dropped from the array; the repo-owned rule bypassed; the
unreadable-dir check removed; Codex's dry-run mutant; recursion into subdirectories; the
link replaced by a regular file; and the rm-failure code changed.

    test-install-prune-skills.sh   22 passed, 0 failed   (was 17, all pre-existing green)

**Cross-ownership note:** the new assertions live in
`claude/hooks/test-install-prune-skills.sh`. That directory is now unowned (`hooks-live`
and `beats-search` both stood down) and the lead authorised editing hook test files when
the assertion genuinely belongs there. It does - that file is the single home for prune
coverage, and splitting it would have left two places to look.

# Files touched

- `install.sh` - `zshrc_block_delete` is now the general safe-edit primitive (option
  parser with `--file`/`--script`, argument guards, restore-on-failed-write); new
  `safe_block_delete` / `safe_sed_apply` wrappers and `strip_block_markers`; all seven
  remaining `sed -i` sites rerouted (`deactivate_discord`, `deactivate_nvm`,
  `deactivate_brain` x2, `deactivate_memory`, section 11 x3, `migrate_legacy_markers`);
  repo-symlink skip in the migration; append suppressed on a refused delete.
- `test-zshrc-safe-edit.sh` - new, 44 assertions.
- `test-userfile-safe-edit.sh` - new, 49 assertions.
- `install.sh` (round 3) - `prune_broken_skill_symlinks` generalized over a `prune_dirs`
  array covering `~/.claude/skills` and `~/.claude/hooks`; new return code 7 for an
  unreadable prune directory; `--help` wording updated.
- `claude/hooks/test-install-prune-skills.sh` - hooks-directory coverage, 17 -> 22
  assertions (cross-ownership edit, authorised; directory is unowned).
- `.claude/memory/session_2026-07-28_zshrc-bak-missed-callsites.md` - this beat.
- `.claude/memory/MEMORY.md` - index line.

Note for the lead: running `test-hook-registry.sh` deleted a leftover
`claude/hooks/zz-registry-fixture.sh` from the working tree. That is the suite's own
cleanup trap removing its own fixture, not an edit by this unit - `claude/hooks/` was
never written to here.
