---
name: verify-before-done-stop corroborates the visual flag against the working tree
description: The Stop gate demanded a screenshot even when the working tree held zero visual files, an unsatisfiable demand only a manual override could clear; it now checks git status as a second piece of evidence and withholds the demand only when it can PROVE there is nothing to screenshot
type: project
relates_to: [decision_verify_hook_quoted_mention_arming.md, feedback_hooks_prefer_false_positives.md]
author_human: Jonah
author_model: claude-opus-4.8
machine: Mac
source: session
verified: reproduced live + 15 negative-controlled rows incl. every fail-closed path + submodule/timeout probes + 5 suites green + Codex round folded
confidence: high
---

Jonah, 2026-07-23. Third unit in the verify-hook thread. The lead session was blocked at Stop by a
screenshot demand while `git status --porcelain` held only `.sh`, `.md` and `.pyc` - zero visual
files - and Jonah had to override manually. This is the safer alternative proposed at the end of
[[decision_verify_hook_quoted_mention_arming]], where fixing the same pain at the ARM site was
proven undecidable.

## The defect

`verify-before-done-stop.sh` blocked whenever the session flag read `visual`, with no check that
anything visual actually existed to photograph. The flag can say `visual` while the tree holds
nothing visual in two ways: a command that only MENTIONED a visual filename armed it (undecidable
to fix at the arm site - see the decision beat), or a real visual change was armed and then
reverted. In both cases the demand cannot be satisfied honestly. The only exit is
`verify-manual.sh` ("verified"/"lgtm"), i.e. a human override - which is exactly the cost the lead
paid. An unsatisfiable gate is the boy-who-cried-wolf failure in
[[feedback_hooks_prefer_false_positives]]: it trains readers to override reflexively, which is
worse than not gating.

## The fix

**Why:** add a second piece of EVIDENCE rather than removing the first. The arm path in
`verify-before-done.sh` is untouched, so all visual recall is exactly as before. This gate can only
ever WITHHOLD a demand it can prove is impossible; it can never arm anything.

**How:** when the flag reads `visual` and the session is not a subagent, run
`git status --porcelain -z --untracked-files=all --ignore-submodules=none` in the payload `cwd`.
If it returns a clean, complete, fully-parsed listing containing no visual file, allow the stop -
exactly as a non-visual `code` flag already does. Otherwise block as before.

Flag choices, each load-bearing:
- `--untracked-files=all` expands untracked DIRECTORIES into their files. Plain `--porcelain`
  collapses a new directory to one `?? newdir/` record and would HIDE a brand-new component, which
  is precisely the case that must still block.
- `-z` gives NUL-terminated records and never C-quotes or escapes a path, so a filename containing
  a space or newline cannot be mis-split into the wrong extension. A rename emits both the new and
  the original path as separate records, so scanning every record covers both ends of a move.
- `--ignore-submodules=none` forces a dirty submodule to surface regardless of repo config, so the
  directory check can block on it.

`VISUAL_EXTS` here is a copy of the arm side set and MUST remain a SUPERSET of it. If the arm side
can arm on an extension this set does not know, a real visual change would be downgraded and the
gate would fail OPEN on it. Noted in a comment at both ends.

## Fail closed, without exception

The only path that returns "no visual evidence" is a clean, complete, fully-parsed status listing.
Every uncertainty blocks: no cwd, cwd not a directory, git missing, not a git repo, non-zero exit,
timeout (5s), undecodable output, more than 20000 status records, or a changed entry that is a
DIRECTORY on disk (a submodule whose contents cannot be enumerated).

## Before/after (15 negative-controlled rows, all probed live)

| case | before | after |
|---|---|---|
| tree holds only .sh/.md/.pyc (the reported case) | BLOCK | **allow** |
| totally clean repo | BLOCK | **allow** |
| staged .css | BLOCK | BLOCK |
| modified tracked .css | BLOCK | BLOCK |
| UNTRACKED .tsx in a never-added dir | BLOCK | BLOCK |
| untracked dir of ONLY non-visual files | BLOCK | **allow** (precision) |
| untracked .css whose filename contains a space | BLOCK | BLOCK |
| untracked .twig (exotic ext the arm side knows) | BLOCK | BLOCK |
| dirty SUBMODULE holding a .css | BLOCK | BLOCK |
| NOT a git repo | BLOCK | BLOCK |
| nonexistent cwd / empty cwd | BLOCK | BLOCK |
| git binary unavailable | BLOCK | BLOCK |
| flag=code | allow | allow |
| no flag at all | allow | allow |
| stop_hook_active (loop guard) | allow | allow |
| subagent/teammate session | allow | allow |

## Accepted residual: a visual file inside a GITIGNORED path (Codex raised this; not fixable)

I found this independently before the review, and Codex then raised it as its ONLY two findings,
rating both serious. They are the same defect: a `.css` that is gitignored (either matched
directly, or sitting inside an ignored `dist/`) is not reported by `git status`, so the gate allows.

