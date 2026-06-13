---
name: Homepage taste pass - validator clean (4 -> 0 violations)
description: /sidecoach taste routed to the standalone taste-validator CLI; fixed icon provenance, hover translateY, and radius literals; exit 0
type: project
relates_to: [session_2026-06-10_homepage-narrative-verified-qa.md]
---

Collaborator: Jonah. 2026-06-10. Command: /sidecoach taste the homepage.

**Routing note:** "taste" is NOT a flow verb - sidecoach-monitor returns flow null for it. The taste surface is the standalone CLI `sidecoach/bin/sidecoach-taste-check.js <html> [css]` (built 2026-05-24, 6 structural checks). Remember this routing; do not improvise a flow.

Run against marketing-site/index.html + styles.css: 4 violations, all fixed, re-run exit 0.

1. taste/fabricated-svg x2 (theme-toggle moon + sun): the paths ARE verbatim Lucide (moon/sun) but carried no provenance marker. Fix: added `lucide-moon`/`lucide-sun` classes, `data-icon-source="lucide:moon|sun"`, and source comments. No visual change (verified: toggle renders identically).
2. taste/translatey-in-hover (.tool-card:hover): removed `transform: translateY(-2px)`; hover is now shadow-only (shadow-sm -> shadow-md), scale(0.96/0.98) press states untouched. Verified: cards pixel-stable on hover.
3. taste/border-radius-inconsistency (3 literals): hamburger bar `2px` -> `var(--radius-full)` (identical pill on a 2px stroke); process__return shorthand `0 0 var(--radius-xl) var(--radius-xl)` -> longhand border-bottom-left/right-radius vars; mobile reset `border-radius: 0` -> longhand `var(--radius-none)`. Verified: U-channel return path renders identically (rounded bottoms, label seated).

All three were pre-existing (theme toggle + tool-card predate today's narrative work); the U-channel shorthand was today's.

Files: marketing-site/index.html (icon provenance), marketing-site/styles.css (3 radius sites + tool-card hover). Working tree on main, uncommitted.
