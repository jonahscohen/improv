---
name: Claudebar timeout and retry
description: Added 60s timeout and retry functionality to the Claudebar in improv core
type: project
relates_to: []
---

## Task
Implement timeout and retry for the Claudebar. When Claude doesn't respond within 60 seconds, the pill transitions to a "Retry Send" state with a redo icon, pulsing glow, and click-to-retry behavior.

## Changes (complete)
- Added `_claudeTimeout: number | null` and `_lastPromptData: any` class properties
- Added `'retry'` and `'retrying'` to `_claudeState` union type
- `_showClaudeBar` starts 60s timeout; fires `_claudeToRetry()` if state is still sending/working/retrying
- `_claudeToRetry()`: clears dots interval, cancels sprite anim, swaps to Lucide redo SVG (18x18 stroke-based, M21 7v6h-6 + arc path), sets label "Retry Send", adds claudebar-glow animation, makes pill clickable
- `_retryClaudeBarClick()`: transitions to "Retrying..." state with shimmer sprite and animated dots, re-sends `_lastPromptData` via transport, starts new 60s timeout
- `_claudeToWorking` clears timeout (response progression received)
- `_claudeToReview` clears timeout (Claude responded)
- `_removeClaudeBar` clears timeout on removal
- All 5 `push_prompt` call sites store prompt data in `_lastPromptData` before sending:
  - index.ts: setOnReply, setOnRevert
  - prompt/index.ts: submitPrompt, submitFromQueue (zero elements), submitFromQueue (with elements)
- `_loadClaudeState` handles 'retry' and 'retrying' on page reload (restores retry state)

## Collaborator
Jonah

## Files touched
- improv/core/index.ts
- improv/core/prompt/index.ts