**It is not fixable, for a principled reason - not merely an inconvenient one.** The obvious remedy
is `--ignored`, and it does not work because **`git status --ignored` reports EXISTENCE, not
CHANGE.** Proven: a `*.gen.css` file last modified in 2020, untouched by any session, is still
listed as `!! old.gen.css` on every single run. Git does not diff ignored paths against an index
baseline, because they are not in the index - so there is no "changed" signal to read. Keying the
gate on those records would convert the question from "did something visual CHANGE?" into "does
this repo CONTAIN an ignored visual file?", which would permanently block every stop in any such
repo, forever. That is strictly worse than the false positive this whole unit removes.

Two supporting measurements: `--ignored=matching` does NOT expand ignored directories (a
`dist/hidden.css` is never listed individually - confirmed 0 records), so it cannot reach the
inside-an-ignored-dir case at all; and `--ignored=traditional`, which does expand, listed 50
dependency CSS files from a single `node_modules` fixture, which would block on every stop in any
JS project.

Why the residual is narrow: ignored paths are by definition build output, caches or vendored
dependencies, not source. A visual change that matters is made to SOURCE, which git tracks, and
which still blocks correctly. It only bites if someone hand-edits a generated or vendored visual
file AND that is their only change. Asserted by a test row so it stays a deliberate, visible trade
rather than a latent surprise - if that row ever flips, the trade gets re-justified.

Same shape as the hidden-dir/node_modules residual in the project_has_ui work: the mechanism that
would close the gap is the same mechanism that makes the fix work at all.

## Verification

- All 5 suites green: test-verify-before-done 145, test-verify-visual-gate 15 -> 30,
  test-verify-session-isolation 11, test-bash-guard-commit 148, test-nudge-debounce 58.
- New rows added to `test-verify-visual-gate.sh`, which already owns the stop-hook teeth.
- Mutation-tested, and each mutation fails EXACTLY the rows it should: forcing "no evidence" fails
  9 recall/fail-closed rows; disabling the fix fails the 3 allow rows; dropping the directory check
  fails only the submodule row; dropping `--untracked-files=all` fails only the precision row.
- That last mutation caught a hole in my first test set. Dropping `--untracked-files=all` broke
  NOTHING, because an untracked directory collapses to a single `?? dir/` record which the
  directory check then blocks on anyway - correct, but coarse, and no row could tell the two
  configurations apart. Added the precision row (an untracked dir of only non-visual files must
  ALLOW), which is the only row that distinguishes them. Without it the flag was unpinned and a
  future edit could have silently dropped it, re-blocking exactly the sessions this fix serves.
- The `VISUAL_EXTS` copy is asserted equal to the arm side by a test, not just by a comment - a
  divergence there is a silent false negative, so it is checked mechanically.
- `bash -n` clean and zero literal single-quotes in the `python3 -c` payload (this file carries the
  same quoting constraint as the arm hook).
- `verify-manual.sh` untouched - the "verified"/"lgtm" escape hatch still clears the flag.
- Codex round run (independent model). Its only findings were the gitignored residual above,
  analysed and declined with proof. Everything else came back NO FINDING and is worth recording as
  positively verified, not merely unexamined: a visual file in the index only, in the worktree
  only, a renamed `.css`, a mode-only change, a deleted `.css`, a `.css` in a nested git repo, a
  symlinked `.css`, a tracked-but-ignored `.css` edited, and `.CSS` / `.TsX` case variants ALL
  block; the XY status-code stripping does not mangle rename records or paths with leading spaces;
  a git that hangs (fake binary sleeping 10s) blocks via the timeout; >20000 records blocks; and
  `flag=code`, no flag, `stop_hook_active`, a sidechain transcript and a `teamName` transcript all
  still allow, so the loop guard and subagent exemption are unaffected.

## Self-analysis

The instinct on the previous unit was to fix the false positive where it was first observed - at
the arm site - and that turned out to be provably impossible. The lesson worth keeping is that the
right place to fix a false positive is not always where it originates: arming had irreducible
ambiguity (a quoted argument may or may not be executed), but the STOP gate has access to evidence
the arm site never had - the state of the working tree at the moment the demand is made. Moving the
question downstream to where more evidence exists turned an undecidable problem into a decidable
one. Worth asking on any future gate FP: is there a later checkpoint that knows more?

Second note: I twice had a fixture blocked by the beats-dirty guard because the fixture itself ran
`git commit`. That is the guard working correctly on my own un-beated edit, not a bug - the fix was
to write this beat, not to work around the guard.

## Files touched

- claude/hooks/verify-before-done-stop.sh (`tree_has_visual_evidence` + the corroboration branch)
- claude/hooks/test-verify-visual-gate.sh (+15 negative-controlled rows)
