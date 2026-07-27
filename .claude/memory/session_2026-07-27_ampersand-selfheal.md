---
name: ampersand self-heal - reproduced root cause of "ampersand does nothing" on a pulled machine
description: Six historical .zshrc block forms enumerated from git history and reproduced in a sandbox. Three distinct silent/hard failure classes found, plus a DEAD migration branch (LEGACY_VANITY_MARKER was brand-renamed in c2776619 to a string no installer ever wrote).
type: project
relates_to: [decision_installer_bucket_browser.md, session_2026-07-23_unmanaged-hooks-packaged.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: sandboxed reproduction matrix (18 cases) + git archaeology
confidence: high
---

# Reproduction: why `ampersand` does nothing on a freshly-pulled machine (2026-07-27)

Collaborator: Jonah. Investigation run entirely in a sandbox (`HOME=<tmp>`, a fresh
`git clone` of the repo); the live `~/.zshrc` was READ but never written.

## The six historical block forms (from `git log -S` on install.sh)

| Form | Commit | Date | Marker written | Body |
|---|---|---|---|---|
| A | 971900e0 / 13748a45 | 04-25 | `# claude-dotfiles vanity command: ...` | `yesplease()` only, NO `ampersand` |
| C | 73cd339a | 04-28 | `# === claude-dotfiles:shortcuts:begin ===` | `yesplease()` + `ampersand()`, `./install.sh "$@"` |
| D | d4b3eda5 / 097fabd1 | 04-28 | `# === claude-dotfiles:shortcuts:begin ===` | `ampersand` w/ `--pull` + `alias yesplease=`, `./install.sh` |
| E | fa17cad4 | 04-28 | `# === claude-dotfiles:shortcuts:begin ===` | `ampersand` only, `./install.sh` |
| E' | c2776619 | 06-08 | `# === improv:shortcuts:begin ===` | same body, renamed marker. **THIS IS THE LIVE BLOCK ON THIS MACHINE** |
| G | 774df3db | 07-17 | `# === improv:shortcuts:begin ===` | adds `local rc`, `return "$rc"`, and `/bin/bash ./install.sh` |

## Reproduction matrix (18 cases, current checkout as target)

`ampersand --dry-run --only ampersand` under each form x scenario:

| Form | good path | baked path missing | exec bit stripped |
|---|---|---|---|
| A | rc=127 `command not found: ampersand` | rc=127 same | rc=127 same |
| C | rc=0 reached installer | rc=1 `cd: no such file or directory` | rc=126 `permission denied` |
| D | rc=0 reached | rc=1 cd fail | rc=126 permission denied |
| E | rc=0 reached | rc=1 cd fail | rc=126 permission denied |
| E' | rc=0 reached | rc=1 cd fail | rc=126 permission denied |
| G | rc=0 reached | rc=1 cd fail | **rc=0 reached** (the `/bin/bash` fix works) |

`ampersand --pull` failure modes (current form, valid path):

| Scenario | rc | installer ran? |
|---|---|---|
| detached HEAD | 1 | NO - `git pull` errors, `&&` short-circuits |
| unreachable remote | 1 | NO |
| path exists but is not a git repo | 128 | NO |
| dirty tree / no remote / healthy | 0 | yes |

## Root cause - four independent failure classes, not one

1. **Form A machines have no `ampersand` at all.** Pure `command not found`. This is the
   literal "does nothing".
2. **A baked absolute `cd "$REPO_DIR"` that does not exist** on the second machine (different
   username, different clone location) kills the subshell before the installer is reached.
   The error is one terse `cd: no such file or directory` with no guidance.
3. **`./install.sh` depends on the executable bit.** Any transfer that drops mode bits (ZIP
   download from GitHub, rsync without -p, a copy onto a non-exec filesystem) turns every
   pre-07-17 form into `permission denied`. Fixed in G by `/bin/bash ./install.sh`, but a
   machine still carrying E/E' has not received that fix.
4. **`git pull --ff-only && install.sh` short-circuits.** Any pull failure (detached HEAD,
   unreachable remote, not-a-repo) means the installer silently never runs.

## Separate defect found: the LEGACY_VANITY_MARKER branch is DEAD CODE

install.sh:4359 sets `LEGACY_VANITY_MARKER="# Improv vanity command: pull latest and
re-launch installer"`. **No version of the installer ever wrote that string.** The marker
machines actually carry is `# claude-dotfiles vanity command: ...` (971900e0, 13748a45).
Commit c2776619 (2026-06-08, "rename stage A: claude-dotfiles -> Improv") blanket-renamed the
brand across install.sh and swept up the *legacy detection string* along with it - renaming the
thing you are trying to RECOGNISE breaks the recogniser. Proved with
`git log -G'^# Improv vanity command' -- install.sh` returning zero commits.

Consequence: a Form A machine falls through to the final `else` and APPENDS a fresh block,
so `ampersand` does start working - but the stale `yesplease()` function is never removed and
keeps pointing at a possibly-wrong path. Cruft, not a hard failure, but the branch that was
written to prevent it cannot fire.

## The bootstrap trap (verified, and narrower than assumed)

The `ampersand` function lives in `~/.zshrc`, which the repo does not manage. So `git pull`
has no reach into it: a stale block can only be repaired by running install.sh, and the
convenient way to run install.sh is the stale block. That loop is real. It is NOT airtight,
though - `bash install.sh` from the repo, and the curl-pipe `bootstrap.sh`, both bypass it.
The fix therefore targets making the block itself unbreakable rather than adding a new escape.

## The fix - a thin .zshrc shim over a repo-owned launcher

**Why:** every one of the four failure classes above is a behaviour baked into `~/.zshrc`,
and `~/.zshrc` is the one file this repo cannot reach with `git pull`. So each fix had to be
re-applied per machine by running install.sh, and the convenient way to run install.sh was the
broken function. Moving the behaviour into the repo breaks that loop permanently - this is the
last .zshrc migration the project should ever need.

**How:** `bin/ampersand` (NEW) is the real launcher; the `.zshrc` block is now a shim that only
locates the repo and execs it. The shim:
- searches `$IMPROV_DIR`, the baked hint, and six standard clone paths under `$HOME`, instead
  of a single `cd` that dies when the repo lives elsewhere;
- always launches through `/bin/bash`, never `./install.sh`, so a lost exec bit is a non-event;
- carries `# improv-shim v1`, a version marker `is_current_format` can test directly (the old
  test inferred freshness from three BODY details and had to be hand-edited in lockstep);
- falls back to running `install.sh` itself when a checkout has no `bin/ampersand` yet, so an
  old revision can still `--pull` its way forward;
- prints an actionable error naming `IMPROV_DIR` and the bootstrap URL when nothing is found.

`bin/ampersand` deliberately does NOT `set -e`, and on a failed `git pull` it warns and
CONTINUES to the installer. The `git pull --ff-only && ./install.sh` short-circuit is failure
class 4; `bootstrap.sh` has always behaved this way, so this makes the shell command agree
with the curl path.

**install.sh changes:**
- marker constants hoisted to global scope (next to `ZSHRC`), because `detect_component` and
  section 11 have to agree on what "current" means and previously agreed only by coincidence;
- `detect_component ampersand` now reports `active` only for a CURRENT shim. This is the fix
  for a gap that would otherwise defeat the whole feature: the browser only re-runs the
  components it is told to install, so a stale block that reports `active` is never repaired.
  Reporting it `not-installed` makes the browser offer it, and installing rewrites the block;
- `LEGACY_VANITY_MARKER_ORIG` added (the spelling machines actually carry) and the vanity block
  is now swept UNCONDITIONALLY rather than as one `elif`, so a machine carrying both an orphan
  `yesplease` and a working block converges instead of keeping the orphan forever;
- `deactivate_ampersand` now removes every block shape, not just the improv-marker one.

## A data-loss defect this change would have INTRODUCED, and the guard

Making the vanity sweep unconditional widened the blast radius of an inherited bug.
`sed '/marker/,/^}$/d'` deletes **through end of file** when the range end never matches -
confirmed directly on BSD sed - and every one of these sites removes its `.bak` on the very
next line. A `.zshrc` whose `yesplease` block had been hand-edited so its closing brace was
not on a line of its own would therefore lose everything below it, silently. Previously that
sed only ran as one `elif` on machines with no other block; unconditional, it would run on
far more machines.

Guarded at all five range-delete sites (three in section 11, two in `deactivate_ampersand`):
resolve the end BEFORE deleting, and if there is no end, warn and refuse. The same hazard
exists for a block whose `# === improv:shortcuts:end ===` marker was hand-removed, so the
marker ranges are guarded identically via `zshrc_range_closed`. The check is INLINED inside
`deactivate_ampersand` rather than called, because the test harness extracts that function
out of install.sh with awk and a file-scope helper would be invisible to the extract.

Both cases are now covered by canary assertions: a user line below the damaged block must
survive, and the refusal must be explained rather than silent.

## Update path - verified end to end, it works (Jonah: "I just want to be sure")

Probed against real git repos (bare origin + a checkout deliberately behind it + a sandbox
HOME), driving the REAL `check_updates` / `apply_update` / `update_status` / `update_apply`
extracted from install.sh and browser-lib.sh, with `$0` set the way the browser sets it.

| Scenario | Result |
|---|---|
| Checkout 1 commit behind origin | `check_updates` -> count 1 + subject; `update_status` -> `available` |
| `update_apply` on that checkout | rc=0, fast-forwarded, re-installed every ACTIVE component, then `up-to-date` |
| Does an OLD deployed asset get refreshed? | **Yes.** A sentinel added to `claude/CLAUDE.md` in origin was absent from the deployed `~/.claude/CLAUDE.md` before, present after |
| Locally-modified managed file | pull fails -> rc=2, loud message, **nothing re-installed** (refuses to half-update) |
| Unreachable remote | `update_status` -> `unknown`, never a false `up-to-date` |

So "old assets/components are offered for update" is TRUE: `update_apply` re-runs
`install.sh --only <every active component> --yes` from the freshly pulled repo, which
redeploys copied/appended assets; symlinked assets update on the pull alone. No gap found.

One honest observation, not a defect: scenario B leaves a user who has edited managed repo
files unable to update, with a deliberately coarse message ("go look at the repo"). That is
documented in the code as intentional, and the alternative - installing from a repo in an
unknown state - is worse.

## Verification

`claude/hooks/test-ampersand-shim.sh` (NEW): **90 passed, 0 failed.** Three parts - migration
from all five historical forms plus the mixed state, launcher behaviour under each reproduced
failure condition, and detector/deactivation agreement (install.sh's real function text is
awk-EXTRACTED, not paraphrased, because the `IMPROV_INSTALL_LIB_ONLY=1` seam returns at line
~329 long before these are defined).

**NEGATIVE CONTROL, built into the suite** (`--negative-control` re-runs parts 1-2 against
`git show HEAD:install.sh` with no `bin/ampersand`): **25 assertions fail pre-fix, 0 fail
post-fix.** The suite treats a clean pre-fix run as a FAILURE, because assertions that cannot
fail prove nothing. Honest detail: two cases pass in BOTH runs and are correctly not counted
as wins - "install.sh not executable" (HEAD already uses `/bin/bash ./install.sh` from
774df3db) and "no repo anywhere -> non-zero exit" (the old block already returned 1 from a
failed `cd`; what it did not do was say anything useful).

No regressions: test-check-updates, test-component-browser (139), test-installer-manifest,
test-install-hook-deploy, test-browser-render (146), test-apply-pending, test-app-hook-offlist,
test-settings-deploy-parity, test-hook-registry (52) all green. `bash -n` clean on install.sh,
`bin/ampersand`, and the new suite; the EMITTED shim additionally passes `zsh -n`.

## Self-analysis - three things that went wrong

**1. I widened a destructive sed without checking its failure mode.** Making the vanity sweep
unconditional was the right call for convergence, and I reasoned about which .zshrc shapes it
would now reach - but not about what the sed DOES when its range end is absent. The signal I
walked past: I was copying a pattern (`/marker/,/^}$/d`) whose end anchor depends on the
USER's formatting, into a code path that now runs on far more machines. The rule to carry: when
you widen the blast radius of an existing operation, re-derive its worst case at the new
radius; inheriting the code does not mean inheriting a safety argument that was only ever valid
at the old radius. Guarded at all five sites, with canary assertions.

**2. My test harness failed in a way that accused the installer.** `deactivate_ampersand`
delegates to a shared `zshrc_block_delete`; my awk extraction did not include it. Because the
call site is `zshrc_block_delete ... || warn ...`, a missing function does not error out - it
takes the "refuse to delete" branch, so the suite went red with "block still present" and
pointed squarely at install.sh. I spent a cycle looking for an installer bug that did not
exist. The durable fix is the `declare -f zshrc_block_delete` assertion now in part 3: an
extraction-based harness must assert its extract is COMPLETE, or its own gaps masquerade as
findings about the code under test.

**3. Codex hung twice before I read the reason.** `codex exec "<prompt>"` printed "Reading
additional input from stdin..." and sat there until the 10-minute timeout - twice, because the
first time I treated it as slowness rather than reading the one line it had actually printed.
It needs `< /dev/null` when the prompt is passed as an argument. Worth knowing for every future
`codex exec` call in this repo.

## Concurrency note - install.sh was being edited under me

The working tree carries another teammate's in-flight work (a `hook_data_files()` table and
its deactivate-side consumers), and during this session `install.sh` was refactored beneath me:
my `zshrc_range_closed` was superseded by a better shared `zshrc_block_delete` (exact line
matching rather than regex, multi-block, detects a doubled open marker), now also used by the
voice-output and claude-teams blocks. I adopted it rather than reinstating mine - it is
strictly better. A fixture (`A_unclosed`) also appeared in my test file from outside this
session. Flagging it because the collision beat records the lead as having assigned install.sh
to this unit, and that is evidently not how it played out in practice.

## Files touched

- `bin/ampersand` (NEW) - the real launcher
- `install.sh` - hoisted markers, shim writer, marker-based `is_current_format`, unconditional
  vanity sweep, shim-aware `detect_component`, full-coverage `deactivate_ampersand`
- `claude/hooks/test-ampersand-shim.sh` (NEW) - 74 assertions + built-in negative control
- `.claude/memory/session_2026-07-27_ampersand-selfheal.md` (this beat)
