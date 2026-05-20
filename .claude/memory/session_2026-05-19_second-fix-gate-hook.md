---
name: Second-fix gate hook built
description: PostToolUse hook that detects stacked fixes on the same area without verification between them; addresses reflection finding #3
type: project
relates_to: [reflection_2026-05-19.md, session_2026-05-19_sending-to-claude-flash.md, feedback_hooks_evolve_over_time.md]
---

# Second-fix gate hook

Operationalizes finding #3 of `reflection_2026-05-19.md`. Today's three-bug session was the proof-of-need: Fix B landed on `improv/server/ws-server.ts` only minutes after Fix A on the same code path, before any external probe confirmed Fix A worked. Fix B made the symptom worse because the underlying root cause (missing WSS handler) was still hidden.

## How it works

PostToolUse hook on `Write|Edit|MultiEdit`. Reads tool input JSON via env-passed heredoc (avoids the apostrophe/quoting issues hitting verify-before-done.sh today).

On each invocation:

1. Skip if tool is not Write/Edit/MultiEdit or no file path.
2. Skip if file path is exempt (`.claude/memory/`, `MEMORY.md`, `.claude/hooks/`, `.claude/skills/`). Memory writes and hook edits are not fixes.
3. Check conditions for "second fix":
   - `~/.claude/.last-fix-file` exists
   - `~/.claude/.needs-verification` exists
   - last-fix file mtime is within 600s
   - current file path matches previous OR shares the same directory
4. If all hold, emit `additionalContext` with the lesson text + the two file paths + a 3-step instruction to run an external probe before shipping.
5. **Always** rewrite `~/.claude/.last-fix-file` with the current path and refresh its mtime. The 10-minute window is self-clearing - no separate clear hook needed.

## Edge cases handled

- `.needs-verification` not set -> no warn (verification gate already cleared, fix #2 is fine).
- Different directory -> no warn (unrelated work).
- Memory/hook/skill paths -> exempt, also do not seed `.last-fix-file` (so writing memory between two real fixes does not silently reset the gate).
- 10+ min gap -> mtime check fails, no warn (slow deliberate work is not stacked debugging).
- First edit of a session -> no `.last-fix-file` yet, no warn.

## Files touched
- claude/hooks/second-fix-gate.sh (new)
- ~/.claude/hooks/second-fix-gate.sh (symlink to source)

## Settings.json wiring (NOT yet applied - orchestrator will do this)

Add to the existing `Write|Edit|MultiEdit|Bash|Read` PostToolUse block, AFTER `memory-nudge.sh` and `verify-before-done.sh`:

```json
{
  "type": "command",
  "command": "~/.claude/hooks/second-fix-gate.sh",
  "timeout": 5
}
```

Precedence rationale: this hook reads `.needs-verification` (which `verify-before-done.sh` sets in the same fire). Running second-fix-gate AFTER verify-before-done means it sees the fresh state. The matcher is broader than needed (`Bash|Read` will fire too) but the script short-circuits on tool name early - cost is negligible.

If we prefer a tighter matcher to avoid wasted invocations, add a new block:

```json
{
  "matcher": "Write|Edit|MultiEdit",
  "hooks": [
    {
      "type": "command",
      "command": "~/.claude/hooks/second-fix-gate.sh",
      "timeout": 5
    }
  ]
}
```

## Smoke tests (all passing)

7 scenarios verified:
- fresh run, no flags -> {}
- same file, flags set -> warning emitted
- same dir different file, flags set -> warning emitted
- different dir -> {}
- memory path (exempt) -> {}
- needs-verification not set -> {}
- window expired (faked old mtime) -> {}

## Collaborator
Jonah
