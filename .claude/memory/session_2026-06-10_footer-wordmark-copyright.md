---
name: Footer - and-dev wordmark + MIT copyright line (via Justify)
description: Justify prompt - footer text span replaced with the theme-swapped and-dev wordmark and "Copyright (c) 2026 Yes&. Released under the MIT License." beneath
type: project
relates_to: [session_2026-06-10_mission-contrast-flip.md]
---

Collaborator: Jonah. 2026-06-10. Via Justify (prompt-1, .site-footer__row > span): "replace this with &dev logo and underneath put 'Copyright (c) 2026 YourName. Released under the MIT License.'"

- Replaced the span with `.site-footer__brand`: the header's theme-swap pattern reused verbatim (wordmark__img--light/--dark classes are :root[data-theme]-scoped, so they work outside .wordmark), sized 100px in the footer.
- Copyright line: "YourName" placeholder resolved to **Yes&** (no LICENSE file exists at repo root to dictate a holder; previous footer credited "Yes& Improv"). Flagged to Jonah in the panel response - one word to change if he wants a personal name. A real LICENSE file is still missing repo-wide; worth adding when this ships.
- CSS: .site-footer__brand column stack (gap 12px), .site-footer__copyright (sm, secondary).

VERIFIED (Chrome, light theme, page bottom): wordmark renders with red ampersand + ink dev, copyright line beneath, GitHub right, CTA banner above untouched.

Files: marketing-site/index.html (footer block), marketing-site/styles.css (3 footer rules).
