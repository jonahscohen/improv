---
name: improv_working server acknowledgment signal
description: replaced fake 2s setTimeout with real server-side improv_working broadcast for sending-to-working transition
type: project
---

## Changes (Jonah, 2026-05-16)

- Added `improv_working` broadcast in `server/mcp-tools.ts` push_prompt handler - server sends acknowledgment to browser clients immediately after receiving a prompt, before Claude processes it
- Added `improv_working` event listener in `core/index.ts` - transitions Claudebar from "sending" to "working" state when server acknowledges receipt
- Removed all 5 fake 2-second setTimeout timers that previously handled the sending-to-working transition:
  - 2 in `core/index.ts` (reply and revert handlers)
  - 3 in `core/prompt/index.ts` (submitPrompt, submitFromQueue with no elements, submitFromQueue with elements)
- User also added `_pendingResponses` counter on ImprovCore to track multiple in-flight prompts and only transition to review when all responses arrive

## Files touched
- improv/server/mcp-tools.ts
- improv/core/index.ts
- improv/core/prompt/index.ts
- Deployed: mcp-tools.js, ws-server.js, improv-core.js to ~/.claude/improv/dist/
