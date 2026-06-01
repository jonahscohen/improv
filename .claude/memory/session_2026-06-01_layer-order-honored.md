---
name: layer order now honored visually (removed forced role-sort)
description: User: "Order of layers should always be honored visually... the order is literally meaningless." Root cause: compositor.setLayers ran orderLayers() which re-sorted every layer by layerRole (bg->mid->pointer->post), discarding the user's panel order across roles. Fixed by rendering configs in the user's explicit order. Chrome-verified the reorder flips the composite.
type: project
relates_to: [session_2026-06-01_verify-all-green.md]
---

Collaborator: Jonah. 2026-06-01.

## Bug
Reordering layers in the composition panel was meaningless across roles. compositor.ts setLayers() called `orderLayers(configs)` (runtime/stack.ts), which sorts by ROLE_ORDER [background, midground, pointer, post], using the user's index only as a same-role tiebreak. So dragging a background above a midground did nothing - the role-sort always forced background to the back. No user agency.

## Fix
compositor.ts: render in the user's EXPLICIT array order - `const ordered = configs` (removed the orderLayers call + its import). Panel order top->bottom now maps to back->front of the visual stack. layerRole STILL governs compositing BEHAVIOUR (a 'post' effect samples the layers beneath its position via composeBeneath, keyed on role not position) - it just no longer dictates the ORDER. New effects still append (stackStore `[...layers, candidate]`), so the default add-order stays sensible (background added first = back; effects stack toward front); the user can now reorder freely and it sticks.
- orderLayers stays exported (public util, still unit-tested in stack.test.ts) - just no longer forced by the compositor.
- compositor.test.ts: updated the "render order" test - passing [post, bg, mid] must now init in THAT exact order (was asserting the role-sorted bg/mid/post).

## Verified
- tsc 0, 228 tests (compositor 7/7).
- Chrome (tabId 1827119115): Aurora(bg) + Globe(mid) -> globe renders in FRONT of aurora. Clicked Aurora "Move down" -> array [Aurora,Globe] -> [Globe,Aurora] -> opaque aurora moves to front and fully COVERS the globe; panel reorders to Globe-first. The composite visibly flips with the reorder. Order honored.

## Related agency note (not changed, flagged)
runtime/stack.ts validateStack still caps 1 background + 1 post per stack. That's a separate constraint on agency; not touched here since the complaint was specifically about ORDER. Revisit if the user wants multiple bg/post layers.
