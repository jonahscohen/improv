---
name: Homepage narrative - verification + QA gate closed
description: Full visual verification (desktop dark+light, mobile 375, real-input interactions) and sidecoach QA triad on the eight-section homepage rework; two fixes landed (minor-list flex-shrink, copy-button 40px hit area)
type: project
relates_to: [session_2026-06-10_homepage-narrative-html-assembly.md]
supersedes: session_2026-06-10_homepage-narrative-css-components.md
---

Collaborator: Jonah. 2026-06-10.

## Visual verification (Chrome, real inputs only)
- Desktop dark + light themes, every section screenshotted and inspected: mission, three-up, loop (U-channel return label renders seated on the rule), stat band, foundation, FAQ, posture, CTA banner, footer.
- Count-up VERIFIED live twice: caught mid-tween (23/189/43... then 20/165/37...) settling to correct finals 26/218/49/17/27/0. Real scroll triggered it.
- FAQ verified by real clicks: item opens (+ rotates to x), answer renders; clicking a second item CLOSES the first (native name="faq" exclusive accordion works).
- Click-to-copy on the closing install block fires the COPIED acknowledgment.
- Theme toggle clicked: light mode verified across all new sections (ink stat band dark-on-cream-page, CTA ink card on cream; on-inverse overrides hold).
- Mobile 375x812: hamburger nav, stacked cards, loop steps stack vertically with hooks, 1-col stats animating, CTA banner wraps cleanly.

## Fixes found by verification
1. `.minor-list__name` overflowed into descriptions ("referencA curated...") - names longer than 7ch got flex-compressed; fix: `flex-shrink: 0`.
2. `.install-block__copy` min-height 32px -> 40px (hit-area floor; pre-existing, surfaced by audit checklist). Verified visually after.

## QA triad (engine run from marketing-site/)
- audit (flowK): generic prevention checklist walked against the build - labels n/a (no forms), no role=button divs (native summary), focus rings present, alt text present, reduced-motion respected throughout; hit-area fix above.
- critique: ENGINE UNAVAILABLE - ProjectPersonaEngine throws (no Anthropic API key configured in sidecoach env). Stated plainly, not claimed as passed; heuristic lens applied manually during the visual pass.
- polish (flowJ): 1 real P1 - stat band matches "hero-metric template" shape. Trade-off documented: stat blocks were Jonah's explicit request; styled as editorial ruled dl blocks (serif tabular values, mono labels, top rules), not floating KPI cards. The 3 "optimize" slop findings are in cheatsheet.html, NOT index.html (grep exit 1) - out of scope.
- `npx @google/design.md lint DESIGN.md`: linter CRASHES internally (colorStr.trim is not a function) on the unchanged DESIGN.md - pre-existing tooling failure, not a token finding. Worth a follow-up ticket.

## make-interfaces-feel-better (applicable points)
- tabular-nums on stat values | balance on headings (global h rule) | concentric radius (banner xl, inner blocks md) | scale(0.96) press states inherited | no transition:all | reduced-motion on every new animation | 40px+ hit areas after fix | shadows over borders (banner shadow-md).

## Team
homepage-narrative team (stats-miner, copy-strategist, component-researcher) - all delivered, shutdown requested. TeamDelete after confirmations.

Files: marketing-site/index.html, marketing-site/styles.css. Working tree on main, uncommitted.
