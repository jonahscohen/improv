---
name: Improv changes panel punchlist
description: 8 bugs and UX issues from user testing - Claude icon, pulse, filtering, done/revert/clear, before/after diff
type: project
relates_to: [session_2026-05-13_improv-changes-panel.md]
---

**Punchlist from user testing (2026-05-13):**

1. **Claude icon**: Replace sparkle SVG with actual Claude logo from Lobehub. Color: Claude brand color (#D97757 or similar). Note: add to design skills that Lobehub is first source for AI company icons.

2. **Claude button pulse**: Remove notification badge. Button pulses when unreviewed changes exist. No badge number needed.

3. **Filter non-actionable responses**: Only show entries where status is `completed` (has changes) or `needsInfo` (has question). Omit entries with no changes AND no question - Claude's editorial summaries with no actionable content are noise.

4. **Done button broken**: Clicking "Done" doesn't remove from queue or visually change. The `markDone` callback may not be firing, or the panel isn't re-rendering after state change.

5. **Click snaps to top**: Clicking an item in the changes list scrolls to top instead of staying in place. The `render()` call rebuilds the entire list, resetting scroll position.

6. **Before/after toggle**: When a task completes and page refreshes, the highlight flashes briefly then disappears. User needs a way to toggle before/after on completed changes - see the old vs new values and visually compare on the page. The property pills show diffs but there's no interactive toggle.

7. **Revert broken**: Clicking Revert does nothing visible. The PreviewEngine may not be attached, or the revert applies old values to a constructable stylesheet that isn't active.

8. **Clear done UX**: "Clear done" is weird language, positioned wrong. Move to bottom bar of panel, rename to "Clear Completed Tasks". Rename "Done" button to "Mark Done" within each entry.

**All items fixed:**
- Claude icon: Lobehub SVG, #D97757, pulse animation, badge removed
- Panel: filter non-actionable, scroll preservation, markDone/revert visual feedback, labels renamed, bottom bar, before/after toggle with Preview button
- Preview toggle wired to PreviewEngine in ImprovCore
- Send All fix: submitPrompt checked live selection (empty after queue). Added submitFromQueue that uses stored elements from queue items.
- Revert: now sends a push_prompt with revert instructions (selector + oldValue) instead of useless PreviewEngine CSS override. Shows "Revert requested" toast.
- markDone root cause: panel held stale array reference + duplicate promptIds. Fix: markDone delegates to ImprovCore callback which marks ALL matching entries on _changeHistory, then re-syncs panel with live array via show().
- Panel auto-closes (slide+fade) when no actionable entries remain
- Claude button moved INTO the toolbar pill (was standalone floating element). Shows/hides via setClaudeButtonVisible. Active state: solid #D97757 bg + white icon. Hover: #D9775720 tint. Only visible when unreviewed changes exist.
- Numbered task circles: #D97757 bg, white number, replaces green dots
- Element highlighting: clicking task entry highlights matching DOM elements with #D97757 border + selector tooltip, rAF tracking follows scroll
- Clear dismisses UI: clearing all tasks removes panel + Claude button
- Detail subpage: clickable list items open drawer-style detail view with back button, file-grouped diffs (red strikethrough old, green new), monospace
- Diff stats: replaced property pills with compact +N -N stats (green/red)
- Removed Show Changes / Hide Changes / Preview buttons
- Keybinds: panel shortcuts (J/K/D/R) skip when Cmd/Ctrl/Alt held so CMD+R etc work
- Custom scrollbar: thin 6px, rgba(255,255,255,0.15) thumb, transparent track
- Custom typefaces: ImprovSans/Serif/Mono served from localhost:9223/fonts/
- Claude button in queuebar when prompt mode active. When prompt mode off but unreviewed changes exist from localStorage, a queuebar-styled pill appears at bottom-left with just the Claude button. Removed when prompt mode activates (its pill takes over) or when all changes cleared.
- markDone isolation: only marks first unreviewed entry with matching promptId, not all
- Undo Done button on reviewed entries, wired to set reviewed=false + re-sync
- Button hover states: #D97757 bg + #1a1a1a text on all panel buttons
- Task number text color: #1a1a1a (was white)
- Postmortem: completed by agent, written to docs/superpowers/specs/2026-05-13-improv-postmortem.md
- Design skill note saved to feedback_ai_icons_lobehub.md
- Claude button restyled: 44x44, #1a1a1a bg, border + shadow matching toolbar "I" button, hover=#D9775715 (subtle orange warmth on dark, matches toolbar hover intensity), active=solid #D97757 + white icon
