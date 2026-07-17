---
name: Bucket browser gum viewport overflow - torn root screen fixed
description: Shipped tear at 80x24 - gum --height was derived from the row count alone, ignoring the printed header and the real terminal height; height now derives from the measured budget, plus the frame-fit assertion the 110 render checks were structurally blind to
type: project
relates_to: [decision_installer_bucket_browser.md, decision_bucket_browser_engine_leaf_master.md]
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: tests + real-terminal screenshots (80x24 Terminal.app) + codex-review.py
confidence: high
---

# Bucket browser: the gum viewport must fit the TERMINAL, not the row count

Shipped bug, found by Jonah on a real 80x24 Terminal via `ampersand` after the browser
merged to main (b25c1f0f).

## Symptom

The root screen rendered TORN: `✓ Up to date` appeared TWICE, `Quit` appeared twice, a
stale cursor `>` sat on a row the cursor was not on, and rows were missing. Jonah's
decisive observation: "If I take my cursor from top to bottom, it eventually, line by
line, replaces the original with the correct line, but with a double 'Up to date'
marker." So gum repaints rows as the cursor passes over them, but never repairs the line
that scrolled off the top.

## Root cause

`render_screen()` sized gum's viewport from the ROW COUNT ALONE:

    rows=${#ROW_DISP[@]}
    height=$(( rows + 1 ))
    [ "$height" -gt 22 ] && height=22

That number is unrelated to the space actually left on screen. It ignored three things:

1. **The header `render_screen` itself printed two lines earlier** via `_br_print_header`.
   MEASURED at 80 cols: 5 rows at the root (leading blank, breadcrumb, the 90-char lead
   WRAPPING to 2 rows, blank), and 6 on a bucket screen. Width-dependent, so never a
   constant.
2. **gum's own chrome.** MEASURED at 80x40 (tall enough that nothing scrolls, so the
   capture is truth and not a scrolled artifact): an optional header row (0 when
   `--header` is empty; a long header TRUNCATES rather than wrapping, so never more
   than 1), then the list, then 2 blanks, then the `navigate / enter submit` footer -
   plus a pagination-dots row once the list paginates.
3. **The real terminal height.** `22` was hardcoded.

Consequence at 80x24: the root landed at 24 (marginal, tips over on any extra wrap), and
deep screens overflowed outright - `Guardrails/verification` (20 rows) took height 21 and
drew 28 rows into 24. The terminal SCROLLED, gum's screen model desynced from the screen,
the top line orphaned, and gum only repaired lines the cursor visited. Exactly the
reported symptom.

## The fix

`height` now derives from the real remaining space:

    term_rows - BR_HDR_LINES - gum_hdr - 3   (2 blanks + footer)
    minus 1 more when the list will paginate (the dots row)
    height = min(rows, budget), floored at 3

**Why:** the only number that can keep the frame on screen is one computed from the
screen. **How:**

- `_br_term_rows` mirrors `_br_term_width`'s `stty size </dev/tty` (NOT `tput lines`,
  which reads its stdout - a pipe inside `$( )` - and so always says 24). Deliberately
  NOT floored the way width is: a width floor is harmless (the line soft-wraps), but
  claiming 24 rows on a 12-row window is the very bug being fixed. Tiny terminals are
  handled by the height floor of 3 instead.
- `_br_print_header` now BUFFERS its output, counts it, and reports `BR_HDR_LINES`. A
  predictor function would be a second copy of the layout that goes stale the first time
  someone edits a printf - and the failure mode is a torn screen. Buffer-and-count cannot
  drift: it counts the bytes about to be printed.
- The `X` sentinel in that buffering is load-bearing: `$( )` strips ALL trailing
  newlines, and the header ENDS in a blank line. Without it the count is one short and
  the frame silently overflows by a row. Measured both ways.
- `_br_display_rows` counts DISPLAY rows, not lines: ANSI stripped (zero width, plenty of
  bytes) and soft-wrap accounted for (`n == w` is one row - terminals defer the wrap).
