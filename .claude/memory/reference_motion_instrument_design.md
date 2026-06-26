---
name: Motion re-labeling instrument - design for lead gate
description: Observation-based GT for layout-transition + bounce-easing via a dynamic-motion probe (Jonah's re-label ruling)
type: reference
relates_to: [session_2026-06-24_sidecoach-stage1-plan.md]
---

# Motion-instrument design (DESIGN-REVIEW for the lead's gate, BEFORE building)

Collaborator: Jonah Cohen. Context: layout-transition (20%) + bounce-easing (12%) GT is SPECULATIVE - the Codex
labeler can't observe motion in a static screenshot, so it guessed from CSS declarations (calcom PRESENT @
layout-shift-ratio 0.00, clerk ABSENT @ 0.17 - non-monotonic). oracle's 74% subjective recall is method-coupled
(it reads the same CSS motion declarations -> "agrees" by shared method, not truth). Jonah ruled: RE-LABEL the
motion classes from OBSERVED motion, blind + uniform, re-measure both tools. This doc scopes the instrument for the
lead's gate.

## 1. Instrument: dynamic-motion probe (Playwright)
Render each captured page, TRIGGER motion, SAMPLE element geometry over time, classify from the OBSERVED trajectory.
- Render: 1280x800, deviceScaleFactor 1, reducedMotion='no-preference' (motion MUST run - the opposite of the
  determinism render). External still aborted to data:/about: (hermetic).
- Triggers (deterministic sequence, fixed timings): (a) LOAD - wait for load-time CSS animations; (b) IN-VIEW /
  SCROLL - scroll the document top->bottom in fixed steps to fire scroll-driven + IntersectionObserver-CSS
  animations and reveal-on-scroll; (c) HOVER/FOCUS - dispatch pointerover/focus on a fixed-order sample of
  interactive elements (links, buttons, [class*=card], [data-state]) to fire hover/expand transitions.
- Sample: for a tracked element set, record getBoundingClientRect() + key computed props on a fixed rAF schedule
  (e.g. 30 samples over ~1s per trigger phase). Store min/max box over the window.

## 2. Observation-based class definitions (observed, not CSS-name)
- layout-transition = an animation/transition that SHIFTS SURROUNDING CONTENT. OPERATIONAL: during a trigger, an
  element's geometry change causes a NEIGHBOR/sibling/following-element's top or left to move (reflow). KEY
  DISCRIMINATOR: transform + opacity do NOT reflow neighbors (they paint in a composited layer); width/height/
  top/left/margin/grid DO. So "neighbor position moved during the animation" cleanly separates layout-shift motion
  from in-place transform/opacity - exactly the rubric ("shifts the surrounding content, as opposed to motion that
  only fades or transforms in place"). Measure: track candidate animated elements AND their next-siblings; flag if
  a sibling's box origin moves > epsilon while the candidate animates.
- bounce-easing = OBSERVED overshoot-and-return. OPERATIONAL: an animated scalar (position/scale/opacity sampled
  over time) goes PAST its settle value then comes back (non-monotonic trajectory with overshoot > epsilon).
  SECONDARY (when sampling can't catch it): the resolved transition-timing-function / animation keyframe easing is
  an overshoot cubic-bezier (control-point y outside [0,1]) or a spring/linear()-spring. Prefer observed overshoot;
  fall back to the easing curve only when an animation is declared but too fast to sample.

## 3. Blind, uniform re-labeling
- Run the instrument on the DEV corpus AND the frozen-90, uniformly, with NO tool knowledge (blind). Output =
  observation-based GT (present/absent + the observed evidence: which element, what neighbor moved, overshoot delta).
- Deterministic/reproducible: fixed viewport, fixed trigger sequence + timings, fixed sample schedule, fixed rng
  seed if any. Re-running yields identical GT. This is the referee-grade artifact (like objective-label-rendered).
- This is a NEW GT for 2 classes on the FROZEN-90 = touches frozen ground truth -> Jonah's authority (he ruled it).

## 4. KNOWN LIMITATION to gate (the real trade-off)
The captures have SCRIPTS STRIPPED (determinism). So the instrument observes only CSS-NATIVE motion (CSS
animations, :hover/:focus transitions, CSS scroll-driven animations). JS-driven motion (framer-motion, GSAP,
IntersectionObserver-toggled classes) will NOT run -> invisible to the instrument. Options for the lead/Jonah:
  (a) ACCEPT CSS-observable motion as the GT basis - uniform, deterministic, hermetic; misses JS motion (both
      tools blind to it equally, so still fair). Recommended: keeps determinism, and the rubric is about whether
      the page HAS the motion character, much of which is CSS.
  (b) RE-CAPTURE the motion corpus WITH scripts for the instrument only - observes real JS motion, but
      non-deterministic + a separate capture pipeline. Heavier; breaks the single-capture parity.
Recommend (a) unless Jonah wants JS motion captured. Flag clearly in the GT that it is CSS-observable motion.

## 5. Re-measure both tools
After re-labeling, re-score layout-transition + bounce-easing for BOTH sidecoach + oracle against the observed
GT. EXPECTED: oracle's method-coupled recall collapses (its CSS-declaration reading no longer matches an
observation-based GT); an observation-based detector (same probe, productized) can win honestly. Sidecoach's motion
detector (if built) would BE an observation-based probe -> feature-label agreement as a consequence of both
observing motion, not tuning.

## 6. Build sequence (after the lead gates THIS design)
1. Build eval/motion-observe-label.mjs (the referee instrument) - blind, deterministic. 2. Re-label dev + 90.
3. Re-measure both tools. 4. THEN (separately) a PRODUCT motion detector in subjective-rendered-scanner (or a
   sibling) that observes motion the same way - gated like nested-cards. Design-gate THIS doc first.
