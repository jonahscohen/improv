---
name: Tool-card CTAs - caret glyph + hover-only underline (via Justify)
description: Justify prompt on .tool-card__cta - arrows became carets (U+203A, matching the carousel chevrons), red underline now only on card hover / keyboard focus; applied to all three cards
type: project
relates_to: [session_2026-06-10_tool-cards-thematic-inverse.md]
---

Collaborator: Jonah. 2026-06-10. Via Justify (prompt-1, .tool-card:nth-child(2) > .tool-card__cta): "make the arrow a caret, only show underline on hover".

- HTML: `-&gt;` -> `&#8250;` (U+203A, the same glyph family as the loop carousel's chevron buttons) in all three CTAs - the prompt targeted one card but describes the shared pattern.
- CSS: .tool-card__cta `text-decoration: none` at rest (decoration color/thickness/offset kept on the base so the underline appears fully styled); `.tool-card:hover .tool-card__cta, .tool-card:focus-visible .tool-card__cta { text-decoration: underline; }` - the card link is the hover/focus surface since the CTA is a span inside it; keyboard users get parity.
- styles.css ?v=12.

VERIFIED (real hover, dark theme): resting cards show caret CTAs with no underline; hovering the beats card surfaces its red underline while the other two stay bare.

Responded completed, queue cleared, watcher relaunching.

Files: marketing-site/index.html (3 CTA glyphs, v12), marketing-site/styles.css (cta rest + hover/focus rules).
