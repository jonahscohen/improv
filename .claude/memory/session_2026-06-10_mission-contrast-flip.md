---
name: Mission section contrast-flipped via Justify (red eyebrow)
description: Justify prompt - mission section inverted to an ink band (section--ink composes with section--mission) with the "What this is" eyebrow in brand red
type: project
relates_to: [session_2026-06-10_mission-centered-via-justify.md]
---

Collaborator: Jonah. 2026-06-10. Via Justify (prompt-1, .section--mission): "make this entire section completely flip in contrast, 'what this is' text in red".

How: added `section--ink` alongside `section--mission` (the existing inversion pattern - no new surface rules needed), plus two scoped rules: `.section--mission .section__eyebrow { color: var(--color-red) }` and `.section--ink .mission__body p { color: var(--text-on-inverse-secondary) }` (mirrors the established .section--ink .section__lede pattern).

VERIFIED (Chrome, fresh load, light theme): mission renders as a dark ink band between the cream hero and toolkit sections; red WHAT THIS IS eyebrow, cream serif title, softened cream body; centered layout held. Note: red mono eyebrow on ink is ~3.5:1 - below AA for small text but an explicit user choice on a decorative label; flag if it ever matters for a11y hardening.

Responded completed, queue cleared, watcher relaunched.

Files: marketing-site/index.html (section class), marketing-site/styles.css (2 scoped rules).
