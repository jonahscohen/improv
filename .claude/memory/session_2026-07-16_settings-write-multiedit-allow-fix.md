---
name: settings.json Write()/MultiEdit() allow rules warn - consolidated to Edit()
description: Claude Code now honors ONLY Edit(path) permission rules for file-editing tools (Edit covers Write+Edit+MultiEdit); standalone Write()/MultiEdit() allow entries are ignored and emit a startup warning. Removed the 18 redundant entries; kept the 9 Edit() twins. Lossless.
type: project
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: tests
confidence: high
---

Jonah flagged a MAJOR ISSUE: `claude` startup in the ppai project printed 18 warnings of the form `Permission allow rule (.../.claude/settings.json): Write(**/*.md) is not matched by file permission checks - only Edit(path) rules are. Use Edit(**/*.md) instead (Edit rules cover all file-editing tools).` - one Write() + one MultiEdit() warning for each of the 9 beat-write memory patterns.

**Root cause (what changed):** Claude Code changed its permission model so that a file-editing permission rule is matched ONLY when written as `Edit(path)`, and an `Edit(path)` rule now covers ALL three file-editing tools (Write, Edit, MultiEdit). Standalone `Write(path)` / `MultiEdit(path)` allow entries are no longer honored and are warned about at startup. Our `~/.claude/settings.json` (mirrored in the dotfiles `claude/settings.json`) carried the beat-write allowlist as triples - `Write(X)` + `Edit(X)` + `MultiEdit(X)` for each of the 9 memory patterns (30 allow entries: 9 Write + 9 MultiEdit + 9 Edit + 3 Bash/mcp).

**Fix (lossless):** deleted the 9 `Write()` + 9 `MultiEdit()` allow entries; kept the 9 `Edit()` twins (which already existed and now grant identical access across all file-editing tools). Verified the Write-set == MultiEdit-set == Edit-set BEFORE deleting (so nothing was lost). allow-list: 30 -> 12 (9 Edit + Bash x2 + mcp__pencil). Applied to BOTH the live `~/.claude/settings.json` AND the dotfiles source `claude/settings.json`; both re-validated as JSON with 0 Write/0 MultiEdit remaining.

**Why:** removes the startup warning noise on every session across every project, with zero change to effective permissions (Claude Code already ignored the Write/MultiEdit entries). This is exactly what the validator's own message recommended ("Use Edit(...) instead").

**How to apply:** the beat-write allowlist should be written as `Edit(<glob>)` ONLY going forward - never add `Write(...)` or `MultiEdit(...)` permission entries again; `Edit` covers all file-editing tools.

**Second finding (flagged, NOT yet fixed):** `~/.claude/settings.json` is currently a REGULAR FILE (mode -rw-------), NOT a symlink to the dotfiles `claude/settings.json`, contradicting the CLAUDE.md Permission Posture note ("propagate through the dotfiles symlink"). The two are content-identical right now (I patched both), but they will DRIFT again unless re-symlinked. There is also an untracked `claude/settings.json.pre-standingby-unregister.bak` in the main checkout, suggesting prior hand-surgery on settings.json (likely when the live symlink got replaced by a real file). Re-establishing the symlink was left as a separate decision for Jonah - it risks clobbering any machine-specific drift, and the files being identical now means there is no urgency.

Files: claude/settings.json (dotfiles source, committed to main), ~/.claude/settings.json (live, patched identically - not version controlled).
