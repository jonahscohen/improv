---
name: second-fix-gate exempts global project memory dir
description: Added regex to second-fix-gate.sh so writes under ~/.claude/projects/<project>/memory/ no longer trip the stacked-fix warning
type: project
relates_to: []
---

Collaborator: Jonah (jonahscohen@gmail.com)

Task: T-0004 from TASKS.md.

Problem: second-fix-gate.sh's EXEMPT substring list contained `.claude/memory/`,
`MEMORY.md`, `.claude/hooks/`, `.claude/skills/`. The check was
`any(e in file_path for e in EXEMPT)`. Global project memory writes target
`~/.claude/projects/<project>/memory/foo.md`, which contains
`.claude/projects/<project>/memory/` - NOT `.claude/memory/`. So those writes
were treated as code fixes and tripped the stacked-fix gate. Self-fired today.

Fix: Added `import re` and a new `EXEMPT_REGEX = re.compile(r"\.claude/projects/[^/]+/memory/")`,
combined with the existing list via OR. Regex is intentionally narrower than a
blanket `.claude/projects/` substring exemption because the session UUID
`.jsonl` transcripts live as siblings of the `memory/` subdir and we don't want
to over-exempt writes to those.

Files touched:
- claude/hooks/second-fix-gate.sh

Side note (NOT fixed, out of T-0004 scope): the gate fires on edits to the
source hook file in this dotfiles repo (`claude/hooks/...`) because EXEMPT
looks for `.claude/hooks/` and the source path is `claude/hooks/` without the
leading dot. The symlinked install copy lives at `~/.claude/hooks/` and would
match. Worth filing as a follow-up if it's annoying enough.

Team-lead actions (Jonah, 2026-05-27, hook-sweep team):
- Verified t4-exempt-paths' fix by reading claude/hooks/second-fix-gate.sh:50.
- Marked T-0004 done in TASKS.md.
- Filed the side-note as T-0006 in TASKS.md (P3): EXEMPT looks for `.claude/hooks/` with leading dot but source path is `claude/hooks/`, so dotfiles-repo hook edits trip the gate.
