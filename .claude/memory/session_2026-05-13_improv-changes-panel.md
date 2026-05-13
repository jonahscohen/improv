---
name: Improv changes panel (Phase 2)
description: Claude button + scrollable changes panel with Done/Reply, keyboard shortcuts P/M/C/J/K/D/R
type: project
relates_to: [session_2026-05-13_improv-loop-phase1.md, session_2026-05-13_improv-claude-connection.md]
---

Built Phase 2 of the improv-claude loop: Claude button and changes panel.

**What was built:**
- `core/changes-panel.ts` (new, ~280 lines): scrollable panel with dark glass aesthetic, ARIA roles, keyboard navigation
- Claude button: appears at bottom-left when unreviewed changes exist, badge shows count with markerColor
- Panel shows each change entry with: status dot (green/markerColor/red), summary, files, property pills, question callout for needsInfo
- Done/Reply actions per entry, reply input with markerColor focus border
- Keyboard: J/K navigate entries, D marks done, R opens reply, Escape closes panel, all suppressed in text inputs
- `_updateClaudeBadge` method: creates/removes Claude button based on unreviewed count

**Keyboard shortcuts added to ImprovCore:**
- P: toggle prompt mode
- M: toggle manipulate mode
- C: toggle changes panel
- All suppressed when input/textarea/contenteditable is focused
- Only fire when toolbar is expanded (not collapsed)

**Visually verified:** Screenshot shows panel with 2 entries (completed + needsInfo), Claude button with badge, correct styling matching dark glass aesthetic.

**Additional iteration (ralph loop):**
- Auto-reload on `status: completed` (1.5s delay for toast visibility)
- MarkerColor live update on Claude button via `_updateClaudeBadge` call in `_syncPromptModeColor`
- Verified: auto-reload triggers, history persists across reload, Claude button reappears with correct badge count

**Phase 3: Element highlights**
- `_highlightChangedElements`: finds elements by selector, draws markerColor border + glow box-shadow
- Change pills above elements showing property: newValue
- Pulse animation (2 cycles), fades out after 1.2s, removes after 1.6s
- Respects `prefers-reduced-motion` (skips animation)

**Phase 4: Live CSS preview**
- `_previewChanges`: injects CSS changes via PreviewEngine constructable stylesheets
- User sees changes instantly before page reload
- Reload delay bumped to 2s to show both preview and highlights

**Accessibility:**
- `prefers-reduced-motion` media query in toolbar stylesheet: disables all animations/transitions
- `focus-visible` rings on all buttons using `--improv-marker` CSS variable (follows markerColor)
- CSS variable updated in `updateModeButtonStyles` when markerColor changes

**Files touched:**
- improv/core/changes-panel.ts (new)
- improv/core/index.ts (all phases wired)
- improv/core/toolbar.ts (reduced motion, focus rings, --improv-marker CSS var, _collapsed public)
- improv/core/annotate/index.ts (fixed imports: selection -> element-utils)

**Ralph loop iteration 2:** Fixed TypeScript errors (_collapsed private, annotate imports), added Q shortcut for queue panel, bumped auto-reload to 2s. All 4 phases + all design principles verified in browser screenshot.

**Ralph loop iteration 3:** Fixed all remaining TypeScript errors (0 errors excluding adapters). Production build passes (215KB). Agent worktree cleaned up. SKILL.md reviewed - watch loop procedure, activation, tools table all complete.

**Final verified state:**
- 0 TypeScript errors (core, excluding adapters)
- Production build: 215KB minified
- Dev build: deployed to ~/.claude/improv/dist/
- MCP server: rebuilt with improv_respond, running on localhost:9223
- Browser: prompt mode activates, response chain stores+toasts+highlights, Claude button+panel work, keyboard shortcuts work, localStorage persists across reload
- SKILL.md: watch loop instructions ready for Claude Agents
- Spec: all items checked, committed at docs/superpowers/specs/2026-05-13-improv-claude-loop-design.md
- 6 commits pushed to remote for this feature

**Ralph loop iteration 4:** Interactive feature testing. Done button: marks entry reviewed=true, persists to localStorage, removes Claude button when all reviewed. Reply button: opens inline input with placeholder, markerColor focus border. Both verified with clean state + screenshot.

**Ralph loop iteration 5:** End-to-end prompt mode UI verified on dish-playscapes.lndo.site.

**Ralph loop iteration 6:** Polish - panel slide animation, Claude button entrance + pulse.

**Ralph loop iteration 7:** Production build deployed (216KB minified). Full verification.

**Ralph loop iteration 8:** Phase 4 completion - diff arrows + revert button.

**Ralph loop iteration 9:** Regression audit of earlier session fixes post-reconstruction. All survived: toolbar width transition + overflow, close button absolute positioning (right:5px top:50%), tooltip fixed position outside toolbar, screen glow 1.2s fade with brightness pulse (not opacity), prefers-reduced-motion + focus-visible in adopted stylesheet. Production build 217KB deployed and verified.
