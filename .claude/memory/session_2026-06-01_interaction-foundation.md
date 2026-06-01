---
name: interaction foundation + 3 deletions (CD-built, the enabler)
description: Extended the Effect interaction contract + PointerTracker + Compositor so effects get pressed/drag state, discrete down/up clicks, and wheel/scroll (touch free via Pointer Events) - the systemic miss. Deleted particles, cursor-trail, plasma-grid. tsc 0, 175 tests. Per-effect interaction porting now fans out to agents on top of this.
type: project
relates_to: [session_2026-06-01_interactivity-overhaul-punchlist.md]
---

Collaborator: Jonah. 2026-06-01.

## Foundation (the enabler for #1 interactivity) - DONE by CD
Old: Compositor polled PointerTracker for POSITION only; effect.onPointer(x,y) each frame + onPointerLeave. No pressed/click/wheel/touch.
New:
- runtime/pointer.ts: PointerTracker now tracks pos + DOWN state + accumulates wheel + queues press/release events. Listens pointermove/down (host), up/cancel (window, so drags ending off-host release), wheel (host, passive:false, preventDefault to capture scroll into the stage). consumeFrame() drains {wheel,downs[],ups[]} once per frame.
- runtime/types.ts Effect: onPointer?(x,y,pressed?) (added pressed = is-dragging), + onPointerDown?(x,y), onPointerUp?(x,y), onWheel?(deltaY,x,y). Keeps onPointerLeave. Backward compatible (existing impls ignore the new pressed arg).
- runtime/compositor.ts renderFrame: reads position()+isDown()+consumeFrame() ONCE, dispatches downs->onPointerDown, ups->onPointerUp, onPointer(x,y,pressed), wheel->onWheel to EVERY layer (not gated to 'pointer' role - any effect can be interactive). Pressed/wheel/touch now reach effects.

## Deletions - DONE
particles (casberry), cursor-trail (unlumen), plasma-grid. Removed: imports + RAW registry entries (index.ts), effect dirs (rm -rf), cursor-trail entry in effect-assets.ts. tsc 0, 175 tests (was 185). Stale mock refs remain only in stack.test.ts (layer('particles')) + BrowseGrid.test.tsx (m('cursor-trail')) - self-contained fixtures, harmless.

## NEXT: per-effect agents port each effect's REAL interactions (against the live originals + local regent/cobe) using the new contract, + the role/asset/preset fixes from the punchlist. CD verifies EACH in Chrome with real pointer/drag/scroll, not just render.
