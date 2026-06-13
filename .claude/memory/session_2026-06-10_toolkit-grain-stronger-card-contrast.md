---
name: Toolkit grain raised + surface-card token for card contrast
description: Per Jonah - grain overlay opacities raised (0.02->0.08, dither 0.06->0.12) and a new surface.card token (white light / #12424A dark) so tool cards contrast with their section
type: project
relates_to: [session_2026-06-10_toolkit-grain-fx.md]
superseded_by: session_2026-06-10_tool-cards-thematic-inverse.md
---

Collaborator: Jonah. 2026-06-10. "make the grain overlay more apparent, i think the opacity i set was too low, also, make the cards contrast with the background."

1. Overlay opacities (the only deviation from his export, at his request): grain-gradient layer 0.02 -> 0.08, dithered-image post 0.06 -> 0.12.
2. NEW TOKEN `--surface-card` / DESIGN.md `colors.surface.card`: the cards were paper-on-paper (raised on a raised section = invisible edges). Card plane is now one clear step off canvas/paper: #FFFFFF in light theme, #12424A in dark (one step lighter than raised #0A3036, same teal family). .tool-card background -> var(--surface-card); resting shadow sm -> md, hover md -> lg (still within DESIGN.md's two-level elevation rule: floating cards md, overlay/hover lg).
3. styles.css ?v=9.

VERIFIED (light theme, fresh load): grain mottle clearly visible across the whole paper field (striking against the flat ink mission band above); cards render pure white with crisp edges and md shadows over the texture; text/CTAs unaffected. Dark theme rides the tokens (#12424A cards on raised teal + white grain glow) - not re-screenshotted this round.

Files: marketing-site/index.html (overlay opacities, v9), marketing-site/styles.css (--surface-card both themes, .tool-card bg + shadows), marketing-site/DESIGN.md (surface.card token).
