---
name: CTA converted to full-bleed centered section (via Justify)
description: Justify prompt - the cta-banner card became a full-bleed flipped section (ink+contrast) with centered content; restores the alternation slot vacated by the posture deletion
type: project
relates_to: [session_2026-06-10_posture-section-deleted.md, session_2026-06-10_homepage-alternating-contrast.md]
---

Collaborator: Jonah. 2026-06-10. Via Justify (prompt-1, .cta-banner): "turn this into a full bleed cta section, text align-center".

- Section class: `section` -> `section section--ink section--contrast` - the CTA takes the gray/white flipped slot the deleted Posture section vacated, so the tail alternation reads ...FAQ(base) -> CTA(flipped) -> footer(base) in both themes again.
- .cta-banner restyled: card chrome removed (no surface-inverse bg, radius, shadow, padding-16); now a centered column (text-align center, gap space-6). The existing .cta-banner on-inverse overrides (install-block subtle bg, btn--secondary inherit/border-inverse) still apply correctly since the flipped section provides the same inverse context the card used to. 880px padding override removed (dead).
- styles.css ?v=17.

VERIFIED (dark theme, fresh load, page end): white full-bleed band between dark FAQ and dark footer, headline/copy centered, install block + Read the source centered beneath, all legible. Light theme = near-black gray band via the same tokens.

Collision protocol: queue claimed, 0 competing responses; responded with full schema.

Files: marketing-site/index.html (section classes, v17), marketing-site/styles.css (cta-banner restyle, mq removed).
