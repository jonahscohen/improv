---
name: tilt-lab contract gap - pointer effects are event-driven, not frame-driven
description: Recon found that cursor-image-trail (unlumen, lane 6) is DOM + Framer Motion, distance-gated/event-driven, not frame(t)-driven. The externally-driven Effect contract assumes a RAF frame(t) pump; pointer-role effects need an adapter. Decision input for Plan 2 acquisition (and a possible small Plan 1 addendum).
type: decision
relates_to: [session_2026-05-29_tilt-lab-foundation-exec.md, session_2026-05-29_tilt-lab-recon-team.md]
---

Collaborator: Jonah. 2026-05-29. Surfaced by recon-d (lane 6, docs/superpowers/tilt-lab-recon/lane-6-unlumen-cursor-trail.md).

## The gap
The Plan-1 Effect contract is RAF-pumped: the web-component wrapper / Compositor calls frame(t) every animation frame, and effects render statelessly from t. cursor-image-trail does NOT fit: it is DOM elements (img/svg) animated by Framer Motion (motion/react), spawned on pointermove and distance-gated (drop an image every N px of cursor travel), with motion springs running their own internal animation. There is no per-frame pixel render keyed off t; it is event-driven.

## Options (recon-d sketched the first two)
- A) DOM-overlay adapter: a new effect sub-kind that mounts DOM into the element instead of drawing to canvas, and receives pointer events instead of (or in addition to) frame(t). The contract grows an optional `onPointer(e)` and the wrapper forwards pointermove. dispose() tears down DOM + listeners.
- B) Canvas2D reimplementation: redraw the trail to the layer's canvas each frame(t), keeping our own sprite/age state internally; pointer position read from a shared input. Fits the existing contract with zero changes, at the cost of not being a 1:1 of the original (which the verbatim-source posture wants to preserve).
- C) Hybrid: keep frame(t) as the pump but add a shared PointerState the runtime updates from pointermove; pointer-role effects read it in frame(t). Canvas-based pointer effects use it directly; DOM ones still need option A.

## Leaning (revisit when writing Plan 2)
Add an OPTIONAL `onPointer(e: PointerEvent)` to the Effect contract and a shared pointer-position the wrapper maintains, AND allow an effect to render into a DOM subtree instead of the canvas (a `mount(host)` escape hatch) for genuinely DOM/Framer-Motion effects. This keeps canvas effects pure (they ignore the additions) while letting pointer/DOM effects be faithful. This is a small, backward-compatible Plan 1 contract addendum to fold into Plan 2's first task, NOT a rewrite. The 24/24 existing tests stay green because the additions are optional.

## Revisit when
Writing Plan 2 acquisition task 1 (contract addendum). Also re-check after motion-core recon (lanes 8a/8b) lands - several motion-core effects (infinite-gallery, glass-slideshow) may also be DOM/React widgets that need the same DOM escape hatch, which would strengthen the case for option A.
