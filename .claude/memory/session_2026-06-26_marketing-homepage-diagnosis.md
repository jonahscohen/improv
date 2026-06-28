---
name: marketing homepage diagnosis (localhost:4830)
description: Audit + visual read of the Improv marketing homepage - root cause of the "feels off" is a uniformly too-dim secondary-text layer
type: project
relates_to: [session_2026-06-26_marketing-homepage-critique.md]
superseded_by: session_2026-06-27_marketing-homepage-rediagnosis.md
---

Jonah asked "something about the marketing homepage feels off, what's actually wrong" re: localhost:4830 (the Improv marketing site). Ran `/sidecoach audit` + `/sidecoach critique` first (per the diagnose-IS-an-audit rule), then screenshotted the full page top to bottom in Chrome.

**Audit result: blocked, grade F, 20 blocking findings - ALL low-contrast.** Every finding is a secondary/label text element below WCAG AA (4.5:1). Grouped by element:
- `dd.stat__caption` (BY THE NUMBERS captions) - 3.02:1, SIX instances. Faintest text on the page, visibly near-invisible.
- `span.process__num` (loop cards 01-05) - 3.26:1, five instances.
- `span.tool-card__tag` (PLAN+DESIGN / VALIDATE+TUNE / RECORD+RECALL) - 3.26:1, three instances.
- `p.section__eyebrow` (small-caps section labels) - 4.23:1 and 3.86:1.
- `button.install-block__copy` (the `curl ... | bash` text, gray-on-cream) - 4.23:1, both hero and footer install blocks.

**Root cause of "feels off":** the headlines are crisp, confident, high-contrast serif; the entire supporting layer (eyebrows, tags, process numbers, stat captions, install-command text) is whispering below AA. That bold/quiet mismatch reads as washed-out and draft-like even though no single element looks broken. This is the thing a freeform eyeball read can't name but the audit measures exactly.

**Secondary design issues (my visual read, not the audit):**
- Inconsistent paragraph alignment: WHAT THIS IS, THE LOOP intro, BY THE NUMBERS intro, and the closing CTA are centered; THE TOOLKIT intro is left-aligned. Subtle wobble section to section.
- BY THE NUMBERS undercuts itself: faintest text on the page PLUS self-disclaiming copy ("Each number measures depth, not marketing") on what is structurally a vanity-metrics block. Protesting-too-much.
- A lot of empty teal vertical space (esp. below the centered WHAT THIS IS paragraph) reads as sparse/unfinished on a tall desktop viewport.

**Copy verdict:** mostly real and concrete, NOT generic slop. "Improv is how we work with Claude... planning against a brief, holding to a design system, adjusting a live page from the browser, remembering decisions between sessions" is specific and earns its place. Only soft spot is the numbers-section disclaimer.

**Process note:** critique engine ran DEGRADED - "PRODUCT.md not found - using generic personas" and the second flow (multi_lens_audit) gated on flowJ_tactical_polish not having run. So the critique grade A / 0 findings is NOT trustworthy; the audit's objective contrast findings are the solid signal. Worth checking whether the marketing site has its own PRODUCT.md or whether sidecoach is reading the wrong root.

Files touched: none (diagnosis only, no code changes yet).
