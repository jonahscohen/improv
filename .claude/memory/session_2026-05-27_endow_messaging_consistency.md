---
name: endow messaging consistency sweep
description: Synced the endow card on index.html and the endow reference panel on reference.html to match the new endow framing (microadjustment toolbar, prompt+manipulate modes, queue, background work). Previously stuck on the old "two-pane editor watches your live UI" framing.
type: project
relates_to: [session_2026-05-26_endow_copy_rewrite.md, session_2026-05-26_endow_hero_shortened.md]
---

Jonah's `Fix it, make the messaging consistent` instruction: bring all endow descriptions across the marketing-site in line with the rewritten endow.html.

**Inconsistencies fixed:**
1. `index.html:99` - endow tool-card description was "A two-pane editor that watches your live UI..." (old framing). Rewrote to mirror the endow.html hero lede: "A microadjustment toolbar for Claude Code. Pick an element, queue a change through prompt mode or manipulate mode, and Claude works the scene in the background. The browser refreshes when it's done."

2. `reference.html` endow panel (lines ~95-127) - the entire panel was on old framing. Rewrote:
   - Description: "A microadjustment toolbar for Claude Code. Queue changes through prompt mode or manipulate mode..."
   - Install: "wires the toolbar, the MCP server registration ..., and the queue" (was "editor extension ... watch loop")
   - How it works: completely rewritten to describe two modes sharing one queue + Claude working in the background + browser refresh model. Old version described "two surfaces ... browser preview iframe + property panel docked to the right edge" with "hot module reload" - all wrong for the queue-based tool.
   - Commands: "mounts the toolbar over your dev server" (was "boots the preview pane"); "tears down the toolbar and clears the queue" (was "tears down the loop and unregisters the watch")
   - Posture: "No live mutation" replaces "No synthetic events" as the first item; expanded "Selection and queue survive context compactions" (was just "Selection survives")

**Stayed unchanged:**
- All sidecoach, beats, cmux, voice, discord, hooks, validation-guard panels - those have their own descriptions, no inconsistency flagged
- MCP tool names (get_selection, apply_changes, watch, respond) referenced indirectly in "exposes the toolbar's state to Claude" rather than listing specific tool names - the backend implementation tool names may have drifted with renames; the abstract description is more durable

**Files touched:**
- `marketing-site/index.html` (1 paragraph)
- `marketing-site/reference.html` (whole endow panel, ~30 lines)

**Pending verification:** screenshot both surfaces to confirm copy renders correctly and matches the endow.html voice.
