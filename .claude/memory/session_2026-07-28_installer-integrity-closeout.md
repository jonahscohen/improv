---
name: Installer integrity closeout - third payload source synced, the cycle closed on the memory path, two registration questions answered
description: claude/memory-discipline-section.md synced from the live block and stripped of its self-wrapping capital-I markers; the installer now owns the markers; found and fixed unbounded block duplication and a live instance of the output-overwrites-input cycle reachable via --only memory. Registration defect 1 turned out not to be a defect.
type: project
relates_to: [session_2026-07-28_claude-md-repair-complete.md, session_2026-07-28_rules-md-stale-drift.md]
author_human: Jonah
author_model: claude-opus-4.6
source: session
verified: 10/10 named suites at exit 0; every new assertion mutation-controlled (5 mutations, each watched red then restored); acceptance gate run on a copy of the live file, 278 content lines before and after, empty multiset diff; live ~/.claude/CLAUDE.md left byte-identical to its pre-change backup
confidence: high
---

# The third payload source, and what syncing it exposed (2026-07-28)

The drift itself was the small part. Repairing it surfaced two defects in the installer
that had nothing to do with stale text, one of which was the root-cause cycle still live
on a path nobody had checked.

## Baseline first (Team Rule 9)

All ten named suites were probed BEFORE any edit and were green at exit 0. That baseline
is what made every later red a signal instead of a question.

## Unit 1 - the drift

`claude/memory-discipline-section.md` was 119 lines, predated the beats rename, and
wrapped ITSELF in `<!-- Improv:memory-discipline:begin -->` - capital I, the identical
shape that bit `claude/RULES.md`. Authoritative content was taken from the live installed
block (128 content lines, 2 occurrences of "Beats"), which is where the edits actually
landed. The source is now byte-identical to that block and carries zero markers.

## The defect the sync exposed: unbounded duplication

The installer emitted NO markers of its own here. It `cat`-ed the payload verbatim and
relied on the payload's self-wrapping capital-I markers, while its presence check was a
LOWERCASE fixed string. The guard therefore never matched the marker the installer itself
had just written, and every re-run appended another whole copy.

Measured against the real installer before the fix: **1 -> 2 -> 3 blocks, 120 -> 240 ->
360 lines over three consecutive runs, each exiting 0 and printing "Installation
complete"**. It is byte-for-byte the unbounded never-heals failure the brain block's own
comment warns about, reached by one letter of case.

It stayed invisible on this machine because an older install had already written
LOWERCASE markers here, so the guard matched and the append was skipped. **The bug only
fires on a machine installing fresh** - which is every other machine.

Fix: the memory path now mirrors the brain path exactly. Delete the existing block, then
emit canonical lowercase markers around a payload piped through `strip_block_markers`.
That also makes the section refreshable; the old skip-if-present branch meant content
changes in the source could never reach a machine that already had the block.

## The cycle was still live, on the memory path

Cross-model review (Codex, `codex-cli 0.142.5`) found it and a direct test confirmed it:
`safe_block_delete` and `>>` both follow symlinks by design, and the legacy
symlink-to-real-file migration lived ONLY inside `picked brain`. So on a machine still in
the legacy state, `install.sh --only memory` wrote the assembled block straight back into
`claude/CLAUDE.md`. **Reproduced against a throwaway repo copy: the payload source went
184 -> 316 lines in a single run.**

This is the exact output-overwrote-input cycle the previous session identified as the root
cause, still reachable on a path nobody had exercised. `safe_block_delete`'s own header
documents this hazard and notes the DEACTIVATE paths keep `[ ! -L ]` guards for it; the
INSTALL path had no equivalent. It does now.

## Sweep for other read-as-input / write-as-output cycles

- Every `~/.claude` symlink into the repo is an EXECUTABLE deployed by reference. The
  installer never assembles output into those paths, so no cycle.
- `settings.json` IS read as merge input and written as output, the same shape. Guarded in
  three places including an early global migration, and **proven by live test**: with
  `~/.claude/settings.json` symlinked into a repo copy, `--only memory` migrated the link
  to a real file and left the repo source byte-identical. Hypothesis raised, tested,
  disproven - not asserted either way.
- `claude/CLAUDE.local.md` is a FOURTH payload source and is currently absent from the
  repo. Latent, same class, worth knowing about.

## Unit 2, defect 1 - the premise was wrong

`model-router-guard.sh` is correctly packaged: in `browser-tree.json`'s `hook_owner`, in
`cluster-wirings.json`, and deployed by the `model-routing` cluster. Driving the real
installer with `--only model-routing` deploys AND wires it correctly. The cluster is in
`CLUSTER_KEYS`, is not seeded off anywhere, and `--yes` alone means `set_all 1`.

**Why the hook-registry guard did not flag it: it was never built to.** `_is_managed`
asks two REPO-STATIC questions - is the name in the tree, and does install.sh mention the
filename. Both are true, so the guard is correctly silent (`--check` exit 0, `--audit`
exit 0). Whether a hook is actually DEPLOYED to `~/.claude/hooks` and WIRED into the live
settings.json on THIS machine is a different axis, and nothing in the repo checks it.

So this is not a half-registration and not an installer defect. It is a live-state gap:
the cluster was never selected on this machine. Enabling it changes the runtime behavior
of every session, which is a user decision rather than a repair to make unilaterally.

The generalizable point: **"managed" means packaged, not deployed.** A guard that proves
the first will pass the next machine that is missing the second, because it is not
looking there.

