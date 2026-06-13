---
name: Loop carousel rework - bleed, 3-up, seamless conveyor, staggered captions
description: Per Jonah - cards bleed off-screen with outer two clipped halfway by the section bottom, wrap jump hidden (no fly-across), return caption removed, dots = absolute section bottom, caption contents stagger-fade per slide
type: project
relates_to: [session_2026-06-10_loop-arc-carousel.md]
supersedes: session_2026-06-10_loop-arc-carousel.md
---

Collaborator: Jonah. 2026-06-10. Corrections on the first arc build: "cards should feel like they're bleeding off the screen... only show three at a time with the remaining two halfway hanging off the bottom of the section. I'm not liking the flip over effect... just wanted an infinite loop of cards using the existing five. Remove the 'Remember feeds...' - absolute bottom should be the carousel indicators with the tiniest bit of breathing room. Each slide caption should stagger fade in its contents."

Changes:
- Geometry: ANGLE 30deg/slot, RADIUS 760 - focused + two neighbors fully visible; d=+-2 cards descend below the section clip (section--loop overflow:hidden) hanging ~half off, and push toward the viewport edges (bleed). Stage 510px.
- Seamless wrap (the "flip over" fix, v2 after Jonah: "the last card all the way at right doesn't animate at all"): render() tracks each card's previous offset (dataset.prevD); on a wrap (offset jump > 2 slots) the card is first TELEPORTED transition-free to a VIRTUAL slot one step further along the arc (d+-3 = 90deg, fully below the section clip), then its real corner transform applies normally - so the entering card GLIDES up into the corner like every other card. v1 (teleport directly to the corner slot) read as a non-animating card because the corner is half-visible. Verified with two ~1s-apart mid-transition frames: Validate visibly rising into the right corner.
- process__return REMOVED entirely (HTML element + base/mobile/ink/arc CSS rules). The mobile stacked list loses its left-rail note too.
- section--loop: overflow hidden, padding-block var(--space-section) var(--space-4) - dots (moved out of the panel, absolute bottom:0 of .process-stage, z 12, [hidden] guard since display:flex beats the hidden attr) are the section's last visual with ~16px breathing room.
- Stagger: .is-in classes re-armed by JS on every focus change (remove class -> reflow -> add) on controls row/desc/hook; CSS fade-up 420ms ease-out with 0/90/180ms delays; disabled under prefers-reduced-motion.
- styles.css ?v=6 then ?v=7 (two structural passes; second fixed hook/dots collision by stage 470->510 + R 700->760).

VERIFIED (light theme, fresh loads, two autoplay cycles watched): 3-up with corner cards half-clipped and bleeding; Plan->Build progression with wrapping cards entering from the clipped corners (no center sweep); no caption; dots seated at the section bottom; panel text re-renders per slide (stagger mechanism same as verified hero pattern). Dark theme is token-driven (white section, ink-alpha cards) - unchanged plumbing.

Files: marketing-site/index.html (section--loop class, return removed, dots relocated + hidden guard, JS: ANGLE/RADIUS, wrap-jump, stagger re-arm, dots toggling, v7), marketing-site/styles.css (return rules removed everywhere, section--loop, stage 510, panel 280 + z11, stagger rules, dots absolute).
