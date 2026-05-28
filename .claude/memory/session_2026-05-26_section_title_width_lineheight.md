---
name: section__title line-height + max-width tuning
description: Two more iterations on .section__title after first polish pass was too loose. Jonah said "section title h2 line heights are terrible" (so tightened from 1.08 to 0.98) and "section title h2 width too narrow" (so widened max-width from 22ch to 36ch).
type: project
relates_to: [session_2026-05-26_heading_line_height_polish.md]
---

First polish pass set `.section__title` line-height to 1.08. Jonah said still terrible. Tightened to 0.98 (very tight; "Two modes. One queue. One scene." has near-zero visible gap between lines now). Confirmed acceptable at this value.

Then Jonah said max-width too narrow. Widened from 22ch to 36ch. At 22ch, "Two modes. One queue. One scene." was breaking awkwardly between "One" and "queue" - splitting the semantic unit "One queue". 36ch is roughly enough to fit that title on a single line at desktop while still constraining longer headings.

**Final values for .section__title:**
- font-size: var(--size-3xl)
- font-weight: var(--weight-semibold)
- line-height: 0.98
- letter-spacing: -0.015em
- max-width: 36ch
- margin-bottom: var(--space-6)

**Pattern noted for future:** when setting up display headings, the trio that matters together is line-height + max-width + text-wrap. A 22ch max-width with text-wrap: balance forces wrapping at arbitrary points; 36ch gives enough room for natural break choices.

**Sidecoach engine output noted but not actioned:** earlier polish flow surfaced repo-wide linguistic ban findings (slop words, anti-pattern templates). Not part of this iteration scope.
