---
name: Homepage narrative CSS component layer
description: Added the five new homepage components to styles.css (mission body, process loop, stat band, FAQ accordion, CTA banner) on the existing token system; HTML assembly pending copy delivery
type: project
relates_to: [session_2026-06-10_homepage-narrative-sidecoach-realign.md]
superseded_by: session_2026-06-10_homepage-narrative-verified-qa.md
---

Collaborator: Jonah. 2026-06-10.

CSS for the approved homepage arc, appended to marketing-site/styles.css before the view-transitions block. All values token-resolved; dark theme inherits through semantic tokens; no per-theme overrides needed.

- `.mission__body` - editorial statement paragraphs (lg, 56ch).
- `.process` - ol-based 5-step loop. 5-col grid at LG, 1-col stack <=1024. Steps: 2px top rule, mono red number, serif name, desc, red-left-tick stakeholder hook. `.process__return` is a decorative U-channel rule (border left/right/bottom, rounded bottom) from step 5 back under to step 1 with a mono label seated on the line; collapses to a left-rail note on mobile. aria-hidden in markup - the ol carries the order semantics.
- `.stats` - dl-based stat band for the ink section. DOM order dt(label) -> dd(value) -> dd(caption) per dl spec; flex `order` puts value visually first. Serif tabular-nums values, mono uppercase labels, ruled tops - deliberately editorial, NOT floating KPI cards (avoids sidecoach's hero-metric-template + identical-card-grid bans). 3/2/1 columns at LG/MD/XS.
- `.faq` - native details/summary accordion. Summary = flex row with mono red "+" that rotates 45deg on open; focus-visible red ring; 44px+ hit area via padding. Open/close animation behind @supports (interpolate-size: allow-keywords) using ::details-content (Baseline 2025, enhancement only - snaps elsewhere). Reduced-motion disables both.
- `.cta-banner` - ink card (radius-xl, shadow-md) with title/body + actions row for the install block reuse.

Why ruled blocks over cards: craft-flow validator names "identical card grids" and "hero-metric template" as absolute bans; the editorial rules also match DESIGN.md's essay-like overview.

Not yet verified visually - nothing references these classes until the HTML assembly lands (copy-strategist delivering mission opener + trimmed three-up). Verification happens on the assembled page.

Files: marketing-site/styles.css.
