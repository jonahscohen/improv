---
name: The status badge became the checkbox, and the row grew a second line for its explanation
description: Status and control were two ideas on one row; now they are one thing. The badge shrank to 10px caps with a Lucide checkbox inside and became the install toggle. Descriptions stopped being ellipsised and got their own line. Hook rows had been rendering blank because the manifest never forwarded hook_desc.
type: project
relates_to: [session_2026-08-01_badges-chevrons-directional-motion.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: staged a change by clicking the badge and watched the box empty, the badge flip to dashed WILL REMOVE and Apply arm; both themes rendered and read; detector re-run to 0 blocking
confidence: high
---

# The badge is the checkbox now (2026-08-01)

Commit stamp at authoring: 65d6ad4e.

Jonah: "make the status badges much smaller, text all caps and colors more emphatic. use
checkmarks inside each and use those as the means to select/deselect for install. and please
provide two sentence explanations for every installable component, even hooks, and let the
description wrap to a new line within the row."

## Status and control were two ideas; they are one now

The badge stated what was true and something else changed it. Merging them means what you read is
what you press. The rule the whole language now rests on: **a filled box means this will be on the
machine after Apply.** That is why a staged install reads as CHECKED before anything has run -
the box describes the outcome, not the current disk state, and the dashed border carries the
"not yet".

Small enough to scan as a column rather than compete with the names: 10px, uppercase, 0.07em
tracking. Emphatic by FILL rather than by tint - solid `--ok` for installed, solid `--part` for a
partial group, hollow for absent. Hollow-versus-filled is the whole binary at a glance.

That needed a new token. The status hues INVERT between themes (dark green in light, pale green in
dark), so text on a solid fill has to invert too or one theme ships unreadable. `--on-solid` is
cream in light and ink in dark.

## Two icons, and a two-line row

`lucide:square-check` and `lucide:square`, copied from the local lucide checkout at
`~/Documents/Github/lucide/icons/`, with `data-icon-source` markers so the provenance is checkable
rather than merely claimed.

The description used to be `white-space:nowrap` with an ellipsis, which is useless for text that
runs to two sentences. The row is now a two-row grid - name and badge on the first line, the
description spanning the second.

The first version confined the description to the NAME column, beside the badge, and real
two-sentence text wrapped to four and five lines. Spanning it under the badge instead gets the
same text into two or three. Only the chevron column stays clear, because it belongs to the row
as a whole.

## Audience, not accuracy

Jonah, on the first batch of descriptions: *"Some of these aren't written for a developer who
doesn't have insight/context to the situation."* He is right, and the failure was uniform: they
defined unknowns with other unknowns. "so a beat write never stalls", "without a sidecoach verb",
"content-guard still runs alongside" - every one of those assumes the reader is already inside
this project. The reader is someone who just downloaded the installer and is deciding whether to
tick a box. The facts were sound; the voice was for us.

## The bug this uncovered: hooks rendered blank

`walkMembers` set every hook child to `desc: ''`. The explanations existed all along in
`browser-tree.json`'s `hook_desc` map - 71 of them - but `manifest.py` never forwarded the map to
the client. **The most cryptic names on the entire list were the only ones with no explanation.**
Three lines to plumb through, and hook rows now carry their text.

## What the detector caught that I would not have

`a11y.min-hit-area`, blocking: 3/3 targets under the floor, smallest 34x34. The theme toggle was
34px and both footer buttons measured 39 - one pixel under. Raised to the 44px button floor.

The badge itself measured **94x19**, which is the tension in the request: the control has to be
much smaller AND it is now the thing you aim at. Resolved by extending the HIT area with an
absolutely-positioned `::after` at `inset:-11px -4px` - the thing you aim at is bigger than the
thing you read, and the pill stays 19px.

Also fixed two of my own defects, both invisible on screen:
- `.row__go` never got `grid-area:go`, so the chevron was AUTO-PLACING. It happened to land in the
  right column and looked correct, which is the worst kind of wrong.
- `.check.is-off` referenced `var(--border)`, which is not a token in this file (they are
  `--border-soft` and `--border-firm`), so that border silently dropped.

## Audits

    static-ban   0 violations
    objective    0 (rendered)
    subjective   0 (rendered)
    static-check 0 blocking, 2 warnings

The two warnings are the pre-existing `staggered-enter` and `subtle-exit`, which want animation
patterns this UI does not have.

## Files touched

- `claude/installer-gui/index.html`, `claude/installer-gui/styles.css`
- `claude/installer-gui/manifest.py` (forward `hook_desc`)
