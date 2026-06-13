---
name: svg-3d shadowOpacity param + hero shadow made super faint
description: Jonah found the ampersand's ground shadow glaring; added a shadowOpacity param to the svg-3d effect (default 0.4 = old hardcoded look), hero now 0.08; stale module cache masked the first three attempts
type: project
relates_to: [session_2026-06-10_hero-dithered-ampersand-stack.md, session_2026-06-08_tiltlab-3dsvg-port.md]
---

Collaborator: Jonah. 2026-06-10. "Can we make the shadow under the ampersand animation more subtle? it's glaring and ugly."

**The shadow:** svg-3d's contact shadow - a radial-gradient plane under the object ("simplified stand-in for drei ContactShadows"), hardcoded rgba(0,0,0,0.4), no param.

**Change (tilt-lab runtime):** new `shadowOpacity` param (range 0-1, step 0.01, DEFAULT 0.4 so every existing stack keeps its exact look - fidelity preserved). Implementation: gradient texture now drawn at full alpha, `material.opacity` carries the strength, so setParam('shadowOpacity') tunes live without redrawing the texture. Wired into defaults, init parse, setParam switch, and manifest.json. typecheck clean, `npm run build` -> dist/tilt-runtime.js, re-vendored to marketing-site/tilt-runtime.js.

**The debugging trap (important):** after vendoring, 0.12 -> 0.08 -> 0.04 all "looked unchanged" and Jonah reported no difference. Root cause was NOT the param - the browser was serving a STALE CACHED tilt-runtime.js module (old bundle ignores the unknown param -> shadow stayed 0.4). A hard reload (cmd+shift+r) proved the new bundle worked instantly. Durable fix: the index.html module import is now versioned (`./tilt-runtime.js?v=2`) - **bump ?v= on every re-vendor** or normal reloads keep the old bundle. This explains, retroactively, why param-only changes to the vendored runtime can appear to "do nothing."

**Final value:** hero svg-3d `shadowOpacity: 0.18`, tuned live with Jonah over several rounds once the cache-bust made values actually land. The calibrated ladder (light theme, the discriminating case): 0 = off, 0.04 = invisible, 0.08 = whisper (Jonah: "too faint"), 0.18 = soft visible grounding (settled), 0.4 = the original glare. Verified fresh-bundle at 0.18: seats the object without drawing the eye.

Files: tilt-lab/runtime/effects/svg-3d/index.ts + manifest.json, tilt-lab/dist/tilt-runtime.js (rebuilt), marketing-site/tilt-runtime.js (re-vendored), marketing-site/index.html (shadowOpacity + versioned import). Uncommitted on main.

## Update 2026-06-11
Jonah: "remove the shadow underneath the floating hero ampersand" - hero config shadowOpacity 0.18 -> 0. Verified on fresh load: clean cream floor, no ground wash. The param remains in the effect for future use.
