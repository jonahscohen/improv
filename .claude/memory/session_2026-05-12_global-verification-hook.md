---
name: Global verification hook
description: Rebuilt verify-before-done.sh as global enforcement - any code file change requires proof before claiming completion
type: project
relates_to: [reflection_2026-05-12.md, session_2026-05-11_improv-settings-active.md]
---

Rebuilt `claude/hooks/verify-before-done.sh` from narrow improv-deploy trigger to global code verification enforcement.

**Problem:** Verification protocol was advisory-only text in CLAUDE.md. The existing verify-before-done.sh only triggered on `cp` to 3 specific project deploy paths. Improv dist edits, file copies to ~/.claude/improv/, and all other code changes were unmonitored. This was the exact failure mode the reflect identified.

**What the hook now does:**
- Sets `~/.claude/.needs-verification` flag on ANY code file edit (Write/Edit/MultiEdit) matching CODE_EXTS (.js, .ts, .css, .html, .py, .sh, etc.)
- Sets flag on Bash commands that write/deploy (cp, mv, >, node build, npm run build, etc.)
- Clears flag when verification actually happens: cmux screenshot, curl localhost, or Read on an image file (.png/.jpg)
- Chrome MCP tool calls clear via existing `verify-clear.sh` (separate matcher)
- Exempt paths: .claude/memory/, .claude/hooks/, .claude/skills/, MEMORY.md
- bash-guard.sh already blocks `git commit` when the flag exists (pre-existing)

**Settings.json change:**
- PostToolUse matcher expanded from `Write|Edit|MultiEdit|Bash` to `Write|Edit|MultiEdit|Bash|Read` so the hook can detect screenshot reads and clear the flag

**Triggered by:** User frustration that improv settings button fix was reported done 3 times without browser verification. Reflect confirmed verification is the most important rule with zero mechanical enforcement.

**Files touched:**
- claude/hooks/verify-before-done.sh (rewritten, symlinked to ~/.claude/hooks/)
- ~/.claude/settings.json (PostToolUse matcher updated)
