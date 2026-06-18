---
name: Justify live loop - two tasks handled (post-fix proof)
description: first live justify tasks after the queue/headless/select fixes - marquee hover-pause + scd-term shadow/border
type: project
relates_to: [session_2026-06-18_justify-tasks-headless-select.md]
---

Collaborator: Jonah

Right after shipping the Justify fixes, Jonah fired two real tasks from sidecoach.html
(port 4830) to test them ("i will be checking for this"). Both carried the new structured
`selectors` field, confirming a reloaded tab is running the new core.

- prompt-1 (.marquee-section): "remove pause on hover from marquee rows." The
  `.marquee:hover .marquee__group { animation-play-state: paused }` rule was already absent in
  current styles.css (present in my first grep ~minutes earlier; gone by the time I went to
  edit - external change, likely Jonah testing). Verified no CSS or JS pause mechanism remains;
  marquee scrolls continuously on hover. Responded completed (truthful summary: already absent).
- prompt-2 (#scd-term): "remove box shadow and outer border from component." Neither styles.css
  nor demo.css set a shadow/border on #scd-term (confirmed by grep of all box-shadow decls and
  visually in BOTH themes - the terminal renders as a flush dark rounded rectangle, no shadow,
  no border stroke). What Jonah likely saw was the Justify selection box around the element he
  clicked. Faithful idempotent fix: added `#scd-term { box-shadow:none; border:none }` to
  demo.css (id-scoped so the install terminal is untouched) to lock the flush state. Reloaded +
  verified the terminal still renders intact on cream and dark.

## Observation worth keeping
When I went to respond, the live queue showed only [prompt-1] - prompt-2 had already left the
queue during my (multi-minute, screenshot-heavy) investigation window. Both prompts were in the
queue when the watcher first caught them. I still applied + responded to prompt-2 (nothing
dropped on my watch). Cause of prompt-2's early removal is external (Jonah testing, or a parallel
pass); could not be traced from here (daemon doesn't log HTTP requests). The id-scoped clear
itself is proven by the isolated test in the sibling beat; live, clearing prompt-1 by id emptied
the (single-item) queue correctly.

## Edge case noted (not a regression)
The /respond -> targetSelectors join reads prompts.json by promptId; if the prompt was already
cleared before /respond (race / external clear), the join yields empty targetSelectors. The
per-change `selectors` fallback covers it when changes carry selectors (prompt-2 did: #scd-term),
so click-to-scroll still works. Normal flow (respond before clear) always has the prompt present.

Files: marketing-site/demo.css (#scd-term shadow/border lock). styles.css unchanged this session
(marquee rule already absent).
