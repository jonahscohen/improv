---
name: Foundation list items stacked (via Justify)
description: Justify prompt-1 "stack these" on .minor-list li - name now stacks above description (flex column) instead of sitting beside it
type: project
relates_to: [session_2026-06-10_justify-watch-forever-loop.md, session_2026-06-10_homepage-narrative-verified-qa.md]
---

Collaborator: Jonah. 2026-06-10. Via Justify (prompt-1, .minor-list > li:nth-child(1)): "stack these".

First task caught by the new FOREVER watch loop - poller exited JUSTIFY_TASK_RECEIVED, task applied, loop relaunched.

Change: `.minor-list li` flex row (name | desc, baseline, 12px gap) -> flex COLUMN (name above desc, 4px gap, flex-start). The 2-col section grid is unchanged; "these" read as the name/desc pair inside each item, applied to all five entries via the shared class.

VERIFIED (Chrome desktop, fresh load): skills/hooks/plugins/reference/tilt-lab each render name-over-description, full cell width, rules intact, no overlap. Flow: apply -> POST /validating -> screenshot verify -> POST /respond (completed) -> /prompts/clear -> watcher relaunched.

Files: marketing-site/styles.css (.minor-list li). Working tree on main, uncommitted.
