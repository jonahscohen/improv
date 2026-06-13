---
name: Background 3 - surface.contrast token (pure white / near-black gray)
description: Third background value added per Jonah - light mode pure white, dark mode #1A1A1A; tokenized as surface.contrast in styles.css + DESIGN.md, applied to the FAQ section
type: project
relates_to: [session_2026-06-10_homepage-narrative-verified-qa.md]
superseded_by: session_2026-06-10_homepage-alternating-contrast.md
---

Collaborator: Jonah. 2026-06-10. "add one last contrasting background value to the homepage and add it to design md: dark mode, background 3 is a dark gray, not quite black. light mode, background 3 is white, pure white."

- Token: `--surface-contrast` - #FFFFFF in :root, #1A1A1A in [data-theme="dark"]. DESIGN.md frontmatter: `colors.surface.contrast` with both values noted; Colors prose documents it as "background 3", the DELIBERATE exception to both the no-pure-white default and tinted-surface rule, one crisper plane per page, used sparingly.
- Class: `.section--contrast { background: var(--surface-contrast) }` - rides normal theme text tokens, no text overrides needed (ink-on-white light / cream-on-near-black dark both pass).
- Placement (my call, Jonah named no section): the FAQ. Light: paper foundation -> WHITE faq -> ink posture, a crisp step. Dark: teal -> near-black gray -> cream posture. Easy to move - it's one class.

VERIFIED both themes (Chrome, fresh loads): dark mode FAQ clearly steps off the teal sections onto neutral near-black; light mode FAQ visibly brighter/cooler than the cream above, ink text clean on white.

design.md lint: still crashes with the pre-existing "colorStr.trim is not a function" internal error (crashes on the unchanged file too - not caused by the new token). Follow-up ticket still owed.

Files: marketing-site/styles.css (token x2 themes + .section--contrast), marketing-site/index.html (FAQ section class), marketing-site/DESIGN.md (frontmatter token + Colors prose).
