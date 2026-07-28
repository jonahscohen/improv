---
name: Prune ownership proven, not inferred
description: install.sh's prune proved "repo-owned" by LOCATION alone and could delete a user's own link or a momentarily-absent target; replaced with a shape proof plus a git-history proof, both required
type: project
relates_to: [session_2026-07-28_codex-repairs-hooks.md, session_2026-07-26_orphan-improv-skill.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests
confidence: high
---

`prune_broken_skill_symlinks` (install.sh) decided a dead symlink was "ours to delete"
by ONE test: the target path resolved somewhere under `$REPO_DIR`. That is location, and
location is not ownership. Two wrong deletions were live, and the blast radius had just
grown because the prune was widened from `~/.claude/skills` to also cover
`~/.claude/hooks`, which are the executables the harness itself runs.

- MODE 1: a symlink the USER made that happens to point into this checkout was deleted.
- MODE 2: a target absent only for a MOMENT read as retired. An unstaged deletion or a
  stash, a mid-rebase, a branch switch or partial checkout, and a submodule working tree
  each make a file vanish from disk while it is not retired at all.

## What was built

Ownership is now PROVEN from two independent oracles, both required, neither needing the
installer to have recorded anything at deploy time (so it works on machines installed long
before this change):

- SHAPE. The target's canonical PARENT must equal the one repo source directory that
  corresponds to the link's directory (`claude/skills` or `claude/hooks`), not merely sit
  somewhere beneath the repo root, and the target's basename must equal the link's. That
  is the only shape this installer ever writes.
- GIT PROVENANCE. The path must be absent from HEAD's tree AND absent from the index AND
  present at some commit reachable from HEAD. A user's untracked file, a path that exists
  only on another branch, and a path belonging to a submodule's history all fail the third
  test and are never touched.

Two new refusals, both hard non-zero so a deletion gate can never report "checked, clean"
when it checked nothing: 8 when `$REPO_DIR` is not the ROOT of a git work tree with a
resolvable HEAD, 9 when the repo is mid-rebase/merge/cherry-pick/revert/bisect.

**Why:** a manifest or a deploy-time marker (the other two options) would need
instrumenting roughly 8 deploy call sites, several owned by other agents editing the same
file right now, and would leave every already-installed machine with no manifest and
therefore a permanently inert prune. The repo's own history answers both questions with no
new state to keep in sync.

**How:** `git -C <repo> --literal-pathspecs` for `ls-tree HEAD`, `ls-files`, and
`rev-list --full-history --max-count=1 HEAD`. `--full-history` because the question is
existence, not a readable log: default history simplification can drop the commit that
carried a path through a merge. The relative path is built from the PROVEN shape rather
than by string surgery on the target. A git query that FAILS is treated as "cannot tell"
and skips the link, never as "absent" - a broken repo must never read as a retirement.

PRESERVED: dry-run stays the default, and a real removal still needs the explicit
`--prune-skills-apply` flag, so an unattended `--yes` install still never deletes from
`~/.claude`.

## Residual, stated rather than hidden

A user who hand-creates a link with EXACTLY the installer's shape, pointing at a path this
repo shipped and later deleted, is still indistinguishable from installer output inside the
installer's own namespace, and is pruned. A deploy-time manifest is the only thing that
would separate those two, at the cost above. Cross-model review agreed this is the only
residual and that it is an acceptable operational boundary.

## Verification

Failing case built FIRST and watched fail: 7 rows red against the unmodified installer
(mid-rebase pruned anyway, both MODE 1 links deleted, all three MODE 2 links deleted, no
rc=8 refusal), with 4 CONTROL rows green proving the suite was not vacuous. Suite now
33/33. The fixture repo had to become a REAL git repo with a real retirement in its
history, because against a bare temp directory nothing is ever removable and every
"this dead link IS removed" row would have passed while measuring nothing.

Two suite rows were passing for the wrong reason and were rebuilt: the `--dry-run` row
pointed at an invented path that survives whether or not dry-run works, and now points at
the genuinely retired `claude/hooks/sidecoach-modes.json` with an ANCHOR assertion that
the run identified it as a candidate before the survival is believed; the nested
direct-children row was renamed so basename-matching is not what saves it.

Mutation control: 23 mutations, one per safety property, each confirming its anchor applied
before any verdict was believed. 16 caught. The 7 not caught are all explained in the suite:
two are a TOCTOU race no single-threaded suite can stage, four are equivalent mutants
subsumed by the byte-length integrity check (which IS caught), and one is a GNU-stat
ordering bug unobservable on macOS.

The first mutation run reported 15 of 15 caught and was WRONG. It wrote the mutant to a temp
directory, and install.sh derives REPO_DIR from its own location, so every CLI-driven row
went red for that reason alone and manufactured a CAUGHT for mutations nothing detected.
Mutants now run from the repo root. A mutation harness can lie in the flattering direction.

Codex (gpt-5.4, deterministic wrapper, four passes, every one exit 0) reviewed the design
before implementation and then the diff three times. Pass 1 supplied `--full-history`,
`--literal-pathspecs`, `-C` everywhere, `rev-parse --git-path` for mid-operation detection
so linked worktrees are covered, a pre-unlink recheck, and the argument for hard non-zero
refusals. Passes 2-4 found six real defects in my own fix, all folded:

- The header claimed to prove OWNERSHIP. It does not prove who created a link. Reworded to
  claim only what it establishes. Overclaiming here is the same sin as the original defect.
- `$(basename)` and `$(readlink)` strip trailing newlines, so a link could be judged against
  a DIFFERENT path's history and deleted. First fix was incomplete (it caught a newline in
  the link name but not in the target, because readlink's output ends in exactly one newline
  whether the target has one or not, making the distinction unrecoverable from the output).
  Now DETECTED instead of recovered: a symlink's st_size is its stored target's byte length,
  so any link that does not read back byte-for-byte is refused.
- The pre-unlink recheck only re-tested the link TYPE, so swapping in a different broken
  symlink still got it deleted. It now re-reads and compares the exact proven target.
- Three "cannot tell" skips did not count themselves, so a run that gave up on every
  candidate could still print the clean line. All now count, and any undecided candidate
  replaces the clean line with an explicit LEFT UNDECIDED warning.
- `stat -f` is "format" on BSD but "filesystem" on GNU, so a BSD-first probe would succeed
  on Linux and hand back output that is not a length, silently rendering the prune inert.
  GNU form now runs first and the result is validated as digits.
- `${#tgt}` counts CHARACTERS in a multibyte locale while st_size counts BYTES, so a
  non-ASCII repo path or username would refuse good links forever. Both sides now count
  bytes.

One defect was found by the suite rather than by review: the `stat` probes were bare
assignments, and install.sh runs under `set -e`, so the BSD box failing `stat -c` by design
aborted the entire installer at the first broken link. Only the CLI-driven row caught it,
because the suite disables `set -e` when it sources install.sh. Every probe now tolerates
its own failure.

## Self-analysis

The defect's shape is one this repo keeps producing: a safety step that reports success.
The prune printed "no dead repo-sourced links" and exited 0 whether it had proven anything
or not, so every unprovable case still resolved toward deleting. The fix inverts that
default: every branch that cannot prove ownership now skips or refuses, and the two new
exit codes exist so "I could not check" can never be read as "I checked and it was clean."

## Files touched

- install.sh (prune_broken_skill_symlinks only)
- claude/hooks/test-install-prune-skills.sh
