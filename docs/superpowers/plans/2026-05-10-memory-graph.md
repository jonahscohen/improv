# Memory Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add relationship links and a `decision` memory type to the `.claude/memory/` system via CLAUDE.md edits.

**Architecture:** Four additions to the Memory Discipline section of `~/.claude/CLAUDE.md`: (1) a `decision` type definition, (2) relationship fields in the frontmatter schema, (3) a write-time link check protocol, (4) navigational loading guidance. All changes are markdown text edits to a single file.

**Tech Stack:** Markdown (CLAUDE.md configuration)

**Spec:** `docs/superpowers/specs/2026-05-10-memory-graph-design.md`

---

### Task 1: Add the `decision` Memory Type

**Files:**
- Modify: `~/.claude/CLAUDE.md` - insert after "Memory File Format" subsection (after line 290)

The system prompt defines four memory types (user, feedback, project, reference) in a `<types>` block that we cannot edit. We extend the type system by adding a new subsection to the Memory Discipline section in CLAUDE.md, which takes precedence over system defaults.

- [ ] **Step 1: Add the `decision` type subsection**

Insert the following after the "Memory File Format" subsection (after line 290, before the closing comment `<!-- claude-dotfiles:memory-discipline:end -->`):

```markdown
### Extended Memory Types

The system provides four base memory types: user, feedback, project, reference. The following additional type is available:

**`decision`** - Architectural choices, approach selections, and resolved trade-off debates.

| Field | Value |
|---|---|
| When to save | When a trade-off is resolved, an approach is selected over alternatives, an architecture question is answered, or a design debate concludes. Not every small choice - only ones where there were meaningful alternatives and the reasoning matters for future work. |
| How to use | When facing a similar decision, check for existing decision memories. The Alternatives and Why sections tell you whether the original reasoning still holds or whether conditions have changed enough to revisit. |

Body structure for `decision` memories:

```
Choice made (what was decided).

**Alternatives considered:**
- Option A: rejected because [reason]
- Option B: rejected because [reason]

**Why this one:** [reasoning for the chosen approach]

**Revisit when:** [conditions that would invalidate this decision]
```

The key distinction from `project`: a project memory says "X is happening" or "X is true right now." A decision memory says "we chose X over Y and Z, for these reasons." Project memories describe state; decision memories describe choices. Decision memories are long-lived (the reasoning persists even after the state changes).
```

- [ ] **Step 2: Verify the edit**

Run: `grep -n "decision" ~/.claude/CLAUDE.md`
Expected: Multiple hits showing the new type definition in the Memory Discipline section.

Run: `grep -c "Alternatives considered" ~/.claude/CLAUDE.md`
Expected: `1`

- [ ] **Step 3: Commit**

```bash
git add ~/.claude/CLAUDE.md
git commit -m "feat: add decision memory type to CLAUDE.md memory system"
```

---

### Task 2: Add Relationship Fields to Frontmatter Schema

**Files:**
- Modify: `~/.claude/CLAUDE.md` - update the "Memory File Format" subsection (around line 283-290)

- [ ] **Step 1: Extend the Memory File Format subsection**

Find the current "Memory File Format" subsection (line 283):

```markdown
### Memory File Format

- One session file per day per topic: `session_YYYY-MM-DD_<topic>.md`
- Use the standard frontmatter format (name, description, type: project)
- List changes as they happen, one line each
- Record key technical decisions with "Why:" rationale and "How:" approach summary, so reviewers understand both the reasoning and the mechanics
- List files touched at the bottom
- Update `MEMORY.md` index when creating new session files
```

Replace with:

```markdown
### Memory File Format

- One session file per day per topic: `session_YYYY-MM-DD_<topic>.md`
- Use the standard frontmatter format with optional relationship fields:

```yaml
---
name: {{memory name}}
description: {{one-line description}}
type: {{user, feedback, project, decision, reference}}
relates_to: {{[file1.md, file2.md] - optional, memories sharing topic/context}}
supersedes: {{file.md - optional, if this memory replaces an older one}}
superseded_by: {{file.md - optional, if this memory has been replaced}}
---
```

- `relates_to` is a list (0-N entries). `supersedes` and `superseded_by` are single values. All three are optional.
- When writing `supersedes: X`, also update file X to add `superseded_by: this_file.md`. Keep both ends in sync.
- `relates_to` is NOT symmetric by default. Only add back-links when genuinely bidirectional.
- Filenames are relative to the same memory directory (just `filename.md`, no paths).
- Most memories should have 0-2 `relates_to` entries. More than 3 means you are linking too broadly.
- List changes as they happen, one line each
- Record key technical decisions with "Why:" rationale and "How:" approach summary, so reviewers understand both the reasoning and the mechanics
- List files touched at the bottom
- Update `MEMORY.md` index when creating new session files
```

