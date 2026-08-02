---
name: Rail clicks fade to the new page instead of swapping instantly - the one place opacity is allowed in a pane transition
description: Direct order to fix the instant, cue-less swap when clicking the left rail. Added a third navDir value (lateral) alongside the existing forward/back slide, using opacity where the slide uses transform - safe here specifically because the fade's resting state and its end state are identical, unlike the fill-mode:both bug this exact codebase already shipped once.
type: project
relates_to: [session_2026-08-01_badges-chevrons-directional-motion.md]
author_human: Jonah
author_model: claude-sonnet-5
source: session
verified: caught the fade mid-flight via a temporarily-stretched 3000ms duration (pane fully transparent partway through, fully opaque and legible after), confirmed real-speed (160ms) clicks land cleanly, confirmed forward/back drill and back-button navigation still use the unaffected slide, detector 0 blocking, suite 147/0
confidence: high
---

# The rail was the one navigation with no cue at all (2026-08-01 beat's gap, closed 2026-08-02)

Jonah: "clicking anything from the left hand nav should fade transition to that page. right now its
instant."

The forward/back slide already existed for drilling into and out of a group - the rail was
explicitly carved out of that at the time: "Lateral: switching between siblings is not forward or
backward, so no cue." That was true as a reason not to SLIDE sideways; it was never a reason to
have NO transition, and the instant swap is exactly what this fixes.

## Why a fade is safe here, when the standing rule says transform only

The directional slide's own comment bans opacity outright: an earlier version faded from 0 with
`fill-mode:both`, and any moment the animation was not actively advancing left the pane invisible -
a stretched test once showed it blank for seconds. That is a real constraint, not a style
preference, and this change does not violate it: the fade's keyframe ends at `opacity:1`, which is
also the pane's own normal, undeclared resting value with NO fill-mode holding it there. If the
animation class is never applied, is removed early, or the browser drops a frame, the pane is
simply at its ordinary opacity - never stuck at 0. The earlier bug's actual failure mode was
`fill-mode:both` freezing the FROM state; this uses the default fill-mode, so there is no state to
get stuck in.

## What changed

A third `navDir` value, `'lateral'`, set only by the rail's own click handler (breadcrumb, back
button, and drilling in all keep their existing values, untouched). `render()`'s existing
class-swap-and-restart logic picks the matching class the same way it already did for two values.

## Verified by catching it mid-flight, not by reading the CSS

Temporarily stretched the duration to 3000ms (a scratch edit, reverted immediately after) and
caught two real frames: one with the pane fully transparent partway through the fade, one later
fully opaque and legible - proving the animation genuinely runs and genuinely completes, the same
standard this session has applied to every other motion change. Reverted to the real 160ms and
confirmed a normal-speed click lands cleanly with no visible artifact.

## Files touched

- `claude/installer-gui/index.html` (`navDir='lateral'` on the rail click, three-way class swap)
- `claude/installer-gui/styles.css` (`@keyframes pane-in-fade`, `.pane.is-lateral`, reduced-motion)
