---
name: Justify - remove-task confirmation dialog polish
description: the queue task-removal confirm dialog made symmetric, with button hover/press states and an entrance pop
type: project
relates_to: [session_2026-06-18_justify-bar-pill-hover.md]
---

Collaborator: Jonah

Jonah (with a screenshot, via /sidecoach polish intent): polish the "Remove <task>?" confirm
dialog, add hover states to the buttons, make the object symmetrical.

The dialog is `PromptMode._confirmRemoveItem` (prompt/index.ts). Before: right-aligned buttons
(empty bottom-left = the asymmetry), no button hover/press states, no entrance animation.

Changes:
- Symmetry: `text-align:center` message + `flex:1` equal-width buttons in the row (Cancel | Remove
  each ~50%), fixed `width:300px;box-sizing:border-box`, even 22px padding. Balanced card.
- Hover states: Cancel -> light tint fill + brighter border + full-white text; Remove -> darker
  red (#dc2626) + soft red glow `box-shadow:0 4px 14px rgba(239,68,68,0.45)`. Both get a press
  `scale(0.96)` on mousedown.
- Polish: entrance pop (backdrop fade + box scale 0.94 -> 1 via spring cubic-bezier), bigger radius
  (14px card / 9px buttons), deeper shadow, larger hit targets (9px 14px). Dismiss on Escape and
  backdrop click (with listener cleanup). data-justify on the overlay.

Verified in-browser (seeded a queue task via the daemon /queue endpoint as test setup, then drove
it with REAL clicks: opened the queue panel, hovered the row, clicked the trash icon -> dialog):
- dialog renders symmetric (centered text + equal buttons), entrance pop played;
- hovering Cancel -> light fill + brighter border/text;
- hovering Remove -> darker red + red glow (Cancel reverted cleanly);
- clicking Remove removed the task; queue back to [] (clean, seeded item gone).

Files: justify/core/prompt/index.ts. Rebuilt + deployed to ~/.claude/justify + public/justify-core.js.
Note: marketing-site/demo.css also picked up the website session's scd-replay focus/active edits;
my #scd-term flush-state rule (earlier beat) is preserved alongside them.
