---
name: The Loop - arc-focus carousel (infinite) + shortened lede
description: Loop section cards rebuilt as an arc-focus carousel after the Framer reference (just-yards demo) with infinite wrap + autoplay; lede cut to one sentence; two cache bumps and a containing-block bug en route
type: project
relates_to: [session_2026-06-10_homepage-alternating-contrast.md, session_2026-06-10_homepage-narrative-html-assembly.md]
superseded_by: session_2026-06-10_loop-carousel-bleed-rework.md
---

Collaborator: Jonah. 2026-06-10. "'The Loop' shorten the lede, and can we turn those cards into this carousel, except it loops around and around?" + reference links (framer marketplace arc-focus-carousel + live demo just-yards-913081.framer.app).

**Reference anatomy (from the live demo, marketplace page is JS-dead):** cards pinned to a circle, focused card upright top-center, neighbors fan down/outward rotated along the arc tangent; the focused item's TEXT lives in the arc's hollow center with prev/next chevrons and dot indicators. Demo is manual-nav; ours adds autoplay + infinite wrap per Jonah.

**Build (no framework, single inline script):**
- Markup: ol.process stays semantic (li = step, AT reads the plain list); new sibling .process__focus panel (aria-live=polite, hidden by default) with chevron buttons (text glyphs, not SVG), name/desc/hook paragraphs, dots built by JS; everything wrapped in .process-stage (the positioning context). U-channel return label becomes a plain centered caption under the stage in arc mode.
- CSS (@media min-width:1025px, .process--arc armed by JS): cards 250x260 absolute at stage center, number+name only (desc/hook display:none - they surface via the focus panel), bg surface-on-inverse-subtle, radius-xl, shadow-md (lg when focused); transitions transform/opacity at duration-glacial ease-out. Reduced-motion kills transitions + autoplay.
- JS: ANGLE 24deg/slot, RADIUS 660px circle (tx=sin, ty=(1-cos)); shortest-path offsets `d=((i-focus)%n+n)%n; d>n/2 -> d-=n` = TRUE infinite wrap; autoplay 4s, pause on hover (list or panel), click card/chevrons/dots navigate, focus panel text synced from the focused li; matchMedia(min-width:1025px) gates arming, change-listener tears down to the stacked fallback (inline styles cleared).

**Bugs caught by verification:**
1. Stale styles.css cache AGAIN (carousel CSS missing -> transforms on grid slots). v=2 -> v=3 (and later v=5). RULE: bump ?v= on EVERY structural CSS change, not just re-vendors.
2. Focus panel positioned against the PAGE (its parent .container is not a positioning context) - rendered up in the hero, invisible. Fix: .process-stage wrapper { position: relative }.
3. Card names at size-3xl overflowed 250px cards (Remember/Validate bled past edges) -> size-2xl. Cards also overlapped at ANGLE 22/R 560 -> 24/660 gives real gaps like the reference.

**VERIFIED (light theme desktop, fresh loads):** arc renders true to reference; autoplay advances with wraparound (watched Validate travel far-left -> far-right as focus moved Plan -> Design); chevron click navigates (minor benign race: an autoplay tick can stack with a click - state stays consistent); dots sync + 44px pseudo hit areas; panel syncs name/desc/hook. Lede verified shortened. Mobile NOT re-verified this round - resize_window stopped taking effect (Jonah actively using the browser); below-1025 path is the previously-verified stacked layout, JS leaves it untouched (panel stays hidden).

Files: marketing-site/index.html (lede, process-stage wrapper, focus panel markup, carousel script, ?v=5), marketing-site/styles.css (process-stage, .process--arc block: cards/panel/nav/dots/caption overrides).