- The header is counted at `_br_term_width_RAW`, not the floored `_br_term_width`. The
  60-col floor is right for LAYING OUT rows (worst case a line soft-wraps) and wrong for
  COUNTING them: at a real 50 columns the lead is wrapped to the 60 floor, the terminal
  soft-wraps those lines again, and the header takes 6 rows while a count at 60 reports
  5. That is the same undercount-then-overflow bug, just below 60 columns. Found by
  Codex round 2, confirmed by measurement (5 at w=60 vs 6 at w=50), and verified fixed on
  a real 50x24 pty: hdr_lines=6, total=24, paginating.
- Dropped the pointless `+1`.

When `rows` exceeds the budget gum now SCROLLS INSIDE its viewport (the `••` dots),
which is what `--height` below the item count is for.

## Why 110 render checks missed it

Two independent blind spots, and BOTH had to be fixed or the new test would be theatre:

1. **pty byte-stream blindness.** Every existing assertion greps text in a pty capture.
   When a frame is taller than the window the emitted bytes are still individually
   CORRECT - the tear is created by the TERMINAL reflowing them. A capture file has no
   screen, no cursor, no scrollback. The duplicate `Up to date` the user sees does not
   exist anywhere in the byte stream; there is no string to grep for.
2. **Geometry.** The harness drives at 130x60. A 60-row window absorbs a 28-row frame
   without scrolling, so even a screen model would have seen nothing. The bug only
   exists at ~24 rows - the DEFAULT Terminal size.

## The new assertion

A `Frame height` section that reads the renderer's own viewport arithmetic (via a
`BR_FRAME_LOG` test seam) at REAL terminal heights and asserts
`header + gum chrome + list + footer <= terminal rows` for root, Guardrails,
Guardrails/verification and Beats/Hooks at 24, 20 and 30 rows. Plus: the viewport must
GROW with the window (else "budget" is a differently-spelled hardcode), and a too-tall
screen must PAGINATE rather than overflow. 127 checks total (110 + 17).

**NEGATIVE-CONTROLLED, not assumed.** Restoring `height=$((rows+1)); cap 22` turns 6
assertions RED: verification 28 > 24, Beats/Hooks 28 > 24, Guardrails 26 > 24, root
24 > 20, and the growth check reports height 21 at BOTH 20 and 30 rows. The 30-row runs
still PASS under the old math, which proves the assertion is not merely always-red.

## Self-analysis (failures caught in-flight)

- **I trusted a confounded test.** My first unit test of `_br_display_rows` appeared to
  confirm a Codex finding that trailing blank rows were undercounted. The test was
  wrong: `$(printf 'a\n\n')` strips the newlines before the function ever sees them, so I
  measured my own harness, not the code. Retesting with `$'a\n\n'` showed the function
  correct in every case. Lesson: when a test confirms a bug, verify the TEST before
  acting on it - a confounded test is as expensive as no test. (The confound was
  accidentally useful: `got=1, expect=2` is precisely the failure the `X` sentinel
  prevents, so it proved the sentinel load-bearing.)
- **My first test was flaky and hid it as a hang.** I made the runs quit by steering the
  browser back out with escape keys. Keys are sent on a fixed schedule, gum loses
  anything typed before it enters raw mode, and every screen change restarts gum - so
  under load a single swallowed key parked the browser one level from where it belonged
  with nothing left to quit it, and the run sat until the 90s watchdog. Six runs doing
  that is a ten-minute suite that proves nothing. Fixed by ending the runs with a
  deliberate KILL: the log is complete the moment the last screen renders, so the clean
  exit was never needed. Lesson: don't make a test depend on a behaviour it isn't
  testing.
- **A stale-log trap I re-opened.** A watchdogged run returns early and LEAVES its
  partial log on disk; my cross-run checks read it regardless and "passed" off a dead
  run's leftovers. This is the same trap `_drive`'s nonce exists to close, and I walked
  into it. Now the runs that succeeded are tracked and the rest refuse to conclude
  anything.

## An orphan browser was polluting a LATER run's frame log (my bug, found by evidence)

