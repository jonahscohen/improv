---
name: sidecoach-sessionstart hook - portable repo-root derivation
description: Replaced the last hardcoded /Users/spare3 machine path in the hooks with the beats-hook real-path root derivation; verified under a foreign $HOME and an unrelated repo path
type: project
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests
confidence: high
---

Unit 4 of the improv dispatch plan (worktree /Users/spare3/Documents/Github/improv-wt/u4, branch w1-u4).

## What changed
- `claude/hooks/sidecoach-sessionstart.sh` line 4 hardcoded
  `SIDECOACH_ROOT="/Users/spare3/Documents/Github/improv/sidecoach"` - the one
  hook that broke on any other machine/checkout. Replaced it with the exact
  real-path root derivation the beats hooks use.

**How:** copied the four-line pattern verbatim from `beats-staleness-guard.sh` /
`beats-rebuild.sh` (both at the same `claude/hooks/` depth):
`_realpath()` (python3 `os.path.realpath`) -> `SELF` -> `HOOK_DIR` (dirname) ->
`REPO_ROOT` (`$HOOK_DIR/../..`), then `SIDECOACH_ROOT="$REPO_ROOT/sidecoach"`.
`os.path.realpath` follows the deploy symlink from `~/.claude/hooks/` back into
the real repo checkout, so the walk-up lands on the actual repo root.

**Why:** the hooks are symlinked into `~/.claude/hooks/`; deriving from the
script's own resolved path is the machine-independent way to find the repo, and
mirroring the beats hooks keeps one convention across the hook set. Did NOT add
`set -u` (the beats hooks have it) - out of scope for a root-derivation port and
risky given the script's use of `$USER`/`$!`; kept the change minimal.

## Verification (behavioral, no UI to screenshot - shell hook)
- `grep -n "/Users/spare3" claude/hooks/sidecoach-sessionstart.sh` -> no match (exit 1).
- `bash -n` parse -> clean (exit 0).
- Harness `scratchpad/verify-sidecoach-root.sh`, two checks, both PASS:
  - TEST 1 (real edited file): symlinked the actual hook into a fake
    `$HOME/.claude/hooks/`, ran it with `HOME` overridden. State file recorded
    `SIDECOACH_ROOT=/Users/spare3/Documents/Github/improv-wt/u4/sidecoach` (the
    worktree's own sidecoach, NOT the old hardcoded improv/sidecoach), the
    resolved `dist/sidecoach-orchestrator.js` existed, and the root carried no
    fake-`$HOME` prefix (HOME-independent).
  - TEST 2 (portability): a copy in a fake repo at an unrelated temp path with
    mock dist+daemon resolved `SIDECOACH_ROOT` to THAT repo's sidecoach, no
    `/Users/spare3` literal.
- Test-spawned daemons/pipes cleaned up by PID; pre-existing daemons from other
  sessions (main-repo path) left untouched.

## Self-analysis (minor in-task correction)
TEST 2 first run reported FAIL because I compared the hook's realpath'd output
against a non-realpath'd expected value; on macOS `/var` is a symlink to
`/private/var`, so `os.path.realpath` correctly returned the `/private/...` form
and my assertion's expected string did not. Failure mode: I built the expected
value with raw `mktemp -d` output instead of normalizing it through the same
resolver the code uses. Fix: run expected paths through `_realpath` before
comparing. The code was correct on the first run; only the test oracle was
wrong. Lesson: when asserting on a value the code passed through `realpath`,
normalize the expected value through the identical call.

## Follow-up: Codex-found latent bug (state-file escaping)
Codex review accepted the derivation but flagged a real latent bug the fix
surfaces: the state file was written unescaped (`SIDECOACH_ROOT=$SIDECOACH_ROOT`
via a heredoc) and is later `source`d by `sidecoach-postuserp.sh` and
`sidecoach-postresponse.sh` (both `source "$STATE_FILE"` on line 7). With the old
hardcoded no-spaces path this never bit; now that SIDECOACH_ROOT is DERIVED from
the real checkout path, a checkout whose path contains a space (e.g.
`/tmp/My Repo/u4`) makes the sourced line `SIDECOACH_ROOT=/tmp/My Repo/...` -
invalid shell that errors (bash runs `Repo/...` as a command, rc 127).

**Fix (same owned file):** replaced the heredoc with `printf '%q'` writes for all
five values (ACTIVE, SESSION_ID, PIPE_PATH, SIDECOACH_ROOT, DAEMON_PID). `%q` is a
no-op on the numeric/literal values and backslash-escapes spaces in the paths, so
`source` in the (bash) consumer hooks restores the exact original value. Escaped
all five uniformly rather than cherry-picking, so no written value stays exposed.
The hook already quoted `$SIDECOACH_ROOT` everywhere it executed it - the state
write was the only unescaped surface.

**Verification extended (TEST 3 in scratchpad/verify-sidecoach-root.sh):** ran the
hook under a space-in-path checkout (`.../My Repo/u4`), then sourced the state
file the way the consumer hooks do. State file now holds `SIDECOACH_ROOT=.../My\
Repo/u4/sidecoach`; sourcing yields `.../My Repo/u4/sidecoach` with NO error.
Control proves the bug was real: the old unescaped write, sourced, fails rc 127
("Repo/u4/sidecoach: No such file or directory"). TESTS 1-2 still pass (escaping
did not regress derivation). All three PASS, harness exit 0.

## Files touched
- claude/hooks/sidecoach-sessionstart.sh (derivation commit b9f3811b + escaping follow-up, both on w1-u4)
