---
name: Bucket browser Task 8 round 2 - width-aware columns, single gum header, apply-row consistency
description: Fixed the description column collapsing at 80 cols (per-screen name width + word-boundary ellipsis + wrapped continuation rows), collapsed the gum path's duplicate instruction lines, and hid the root Apply row at zero pending
type: project
relates_to: [session_2026-07-16_bucket-browser-task8-render.md]
supersedes: session_2026-07-16_bucket-browser-task8-render.md
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: pty captures at 60/80/100/120 (110 render checks) + 5 regression suites + 2 Codex passes + 2 mutation probes
confidence: high
---

Round 2 of Task 8, from three defects Jonah found by driving the renderer at real
widths. All three fixed; all seven gates green.

## 1. HIGH - the description column collapsed at common widths

At 80 cols the tag column (which carries the hook DESCRIPTIONS, the whole point of the
drill-in) got ~13 chars and sheared mid-word ("rules, settin"). Measured first, then
fixed:
- Longest hook name 29, longest hook description 52. Name + desc + status CANNOT share an
  80-col line, so truncation alone could never satisfy "a user can READ what each hook
  does". A strategy was needed, not a shaved column.
- Widest BUCKET name is only 12 ("Design Tools") - a fixed 30-wide name column was
  burning 18 columns on every root row.

**Strategy (three parts):**
1. **Per-screen name width** - the widest name actually on that screen, clamped
   [10, 30]. Root/bucket screens reclaim ~18 columns; hook screens keep 29-30. This
   alone makes bucket tags render in FULL at 80.
2. **`_br_fit_words`** - word-boundary truncation + ellipsis, never a mid-word cut. Backs
   off only when the cut lands INSIDE a word (next char alphanumeric); a cut before a
   space or punctuation keeps the word that fit.
3. **Wrapped continuation rows** - when a hooks screen still cannot fit its descriptions,
   the description gets its own indented line under the row (kind `desc`, carrying the
   SAME path as its parent, so in gum - where every line is selectable - either line acts
   on the same hook). Wide terminals (>=~118) keep the prototype's exact one-line layout.
Also `_br_print_prose` word-wraps lead/toast prose; unwrapped, a 134-char lead relied on
the terminal's soft wrap.

**Why:** at 80 cols a full single-line description is arithmetically impossible; the only
honest options were amputate or wrap. Wrap preserves the feature Jonah explicitly asked
for ("when we hover over the hooks, we need descriptions for those too").

## 2. MEDIUM - the gum path stacked two near-duplicate instruction lines

The lead and the orientation line sat adjacent above the rows saying the same thing.
Fix: gum's `--header` now carries ONLY the staged rollup; the toast prints above the rows
via `_br_print_header gum` (it can be long and needs wrapping, which a --header cannot
do); the one non-redundant fact, "Pinned hooks are always on", folds into the lead and
ONLY on screens that actually contain a pinned hook.

**Gotcha found by looking:** omitting `--header` entirely makes gum print its OWN default
`Choose:` under our lead. An explicit (possibly empty) `--header` renders nothing. It is
now always passed, with a regression assertion.

## 3. LOW - "Apply 0 changes" at root

Root always rendered the Apply row while sub-screens hid it at zero. Root now matches.

## Bugs found in my OWN fixes (the reason probes exist)

- **`printf '%s'` printed the literal text `\033[0m`.** install.sh's palette vars are
  single-quoted (`NC='\033[0m'`), so they hold a LITERAL backslash-0-3-3 and only become
  escapes when printf interprets them in the FORMAT string. Passed as a `%s` ARGUMENT
  they print as visible garbage. `%b` interprets them. Caught by reading the capture.
- **The `tag_w` floor of 12 re-overflowed the line** (Codex): it ignored the width the
  name clamp had just budgeted, so a 60-col root row rendered ~61 chars + the menu's
  6-char prefix. Removed; when a tag cannot fit the answer is to WRAP it, never to widen
  the column past the terminal.

## The measurement was lying in BOTH directions (most important lesson)

My overflow assertion used `awk 'length($0) > w'`. **awk counts BYTES in this locale**,
and the status glyphs (● ◐ ○) are 3-byte UTF-8 occupying ONE column. So it reported every
full-width row as ~2 columns over and invented overflows that did not exist - a correct
120-column row measures 122 bytes. Now counted in display columns via python.

