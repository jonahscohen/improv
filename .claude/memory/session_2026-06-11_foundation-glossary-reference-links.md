---
name: Foundation lede glossary-framed + per-item reference links with red fill underline (via Justify)
description: Two-prompt batch - lede recentered on "A short Improv glossary", last sentence dropped; all five minor-list items get a See-in-reference link whose red underline fills left-to-right on hover
type: project
relates_to: [session_2026-06-11_carousel-centered-one-liners-dots-gone.md]
---

Collaborator: Jonah. 2026-06-11. Via Justify.

1. Lede: "...Named here so you know it's there." removed; now "A short Improv glossary: the deeper layer that does the quiet work. It isn't pitched separately - it's the substrate everything else runs on."
2. .minor-list__link added to ALL FIVE items (prompt targeted skills; generalized for consistency): mono xs semibold, "See in reference >". Hover/focus underline: background-image linear-gradient(red), background-position left bottom, background-size 0% 2px -> 100% 2px, transition medium ease-out - fills LEFT-TO-RIGHT per spec.
3. Href mapping (told to Jonah in the response): hooks -> reference.html#tab-hooks, plugins -> reference.html#tab-cmux; skills/reference/tilt-lab -> reference.html (no matching tabs exist on the reference page - candidates for new tabs/anchors later).
- styles.css ?v=29.

VERIFIED (dark mode): lede renders; five links under their items; REAL hover on the skills link captured the full red underline (zoom); unhovered links show none.

Files: marketing-site/index.html (lede, 5 links, v29), marketing-site/styles.css (.minor-list__link + hover).

## Refinement (Jonah follow-up): whole-item links, hairline fill, color-only label
"i want each li clickable as the link, the border bottom is the object i wanted to see fill from left to right with red when hovered upon. see in reference link should merely change color, not have an underline."
- Each li's content now wrapped in <a class="minor-list__item"> (inner link demoted to a span - no nested anchors); li keeps the resting border-bottom hairline.
- Fill: .minor-list li::after - red 1px bar laid exactly over the hairline (bottom -1px), scaleX(0)->scaleX(1) transform-origin left on li:hover/:focus-within.
- .minor-list__link: underline machinery removed; hover/focus -> color var(--color-red) only.
- VERIFIED via real hover on the item BODY (zoom): hairline fully red edge-to-edge, label red with no underline, hover firing from description text = whole item hot. First real-world hot-refresh broadcast follows this respond.
