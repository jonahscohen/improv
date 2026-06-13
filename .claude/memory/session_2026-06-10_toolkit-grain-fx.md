---
name: Toolkit section FX - grain-gradient + dither overlay (tilt-lab retrofit)
description: Jonah's tilt-lab stack config (grain-gradient ripple 0.02 + bayer4x4 dither post 0.06, both transparent-bg) mounted behind the toolkit cards via mountStack
type: project
relates_to: [session_2026-06-10_hero-dithered-ampersand-stack.md, session_2026-06-10_homepage-narrative-html-assembly.md]
---

Collaborator: Jonah. 2026-06-10. Pasted a tilt-lab stack config: "overlay this onto the background of the 'toolkit' block."

Retrofit per the tilt-lab contract:
- Config applied VERBATIM, zero swaps needed (no asset handles - grain-gradient is generative, dither src empty). grain-gradient background: single white color, ripple shape, softness 1, intensity 0.49, noise 0.14, scale 1.17, layer opacity 0.02. dithered-image post: bayer4x4, black, transparent bg (#ffffff00), layer opacity 0.06.
- Mounted in the existing hero FX module script (same mountStack import - one module, two mounts now: hero + toolkit).
- Host: .toolkit__fx absolute inset 0, z 0, pointer-events none, inside .section--toolkit (position relative + isolation + overflow hidden); .container z 1.
- styles.css ?v=8.

VERIFIED (light theme, fresh load + zoom region): fine dither speckle + soft ripple mottling visible across the paper surface behind the three cards; text/cards/CTAs fully legible above; section boundaries clean; no layout shift. Reduced-motion handled by mountStack (static single frame).

Note: the toolkit section is PAPER (light) in light theme and dark teal raised in dark theme - the white grain at 0.02 reads slightly differently per theme (whisper-light mottle vs faint glow); both acceptable, flag to Jonah only if he asks about dark.

Files: marketing-site/index.html (host div, mount call, v8), marketing-site/styles.css (.section--toolkit + .toolkit__fx rules).