## Unit 2, defect 2 - closed via the installer's own path

`~/.claude/hooks/sidecoach-modes.json` was a dangling symlink into a repo file deleted in
the modes collapse. The prune covers the hooks directory on a REAL run, not just in tests:
`--prune-skills` named it, `--prune-skills-apply` removed it. Zero dangling links remain
under `~/.claude/{hooks,skills}`. No manual `rm` was used.

## A finding I rejected, and why that matters

Codex's third finding claimed the substring presence check (`grep -Fq`) let an indented
marker enter the refresh path and append a duplicate. I built the case and measured it:
**the canonical block count stays at 1 across four runs with the original check.** The "2
markers" the finding rests on are the user's own indented line plus our single correct
block, and leaving the user's line alone is right - the installer must not delete lines it
never wrote.

I had already written a helper and two test rows for it. Mutation control caught them:
reverting the helper left both rows GREEN, so they proved nothing. Both the helper and the
rows were removed rather than kept as decoration, and the misleading comment attached to
the helper went with them.

**A fix justified by a disproven premise is worse than no fix, and an assertion that
passes under mutation is not a test.** Accepting all three findings because two were real
would have shipped a false claim in a comment future readers would trust.

## Mutation control

Five mutations, each watched red then restored: self-wrapping markers restored (payload-
marker row red), full original defect restored (duplication row red, 3 markers), malformed
suppression removed (byte-identical row red), symlink migration removed (both cycle rows
red), legacy suppression downgraded to warn-only (legacy row red).

One test failure was a harness artifact, not a product defect: `$TMPDIR` ends in a slash,
so the literal fixture path carried a `//` that install.sh's `cd && pwd` normalizes away,
and the prefix comparison missed. Normalized in the test rather than "fixed" in the
product.

## The acceptance gate, and the one open decision

Reassembly is lossless: **278 content lines before and after, multiset diff EMPTY**, one
canonical marker pair.

The literal ordered diff is NOT empty, for one reason: the memory block MOVES. This
machine's file is memory-then-brain, a historical artifact; the installer's canonical
fresh-install order is brain-then-memory, so a refresh converges to it. Content is
provably intact, but the block changes position.

Per the standing instruction, the backup was restored and the live file left byte-
identical to its pre-change state rather than accepting a gate that did not come back
empty. That decision belongs to the lead, and nothing was forced.

**The live file needs no change regardless**: its block already carries the current text,
and the repo source is now byte-identical to it. The drift was repo-side and is closed.

## Lead correction round, and one stale claim in it (same day)

The lead sent a stop on Unit 2 after it was already finished. Reconciling it:

- **2.1 model-router-guard: we agreed independently.** Their `--manifest` check
  (`Guardrails/model-routing`, no state) and my `_is_managed` reading reach the same
  conclusion: not a defect, guard correctly silent, do not deploy. I had already declined
  to enable it. One factual nuance that does not change the ruling: the cluster sits in
  the browser's non-core `"section": "more"` bucket and was never selected here, but it is
  NOT seeded into `HOOK_OFF` the way `sidecoach-detect` is, and `--yes` with no `--only`
  still means `set_all 1`. So a bare full install WOULD pick it up. "Never selected on
  this machine" is exact; "opt-in" is close but would mislead anyone who later runs a
  bare `--yes` expecting it to stay off.

- **2.2 the dangling link: the lead's statement of live state was already stale.** They
  ruled the prune stays dry-run by default (correct, and untouched by me) and then said
  the consequence is that `~/.claude/hooks/sidecoach-modes.json` "is now DETECTED and
  named by path but still present until someone runs the apply flag." It is not present.
  I removed it earlier via the explicit `--prune-skills-apply` flag, which is what their
  own original spec asked for ("make the live state clean, via the installer's own prune
  path rather than a manual `rm`"). Zero dangling links remain. Nothing about the DEFAULT
  behavior changed: the apply flag is still the only mutating path, and I invoked it
  deliberately rather than making it automatic.

  Worth recording as its own lesson: **a ruling issued against a remembered live state can
  be stale by the time it lands.** The fix is cheap - re-read the state before stating it
  as a consequence.

- Their carry-forward #1 (a sweep reporting CLEAN on a directory it could not read) is
  already closed in this suite: `test-install-prune-skills.sh` has a green row asserting
  an unreadable directory returns **exit 7** rather than a clean report.

- Their carry-forward #2 (a comment claiming a control that was never run) is the one to
  answer directly, because Unit 1 is where they predicted it would appear. The control was
  RUN, not asserted: 278 content lines before and after with an EMPTY multiset diff, and
  when the ordered diff came back non-empty the backup was restored and the gate was NOT
  accepted. The same discipline is what killed my own `marker_line_present` helper and its
  two test rows - mutation control showed them green under revert, so they were removed
  rather than kept as decoration.

## Files touched

- `claude/memory-discipline-section.md` - synced from the live block, self-wrapping
  capital-I markers removed, 119 -> 128 lines, now a true payload
- `install.sh` - memory path mirrors the brain path (installer owns the markers, block is
  refreshable, malformed and malformed-legacy blocks both suppress the append) plus the
  legacy symlink-to-real-file migration that closes the cycle
- `test-userfile-safe-edit.sh` - 10 new rows driving the REAL installer, 49 -> 59 passing
- `~/.claude/hooks/sidecoach-modes.json` - dangling link removed via `--prune-skills-apply`
- `~/.claude/CLAUDE.md` - deliberately unchanged, byte-identical to its pre-change backup
