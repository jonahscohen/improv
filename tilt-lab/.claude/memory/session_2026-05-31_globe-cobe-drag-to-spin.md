---
name: Globe (cobe) drag-to-spin + diagnosis
description: Wired cobe's signature pointer-drag rotation into the globe effect; diagnosed the "missing assets" symptom as no-interaction, not a real asset gap
type: project
relates_to: [session_2026-05-31_parity-interactive-globe-particles-cursor-aurora.md]
---

Collaborator: Jonah

User report (emphatic): "cobe globe still not functioning to expectation / MISSING ASSETS."

## Diagnosis
- **No interaction was wired.** `runtime/effects/globe/index.ts` had NO `onPointer*`
  handlers. cobe's hallmark is drag-to-spin; the globe only auto-rotated. The globe
  predated the new pointer contract (team-lead's edits to types.ts/compositor.ts/
  pointer.ts), so it was never connected. This was the real "not functioning."
- **"Missing assets" is a symptom, not a cause.** cobe v0.6.5 (npm, phenomenon v1 API)
  embeds its world map as a base64 PNG loaded inside `onSetup` via `new Image()`.
  `requiredAssets: []` is correct and it needs NO effect-assets.ts entry (unlike the
  separate `mc-globe` effect, which does have one). A static/blank globe reads as
  "missing assets" but the texture is internal.
- Local cobe instance found at `/Users/spare3/Documents/Github/cobe` (v2.0.1, newer
  src arch: webgl.js/anchor.js/marker.glslx). Its `website/app/page.tsx` is the
  canonical interaction: drag deltaX -> phi (`/300`), deltaY -> theta (`/1000`,
  clamped ~[-0.4,0.4]), inertia decay `*0.95`, auto-rotate when idle, grab/grabbing
  cursor. tilt-lab uses npm cobe v0.6.5, so I matched the README/demo feel, not the v2 API.

## Fix
- Extracted a pure, WebGL-free `createGlobeRotation()` controller (exported for tests):
  `pointerDown/pointerMove(x,y,pressed)/pointerUp/tick(dtMs)` + `phi()/theta()/isDragging()`.
  - Horizontal drag -> phi (1/250 rad/px), vertical -> theta (1/400 rad/px), theta
    clamped to ±1.4 so poles never flip. Per-frame deltas accumulate (= demo's total).
  - Release velocity = last per-frame delta (clamped); inertia decays `*0.92`/frame,
    stops below 0.0006. Auto-rotate (`speed * dt/1000`, default 0.3 rad/s) advances only
    when NOT dragging, so a drag pause / backgrounded tab doesn't jump (frame dt capped 100ms).
- Effect delegates to the controller: `onPointerDown/onPointer/onPointerUp/onPointerLeave`,
  `frame(t)` calls `rot.tick(dt)`, onRender bridge + label projection read `rot.phi()/theta()`.
  Host canvas cursor: `grab` at rest, `grabbing` mid-drag. onPointerLeave keeps a live drag
  spinning (window pointerup releases it).
- Why a controller: the effect is `dead` (no WebGL) in headless tests, so drag math had to
  be testable in isolation. 5 new unit tests (drag rotates, hover doesn't, auto-rotate
  advances + freezes on drag, inertia advances-then-decays, theta clamp, effect forwards
  drag headless-safe).

## Verify
- `cd tilt-lab && npm test` (ROOT): 40 files / 195 tests green (globe: 11/11).
- Globe typechecks clean (zero globe lines in `app && npx tsc --noEmit`).
- NOTE: app tsc currently exits non-zero on `neural-noise` / `halftone` (TS6133 unused
  + TS2339) - errors SHIFT between runs, i.e. other teammates are editing those effects
  live. Not globe. Flagged to team-lead.

## Files
- runtime/effects/globe/index.ts (rotation controller + pointer handlers + bridge/project/frame)
- runtime/effects/globe/index.test.ts (5 new drag/rotation tests)
