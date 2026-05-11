<!-- claude-dotfiles:memory-discipline:begin -->
## Memory Discipline (MANDATORY - NO EXCEPTIONS)

### Session Startup - Memory Loading Order

At the start of every session, you MUST load and absorb project memory in this strict priority order before doing anything else:

1. **Project root memory** (`<project-root>/.claude/memory/`) - Read MEMORY.md index, then read every file referenced in it. This is the canonical source of truth for what has been done, what decisions were made, and what the current state of the project is. Absorb all of it. Do not skim. Do not summarize from the index alone. Read the actual files.
2. **Global project memory** (`~/.claude/projects/<project-path>/memory/`) - Secondary context. Read if present.
3. **Git history** - Tertiary. Use only to fill gaps not covered by memory files.
4. **Anything else** - Supportive only. Never prioritize over the above.

When a user asks "what did we work on last?" or any question about prior work, the answer comes from project root memory files first. Not git log. Not guessing. Not the startup script's git status. The memory files ARE the record.

This system exists so that Claude can be opened on multiple machines sharing the same repo and retain shared context. The memory files are the cross-session, cross-machine continuity layer. Treat them as such.

When a memory file has `relates_to` entries, Claude may follow those links to read related files if actively investigating a topic. This is a judgment call, not automatic - do not traverse links at session startup or during routine loading. When a memory has `superseded_by` set, treat it as historical; the superseding memory is the current truth.

### Memory Writes Are Pre-Approved (NEVER ASK PERMISSION)

You have full, standing, durable permission to write, edit, and delete files anywhere under any `.claude/memory/` directory and any `~/.claude/projects/<...>/memory/` directory. This permission is encoded in `~/.claude/settings.json` (twenty-plus explicit allow patterns plus `defaultMode: bypassPermissions`) AND restated here so there is no ambiguity.

You MUST NEVER:
- Ask "should I save this to memory?" or any variation. Memory updates are required, not optional.
- Pause to confirm before writing a session memory file. Just write it.
- Treat memory writes as a "risky action" or apply the confirmation-first rule from the system prompt to them. They are explicitly exempted.
- Phrase memory work as a question to the user.

If a permission prompt or confirmation step somehow surfaces during a memory write, treat that as a configuration bug, not a question to the user. Do the write anyway and flag the bug at the end of your response so the user can fix the harness.

### Per-Task Memory Updates - The Hard Rule

Memory updates are mandatory after every single discrete change. Not per-feature. Not per-session. Not "when I get around to it." Per-task. Every time.

The moment a fix is verified, a component is added, a bug is resolved, a style is tweaked, a copy change lands - before responding to the user, before moving to the next thing - update the relevant session memory file in `<project-root>/.claude/memory/` with what was just done.

One line per change is fine. The discipline is in the frequency. Batching is a failure mode. If a session ends unexpectedly, every completed task must already be recorded. There is no "I'll save it all at the end." There is no end - there is only now.

What counts as a task (non-exhaustive):
- A CSS fix (even a one-line specificity bump)
- A copy change
- A component created or modified
- A bug identified and resolved
- A refactor or approach change
- An architectural decision made
- A dependency added or removed

If you did something and it works, it goes in memory before anything else happens. This has been corrected multiple times. It is a hard rule, not a best practice. Violating it is a failure.

### Write-Time Link Check

When creating or updating a memory file, perform a three-step write:

1. **Write the memory file** with the full frontmatter schema, including relationship fields if relationships are known.
2. **Update MEMORY.md** index with a one-line pointer (unchanged from current protocol).
3. **Link check** - scan the MEMORY.md index (already in context) for memories sharing the same topic area. If a clear relationship exists, add the filename to `relates_to`. If this memory replaces an older one, set `supersedes` and update the old file's `superseded_by`.

What counts as a meaningful relationship (link when):
- The related memory describes a decision that led to this work
- The related memory describes a prior attempt at the same problem
- The related memory documents a rule or constraint that applies to this work
- The related memory is the plan that this session implements

Do NOT link when:
- "Both are about the same project" (too broad)
- "Both happened on the same day" (temporal proximity is not a relationship)
- The connection is trivially obvious from the names alone

The link check scans one-line MEMORY.md descriptions, not full file contents. Only additional reads happen if updating an old file to add `superseded_by`.

### Memory File Format

- One session file per day per topic: `session_YYYY-MM-DD_<topic>.md`
- Use the standard frontmatter format with optional relationship fields:

    ---
    name: {{memory name}}
    description: {{one-line description}}
    type: {{user, feedback, project, decision, reference}}
    relates_to: {{[file1.md, file2.md] - optional, memories sharing topic/context}}
    supersedes: {{file.md - optional, if this memory replaces an older one}}
    superseded_by: {{file.md - optional, if this memory has been replaced}}
    ---

- `relates_to` is a list (0-N entries). `supersedes` and `superseded_by` are single values. All three are optional.
- When writing `supersedes: X`, also update file X to add `superseded_by: this_file.md`. Keep both ends in sync.
- `relates_to` is NOT symmetric by default. Only add back-links when genuinely bidirectional.
- Filenames are relative to the same memory directory (just `filename.md`, no paths).
- Most memories should have 0-2 `relates_to` entries. More than 3 means you are linking too broadly.
- List changes as they happen, one line each
- Record key technical decisions with "Why:" rationale and "How:" approach summary, so reviewers understand both the reasoning and the mechanics
- List files touched at the bottom
- Update `MEMORY.md` index when creating new session files

### Extended Memory Types

The system provides four base memory types: user, feedback, project, reference. The following additional type is available:

**`decision`** - Architectural choices, approach selections, and resolved trade-off debates.

| Field | Value |
|---|---|
| When to save | When a trade-off is resolved, an approach is selected over alternatives, an architecture question is answered, or a design debate concludes. Not every small choice - only ones where there were meaningful alternatives and the reasoning matters for future work. |
| How to use | When facing a similar decision, check for existing decision memories. The Alternatives and Why sections tell you whether the original reasoning still holds or whether conditions have changed enough to revisit. |

Body structure for `decision` memories:

    Choice made (what was decided).

    **Alternatives considered:**
    - Option A: rejected because [reason]
    - Option B: rejected because [reason]

    **Why this one:** [reasoning for the chosen approach]

    **Revisit when:** [conditions that would invalidate this decision]

The key distinction from `project`: a project memory says "X is happening" or "X is true right now." A decision memory says "we chose X over Y and Z, for these reasons." Project memories describe state; decision memories describe choices. Decision memories are long-lived (the reasoning persists even after the state changes).
<!-- claude-dotfiles:memory-discipline:end -->
