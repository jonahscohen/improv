---
name: Install block equalized to CTA button height, border removed
description: hero__cta-row align-items stretch + borderless install-block with min-height 44px; DESIGN.md spec updated
type: project
relates_to: [session_2026-06-10_justify-queue-stale-responses.md]
---

Collaborator: Jonah Cohen

## What

Justify task: install block did not match the "Read the source" button height
and the user disliked the red-tinted border. Changes:
- `.hero__cta-row`: `align-items: center` -> `stretch`, so the install block
  and CTA button equalize to the same rendered height by flexbox construction.
- `.install-block`: removed `border: 1px solid var(--accent-red-border)`;
  `height: 44px` -> `min-height: 44px` (stretch now governs actual height).
- Bumped stylesheet cache buster to ?v=16 in index.html.
- DESIGN.md install-block component spec rewritten to match (was still
  describing the long-gone 3px red border-left).

## Why

`.btn` renders ~50px (min-height 44 + 12px vertical padding around 17px text)
while the block was hard-coded 44px - a fixed pixel match would be brittle
against font metrics. Stretch makes equality structural, not numeric. Border
removal per explicit user request; the red Copy button remains the brand
anchor on the component.

## How

Verified in Chrome: hero screenshot read and compared - block and button
identical heights, no border, flush red Copy button intact.

## Notes

`npx @google/design.md lint DESIGN.md` fails with "colorStr.trim is not a
function" on BOTH the edited and the git-HEAD version - a pre-existing
linter/model-building failure against this file's frontmatter (likely the
rgba()/nested color maps), not a regression from this edit. Worth a separate
fix pass on the frontmatter or a linter version check.

## Files

- styles.css
- index.html
- DESIGN.md
