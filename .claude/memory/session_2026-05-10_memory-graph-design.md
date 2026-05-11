---
name: Memory graph design session
description: Designed relationship links and decision type for the memory system, inspired by graph-native memory architectures
type: project
---

## What

Brainstormed and spec'd enhancements to the `.claude/memory/` system inspired by graph-native memory architectures. Three features designed:

1. **Relationship graph via frontmatter** - three new optional fields: `relates_to` (list), `supersedes` (single), `superseded_by` (single). Zero new files, zero context cost increase at session start.
2. **New `decision` memory type** - captures architectural choices with structured body: Choice, Alternatives considered, Why this one, Revisit when. Splits the most important distinction out of `project` type.
3. **Write-time linking protocol** - three-step write process (write file, update MEMORY.md, link check against index). 0-2 link density guideline.

## Key decisions

- **Frontmatter-only approach** over separate GRAPH.md or clustered MEMORY.md - zero infrastructure, data colocated with content
- **Navigational-only loading** - relationships are metadata for when Claude is actively investigating, not auto-traversed at session start
- **Lazy migration** - existing 78+ memories NOT bulk-updated; gain relationship fields via touch-and-update during normal work
- **Write-time discovery only** - no retroactive scanning passes
- **Five types total**: user, feedback, project, decision, reference

## Current status

- Design spec written and approved: `docs/superpowers/specs/2026-05-10-memory-graph-design.md`
- Implementation plan written: `docs/superpowers/plans/2026-05-10-memory-graph.md`
- Task 1 DONE: `decision` type subsection inserted into `~/.claude/CLAUDE.md` after Memory File Format section (before `<!-- claude-dotfiles:memory-discipline:end -->`)
- Task 2 DONE: Memory File Format subsection rewritten with relationship fields
- Task 3 DONE: Write-Time Link Check subsection inserted between Per-Task Memory Updates and Memory File Format
- Task 4 DONE: Navigational loading paragraph added to Session Startup section (relates_to traversal, superseded_by handling)
- Task 5 DONE: Final verification passed - subsection ordering correct, markdown balanced, all content matches spec
- Implementation complete. Pending: commit

## Files touched

- `docs/superpowers/specs/2026-05-10-memory-graph-design.md` (new - design spec)
- `docs/superpowers/plans/2026-05-10-memory-graph.md` (new - implementation plan)
- `~/.claude/CLAUDE.md` (Tasks 1-4: Extended Memory Types, relationship fields, write-time link check, navigational loading)
- `claude/memory-discipline-section.md` (repo source synced with live CLAUDE.md changes)
