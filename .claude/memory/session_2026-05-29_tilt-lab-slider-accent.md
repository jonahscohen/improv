---
name: tilt-lab slider fills - muted at rest, accent on active
description: Per Jonah's taste call, toned every slider fill from solid red to muted; the Yes& accent now lights up only while a slider is actively engaged (drag / focus). Reserves red as a sparse indicator per brand law. CD direct edit across Slider.css + LayerStack.css.
type: decision
relates_to: [session_2026-05-29_tilt-lab-cd-review.md, session_2026-05-29_tilt-lab-design-direction.md]
---

Collaborator: Jonah. 2026-05-29. Decision: brand-strategist flagged accent-everywhere; Jonah chose "tone to muted, red on active."

Choice: slider fill = --muted at rest, swaps to --accent on :active + :focus-visible (keyboard/drag). Red reserved for active/enabled state + enable toggle + edit-input border + focus ring.

**Alternatives considered:**
- Keep red fills: rejected - too much accent, dilutes "red means something" (brand-strategist trap #2).
- Fully muted, no red on sliders: rejected by Jonah in favor of red-on-active (keeps a live engagement cue).

**Why this one:** honors single-accent / indicator-not-paint brand law while keeping an active-state affordance.

**How:** introduced --tl-fill (Slider.css) / --ch-fill (LayerStack.css opacity) defaulting to var(--muted); a `:active, :focus-visible { --fill: var(--accent) }` rule swaps it; the webkit track gradient + moz-range-progress reference the var. Also changed readout :hover from --accent to --text (red now active-only).

Files: app/src/components/controls/Slider.css, app/src/components/LayerStack.css. Builders B/C idle; CD direct edit for cross-component consistency.

Next: verify in Chrome (muted at rest, red on drag/focus) -> run full Sidecoach QA triad (audit/critique/polish + make-interfaces-feel-better) per Jonah.