`kill -9` on the pipeline kills `script`; the BROWSER is a separate process and survives
it, still rendering and still appending to its BR_FRAME_LOG. A bare `pkill` is
fire-and-forget - it returns before the signal lands - so the next run could start while
the last one's browser was still alive.

The tell was an inconsistency, not a hunch: `frames-beats-24`'s log contained
`nav=Guardrails`, a screen its own keystrokes CANNOT reach (the beats descent sends 9
downs; Guardrails is row 10), and the log's mtime was SEVEN SECONDS after its own raw
capture stopped. A log that disagrees with its own capture is another process writing to
it. Fixed with `_frames_no_browser`: kill and then PROVE the browser is gone (poll
`pgrep`), before the run and after it, refusing to proceed if one survives SIGKILL.

Worth noting the shape: the harness's existing nonce discipline exists to stop exactly
this class of thing (asserting against output this run never produced) and I reopened it
from a new direction. The lesson generalizes past the nonce: freshness is not only "is
this file new", it is "did THIS process write it".

## Codex verdict round 2 (real verdict, 223.8s, exit 0) - ONE Medium, REAL

The `_br_term_width` 60-col floor being used to count header rows (folded above,
measured). Codex explicitly cleared the two things I most wanted challenged: the one-shot
retry cannot turn a missed descent green (`_frames_saw` still runs on the log), and the
kill path's masked exit status is fine because nav-reachability is what carries the
proof. No bash 3.2 issues.

## Codex verdict round 1 (codex-review.py, real verdict, 58.2s, exit 0)

- Finding 1 (High) "`_br_display_rows` undercounts trailing blank rows": FALSE POSITIVE.
  awk does emit the empty record for `a\n\n`; it drops only the newline after the last
  record, which is correct. Verified by unit test rather than argued.
- Finding 2 (High) "the test's oracle shares `BR_HDR_LINES` with the renderer, so a bad
  header measurement makes both agree while the terminal scrolls": REAL and fair.
  Folded: `_br_display_rows` is now pinned by independent unit checks against
  hand-computed expectations (extracted from install.sh, not copied - a copy is a second
  implementation that can agree with itself while both are wrong).
- Finding 4 (Medium) `[ x -gt y ]` on a non-numeric operand exits 2: harness runs
  `set -uo pipefail` (no `-e`) so it cannot abort, but numeric guards added so a bad
  parse fails cleanly rather than erroring.
- Finding 5 (Low) divide-by-zero on width 0: `_br_term_width` floors at 60 so it cannot
  fire, but `_br_display_rows` is generic arithmetic - clamp added.
- Finding 3: no bash-4-only constructs. No action.

## Verification

- `bash -n install.sh` clean.
- test-browser-render 127 (110 + 17 new), test-component-browser 104, test-check-updates
  39, test-apply-pending 33, test-app-hook-offlist 36, test-settings-deploy-parity ALL
  PARITY CHECKS PASSED, test-content-guard 35. No regressions.
- **Real 80x24 Terminal.app**, root AND Guardrails: `✓ Up to date` once, `Quit` once,
  breadcrumb once, cursor on the row it is actually on, all rows present, and the `••`
  dots on Guardrails showing gum scrolling inside its viewport. No tear.

## Known gap

`screencapture` returns "could not create image from display" for both this harness and
Terminal itself - Screen Recording is not granted, and that is a system security setting
not to be changed from here. The real-terminal verification was done via the computer-use
screenshot surface (which has its own entitlement) and the images are in the session
transcript, but no PNG was written to disk. A simulated render was deliberately NOT
substituted: the whole point of this bug is that only a real terminal reflow shows it.

## Files touched

- `install.sh` - `_br_term_rows` + `_br_display_rows` added; `_br_print_header` split
  into a buffering wrapper (`BR_HDR_LINES`) over `_br_render_header`; `render_screen`
  viewport budget; `BR_FRAME_LOG` test seam.
- `claude/hooks/test-browser-render.sh` - `Frame height` section: `_drive_frames`,
  `_frames_fit`, `_frames_saw`, `_br_display_rows` unit checks.
