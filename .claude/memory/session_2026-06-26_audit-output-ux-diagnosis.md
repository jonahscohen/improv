---
name: Audit output UX diagnosis - verbose JSON wall + flat panel, no progress
description: Jonah - the audit output is a mess: 232-line JSON wall before a static report, the progress panel buried + showing flat completed states, no indication of what's happening. Grounded the cause in the monitor + present + skill code.
type: project
relates_to: [session_2026-06-26_audit-command-rendered-wired.md]
---

Collaborator: Jonah. 2026-06-26. UX complaint, distinct from the engine correctness fixed earlier.

## WHAT JONAH SEES (verified by running it)
- DEFAULT `node sidecoach-monitor.js "/sidecoach audit localhost:4830"` -> 232 lines / 11.8KB
  of JSON.stringify(result). The panel is buried INSIDE as an escaped-ANSI string
  ([38;2;...). This is the "miles of mumbo jumbo."
- `--render` -> 16 clean lines (header, route/flow, verdict blocked/grade F/20 findings, next).
  The product surface exists but is gated behind a flag nobody passes.
- The panel shows FLAT completed states: `checklist 1/1`, `[done]`, gates all `✓`. It is built
  once from the FINAL result, so there is no progression - the whole audit is one synchronous
  call returning the end state.

## ROOT (grounded in code)
- sidecoach-monitor.js:110-114: `if (--render) render(result) else JSON.stringify(result)`.
  Default = the JSON wall. Comment says "Default stays JSON so the skill's programmatic
  parsing is untouched."
- SKILL.md:45,58,153 INTENT: parse the JSON for Claude's own use, PRINT ONLY `result.panel`
  verbatim to the user, "do the work quietly, surface the final panel." The session that
  upset Jonah did NOT follow this - it ran the monitor raw, so the JSON wall hit the transcript.
- The panel (panel-model.ts + panel-renderer.ts / present.js render()) renders a single final
  snapshot. For a one-shot verb there are no intermediate states; lanes print `.panel` after
  each advance (live), but a single audit = one flat panel.

## THE THREE GAPS
1. Verbosity: the visible output is the JSON wall, not the panel.
2. No progress: the multi-second render+scan runs silently; panel only appears at the end.
3. Flat panel: the panel shows completed states, not the audit progressing through its lenses
   (render -> objective a11y -> subjective taste -> verdict).

## SURFACE CONSTRAINT (matters for the fix)
When a Claude runs the monitor via the Bash tool, the transcript shows the FINAL captured
stdout - no live animation. So "progress" in that surface = a readable staged log/panel, not
a spinner. A real TTY can animate. The fix must degrade gracefully across both.

## NEXT
Asking Jonah for the target FEEL (his panel, his taste) before rebuilding - quiet final panel
vs. staged-progress panel vs. live streaming. Then: kill the JSON wall as the default visible
output (JSON opt-in / sidecar for Claude), and make the audit panel show its lens-by-lens
progression.

## Files (investigation)
- sidecoach/bin/sidecoach-monitor.js, sidecoach/bin/sidecoach-present.js,
  sidecoach/src/panel-model.ts + panel-renderer.ts, claude/skills/sidecoach/SKILL.md.
</content>
