---
name: marketing-site heading line-height polish
description: Tightened line-heights for headings via /sidecoach polish. Two undefined cases (section__title, feature-row__title) inherited browser defaults ~1.2-1.4 which looked loose against MADE Awelier display serif. Also tightened page-hero__title from 1.04 to 1.02.
type: project
relates_to: [session_2026-05-26_endow_copy_rewrite.md]
---

Jonah ran `/sidecoach polish the heading line-heights. they're terrible.` after the endow.html copy rewrite.

**Audit:**
- `.hero__title` (homepage h1): line-height 1.02 - already good, untouched
- `.page-hero__title` (sub-page hero h1): 1.04 - tightened to 1.02
- `.section__title` (h2): NO line-height defined - inheriting browser default ~1.2-1.4. Worst offender. Added 1.08.
- `.feature-row__title` (h3): NO line-height defined either - same problem. Added 1.15.
- `.section__lede` (1.5) and `.page-hero__lede` (1.4) - body-ish, left alone.

**Rationale (typography conventions for display serif at large sizes):**
- Hero displays (largest, max-width ~16-18ch, often wrap to 3-4 lines): 1.0-1.05
- Section headings (h2, 22ch max, wrap to 2-3 lines): 1.05-1.15
- Feature row sub-headings (h3, 18ch max, wrap to 1-2 lines): 1.15-1.25
- Body text: 1.5-1.6 (already at 1.55 via --line-height-body)

**Files touched:**
- `marketing-site/styles.css` - three line-height edits

**Sidecoach engine output noted but not actioned:** the /sidecoach polish flow surfaced 20+ linguistic ban findings (slop words: "transform", "optimize"), 1 hero-metric-template anti-pattern in test-site-1, and Polish Standard rule failures (19/22 pass). These are repo-wide findings unrelated to the actual line-height ask. Filed for future polish sweep but NOT addressed in this targeted fix - Jonah's request was specifically about heading line-heights.

**Pending verification:** screenshot of endow.html (which has all three heading types) confirming tightened spacing.
