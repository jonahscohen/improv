---
name: Icon source fix - reference/index.html and one reference-doc example swapped to verbatim Lucide
description: 5 fabricated-svg findings plus 1 the gate could not see, replaced with byte-verified Lucide 1.16.0 paths; the gate's detector is blind to icons built from primitives
type: project
relates_to: [session_2026-07-28_skill-retirement.md, session_2026-05-24_landing_page_built.md, session_2026-06-10_homepage-taste-pass.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
machine: spare3
source: session
verified: browser + codex-review + byte-comparison verifier
confidence: high
---

Collaborator: Jonah. Base commit 8ae761a4.

`reference/index.html` carried 5 `taste/fabricated-svg` findings, logged but declined by
the prose pass earlier today (session_2026-07-28_skill-retirement.md:418) because a text
edit cannot reach them. This unit closes them.

## Library

Lucide, one library for the whole file, consistent with the repo's existing choice
(session_2026-05-24_landing_page_built.md sourced 19 Lucide icons; the homepage taste pass
re-marked Lucide moon/sun). `reference/DESIGN.md` names no icon library, so protocol step 3
applied: the file's existing arrow geometry was already Lucide, so Lucide it stays.

Source of truth: the Lucide checkout at `/Users/spare3/Documents/Github/lucide`, tag 1.16.0,
commit 5b40f2c5a76a27eeb81c8f1b1c311121dee45495, files `icons/<name>.svg`. Cross-checked
against the repo's own bundled `sidecoach/data/icons/lucide.json` (68-icon subset) wherever
that subset carries the icon. The two sources agreed on every icon they share.

## What was replaced

| # | Location | Was | Now | Category |
|---|---|---|---|---|
| 1 | index.html:46 GitHub nav link | 2 paths, correct `arrow-up-right` geometry but in REVERSED source order, no marker | `lucide/arrow-up-right` in source order | icon |
| 2 | index.html:51 sidebar toggle | 3 hand-drawn `<line>` elements at y=6/12/18 | `lucide/menu`, 3 paths at y=5/12/19 | icon |
| 3-6 | index.html:205/214/223/232 house-card CTAs | `arrow-right` geometry, no marker | `lucide/arrow-right` | icon |
| 7 | sidecoach/reference/responsive-foundation.md:197 | 1 compound hand-written path `M3 6h18M3 12h18M3 18h18` | `lucide/menu`, 3 paths | icon (doc example) |

Every one now carries both `class="lucide-<name>"` and `data-icon-source="lucide"`, the double
marker the icon-source reference specifies.

## The finding the gate could not see

`taste/fabricated-svg` counts `<path>` elements only (`taste-validator.ts:146`). The sidebar
toggle was a hamburger drawn from three `<line>` primitives, so it scored zero paths and the
detector skipped it entirely. It was the most clearly fabricated icon in the file - hand-placed
coordinates, not from any library - and it was the one finding the gate never reported. The
gate's 5 were a floor, not a census. Any icon built from `<line>`, `<rect>`, `<circle>`,
`<polyline>` or `<polygon>` is currently invisible to it.

**Why:** the rule is about provenance, not element type. A detector keyed to `<path>` enforces
the rule only against icons that happen to use paths.
**How (not done here, flagged for the owner):** extend the path count to include primitive
elements before the >=2 threshold.

## What was NOT touched, and why

Categorised honestly rather than swept:

- `reference/assets/favicon.svg` - LOGO (rect + text ampersand, zero paths). Not an icon.
- `justify/assets/spark-*.svg` + 4 demo HTML files, `.backups/.../spark-*.svg` - BRAND MARK and
  loading-animation frames of the Claude spark (single paths up to 35k chars). Not icons;
  substituting a library glyph would destroy the mark.
- `tilt-lab/app/public/and-dev-white.svg` - WORDMARK. Not an icon.
- `docs/dependency-map/index.html` - `<svg id="wires">` empty container, edges drawn by JS.
  DIAGRAM. Not an icon.
- `sidecoach/eval/migration-harness/inputs/taste-extra.html` - deliberately fabricated FIXTURE
  (`d="...zoooooong"`, `more-fabricated-path-data-here`) whose golden asserts the finding.
  Fixing it would break the detector's own test.
- `claude/hooks/_tests/test-visualizer-guard.sh` - `<svg>` string literals as test inputs.
- `sidecoach/reference/a11y-remediation.md` - 2 svgs, path data elided as `...`. Nothing to fix.
- `sidecoach/eval/corpus/**` - captured third-party pages. Not ours.

## Proof the paths are verbatim

A claim of verbatim is not evidence, so the claim was made mechanical. `/tmp/verify-icon-provenance.py`
derives each icon's name FROM ITS OWN `lucide-<name>` marker, reads the matching library file, and
byte-compares the ordered list of `d=""` values. Distinct exit codes per failure class: 2 marker
names a nonexistent icon, 3 path DATA drift, 4 path ORDER/count drift, 5 source unreadable,
6 nothing verified (silent-success guard), 7 the two sources disagree. All four negatives were
exercised and produced their own code. Result: `OK: 7 marked icon(s) byte-for-byte identical`, exit 0.

Exit code 4 is not decorative: icon 1 at HEAD had the right two paths in the wrong order. Feeding
the original back through the verifier produces exit 4. That is a real correction, not a marker
sticker - the rule bans reordering as much as redrawing.

## Gate before / after

| File | fabricated-svg before | after |
|---|---|---|
| reference/index.html | 5 | 0 |
| sidecoach/reference/responsive-foundation.md | 0 (undetected, 1 real) | 0 |

`reference/index.html` alone: 5 violations -> 0 violations. Four findings remain when index.html is
scanned together with `styles.css` (2x `translatey-in-hover`, 2x `hex-in-interactive-state`). Those
live entirely in `styles.css`, predate this unit, and are out of scope per the lead's constraint.

## Visual verification

Served on :4831 and opened in Chrome. `resize_window` reported success twice but never actually
changed the viewport, so the mobile breakpoint was reached with a real 700px iframe harness on
:4832 instead - a genuine narrow viewport, not a scripted class toggle.

- GitHub nav: diagonal arrow to upper-right, small, aligned to cap height. Reads as external link.
- All 4 house-card CTAs: right arrow with shaft and chevron head, rounded caps, baseline aligned.
- Hover on the Design card nudged its arrow right while the un-hovered Workflow arrow stayed put,
  so `.house-card:hover .house-card__cta .i` still binds after the second class was added.
- Hamburger at 700px: three evenly spaced rounded bars. Real click opened the sidebar drawer.

No blank boxes, no wrong glyphs, no missing icons.

## Codex

`git diff 8ae761a4 -- <paths> | ~/.claude/hooks/codex-review.py "<prompt>" -C <repo> -t 420`
-> wrapper exit 0, real verdict in 113.4s. "No path-data drift found." It read the Lucide files
itself rather than trusting the claim, confirmed the 6/12/18 -> 5/12/19 menu change is correct
Lucide geometry and not an approximation, confirmed no `styles.css` selector depended on
`class="i"` exactly, and confirmed the markdown edit sits past the 4000-char artifact truncation
in `flow-handler-responsive-validation.ts`. One caveat: `arrow-up-right` is absent from the
bundled 68-icon JSON, so it has one source rather than two - already labelled `[checkout only]`
by the verifier.

## Files touched

- reference/index.html (6 svgs)
- sidecoach/reference/responsive-foundation.md (1 svg in a doc example)

Not committed, per instruction.
