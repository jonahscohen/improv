---
name: Improv settings button active state fix
description: Fixed settings gear button not showing active state when settings panel is open
type: project
relates_to: [session_2026-05-04_improv-design-and-plan.md]
---

Settings gear button in improv toolbar had no visual active state when the settings panel was open. Hover worked fine (via createToolbarButton's mouseenter/mouseleave handlers checking dataset.active), but toggleSettingsPanel never set/cleared dataset.active or the blue highlight styles.

**Fix (edits to dist/improv-core.js):**
- Added `settingsBtn=null` class property
- Stored reference: `this.settingsBtn=r` after creating the button
- In `toggleSettingsPanel`: set `background: #3b82f6`, `color: #fff`, `dataset.active="1"` on open; clear all three on close
- Updated `updateModeButtonStyles` to match: solid `#3b82f6` background + `#fff` icon (was `rgba(59,130,246,0.2)` + `#6dacfc` which rendered too faint)

**Deployment note:** Editing `improv/dist/improv-core.js` (repo) is not enough - the browser loads from `~/.claude/improv/dist/improv-core.js` (installed copy). Must copy to installed location after editing.

**Files touched:**
- improv/dist/improv-core.js (repo source of truth)
- ~/.claude/improv/dist/improv-core.js (installed copy, updated via cp)
