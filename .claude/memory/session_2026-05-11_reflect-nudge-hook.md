---
name: reflect-nudge SessionStart hook implementation
description: Created SessionStart hook that nudges user when memory accumulation exceeds threshold
type: project
relates_to: [session_2026-05-11_reflect-skill-created.md, session_2026-05-11_reflect-design.md]
---

Task 2 of reflect feature plan completed.

## What was done

Created `claude/hooks/reflect-nudge.sh` - a SessionStart hook that:
- Counts new .md files in `.claude/memory/` since last reflection (tracked via `~/.claude/last-reflect-timestamp`)
- Returns empty JSON `{}` on first run (creates timestamp, no nudge yet)
- Returns `additionalContext` nudge when NEW_COUNT >= REFLECT_THRESHOLD (default 15)
- Nudge message: "{count} new memories since your last reflection. Worth taking a look?"

## Implementation details

- Follows existing SessionStart hook pattern (voice-mandate.sh, others)
- Uses find with `-newer` flag to identify files since last reflection
- Excludes MEMORY.md index from count
- Configurable via `REFLECT_THRESHOLD` env var
- Uses SESSION_CWD (set by harness) or falls back to pwd

## Testing

- Verified hook returns `{}` on first run (creates timestamp file)
- Tested with 20 synthetic memory files + REFLECT_THRESHOLD=5: correctly returned nudge with count
- Cleaned up test files, moved to /tmp instead of rm

## Commits

- 3e5ac76: feat: add reflect-nudge SessionStart hook

## Files touched

- claude/hooks/reflect-nudge.sh (created, executable)
