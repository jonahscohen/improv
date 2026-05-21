---
name: Memory scope check before every write
description: Before writing any memory file, ask "does this lesson apply to this project only, or to every project?" If every project, it's global memory and lives in the dotfiles repo, symlinked from ~/.claude/memory/.
type: feedback
---

Before writing any memory file, pause and ask: **does this lesson apply to this project only, or to every project?**

If "every project" - it's global memory. In this dotfiles setup, global memory means:

1. Write the file to `claude-dotfiles/claude/memory/<name>.md` (the canonical, portable version)
2. Symlink it from `~/.claude/memory/<name>.md` (the active location Claude reads at session start)
3. Index it in the global `claude-dotfiles/claude/memory/MEMORY.md` (which is itself symlinked to `~/.claude/memory/MEMORY.md`)

If "this project only" - write to `<project>/.claude/memory/` and index in that project's `MEMORY.md`.

**Why:** Lessons about how a tool works (`cmux open <file.md>`, `gh auth git-credential` for pushes, the `Promise.race` vs `Promise.any` distinction) apply to every project. Lessons about a specific project's state, surface IDs, or in-progress decisions apply only to that project.

Filing a universal lesson under a single project means every other project re-learns it from scratch - the lesson is invisible. Filing a project-specific note in global pollutes the corpus for unrelated work.

The 2026-05-20 cmux-markdown case was the trigger: a universal "cmux has a native markdown renderer, use it instead of installing grip" lesson got filed in claude-dotfiles project memory. Jonah caught it - other projects would have missed the lesson entirely and repeated the unnecessary grip install. The right home was global memory, in the dotfiles repo, symlinked.

**How to apply:** Run the scope check FIRST, before choosing the path. If the file would help a hypothetical different project Claude opens tomorrow, it's global. If it only makes sense for this project's current state or workstream, it's project memory. When in doubt, default to project (less polluting); the file can always be moved later via `mv` + `ln -s` + MEMORY.md index update.

Universal indicators (file globally):
- "How to use tool X" / "what command does Y"
- Behavioral rules ("never X", "always Y")
- Cross-project conventions (attribution, hook patterns, debugging method)
- Lessons learned about Claude Code, cmux, the harness, the model itself

Project-specific indicators (file in project memory):
- Surface IDs, ports, paths within this project
- Decisions about this project's architecture or in-flight work
- The state of an investigation or refactor
- Names of files, components, or systems unique to this project
