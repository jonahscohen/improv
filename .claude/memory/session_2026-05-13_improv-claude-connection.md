---
name: Improv prompt-to-Claude connection design
description: Architecture for connecting improv's browser prompt mode to Claude Code for action
type: project
relates_to: [session_2026-05-12_improv-pipeline-fix.md, session_2026-05-12_improv-source-reconstruction.md]
---

Investigating how to connect improv's prompt mode to Claude.

**Current flow (already built):**
1. User selects elements in browser, types a prompt
2. Browser sends `push_prompt` via WebSocket: `{context, prompt, elementCount}`
3. MCP server buffers in `pendingPrompts[]`
4. MCP tool `improv_get_prompts` returns buffered prompts (context + instruction + element count)
5. MCP tool `improv_watch` polls for new data with timeout

**The gap:** Claude doesn't know a prompt arrived. No push notification, no auto-trigger.

**Design decision:** Full cyclical loop. User stays in browser entirely. Spec written to docs/superpowers/specs/2026-05-13-improv-claude-loop-design.md

**Architecture:** Watch agent (Claude goal) polls improv_watch -> reads prompts -> makes code changes -> calls improv_respond -> server broadcasts to browser -> browser shows highlights/toast/change pills -> user sends next prompt

**Auto-refresh on completion:** Browser reloads page when `status: completed` arrives so user sees changes live. No reload for `needsInfo` (pulse button) or `failed` (show error). Change history persists via localStorage, survives reloads and HMR.

**Claude button + changes panel:** After Claude completes tasks, a Claude icon button appears in the queuebar. Clicking it opens a scrollable panel of all changes with Done/Reply per entry. Badge shows unreviewed count. needsInfo questions pulse the button.

**4 phases:** 
1. Watch + Act (MVP - Claude picks up prompts, makes changes, sends toast)
2. Browser Response UI (highlights, change pills, auto-reload)
3. Conversational Loop (chat panel, clarifying questions)
4. Live Preview (CSS injection before file write, apply/revert)

**Design principles added to spec:**
- Full keyboard navigation: P/M for modes, J/K for list nav, D/R for done/reply, Q/C for panels, focus trapping, focus return. All single-key shortcuts suppressed when input/textarea/contenteditable is focused.
- Accessibility: ARIA roles/labels/live regions on all elements, focus visible rings, prefers-reduced-motion
- Visual language: dark glass aesthetic codified, hit areas, transition timing, markerColor as sole accent, typography scale

**Files examined:**
- improv/core/prompt/index.ts:655-671 (submitPrompt - sends context + prompt + elementCount)
- improv/server/mcp-tools.ts:29-38 (push_prompt handler - buffers)
- improv/server/mcp-tools.ts:273-287 (improv_get_prompts tool - returns buffer)
- MCP SDK: sendLoggingMessage exists but requires active turn; improv_watch loop is the right model

**Spec committed:** 99bfb15 docs/superpowers/specs/2026-05-13-improv-claude-loop-design.md (258 lines)
**Status:** Spec complete, ready for implementation plan
