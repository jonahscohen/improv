---
name: Bucket-browser Task 9 - browser becomes THE interactive entry; --help generated from the tree
description: Retired run_tui_gum/run_tui_fallback/fresh_flow/returning_flow for component_browser on the default entry; --help Components block now generated from browser-tree.json; check_updates availability decoupled from subject text (count-based); pinned-note copy said once
type: project
relates_to: [session_2026-07-16_bucket-browser-task7-update-flow.md, session_2026-07-16_bucket-browser-task8-render.md, session_2026-07-16_bucket-browser-task8-width-header.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: tests (6 suites) + pty render captures + non-interactive differential vs pre-wire baseline + codex-review.py
confidence: high
---

Task 9 of the installer bucket browser: the browser stops being an additive `--browser`
seam and becomes the interactive experience. Authored against `b807f0cb`.

## What was retired (and the grep that justified it)

Deleted outright - no shims. Every call site was checked before cutting:

- `run_tui_gum` (was install.sh:1145) - only caller was `fresh_flow`
- `run_tui_fallback` (was install.sh:1214) - only caller was `fresh_flow`
- `fresh_flow` (was install.sh:1915) - only caller was the entry dispatch
- `returning_flow` (was install.sh:1963, 236 lines) - only caller was the entry dispatch

After deletion `grep -n 'run_tui_gum\|run_tui_fallback\|returning_flow\|fresh_flow' install.sh`
returns ONLY prose comments. Cross-file hits in `test-apply-pending.sh`,
`test-component-browser.sh` and `browser-lib.sh` are comments describing *returning_flow
parity* (the bookkeeping `apply_pending` had to reproduce), not calls - they stay accurate
as history and were left alone.

**Why there is no fresh-vs-returning branch any more.** The browser probes each item's
status live, so a first-run machine and a drifted one render through the identical path.
`returning_flow` existed to answer "which of two screens do I draw" - a question the
browser does not have to ask. That is why this is a deletion, not a port.

**Update check kept, prologue dropped.** `returning_flow` ran the update check as a
blocking gate before you could reach anything. It now surfaces only through the browser's
update row (`_browser_update_refresh` -> `update_status`).

## Orphaned, NOT deleted (flagged for Jonah)

`print_yes_and_banner` (the Yes& ASCII logo) and `print_title_animated` now have zero
callers - the browser never drew the banner. Deleting the product's brand banner is a
design call, not a cleanup, so they were left in place and reported rather than removed.
`show_picks_summary` correctly survives: `--dry-run` still uses it.

## --help regenerated from browser-tree.json

The Components block was hand-maintained and had already drifted. `_help_components()`
now generates it from `claude/hooks/browser-tree.json` via one python3 pass.

**How:** grouping = the tree's buckets (so help reads in the browser's order, under the
browser's names). Per bucket it emits the reachable `--only` keys: leaf -> its own key;
hooks -> the `hook_owner` of each hook; group -> recurse. De-duplicated, tree order kept.
The Personal bucket is gated on `--personal` by the tree's own `"personal": true` field -
the same field `_br_is_personal` reads.

**Why `hook_owner` and not the node key:** `Beats/Hooks` is a hooks node whose hooks are
owned by `memory` + `reflect`. A naive walk would advertise a key called "Hooks", which
`--only` rejects. This is exactly the class of error a hand-written list makes.

**Verified, not assumed:** all 43 advertised keys were fed to `--dry-run --only <key>`;
0 rejected. Reverse check against the real runtime `KEYS` array: nothing advertised that
is not real, and the only real key NOT in the block is `skills` - which has no tree node
because the browser installs the 11 design skills individually. It stays documented in
the prose note under the block.

**Self-caught bug:** `textwrap.wrap` split `api-drift` across lines at the hyphen,
printing a key that does not exist. Fixed with `break_on_hyphens=False,
break_long_words=False`. Every token in that block is a literal the user types.

**Degradation:** no python3, or an unparseable tree, prints a pointer at the file. It
never prints a stale hard-coded copy - a stale copy is the exact failure being removed.

## check_updates: availability is a COUNT, not subject text (the deferred fix)

Held for Task 9 deliberately, because the fix changes `check_updates`' OUTPUT CONTRACT and
its second consumer (`returning_flow`) died above. With one consumer left, the contract was
free to move.

**The hole (Codex R2, proven in Task 7, not theorised):** `git commit --allow-empty-message`
is legal. Availability was inferred from whether `git log --pretty=%s` printed anything, so
a repo whose first <=10 incoming commits all had empty subjects printed nothing and read
`up-to-date` while updates existed.

New `check_updates` contract:
- exit 1 -> cd/fetch/rev-list/log failed; UNKNOWN
- exit 0 -> line 1 = count of incoming commits (`git rev-list --count HEAD..origin/main`,
  a bare integer, "0" = up to date); lines 2+ = up to 10 subjects, newest first, DISPLAY
  ONLY, legitimately absent even when count > 0.

Kept: the `cd`/fetch -> unknown semantics, and `--max-count=10` (NOT `| head -10`, which
returns 141 under pipefail when git log is still writing as head exits - the Task 7
finding). Nothing prints until both git calls succeed, so a failure path never leaves a
half-written count on stdout.

**The no-subjects render decision (Jonah flagged it, this is the answer):** when available
with zero subjects, `update_status` synthesizes the count as the detail line - "3 new
commits" / "1 new commit". It lives in `update_status` (browser-lib.sh), not in
`check_updates`: the git primitive answers "how many", the UX layer decides what the row
says. `update_status`' public contract is unchanged (line 1 = available|up-to-date|unknown,
detail on 2+). A zero-exit `check_updates` that prints an invalid count is reported
`unknown` - a broken primitive is not an up-to-date repo.