- [ ] **Step 2: Verify the edit**

Run: `grep -n "relates_to\|supersedes\|superseded_by" ~/.claude/CLAUDE.md`
Expected: Multiple hits showing the three new fields in the frontmatter template and rules.

Run: `grep -c "NOT symmetric" ~/.claude/CLAUDE.md`
Expected: `1`

- [ ] **Step 3: Commit**

```bash
git add ~/.claude/CLAUDE.md
git commit -m "feat: add relationship fields to memory frontmatter schema"
```

---

### Task 3: Add Write-Time Link Check Protocol

**Files:**
- Modify: `~/.claude/CLAUDE.md` - insert new subsection after "Per-Task Memory Updates" (after line 281)

- [ ] **Step 1: Add the link check subsection**

Insert the following after the "Per-Task Memory Updates - The Hard Rule" subsection (after line 281, before "Memory File Format"):

```markdown
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
```

- [ ] **Step 2: Verify the edit**

Run: `grep -n "Link Check\|link check\|three-step" ~/.claude/CLAUDE.md`
Expected: Hits showing the new subsection header and protocol description.

Run: `grep -n "^###" ~/.claude/CLAUDE.md | tail -10`
Expected: "Write-Time Link Check" appears between "Per-Task Memory Updates" and "Memory File Format".

- [ ] **Step 3: Commit**

```bash
git add ~/.claude/CLAUDE.md
git commit -m "feat: add write-time link check protocol to memory system"
```

---

### Task 4: Add Navigational Loading Guidance

**Files:**
- Modify: `~/.claude/CLAUDE.md` - extend the "Session Startup - Memory Loading Order" subsection (around line 248-250)

- [ ] **Step 1: Add navigational loading paragraph**

After the existing paragraph ending with "Treat them as such." (line 250), insert:

```markdown

When a memory file has `relates_to` entries, Claude may follow those links to read related files if actively investigating a topic. This is a judgment call, not automatic - do not traverse links at session startup or during routine loading. When a memory has `superseded_by` set, treat it as historical; the superseding memory is the current truth.
```

- [ ] **Step 2: Verify the edit**

Run: `grep -n "superseded_by\|navigat\|historical" ~/.claude/CLAUDE.md`
Expected: Hits in the Session Startup section showing the new guidance.

- [ ] **Step 3: Commit**

```bash
git add ~/.claude/CLAUDE.md
git commit -m "feat: add navigational loading guidance for memory relationships"
```

---

### Task 5: Final Verification

**Files:**
- Read: `~/.claude/CLAUDE.md` (full Memory Discipline section)

- [ ] **Step 1: Read the complete Memory Discipline section**

Run: `sed -n '/^## Memory Discipline/,/claude-dotfiles:memory-discipline:end/p' ~/.claude/CLAUDE.md`
Expected: The full section with all four additions visible and properly ordered:
1. Session Startup (with navigational loading paragraph)
2. Memory Writes Are Pre-Approved
3. Per-Task Memory Updates
4. Write-Time Link Check (new)
5. Memory File Format (with relationship fields)
6. Extended Memory Types (with decision type)

- [ ] **Step 2: Check section ordering**

Run: `grep -n "^###" ~/.claude/CLAUDE.md | grep -A20 "Memory"`
Expected: Subsections appear in the order listed above.

- [ ] **Step 3: Check for no broken markdown**

Run: `grep -c '```' ~/.claude/CLAUDE.md`
Expected: Even number (every opening fence has a closing fence).

- [ ] **Step 4: Squash into single commit (optional)**

If the user prefers a single commit instead of four incremental ones:

```bash
git reset --soft HEAD~4
git commit -m "feat: add relationship graph and decision type to memory system

Extends the memory system with three relationship fields (relates_to,
supersedes, superseded_by) in frontmatter, a new decision memory type
for architectural choices, a write-time link check protocol, and
navigational loading guidance. Zero context cost increase at session
start. Lazy migration - existing memories stay unchanged."
```

- [ ] **Step 5: Update session memory**

Update `.claude/memory/session_2026-05-10_memory-graph-design.md` to record implementation as complete.
