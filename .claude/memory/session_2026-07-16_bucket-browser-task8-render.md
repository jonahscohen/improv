---
name: Bucket browser Task 8 - render + nav + text fallback
description: The VIEW layer over browser-lib.sh (render_screen/render_screen_text/component_browser/activate) plus a pty-driven render harness; caught a silent tput-cols bug and a harness that could pass on stale captures
type: project
relates_to: [session_2026-07-16_bucket-browser-task7-update-flow.md]
superseded_by: session_2026-07-16_bucket-browser-task8-width-header.md
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: pty-captured real screens (74 render checks) + 5 regression suites + 2 Codex passes
confidence: high
---

Task 8 of the installer bucket browser: the VIEW + NAV on top of the finished logic
layer. browser-lib.sh was NOT touched (logic was already green at 93/93).

## What was built (all in install.sh, ~800 lines, before the entry-point section)

- `render_screen` - the gum renderer. ONE `gum choose` per screen; the returned row
  string maps back to a row index by exact match against `ROW_DISP`.
- `render_screen_text` - the no-gum fallback: a numbered menu over the SAME rows, using
  install.sh's existing `printf` + `read -r </dev/tty` idiom.
- `component_browser` - the nav-stack loop (root -> bucket -> member -> hooks).
- `build_rows` / `_br_item_row` - ported from the prototype's buildRows/itemRow.
- `activate` - ported from the prototype's activate (drill vs toggle vs action).
- Entry seam: `install.sh --browser`. ADDITIVE ONLY - the default interactive dispatch
  still goes to run_tui_gum/run_tui_fallback/returning_flow (retiring those is Task 9).
  `--browser` does not set NONINTERACTIVE, so no unattended path can reach it.
- `claude/hooks/test-browser-render.sh` - pty-driven render harness (74 checks).

## Two real bugs found by LOOKING at captured output (not by reasoning)

1. **`$(tput cols)` always returns 80.** tput reads the window size from its STDOUT;
   inside a command substitution stdout is a PIPE, the ioctl fails, and tput silently
   falls back to terminfo's default 80. It never errors. This would have pinned the
   elastic tag column - where the hook DESCRIPTIONS render - to 13 characters on every
   terminal regardless of width. Caught because the first capture showed
   `rules, settin` truncated at 130 cols. Measured: under a 140-col pty, `stty size` ->
   "60 140" while `$(tput cols)` -> "80".
   **Why:** stty reads STDIN, so `stty size </dev/tty` gets the truth from inside a
   command substitution. tput kept as the no-tty fallback.
   Note: install.sh's pre-existing `term_width=$(tput cols ...)` (~line 1953) has the
   same latent flaw; harmless there (it only feeds `fold`), left alone as out of scope.

2. **The pinned toast printed " is always on ..." with no name.** A HOOK LEAF IS NOT A
   NODE: browser-lib only walks buckets/members, so `node_label` AND `node_kind` both
   return EMPTY for "Beats/Hooks/beats-rebuild". Hooks exist only as their parent's
   CHILDREN string plus by-name HOOKPATH/HOOKDESC/PINNED entries. The row builder had a
   key fallback; the toast did not.
   **Why/How:** one `_br_display_name` helper (label-or-key) now used at every call site
   so the fallback cannot drift again.

## Codex cross-model gate (2 passes, ~206s + ~260s)

