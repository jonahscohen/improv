---
name: tilt-lab tooltips restyled to match Justify (pill + instant fade)
description: Reworked the Tooltip to resemble Justify's tooltips - pill shape, drop shadow, 11px JustifySans-500, and INSTANT show (delay 0) with a 120ms opacity+translateY fade-in via rAF. Reference was justify/core/toolbar.ts. Teammate tt-justify-2, verified in Chrome.
type: project
relates_to: [session_2026-05-30_tilt-lab-tooltips.md]
supersedes: session_2026-05-30_tilt-lab-tooltips.md
---

Collaborator: Jonah. 2026-05-30. Jonah: tooltips should resemble Justify's + "instantly fade in the way they do in Justify" - I had matched our own system instead of studying Justify. Connectivity issues -> spun a fresh agent (tt-justify-2) after the first (tt-justify).

## Justify reference (justify/core/toolbar.ts:400, 545-599)
Pill (border-radius 20px), background #1a1a1a, 1px rgba(255,255,255,0.1) border, box-shadow 0 2px 8px rgba(0,0,0,0.3), padding 5px 14px, font 11px JustifySans weight 500, color rgba(255,255,255,0.85), nowrap. SHOW on mouseenter with NO delay -> opacity 0->1 + translateY(4px)->0 over 120ms transition. HIDE reverses, clears text after 120ms.

## Applied to tilt-lab Tooltip.tsx + .css + .test.tsx
- delay default 0 (instant). Fade-in via rAF: tip mounts at opacity 0 + small translateY offset, then a rAF flips .tooltip--visible (opacity 1 + translateY 0) so the 120ms `transition: opacity .12s, transform .12s` runs. rAF cancelled on hide/unmount.
- Pill via var(--r-full); shadow 0 2px 8px rgba(0,0,0,0.3) (the one intentional shadow, per Jonah); padding 5px 14px; 0.6875rem (11px); weight 500; var(--font-sans); nowrap; pointer-events none. Per-placement slide (bottom -4px->0, top/left 4px->0). prefers-reduced-motion = instant.
- Token substitutions vs Justify literals: bg var(--surface-2) (~#1b1916 vs #1a1a1a), border var(--line-2), text var(--text). Shadow rgba + pill radius literal.
- Kept: portal, getBoundingClientRect + viewport clamp, mouseenter/leave, focus-modality tracker, Escape/scroll/resize hide, aria. API + consumers untouched.

## Verified (Chrome, tab 41, focus path): Add shader tooltip is now a PILL (was sharp chip), dark, "Add shader" below the focused button. tsc 0, npm test 167/167. Animation (instant + rAF fade) is code/test-verified (can't capture in a still; synthetic chrome hover fires no JS events - use focus path).
