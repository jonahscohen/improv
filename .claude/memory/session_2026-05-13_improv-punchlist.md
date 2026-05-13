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
- Design skill note saved to feedback_ai_icons_lobehub.md
- Claude button restyled: 44x44, #1a1a1a bg, border + shadow matching toolbar "I" button, hover=orange 20% tint, active=solid #D97757 + white icon
