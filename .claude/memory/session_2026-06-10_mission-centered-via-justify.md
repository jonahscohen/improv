---
name: Mission section - lede removed + centered via Justify (prompts 1-2)
description: Two Justify prompts in one Send All - removed the mission lede paragraph, center-aligned the section with a wider 64ch body measure
type: project
relates_to: [session_2026-06-10_mission-opener-three-sentences.md, session_2026-06-10_justify-watch-forever-loop.md]
---

Collaborator: Jonah. 2026-06-10. Via Justify (two prompts in one batch - first multi-prompt Send All handled by the forever watcher).

- prompt-1 (.section__lede): "remove this" -> deleted the mission lede paragraph from index.html. Section now runs eyebrow -> title -> body (two sentences).
- prompt-2 (.container): "text align center all of this, make the max width a little wider" -> added `section--mission` modifier class; scoped CSS: `.section--mission .container { text-align: center }`, title margin-inline auto, body p max-width 56ch -> 64ch + margin-inline auto. Scoped to the modifier, no broad rules.

VERIFIED (Chrome, fresh load, light theme): eyebrow/title/body all centered, lede gone, body balanced across four lines at the wider measure, no clipping. Both prompts responded completed, queue cleared, watcher relaunching.

Files: marketing-site/index.html (lede removed, section--mission class), marketing-site/styles.css (.section--mission rules).
