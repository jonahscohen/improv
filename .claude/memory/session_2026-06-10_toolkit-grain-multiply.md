---
name: Toolkit grain blends multiply instead of flat overlay
description: Per Jonah - mix-blend-mode multiply on .toolkit__fx so the grain burns into the section surface; white ripple multiplies to identity but its shape survives via the dither post's sampling
type: project
relates_to: [session_2026-06-10_toolkit-grain-stronger-card-contrast.md]
---

Collaborator: Jonah. 2026-06-10. "Can we treat the grain as a multiply/burn instead of just a flat darkness overlay?"

How: CSS `mix-blend-mode: multiply` on `.toolkit__fx` - blends the whole stack canvas against the DOM behind it (a per-layer blendMode in the stack config only blends layers against each other inside the canvas; page-level burn requires CSS). `.section--toolkit` already has `isolation: isolate`, which contains the blend to the section. Config untouched.

Physics note recorded for future grain work: under multiply, WHITE content is identity - the grain-gradient's direct white ripple paint vanishes. The texture keeps its rippled character anyway because the dithered-image POST samples the ripple beneath it; the speckle density encodes the ripple shape, and that black speckle is what burns in.

VERIFIED (dark theme - the tab was in dark): grain reads as a subtle DEEPENING mottle in the teal (multiplied), not a gray film; #12424A cards keep their contrast. Light theme not directly screenshotted this round - Jonah was actively driving the tab and theme toggling kept slipping; the light result is deterministic (black bayer speckle multiplied into #FAF7EE = darker warm burn rather than neutral gray) but should get an eyeball from Jonah.

Files: marketing-site/styles.css (.toolkit__fx mix-blend-mode), marketing-site/index.html (v10).