Pass 1 findings, all folded:
- HIGH: the harness could report success from STALE captures. `rm -f` then `[ -s "$raw" ]`
  passes if the rm FAILED, `_clean` regenerates a stale .txt, and callers ignored
  `_drive`'s return entirely. Codex REPRODUCED it printing `ALL 74 RENDER CHECKS PASSED`
  while nothing rendered. **Fix:** each run mints a NONCE the pty echoes first and the
  capture must contain it; refuses to run if a prior capture cannot be cleared; `_clean`
  and the installer's exit code checked; every caller now gates on `if _drive ...; then
  ... else fail`. **Proven** by planting a stale fixture that satisfied every assertion:
  harness now exits 2, "refusing to run text-root against a possibly stale file".
- HIGH: `component_browser`/`activate` are status-tested by `if`, which DISABLES errexit
  for the whole body, yet `build_rows`/`stage_toggle`/`stage_all` were unchecked -
  contradicting this file's own SET -E NOTE. **Fix:** all checked explicitly.
- MEDIUM: an unmappable gum return string was silently treated as escape (walking the
  user up a level or quitting). **Fix:** non-zero gum exit still means abort/back, but an
  unmappable string now sets a toast and re-renders.
- MEDIUM: harness only classified rc==137. **Fix:** 137 -> exit 3; missing nonce / empty
  capture / non-zero installer exit -> exit 2.
- LOW: state-dependent assertions. **Fix:** below.

Pass 2 confirmed 1/3/4 fixed, and found more:
- The `build_rows` guard I added was DEAD CODE - my own probe caught it before Codex.
  With zero buckets the root still has 3 chrome rows (update + 2 labels), so a
  `+2` threshold never fired. Now counts ITEM rows; probed both ways (empty tree ->
  returns 1; real tree -> 17 rows, no false positive).
- stage_all test was still state-dependent even at `Apply [1-9]+` (a machine with those
  hooks already off should correctly stage ZERO). **Fix:** the expected count is now
  DERIVED from the post-action screen (count the non-pinned hook rows showing `active`),
  so it is right on any machine. Reads "exactly the 5 active non-pinned hooks" here.
- Harness could exit green having never exercised gum (hardcoded /opt/homebrew/bin;
  Intel Homebrew uses /usr/local/bin). **Fix:** gum discovered via `command -v`; a
  missing gum is now a HARNESS ERROR (exit 2), and the text path's "gum is unreachable"
  premise is verified at startup. Probed: exit 2, no false green.

## KNOWN LIMITATION (deliberate, reported not hidden)

Codex pass 2, MEDIUM: the `stage_toggle`/`stage_all` failure toasts are currently
unreachable, because those functions in browser-lib.sh always `return 0`. Making them
propagate real failures is a browser-lib.sh change, and this task's brief was explicit:
do not modify it. The call-site checks are correct for this layer and would catch a
future lib change; today they are defensive only. Flagged for the coordinator.

## Three places the prototype could not be ported faithfully (gum constraints)

1. **The detail bar cannot follow the cursor** - `gum choose` has no on-highlight
   callback, and one-choose-per-screen is the approved design. It renders as a status
   line carrying the prototype's `toast()` messages (toast writes to that same bar) and
   otherwise the screen's orientation line. Per-row descriptions are NOT lost: they ride
   inline in the tag column, which for every hook leaf IS its description (the
   prototype's `hleaf` sets tag and desc to the same string). In the gum path it rides in
   gum's `--header`, ABOVE the rows, because nothing can print below the chooser.
2. **Labels/separators are selectable** - gum makes every line selectable; they render in
   position and `activate` no-ops on them. The text path skips them properly (no number).
3. **No `a`/`q` key bindings** - gum owns the keyboard, so Apply/Quit are ROWS. Apply
   appears on deeper screens only when something is staged; Quit lives at root (esc backs
   out, and at root esc quits with the same unapplied warn).

Glyphs: design.md's literal spellings win over the prototype's where they differ - `<`
`>` `v` carets (design.md spells them ASCII, which also matches the house prefer-ASCII
rule), `●`/`◐`/`○` status, `↻`/`✓` update row (all spelled out in design.md). ASCII `-`
for the pending marker rather than the prototype's U+2212. gum STRIPS ANSI out of items
(measured on gum 0.17.0), so rows are plain text and color comes from gum's palette
flags - which is what run_tui_gum/returning_flow already do.

## What the pty harness could and could not drive

- COULD: both renderers, for real. Text path driven by numbers; **the gum path driven by
  real escape sequences** (`\033[B` down, `\r` enter, `\033` esc) - it navigates root ->
  Beats and asserts on the drilled screen.
- CAVEAT: the gum drive is TIMING-based. Keys delivered before gum enters raw mode are
  echoed by the line discipline and lost - measured, not theoretical: an unpaced drive
  selected the wrong row. Keys are paced with sleeps (3.5s startup, 0.55s between).
- Every run has a 90s watchdog. Learned the hard way: a drive whose keys do not lead to
  an exit leaves gum waiting forever (first gum attempt hung until SIGTERM at 2min).
- The update row runs the REAL `check_updates` (git fetch), so captures show live state
  (`✓ Up to date` here); the assertion accepts any of the three states.

## Gates (all green)

- `bash -n install.sh` OK; `bash -n test-browser-render.sh` OK
- test-component-browser.sh 93/93 | test-check-updates.sh 26/26
- test-apply-pending.sh 33/33 | test-app-hook-offlist.sh 36/36
- test-settings-deploy-parity.sh ALL PARITY CHECKS PASSED
- test-browser-render.sh ALL 74 RENDER CHECKS PASSED (exit 0)
- `--help` exit 0, `--dry-run --only safety` exit 0 (picks only safety),
  `--dry-run --preset minimal` picks 6, unknown flag still exits 2

Captured screens left on disk: /tmp/browser-render-{text-root,text-beats-hooks,
text-toggle,text-stageall,gum-root,gum-nav}.txt

## Self-analysis

The `build_rows` guard I wrote to satisfy a Codex finding was itself broken (off-by-one
on chrome rows) and would have shipped as reassuring dead code if I had not probed it.
Failure mode: I wrote a guard and trusted it because it was *my* fix for a *reviewed*
issue - treating "I addressed the finding" as "the finding is fixed". The signal I nearly
missed is that a guard is a claim like any other and needs its own external probe. Same
lesson as the stale-capture hole: the harness asserted freshness it never checked. Both
were caught only by running a probe designed to make the thing FAIL.

## Files touched

- install.sh (browser view/nav block, --browser seam + help/header docs)
- claude/hooks/test-browser-render.sh (new)
- .claude/memory/session_2026-07-16_bucket-browser-task8-render.md (this beat)
- .claude/memory/MEMORY.md (index)