**NOT fixed, recorded:** the nonstandard `remote.origin.fetch` refspec case (stale
`origin/main` after a successful fetch -> false up-to-date). It also breaks `apply_update`'s
pull, so it is a repo-config problem, not a `check_updates` bug.

## Copy fix: the pinned note was said twice, unpunctuated

`/tmp/browser-render-text-w80.txt` line 49 read `7 of 7 hooks on Pinned hooks are always
on.` - two sentences run together - and line 70 repeated `Pinned hooks are always on.` in
the same screen's footer.

**Root cause of the run-on:** the separator was two spaces, but `_br_print_prose` wraps via
`_br_wrap_words`, which re-joins on SINGLE spaces. The separator vanished on the wrapped
path. Fixed with a " - " separator, which survives the re-join because it is its own word.

**Root cause of the duplication:** `_br_footer_text`'s own section comment already claimed
the note was folded into the lead "and only on screens that really have a pinned hook" -
but the code appended it anyway. The comment was right and the code was wrong; the footer
line is gone. `_br_print_header` is now the single source, which is also what keeps the gum
path correct (gum's footer carries only the staged rollup, so moving the note the other way
would have silently dropped it there).

## Judgment call: --dry-run now gates the interactive dispatch

`--dry-run` alone never set `NONINTERACTIVE`, so post-wire it would have entered the
browser - an interactive applier - and written to disk under a flag documented as "print
resolved picks and exit; touches no files". The old `fresh_flow` honored dry-run (it only
picked, then fell through to the summary); the old `returning_flow` did NOT. The dispatch
is now gated `NONINTERACTIVE == 0 && DRY_RUN == 0`, so dry-run falls through to the picks
summary. Precedent followed: the prune block already states "a global --dry-run overrides
an apply request". Consequence: `--browser --dry-run` prints picks instead of browsing.

## Cross-model review (codex-review.py, 2 rounds)

The bare `codex` CLI is BROKEN on this machine (`SyntaxError: Unexpected reserved word` -
its `#!/usr/bin/env node` shebang picks up a node too old for its top-level await).
`codex-review.py` exists for exactly this and resolves a node>=16 absolutely; `--smoke`
returned HEALTHY in 38.5s. This is why the mandate says use the wrapper, not the CLI.

**Round 1 - no HIGH. 2 findings, both real, both folded:**

- MEDIUM: mixed empty/non-empty subjects rendered `Incoming: ; fix config`. I had spotted
  this case while designing and waved it off as cosmetic. It was not: git prints an empty
  LINE per empty-message commit, and the footer joins detail lines with "; ". Reproduced
  against a real repo BEFORE fixing. `update_status` now filters empty lines.
- LOW: the MUT_SUBJ control claimed the mutant was "still correct on a normal repo" while
  only asserting line 1. The mutant counts via `git log --max-count=10 | grep -c .`, so its
  count caps at 10 - it breaks the full-count contract too. Claim narrowed to
  CLASSIFICATION, with the cap documented.

**My own bug, caught by running the fix rather than trusting it:** the first cut of the
filter wrote `${out#*$'\n'}` INSIDE a here-doc body. A here-doc does parameter expansion
but NOT quote removal, so `$'\n'` was literal, the strip never matched, and the count
leaked into the detail as a fake subject - the real repo rendered `Incoming: 3; fix config`.
Now precomputed into `$subjects` before the here-doc. The unit stubs would have shown the
same wrong output without explaining it; the real-repo probe is what made it obvious.

