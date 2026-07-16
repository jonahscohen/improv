---
name: Bucket browser Task 7 - two-state update flow (update_status / update_apply)
description: update_status + update_apply land in browser-lib.sh; check_updates gets its missing return 0 so up-to-date is distinguishable from offline; 2/3 exit-code contract; Codex caught a FAKE test of mine
type: project
relates_to: [session_2026-07-16_bucket-browser-task6-apply-pending.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: tests
confidence: high
---

Task 7 of the bucket-browser TDD build. Builds the LOGIC behind the root screen's
two-state update row (Update available / Up to date). The row's RENDERING is Task 8.

## Changes

- `install.sh` `check_updates`: added an explicit `return 0` as the final line. Fixes a
  real defect, not a style nit (below).
- `claude/hooks/browser-lib.sh`: new `update_status` (classify) + `update_apply`
  (pull + targeted re-run). New code lives in browser-lib.sh, NOT install.sh.
- `claude/hooks/test-component-browser.sh`: +13 assertions (75 -> 88), all stub-driven.

## The check_updates defect (and why the fix was safe)

`check_updates` ended with `[ -n "$commits" ] && printf '%s\n' "$commits"`. As the last
command of the function, that returns **1** whenever there are NO commits. So the
up-to-date case was indistinguishable, BY EXIT CODE, from a failed `cd`/`git fetch`.
Any caller that read the code (as update_status must, to tell "up to date" from
"offline/unknown") would mis-report an up-to-date repo as unknown.

**Why:** the browser's update row is a three-way classification, and it can only be
driven off the exit code plus output. The code had to become meaningful.

**How:** append `return 0`. Safe because the ONLY existing caller is `returning_flow`
(install.sh ~1825), which does `updates=$(check_updates 2>/dev/null || true)` and tests
the OUTPUT only, ignoring the exit code entirely - so no existing behavior moves. Task 9
retires that caller anyway. No other line of check_updates/apply_update was touched.

Resulting contract:
- exit 1 -> cd/fetch failed; update state is UNKNOWN
- exit 0 + output -> commits available (one subject per line)
- exit 0 + no output -> up to date

## update_status

stdout line 1 is exactly one of `available` / `up-to-date` / `unknown`; when `available`,
the commit subjects follow verbatim on lines 2+. The `check_updates` call is wrapped in
`if` so the expected exit-1 (offline) path cannot abort a caller under `set -e`.

## update_apply exit-code contract (2 vs 3 is the whole point)

- `0` pulled clean and the re-run landed, OR nothing was active to re-run
- `2` the PULL failed (not fast-forwardable) - the user must resolve the repo by hand.
  No re-run is attempted: re-installing from a conflicted repo is how you get a
  half-updated setup.
- `3` the pull SUCCEEDED but the re-install failed. The repo IS updated, the deployment
  is NOT. Distinct from 2 so the caller never sends the user off to resolve a repo that
  is already clean.

Re-run list = `KEYS` filtered by `detect_component "$k"` = active, joined with commas,
then `_AMPERSAND_NO_SUMMARY=1 bash "$self" --only "<csv>" --yes` (mirrors the returning
flow's recursive-install idiom at install.sh ~2021). Empty list -> skip the re-run, return 0.

**Why `bash "$self"` deliberately runs NEW code:** the pull may have just rewritten
install.sh, and matching the user's setup to the fresher repo is the entire point of the flow.

**cwd side effect (pre-existing, left alone):** check_updates/apply_update `cd "$REPO_DIR"`
WITHOUT a subshell, mutating the caller's cwd. Out of scope to fix here, but update_apply
resolves `$0` to an ABSOLUTE path BEFORE calling apply_update so a relative `$0` cannot
silently resolve against the wrong directory after the cd.

## Self-caught bug (produce-and-verify, before Codex)

First draft of the re-run leg used `if cmd; then ... return 0; fi; rc=$?`. That is wrong:
after a plain `fi` with no else, `$?` is the IF STATEMENT's status (0), not the failed
condition's - the error message would have printed "exit 0" and rc would be meaningless.
Fixed to the `else rc=$?` form, which is exactly why apply_pending is written that way.
Failure mode to keep catching: `$?` is only the condition's code INSIDE the else branch.

Also used the bash-3.2 empty-array guard `${KEYS[@]+"${KEYS[@]}"}` - a bare `"${KEYS[@]}"`
on an empty array is an unbound-variable error under `set -u` on macOS system bash.

## Codex cross-model review (R1, real verdict in 254s)

Codex CLI first appeared BROKEN here (`codex --version` -> SyntaxError "Unexpected
reserved word"). Root cause was NOT codex: the non-interactive Bash tool shell has node
**v12.22.12** active (the nvm default lives in zshrc, which this shell never sources),
while codex 0.142.5 is installed under v20 and needs >=16. Workaround used:
`export PATH="$HOME/.nvm/versions/node/v20.19.6/bin:$PATH"`. Worth a durable shim if it
recurs - a future session will hit this same wall and may wrongly conclude "Codex absent"
and drop to the fallback reviewer.

FOLDED (5):
- **Fake test of mine (the big one).** My "survives a failing detect_component probe"
  test drove update_apply via `if update_apply`, which DISABLES errexit inside the body -
  so it passed with the guard deleted. Proven fake, then rewritten to call update_apply as
  a PLAIN COMMAND under `set -euo pipefail` (errexit live inside the body), which now goes
  red without the guard. This is the exact "tests pass while the impl is wrong" trap.
- Guarded the `st="$(detect_component ...)"` assignment (was a bare assignment that could
  abort an errexit caller). The rewritten test above is its real control.
- Test 31 recorded argv with `"$*"`, which collapses args: `bash "$self" "--only csv" --yes`
  (one arg) passed identically to the intended three-arg form. Now records `<%s>` per line.
- "available" test only grepped for subjects; an impl that duplicated/reordered lines passed.
  Now asserts the EXACT multiline output.
- Added strict-mode caller-shape tests (`if update_apply` under `set -euo pipefail`) for
  BOTH exit 2 and exit 3; the original tests ran under `set -u` only.
- Softened the exit-2 comment + stderr message: `git pull --ff-only` also fails on a bad
  REPO_DIR, network/auth error, or dirty tree, so the code no longer CLAIMS "not
  fast-forwardable" when it cannot distinguish that. (Spec mandates 2 for any pull failure;
  only the wording over-claimed.)

REPORTED, NOT FIXED (out of scope - check_updates/apply_update bodies are frozen by spec,
and both are design calls for the orchestrator, not the executor):
- **Codex's #1 High: `check_updates` can report "up-to-date" when `git log HEAD..origin/main`
  itself fails** (fetch succeeds, log fails -> empty commits -> `return 0` -> "up-to-date"
  instead of "unknown"). NOT a regression: the old code returned 1 there, and the sole
  existing caller reads OUTPUT only, so it printed "Up to date" too. Tightening it means
  `commits=$(git log ...) || return 1`, i.e. unfreezing check_updates.
- `commits=$(git log ... | head -10)` is SIGPIPE-fragile under `pipefail` (>10 commits ->
  pipeline returns 141). Harmless TODAY precisely because the new `return 0` swallows it,
  and the 10 subjects are still correct. `git log --max-count=10` is the clean fix.
- The cwd side effect (primitives `cd` without a subshell) - update_apply defends itself by
  resolving `$0` absolute BEFORE the cd; the primitives themselves are untouched.

## Tests (+18, 93 total)

Stub-driven: check_updates / apply_update / detect_component / KEYS / the recursive `bash`
call. Every re-run assertion uses a MARKER FILE, never stderr - update_apply redirects the
re-install with `>"$logfile" 2>&1`, so a stderr marker would be swallowed and a trap meant
to catch an unwanted re-run would silently never fire (Task 6 hit exactly this trap).

Coverage: available+both subjects, up-to-date, unknown, `set -e` smoke on the unknown path,
pull-fail -> 2 with NO re-run (marker absent), pull-ok -> 0 with exact args
`--only codex,chrome --yes`, nothing-active -> 0 + no re-run, re-run-fail -> 3.

NEGATIVE-CONTROLLED: all 18 assertions, via 18 source mutations (A-Q + the guard removal).
Label swaps, dropped/duplicated commit lines, unguarded check_updates call, 2->1 / 3->2 /
3->9 code swaps, pull-fail fall-through, csv truncation, removed empty-csv guard,
success-path rc swaps, argv collapsed to one arg, removed abs-path resolution, removed
detect_component guard. Each mutation was confirmed to turn the intended assertion RED,
then reverted. One mutation (guard removal) FOUND A FAKE TEST rather than confirming a
real one - see the Codex section.

## Gates (all green, final)

- `bash -n install.sh` clean
- test-component-browser.sh 93/93 (was 75; +18)
- test-apply-pending.sh 33/33 (no regression)
- test-app-hook-offlist.sh 36/36 (no regression)
- test-settings-deploy-parity.sh ALL PARITY CHECKS PASSED
- Real-`check_updates` behavioral probe against a throwaway git repo. This matters because
  the unit tests STUB check_updates, so the return-0 fix has NO unit coverage - the defect
  and its fix are only observable on the real function. Extracted it verbatim from
  install.sh and drove it under `set -euo pipefail`:

  | case          | PRE-FIX rc | POST-FIX rc |
  |---------------|-----------|-------------|
  | up-to-date    | **1**     | **0** + empty output |
  | bad REPO_DIR  | **1**     | **1** |

  Pre-fix, both cases return 1 - the defect reproduced empirically, not just read off the
  page. Post-fix they separate, which is exactly what update_status needs to tell
  "up to date" from "unknown".

## Files touched

- install.sh (check_updates return 0 only)
- claude/hooks/browser-lib.sh (update_status, update_apply)
- claude/hooks/test-component-browser.sh (+13 assertions)
