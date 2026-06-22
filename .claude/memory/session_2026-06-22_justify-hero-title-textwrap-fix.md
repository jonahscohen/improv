---
name: Hero title first-line fix - real cause was text-wrap:balance, not column/max-width
description: "Say what you want." would not stay on the hero title's first line because the global h1 rule sets text-wrap:balance (equalizes line widths, ignores available width). Fix = text-wrap:wrap on .page-hero__title. Column restored to 60/40; max-width:none. Verified visually in Chrome at 1440 and 600.
type: project
supersedes: session_2026-06-22_justify-hero-title-maxwidth.md
relates_to: [session_2026-06-22_justify-hero-split-6040.md, reference_chrome_mcp_lan_ip_access.md]
---

Collaborator: Jonah Cohen

User criterion (Justify follow-up): keep the hero title as one element (no <br>, no nowrap), but make sure "Say what you want." stays on the FIRST line at desktop; narrower viewports may wrap normally.

ROOT CAUSE (found only after visual verification): `h1, h2, h3, h4 { text-wrap: balance }` (styles.css:241). `.page-hero__title` is an h1, so it inherited balance, which distributes words into roughly-equal-width lines and IGNORES available width. That is why the title balanced into "Say what you" / "want. Sidecoach" / "puts it all together." and why widening the column did nothing.

THE FIX: `.page-hero__title { text-wrap: wrap; max-width: none; }` - greedy wrap fills line 1 to the column width. Column restored to the user's original 60/40 (`grid-template-columns: 3fr 2fr`). Result at desktop: "Say what you want." / "Sidecoach puts it all" / "together." (red underline on "all together" preserved).

Visual verification (Chrome MCP, primary per Jonah; see [[reference_chrome_mcp_lan_ip_access.md]]):
- 1440px: "Say what you want." on line 1 at 60/40. CONFIRMED with a real screenshot, examined.
- 600px (contracted): single column, wraps cleanly, no overflow, phrase intact. CONFIRMED.

SELF-ANALYSIS (failure modes to not repeat):
1. I reported the Justify task "completed" to the panel after a curl check, BEFORE any visual verification. Jonah corrected: visual changes REQUIRE visual verification; curl is content-only. curl confirmed "max-width:19ch served" but the page still wrapped wrong - a false positive exactly as the Verification Protocol warns.
2. I iterated three width-based edits (max-width 16->19->28->none, column 60%->67%) on a WRONG hypothesis before inspecting the actual wrapping mechanism. The debugging protocol says find the delta / don't keep narrowing to the next likely line. The tell was that the wrap did not change across two different column widths - that should have pointed me to a width-independent cause (text-wrap) immediately. Grepping the CSS for `text-wrap` took 30 seconds and ended it.

Final CSS state (marketing-site/styles.css):
- .hero-split: grid-template-columns: 3fr 2fr (60/40, original).
- .page-hero__title: max-width: none; text-wrap: wrap; (plus existing font/weight/line-height/letter-spacing).
- (sidecoach.html title <br> already removed earlier; lede already shortened earlier.)

Files touched:
- marketing-site/styles.css (.page-hero__title text-wrap:wrap + max-width:none; .hero-split kept 3fr 2fr)
