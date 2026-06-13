---
name: Toolkit copy/tags + install-block redesign (six-prompt Justify batch)
description: Red eyebrow, stakeholder title + lede naming each centerpiece, VALIDATE + TUNE / RECORD + RECALL tags, install block at button height with an attached full-height red Copy segment
type: project
relates_to: [session_2026-06-10_toolkit-reorder-hover-lift.md, session_2026-06-10_justify-watch-guard-hook.md]
---

Collaborator: Jonah. 2026-06-10. Six prompts in one Send All - the biggest batch yet, first caught by the guard-protected watch.

1. Toolkit eyebrow -> var(--color-red), scoped .section--toolkit .section__eyebrow (mirrors the mission's red eyebrow).
2. Lede rewritten ("skim them here, dig in" was flagged "not appropriate for stakeholder-facing"): "These three are the center of the toolkit. Each owns a part of the loop - sidecoach plans and designs, justify validates and tunes in the browser, beats records and recalls across sessions - and everything else in the package supports them." Aligns with the new tags.
3. Title "Three tools that earn their place. A foundation underneath." -> "Three tools the rest of the package is built around." (focal importance, calm).
4./5. Tags: justify validate -> "validate + tune"; beats remember -> "record + recall" (CSS uppercases).
6. Install block: height locked to 44px (= .btn min-height; align-items stretch, padding-left only, overflow hidden), cmd self-centered; Copy button is an ATTACHED full-height segment - red at rest (cream text), radius 0 (clipped by the container), hover/active darken via color-mix(in srgb, var(--color-red) 82%/70%, black) (var-based, avoids the taste hex-in-interactive-state rule; the old :active scale dropped since the segment is flush). Applies to both hero and closing-CTA install blocks.
- styles.css ?v=15.

VERIFIED (light theme, fresh load): red THE TOOLKIT eyebrow; new title/lede rendering balanced; both new tags on cards; hero install block exactly button-height beside Read the source with the red COPY segment flush right. All six responded completed, queue cleared.

Files: marketing-site/index.html (title, lede, 2 tags, v15), marketing-site/styles.css (eyebrow red, install-block + copy segment rework).
