---
name: Foundation moved above By the numbers (via Justify)
description: Pure section reorder per prompt - page now runs loop -> foundation -> stats; alternation bends (two darks, two creams adjacent), flagged in panel response
type: project
relates_to: [session_2026-06-10_cta-full-bleed.md, session_2026-06-10_homepage-alternating-contrast.md]
---

Collaborator: Jonah. 2026-06-11. Via Justify (prompt-1, .section:nth-child(6)): "move this section up above 'by the numbers'".

- Pure move, no class changes: order now What this is / The toolkit / The loop / The foundation / By the numbers / FAQ / CTA.
- Alternation consequence flagged; Jonah replied 'you swapped them but didn't respect the alternating contrast'.
- Verification gotcha: first post-edit screenshots showed the OLD order - the browser served a stale cached DOCUMENT (not just assets). curl of the served HTML proved the edit live; cmd+shift+r resolved. Lesson: when a structural HTML change "doesn't show", curl the served document BEFORE re-editing - the assert-before-replace habit plus curl saved a phantom double-edit here.
- Collision protocol: queue claimed, zero competing responses; responded with full schema.

Files: marketing-site/index.html (section order).

## Rebalance applied (Jonah's reply via Justify)
- Foundation: section--ink -> section--paper (base slot; minor-list reverts to base colors automatically since ink variants are scoped).
- By the numbers: section -> section--ink (flipped green slot); new scoped rules .section--ink .stat/.stat__label/.stat__value (text-inverse) and .stat__caption (on-inverse-tertiary), border-inverse top rules - base versions retained as defaults.
- styles.css ?v=20. Full light rhythm restored: cream / green / paper / gray / paper / green / cream / gray (flipped planes alternate green/gray per the original spec; dark theme mirrors).
- VERIFIED (hard reload): loop(gray) -> foundation(paper, ink text) -> stats(green, cream values, count-up fired) -> FAQ(cream) -> CTA(gray). Responded with full schema.

LESSON (self-analysis): when Jonah asks to MOVE a section, the alternating-contrast rule is part of the move, not an optional follow-up - he established it as a standing rule ("Capiche?"). Flag-and-wait was the wrong default there; rebalance surfaces proactively next time.
