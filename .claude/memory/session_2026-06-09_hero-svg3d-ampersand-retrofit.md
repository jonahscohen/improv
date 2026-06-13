---
name: Hero retrofit - svg-3d ampersand background (user's tuned stack)
description: Replaced the flat ampersand+grid hero bg with the tilt-lab svg-3d 3D ampersand; washed out on cream vs black stage
type: project
relates_to: [session_2026-06-08_hero-rework-improv-ampersand-grid.md, session_2026-06-08_tiltlab-3dsvg-port.md]
---

Collaborator: Jonah. 2026-06-09. Repo: ~/Documents/Github/improv.

User pasted a tilt-lab stack export (svg-3d: ampersand, rubber, metalness .72, roughness 0, color #e32400, zoom 5.8, fov 56, lightIntensity 0, ambientIntensity 0, spinFloat 0.3, intro fade, cursorOrbit off) to retrofit as the hero background, replacing the earlier flat-ampersand `media`+`interactive-grid` stack.

**Done:**
- Vendored the RAW ampersand -> `marketing-site/assets/ampersand.svg` (svg-3d auto-centers+scales, so no wrapper transform; the earlier `ampersand-hero.svg` wrapper was for the flat `media` effect).
- Re-vendored `marketing-site/tilt-runtime.js` from tilt-lab/dist (now contains svg-3d).
- Swapped the hero mount script to the svg-3d single-layer config. CRITICAL FIX: the export's `source` was a `blob:http://localhost:5180/...` (dead session handle) -> replaced with `./assets/ampersand.svg`.
- Host CSS: cursorOrbit off -> made `.hero__fx` a pure backdrop (pointer-events:none) offset to the RIGHT quadrant (`left:38%`), clearing the left-set text (addresses the earlier collision/clutter complaint + the original "offset right" intent). Reverted the `.hero__inner` pointer-through hack (text selectable again).

**Verified (Chrome, desktop, fresh load):** mounts + renders the extruded 3D ampersand in the right quadrant, text fully legible on top, fade-in works. LAYOUT IS GOOD.

**Problem found (honest):** the object is WASHED OUT on the cream hero - a faint grey/taupe ghost, NOT the vivid red of the tilt-lab preview. Root cause: tuned against tilt-lab's BLACK stage; metalness .72 + roughness 0 = near-mirror reflecting the mostly-dark env cubemap, plus lightIntensity/ambient zeroed. On black that reads as moody dark-red metal; composited (alpha canvas) over cream it's a low-contrast watermark. Same code; background flip (black->cream) breaks the tuning.

**RESOLVED - user chose "re-light for cream".** Edited the hero svg-3d params: metalness .72->0.1, roughness 0->0.45, lightIntensity 0->1.5, ambientIntensity 0->0.45 (kept color #e32400, rubber, zoom 5.8, fov 56, spinFloat 0.3, fade). Dropping the near-mirror metalness + turning direct lights on makes the red ALBEDO read instead of dark env reflections. VERIFIED (Chrome desktop fresh load): bold, dimensional RED 3D extruded ampersand, right quadrant, lit faces + highlight + contact shadow, caught mid-spinFloat; text/lede/CTA clean on top; seamless cream, no panel. Strong hero. DONE.

Files: marketing-site/index.html (mount script + relit params), styles.css (.hero__fx right-offset backdrop), assets/ampersand.svg (new raw asset), tilt-runtime.js (re-vendored w/ svg-3d). Working tree on main, uncommitted.

Note: earlier hero artifacts now unused by index.html - assets/ampersand-hero.svg (the flat-media wrapper) is orphaned; the media + interactive-grid hero path is replaced. Could clean up ampersand-hero.svg later (harmless to leave).
