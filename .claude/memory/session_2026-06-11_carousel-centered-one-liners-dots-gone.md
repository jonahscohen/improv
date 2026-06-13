---
name: Carousel cards centered, step copy cut to one sentence, dots removed (via Justify)
description: Three-prompt batch - arc card content centered both axes, each step's focus desc reduced to a single sentence with hooks emptied, indicator dots display none
type: project
relates_to: [session_2026-06-11_loop-copy-tease.md, session_2026-06-10_loop-carousel-bleed-rework.md]
---

Collaborator: Jonah. 2026-06-11. Via Justify (3 prompts, one Send All).

1. Card layout (.process--arc .process__step): justify-content center + align-items center + text-align center - number and name now sit dead-center of each card.
2. Step copy: all five .process__desc cut to ONE sentence each (Plan: "sidecoach turns a plain-language brief into a plan you approve before any code is written." / Design: tokens-not-template / Build: working code in your repo / Validate: clicks become verified changes / Remember: recorded and read back next session). All five .process__hook elements EMPTIED but kept in the DOM - the focus-panel JS reads desc/hook textContent per slide, so removing the elements would break it; empty strings render nothing.
3. Dots: .process__dots display none (rule kept its positioning beneath; JS still manages the invisible element - zero logic touched).
- styles.css ?v=26.

VERIFIED: focused card shows centered 01/Plan; focus panel shows the single sentence with no hook line; no dots, clean junction into The Foundation. Responded x3 with full schema, queue cleared, watch relaunched.

Files: marketing-site/index.html (5 descs, 5 hooks emptied, v26), marketing-site/styles.css (card centering, dots hidden).

## Update - focus panel re-centered (Jonah, follow-up prompt)
"position this container further down, should feel centered between bottom of section and bottom of selected card": .process__focus top 280px -> 330px (card bottom 260 + (250px zone - ~110px panel)/2). VERIFIED in dark mode: panel center ~625 vs zone center ~628 - visually even air above and below. v28.
