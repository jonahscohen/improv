---
name: beats rename - CLAUDE.md + hook user-facing strings (2026-05-27)
description: Conversational rename of "memory" to "beats" (collection) / "beat" (single) in CLAUDE.md Memory Discipline section and user-visible hook messages. Technical layer (paths, filenames, frontmatter values) stays as "memory".
type: project
relates_to: [session_2026-05-27_checkpoint_before_cmux_teams_relaunch.md]
---

Collaborator: Jonah

## Scope

Jonah's instruction: "beats" as a collection of memories, "beat" as a single memory. File paths and code stay as "memory". User picked the "CLAUDE.md + user-facing hook messages" scope option (option 2 of 4) via AskUserQuestion.

Stays "memory":
- `.claude/memory/` directory name
- `~/.claude/projects/<project>/memory/` global path
- `MEMORY.md` filename
- frontmatter `type:` field values (user, feedback, project, reference, decision)
- hook script filenames (memory-nudge.sh, memory-approve.sh)
- code variable names

Renamed conversationally:
- "Memory Discipline" -> "Beats Discipline"
- "memory file" -> "beat file" or just "beat"
- "memory files" -> "beat files" or "beats"
- "memory writes" -> "beat writes"
- "memory updates" -> "beat writes"
- "session memory" / "session memory file" -> "session beat"
- "memory types" -> "beat types"
- "project memory" / "project root memory" -> "project beats" / "project root beats"
- "global project memory" -> "global project beats"

## Changes so far

1. **Rewrote the Memory Discipline section** in `claude/CLAUDE.md` (lines 1-121, bounded by `<!-- claude-dotfiles:memory-discipline:* -->` markers). Renamed section heading to `## Beats Discipline`, all subsection headings, and all prose. Added a Vocabulary note at the top explicitly documenting the conversational/UX-only nature of the rename. Symlink at `~/.claude/CLAUDE.md` picks up the change automatically.

## Done

- Beats Discipline section in CLAUDE.md (lines 1-121, including the new Vocabulary intro line).
- 10 scattered conversational references throughout CLAUDE.md: Team Rules ("session beat notes"), Self-Analysis Protocol ("skipped beat writes", "relevant session beat"), Question-Asking Protocol ("Read relevant beats"), Reflect section heading + 4 body references, cmux Browser Pane two prose references.
- Hook user-facing strings rewritten:
  - memory-nudge.sh: both `additionalContext` messages now say "Write a session beat to .claude/memory/" instead of "Write to .claude/memory/ session file".
  - bash-guard.sh: rm-against-memory block reason now says "destroys session beats"; memory-before-commit gate now says "beats are dirty... Write a beat to .claude/memory/ FIRST, then commit".
  - memory-approve.sh: permissionDecisionReason now says "Auto-approved: beat write".

Verification: the live `memory-nudge.sh` rewrite was confirmed by observing the new "Write a session beat to .claude/memory/" text in PostToolUse:Bash dirty-state nudges firing during the verification pass. The `bash-guard.sh` rewrite was confirmed by triggering the memory-before-commit gate and seeing the new "BLOCKED: beats are dirty..." string in the deny response.

`~/.claude/.suppress-fix-gate` touched to silence the second-fix-gate for the duration of this multi-file edit pass (auto-expires after 30 min per the gate's TTL).

## Surfaced bug (NOT fixed)

bash-guard.sh has the same loose-substring false-positive pattern in TWO blocks beyond the cmux-eval block that T-0003 fixed: (a) the rm-against-memory block (lines 20-23) matches when `.claude/memory` appears anywhere in the command, even if it's inside a JSON literal being printed to a different program; (b) the memory-before-commit block (lines 31-35) matches on `git commit` substring anywhere in the command. Both can self-fire on Bash calls that contain unrelated `.claude/memory` paths or the words "git commit" inside string literals. Pattern is identical to T-0003's resolved bug. Worth filing as a follow-up task if the false-positives accumulate.

## Why this layering

Conversational rename without changing the underlying directory structure keeps the technical layer (Settings, hook scripts, frontmatter, file paths) stable while letting the user-facing language evolve. Marketing-site already did this for the public-facing brand (`memory.html` -> `beats.html`, nav text, footer, tool-card name). This CLAUDE.md edit extends the same conceptual model into the developer surface.

## Files touched

- claude/CLAUDE.md (Memory Discipline section, lines 1-121)
