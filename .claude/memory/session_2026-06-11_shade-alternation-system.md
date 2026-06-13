---
name: Shade alternation replaces flipped-contrast system (decision)
description: Jonah retired the flipped dark/light section alternation; sections now alternate shades only - cream/darker-cream in light mode, dark-teal/lifted-dark-green in dark mode; no section ever inverts
type: decision
relates_to: [session_2026-06-10_homepage-alternating-contrast.md, session_2026-06-11_foundation-moved-above-stats.md]
supersedes: session_2026-06-10_homepage-alternating-contrast.md
---

Collaborator: Jonah. 2026-06-11. "We will no longer be alternating contrasts between sections... we will stick with alternating shades of cream for light mode and alternating shades of dark green for dark mode."

Choice made: section planes alternate canvas / alt (shade pairs) in both themes; the flipped-contrast system (ink green + near-black gray darks in light mode, cream + pure white lights in dark mode) is fully retired.

**Alternatives considered:**
- Flipped-contrast alternation (the 2026-06-10 system): rejected by Jonah - too much contrast churn between sections.
- Keeping paper as a third light shade: rejected implicitly - strict two-shade rhythm (canvas/alt), paper remains a card/raised surface token only.

**Why this one:** calmer page rhythm; text tokens never flip because no plane inverts, which deletes an entire class of cream-on-cream/ink-on-ink bugs (one bit during this migration: CTA title). Inverse surfaces survive as CARD accents (tool cards, carousel cards, install block), which carry the brand's dark/cream punch without flipping whole planes.

**Revisit when:** Jonah asks for higher-drama section breaks, or a new page needs a true inverse band (would need a deliberate exception).

## Implementation (styles.css ?v=22)
- Token: --surface-contrast retired -> --surface-alt (light #ECE5D4 darker cream; dark #073035 lifted dark green). .section--alt sets it.
- HTML: hero/toolkit/foundation/faq = plain section (canvas); mission/loop/stats/cta = section--alt. section--paper and section--ink/--contrast no longer used on sections (CSS defs remain inert; .section--ink scoped overrides are dead rules - cleanup candidate).
- De-inversed components: carousel cards solid var(--surface-inverse) with text-inverse names; focus panel/nav/dots to primary/secondary/tertiary; cta-banner title/body to primary/secondary (BUG caught in verification: still cream-on-cream after class removal because the rules were explicit, not scoped); cta install-block/btn on-inverse overrides removed; stats .section--ink overrides now dead (base colors apply).
- Loop FX: dither dot color #ffffff -> #02272B (ink dots on the light plane; in dark mode dots are near-invisible and only the faint white grain glow shows - flagged to Jonah as a consequence of one effect config serving two themes).
- DESIGN.md: surface.alt token replaces contrast; alternation prose rewritten; stale flipped-plane paragraphs removed (Colors + Layout sections).

VERIFIED both themes, full page walks, real theme-toggle click: light = cream/darker-cream rhythm with ink text everywhere, dark cards as accents; dark = teal/lifted-green rhythm, cream text, cream cards as accents; CTA legible in both; count-up fires; hero ampersand unaffected (mid-intro frame initially mistaken for a regression - config audit confirmed hero untouched).

Files: marketing-site/styles.css (tokens, section--alt, component de-inversing), marketing-site/index.html (section classes, dither color, v22), marketing-site/DESIGN.md.

## Update - alt leads (Jonah: "start with the darker cream first")
Order inverted: .hero now carries background var(--surface-alt) and the alt class moved to toolkit/foundation/faq; mission/loop/stats/cta sit on canvas. Light reads darker/lighter/darker... from the hero down; topbar stays canvas chrome (crisp deliberate boundary under it, verified). Dark mode consequently opens on the lifted green then teal - still pure dark-green shade alternation, within the rule. v23. Verified light walk + top seam.

## Update - sticky hero-matched nav (Jonah)
"I dont want the nav to be differently colored than the hero. also, make it sticky." Header restructured out of the width-capped container into a full-bleed .site-header (position sticky, top 0, z-index 100, background var(--surface-alt)) with .container > .topbar nested inside. Nav and hero now share one plane; the bar floats over lighter sections as a chrome band (no shadow/hairline - offered to Jonah, declined-by-default minimalism). v24. VERIFIED: continuous plane at top, bar pinned during scroll with all controls present.
