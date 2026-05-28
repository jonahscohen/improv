---
name: Multi-task response batching
description: Claudebar waits for all batch responses before transitioning to Review Changes
type: project
relates_to: [session_2026-05-13_improv-punchlist.md]
---

Implemented multi-task response batching so Send All waits for ALL responses before showing "Review Changes".

Changes:
- Added `_pendingResponses: number = 0` property to ImprovCore class (line 43 of index.ts)
- Modified `improv_response` handler to decrement `_pendingResponses` and only call `_claudeToReview()` when count reaches 0; individual response highlights/previews still fire per-response
- Set `_pendingResponses = 1` before single sends: Reply handler (setOnReply), Revert handler (setOnRevert), and submitPrompt in prompt/index.ts
- Set `_pendingResponses = this._changeQueue.length` before the Send All loop in prompt/index.ts
- submitFromQueue does NOT set _pendingResponses (the caller sets the batch count)
- No `location.reload()` was found to remove

Collaborator: Jonah

Files touched:
- improv/core/index.ts (property, response handler, Reply handler, Revert handler)
- improv/core/prompt/index.ts (submitPrompt, Send All handler)

Note: Other agents were concurrently modifying index.ts (added retry/timeout logic, _lastPromptData, improv_working handler). Edits were coordinated around those changes.