**Round 2 - no HIGH. Round-1 production fixes confirmed correct. 2 findings, both tests:**

- MEDIUM (REJECTED, premise false, evidence recorded): claimed the parity `git log | head -10`
  could SIGPIPE-141 and abort the harness before scenario 2. The harness runs `set -u`
  (line 57); the `set -euo pipefail` at 135/148 is inside the DRIVER heredocs, not the
  harness. Empirically every scenario runs and the tally is 39/39. Patching a finding whose
  premise is false would have been its own failure, so it is reported, not applied.
- LOW (REAL, folded): test 26e did not test what it claimed. `out="$(check_updates)"` strips
  trailing newlines, so `printf '2\n\n\n'` arrives as `2` and the blanks never reach the
  filter - it was a duplicate of 26b. Rewritten to pin the actual boundary, and it exposed
  a genuine structural fact now documented in `update_status`: when out != count the block
  always ends non-blank, so `detail` can never filter to empty. The `-n "$detail"` guard is
  DEFENSIVE, not load-bearing. Saying so is better than a test pretending to cover it.

## Self-analysis

Two failures worth naming. **The mixed-subject case:** I identified it during design,
called it "cosmetic, pre-existing-ish", and moved on. The failure mode was reasoning about
severity from the code instead of looking at the rendered output - the same class of error
this project keeps re-learning (Task 8: "found by LOOKING at output"). Codex found it in one
pass. **The zsh probe:** my non-interactive proof loop reported `exit=2` for every
multi-word flag spec because the Bash tool runs zsh, which does not word-split unquoted
`$spec` - so each spec arrived as ONE argument and hit the unknown-flag path. `--help`
"passed" only because it is a single token, which is what made the result look plausible
rather than broken. I caught it because the loop contradicted a standalone run I had already
done. A harness that lies in the PASSING direction is the dangerous shape; this one lied in
the failing direction and was therefore cheap. Lesson banked: run installer flag matrices
under an explicit `bash`, never the ambient shell.

## Gates

- `bash -n install.sh` and `bash -n browser-lib.sh` clean.
- Non-interactive differential vs the PRE-WIRE installer: `--only safety`, `--preset
  minimal`, `--preset none`, `--help`, unknown-flag all return identical exit codes;
  `--dry-run --only safety` pick rows byte-identical (42 rows); zero writes under
  `HOME/.claude` on every path. Re-proved on the final code under an explicit bash:
  `--only safety`/`--only justify` pick exactly 1, `--preset minimal` 6, `--preset all` 42,
  `--preset none` 0, unknown flag exit 2.
- All 43 `--help`-advertised keys accepted by `--only` (0 rejected); reverse-checked against
  the runtime KEYS array (nothing advertised that is not real).
- Suites: component-browser 99 (was 93), check-updates 39 (was 26), apply-pending 33,
  app-hook-offlist 36, browser-render 110, settings-deploy-parity ALL PASSED.
- Captures re-taken through the DEFAULT entry (`bash install.sh`, no flags) on both
  renderers, proving the wire-in routes there rather than trusting the `--browser` seam.
  `--browser` separately re-proved to still render after its dead variable was removed.

## Staging note for the coordinator

The handoff said to stage install.sh + test-check-updates.sh (+ test-browser-render.sh if
touched) + the beat. Two files outside that list HAD to change, and the work is incoherent
without them:

- `claude/hooks/browser-lib.sh` - `update_status` lives here. It is not optional: under the
  new contract check_updates prints "0" for an up-to-date repo, and the OLD update_status
  mapped "exit 0 + any output" to `available`. Leaving it would make every up-to-date repo
  report an available update.
- `claude/hooks/test-component-browser.sh` - its update_status tests STUB check_updates with
  the old contract. They went red (88/93) the moment the contract moved. That is the suite
  working, not breaking.

`test-browser-render.sh` was NOT touched (its 110 checks passed unmodified).

## Files touched

- `install.sh` - retired 4 flows, `_help_components()` + `print_help`, `check_updates`,
  `_br_print_header` / `_br_footer_text` copy, entry dispatch, `--browser` made inert
- `claude/hooks/browser-lib.sh` - `update_status` (count contract, empty-line filter,
  no-subjects display)
- `claude/hooks/test-check-updates.sh` - count-contract assertions, empty-subject scenario,
  new subject-text mutant control, re-anchored MUT_PIPE / MUT_NOGUARD
- `claude/hooks/test-component-browser.sh` - stubs moved to the new contract, plus 26b/26c/
  26d/26e (no-subjects, singular, mixed, the command-substitution boundary)
