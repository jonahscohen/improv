---
name: Hook system architecture doc written
description: Wrote decision_hook_system_architecture.md per reflection 2026-05-19 finding #4 - operational inventory, flag registry, precedence rules, duplications, override mechanism, new-hook recipe
type: project
relates_to: [reflection_2026-05-19.md, decision_hook_system_architecture.md]
---

# Hook system architecture doc

Per reflection finding #4 ("The hook layer has no inventory, no governance, no precedence doc"), wrote `.claude/memory/decision_hook_system_architecture.md` as a single-page operational reference.

## Contents

1. Hook inventory table (16 scripts; event, matcher, type, flag files, purpose).
2. Flag file registry (`.memory-dirty`, `.needs-verification`, `.screenshot-pending`, `.voice-enabled`, `.no-auto-resume`, `.voice-config`, `last-reflect-timestamp` - who sets/clears, what gates).
3. Precedence rules (within `bash-guard.sh`, across PreToolUse hooks on a Write call, SessionStart ordering).
4. Duplications: `validation-guard.sh` vs `bash-guard.sh` cmux-eval branch (6 patterns mirrored), legacy-model regex in two languages, attribution regex in two hooks, JSON-stdin boilerplate, toggle-script pattern, read-only command lists diverging between memory-nudge and verify-before-done.
5. Override mechanism (conversational, per-edit, no flag file).
6. Adding-a-new-hook checklist (8 steps).

## Surprise findings

- **Only 5 of 16 hooks are wired in `claude/settings.json`** (bash-guard, content-guard, memory-approve, voice-mandate via SessionStart, reflect-nudge). The other 11 (memory-nudge, verify-before-done, verify-clear, verify-manual, screenshot-*, validation-guard, voice-gate, voice-toggle, resume-*) exist on disk and are referenced by CLAUDE.md and prior memory, but the wiring is presumably in `settings.local.json` per-machine. This is the source-vs-installed drift called out in reflection finding #5.
- Memory-nudge does NOT include Read in its current matcher list in the repo's `settings.json` (the wiring isn't here at all), but the live session is clearly firing memory-nudge on Read - so the installed wiring includes Read in PostToolUse matcher. That's exactly the bug from finding #1.
- `is_read_only_command` lists in memory-nudge and verify-before-done have diverged: memory-nudge has `node -e`, `python3 -c`; verify-before-done does not.
- Voice subsystem has three hooks for one flag.

## Files touched

- `.claude/memory/decision_hook_system_architecture.md` (new)
- `.claude/memory/MEMORY.md` (added index entry)
- `.claude/memory/session_2026-05-19_hook-architecture-doc.md` (this file)

## Collaborator

Jonah
