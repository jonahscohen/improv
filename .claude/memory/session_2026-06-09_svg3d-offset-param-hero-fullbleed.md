---
name: svg-3d offsetX/offsetY param + hero full-bleed canvas (Justify task)
description: Added a camera-pan offset to svg-3d so the object holds an off-centre position while its canvas fills the full host; fixes the hero "canvas not extended to both ends" complaint
type: project
relates_to: [session_2026-06-09_hero-canvas-fullbleed.md, session_2026-06-08_tiltlab-3dsvg-port.md]
---

Collaborator: Jonah. 2026-06-09. Repo: ~/Documents/Github/improv.

**Via Justify (prompt-1, .hero):** "i can still see very clearly that the canvas is not extended to both ends of the hero". My earlier `right:-38%` asymmetric-overflow hack kept the object in place but the transparent canvas didn't read as full-width and inspected wrong.

**Root cause:** svg-3d AUTO-CENTERS the object in its host, so a true full-width host (`left:0;right:0`) recenters the ampersand. The earlier workaround offset the HOST instead of the OBJECT.

**Real fix - new svg-3d param `offsetX`/`offsetY`:** pans the camera laterally (camera still looks down -z) so the object sits off-centre while the canvas fills the whole host. offset is a fraction of the visible viewport at the object's depth (right/up = +). Computed in frame() from fov+distance+aspect: `vH = 2*tan(fov/2)*dist; vW = vH*aspect; camera.position.x = -offsetX*vW`. Wired: state default, init parse, frame apply, setParam cases, manifest range [-0.5,0.5].

**Hero:** `.hero__fx` back to `left:0; right:0` (true full-bleed, both ends); mount config adds `offsetX` (~+0.22, tune in verify) to hold the ampersand in the right quadrant; keeps the lit-for-cream params + spinFloat + fade.

Status: DONE + verified + justify-done(prompt-1) sent.
- Effect: offsetX/offsetY param (state/init/frame-camera-pan/setParam/manifest). typecheck clean. Rebuilt dist + re-vendored (14 offsetX refs in bundle).
- Hero: `.hero__fx` inset:0 (true full-bleed both ends); mount offsetX:0.22 holds ampersand in right quadrant.
- VERIFIED (Chrome, fresh tab, 3 frames): canvas spans full width; ampersand held right (NOT recentered) - offsetX works.
- OBSERVED (honest): the ampersand BRIGHTNESS CYCLES near-black -> maroon -> vivid red across the spinFloat rotation (lit front face rotating toward/away from key light [5,8,5]). NOT a regression from the camera pan (diffuse shading is camera-independent; proven by the cycle returning to bright red). It is inherent to animate:spinFloat. On tilt-lab's black stage the dark trough read fine; on the hero the trough looks muddy. Flagged to user - options to steady it: raise ambientIntensity, add a camera-tracking fill light, or slow/disable the spin.

Files: tilt-lab/runtime/effects/svg-3d/index.ts + manifest.json; marketing-site/styles.css + index.html + tilt-runtime.js (re-vendored). Working tree on main, uncommitted.
