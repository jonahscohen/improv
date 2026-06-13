---
name: Tool cards flipped to thematic inverse (surface-card token retired)
description: Per Jonah - toolkit cards now use surface-inverse (ink cards on paper in light, cream cards on teal in dark) with on-inverse text tokens; the hour-old surface-card token removed as dead
type: project
relates_to: [session_2026-06-10_toolkit-grain-multiply.md]
supersedes: session_2026-06-10_toolkit-grain-stronger-card-contrast.md
---

Collaborator: Jonah. 2026-06-10. "Make the cards in that section contrast by using its thematic inverse."

- .tool-card background -> var(--surface-inverse); name -> text-inverse (overrides global h3 text-primary), desc -> text-on-inverse-secondary, CTA -> text-inverse (red underline unchanged), tag stays red. tool-card is used ONLY on index.html (grep verified), so no scoping needed.
- The --surface-card token (added ~1h earlier: #FFF/#12424A) is RETIRED - zero consumers after this flip; removed from both theme blocks and DESIGN.md frontmatter. Dead tokens are noise; the supersede chain records the why.
- styles.css ?v=11.

VERIFIED (dark theme): cream cards pop hard off the grain-mottled teal; ink names, red tags, ink-alpha descs, red-underlined CTAs all crisp. Light theme is the token-symmetric outcome (ink-green cards on grainy paper, cream text) - same plumbing as every verified section--ink surface.

Files: marketing-site/styles.css (.tool-card + 3 child color rules, token removal x2), marketing-site/DESIGN.md (card token line removed), marketing-site/index.html (v11).
