---
name: Forward/back tree navigation now slides AND fades together (not fade replacing slide)
description: Direct order, then a correction after I misread it - "Transitions upward and downward in the tree should result in fade out/in of content, not just left and right slides" first read as "fade instead of slide," which the user then corrected via AskUserQuestion to "I want to see a slide and fade TOGETHER."
type: project
relates_to: [session_2026-08-02_home-dashboard-view.md]
author_human: Jonah
author_model: claude-sonnet-5
source: session
verified: test-component-browser.sh 147/0; confirmed live via a temporarily exaggerated animation duration (380ms -> 1400ms, reverted before shipping) that a mid-transition frame shows genuine partial opacity - proving the same keyframe that combines opacity and transform is actually running, since both properties in one keyframe interpolate together by spec; user confirmed "PERFECT. Verified and validated" after reviewing live
confidence: high
---

# Two readings of one sentence (2026-08-02)

Jonah: "Transitions upward and downward in the tree should result in fade out/in of
content, not just left and right slides."

## First pass - read as a replacement, and it was wrong

Read "not just left and right slides" as "not [a slide, but a fade instead]" and
collapsed `.pane.is-fwd`/`.pane.is-back` onto the same plain-fade keyframe
`.pane.is-lateral` already used, deleting the directional slide keyframes entirely.
Verified this looked right (a genuine fade, no slide) and reported it done.

Jonah: "you removed the slide left and right to accommodate the fade request" - a
factual statement of what happened, not yet a correction. Then, after a follow-up "still
not seeing slide" turned out to mean the opposite of what it sounded like, asked directly
via AskUserQuestion and got: "I want to see a slide and fade TOGETHER."

"Not JUST left and right slides" meant slide-only was insufficient, not that slide
should be removed - add fade, keep the slide.

## Fix

Restored `pane-in-fwd`/`pane-in-back` as distinct keyframes (forward from the right,
back from the left, matching the original directional intent), but each keyframe now
animates BOTH `opacity` and `transform` together instead of transform alone:

```css
@keyframes pane-in-fwd{ from{opacity:0; transform:translateX(20px);} to{opacity:1; transform:none;} }
@keyframes pane-in-back{ from{opacity:0; transform:translateX(-20px);} to{opacity:1; transform:none;} }
```

Lateral (the rail's sibling-switch) is untouched - it was never asked to gain a slide,
and stays a plain fade.

Still safe against the established fill-mode:both bug (the one that left a pane stuck
invisible for 9 seconds earlier this session): no fill-mode on either keyframe, so any
moment the animation is not actively advancing, the pane sits at its own normal resting
values - opacity 1, no transform - the same values every one of these animations ends
on. Combining two properties in one keyframe doesn't reintroduce that risk; the risk was
specifically fill-mode holding a FROM state open-endedly, which neither keyframe uses.

## Files touched

- `claude/installer-gui/styles.css` (`pane-in-fwd`/`pane-in-back` keyframes restored
  with combined opacity+transform, `.pane.is-lateral` unchanged)
