---
name: tilt-lab tooltips restyled to Justify look + instant fade-in
description: Tooltip now matches Justify's dark pill (border + shadow, 11px medium), shows instantly on hover with a 120ms rAF-driven CSS transition fade-in
type: project
relates_to: [session_2026-05-30_tilt-lab-tooltips.md]
---

Collaborator: Jonah

Made tilt-lab's Tooltip resemble Justify's toolbar tooltips (reference: justify/core/toolbar.ts `_tt`, lines ~399-599).

Changes:
- Tooltip.css: pill radius (var(--r-full)), drop shadow 0 2px 8px rgba(0,0,0,0.3) (the one intentional shadow - user explicitly wanted the Justify lift), padding 5px 14px, font-size 0.6875rem (11px), font-weight 500, font-family var(--font-sans) (JustifySans), white-space nowrap, pointer-events none. Colors via tokens: background var(--surface-2) (~#1b1916), border var(--line-2), text var(--text). Replaced the old @keyframes entrance with a transition-based fade (opacity+transform 0.12s ease) matching Justify's recipe; per-placement translateY slide (bottom: -4px->0, top/left: 4px->0). prefers-reduced-motion: instant, no transform/transition.
- Tooltip.tsx: default delay 0 (was 400) - shows instantly. showDelayed now sets open synchronously when delay<=0, keeps setTimeout path for delay>0 (API preserved). Added `visible` state flipped to true via requestAnimationFrame one frame after the positioned mount, toggling `.tooltip--visible`; this makes the CSS transition actually run (mount at opacity 0 + offset, then transition in). rAF cancelled on hide and unmount. hide() resets visible.

Why rAF (not keyframes): faithful to Justify which uses a CSS transition, and lets per-placement transform live in CSS via data-placement; the label is in the DOM the instant the tip opens (good for tests + a11y), the fade is purely visual.

Kept unchanged: portal to body, getBoundingClientRect + viewport clamping, mouseenter/leave triggers, focus modality tracker (onFocusCapture), Escape-to-hide, scroll/resize-hide, aria-hidden tip + aria-label trigger. Public API and consumers (IconButton/TopBar/App) untouched - no consumer passes `delay`.

Token substitutions vs Justify literals: radius var(--r-full) (999px) for Justify's 20px (both fully round the 11px text); box-shadow and rgba kept literal (not brand palette).

Tests: updated the hover test to assert instant show (label present right after mouseEnter, no timer); added a separate test confirming the `delay` prop still works when explicitly passed.

Verify: `npx tsc --noEmit` 0 errors; `npm test` 167/167 pass.

Files touched:
- tilt-lab/app/src/components/Tooltip.tsx
- tilt-lab/app/src/components/Tooltip.css
- tilt-lab/app/src/components/Tooltip.test.tsx