And it under-reported: `_br_rtrim` strips trailing spaces, so with an EMPTY pending column
a too-wide row got trimmed back and the overflow hid. The width drive now STAGES an item
(the `4` toggle is load-bearing, not incidental) so the pending column is populated - the
widest the layout ever gets, and the only state where an overflow is observable.

## Codex (2 passes) and mutation probes

Pass 1 (this round) findings, all folded:
- MEDIUM: `desc` rows are selectable in gum and mapped by exact display string; two
  identical wrapped lines could toggle the WRONG hook. MEASURED: all 55 wrapped
  description lines in the tree are currently unique, so it is LATENT, not live - but one
  description edit from being real, and the failure is silent. Fixed FAIL-SAFE: if the
  chosen string matches rows with DIFFERENT paths, refuse + toast + change nothing.
  Same-path duplicates (the sep rules, a desc line vs its own item) still first-match.
- LOW: narrow-width overflow (name_w could stay 29) -> name clamp.
- LOW: `_br_fit_words` over-truncated on an exact word boundary -> boundary check.
- TEST GAP: the matrix proved only 3 known descriptions and the negative "rules, settin"
  assertion could pass vacuously -> added a 60-col case (below the renderer floor), a
  POSITIVE full-tag assertion at >=80, and `assert_in_flow` (whitespace/newline
  normalized) so a legitimately WRAPPED description still counts.

Pass 2 confirmed 1-4 fixed and caught the tag_w floor bug I had introduced.

**Mutation probes (a test that cannot fail proves nothing):**
- Reintroduced the `tag_w` floor -> harness exits 1, "w60: 1 line(s) exceed 60 columns".
  After the wrap-rule change the floor became unreachable (the wrap rule subsumes it), so
  the same mutation now passes - removal remains correct as defense if the rule changes.
- Removed the name clamp -> harness exits 1, "w60: 1 line(s) exceed 60 columns". Proves
  the clamp is load-bearing AND that the column-based check catches a REAL overflow.
- `assert_in_flow` control-tested both ways, now a permanent harness SELF-CHECK that
  exits 2 if the matcher cannot match across wraps or cannot fail.

## Gates (all green)

- `bash -n install.sh` OK; `bash -n test-browser-render.sh` OK
- test-component-browser 93/93 | test-check-updates 26/26 | test-apply-pending 33/33
- test-app-hook-offlist 36/36 | test-settings-deploy-parity ALL PARITY CHECKS PASSED
- test-browser-render ALL 110 RENDER CHECKS PASSED (was 74)
- `--help` 0; `--dry-run --only safety` 0 (picks only safety); `--preset minimal` picks 6;
  unknown flag exits 2

Captures: /tmp/browser-render-{text-root,text-beats-hooks,text-toggle,text-stageall,
gum-root,gum-nav,text-w60,text-w80,text-w100,text-w120}.txt

## Ruling absorbed

Jonah ruled the `stage_toggle`/`stage_all` unreachable-toast concern NOT a defect: those
lib functions are pure string ops that cannot fail, and the call-site checks are correct
defensive code. No browser-lib task. Not revisiting.

## Self-analysis

Two failures worth naming. First: I wrote an overflow assertion with `awk length()`
without checking what it counts, then trusted its verdict twice - once when it invented
an overflow (byte counting) and once when it hid one (rtrim + empty pending column). The
failure mode is treating a measurement as ground truth because I wrote it; a measurement
is a claim like any other and needs its own control. Second: I again shipped a "fix" (the
tag_w floor) that introduced the very bug class it was meant to prevent, and only Codex
caught it - same pattern as the dead build_rows guard last round. The tell both times was
that I reasoned about the arithmetic instead of rendering it and looking. Every real bug
this round was found by capturing output or mutating code, never by reading it.

## Files touched

- install.sh (per-screen widths, _br_fit_words/_br_wrap_words/_br_print_prose, desc rows,
  gum header, name clamp, ambiguity fail-safe, root apply-row)
- claude/hooks/test-browser-render.sh (width matrix 60/80/100/120, assert_in_flow +
  self-check, column-based overflow, staged width drive)
- .claude/memory/session_2026-07-16_bucket-browser-task8-width-header.md (this beat)
- .claude/memory/MEMORY.md (index)
