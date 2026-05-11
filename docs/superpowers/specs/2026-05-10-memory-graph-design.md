# Memory Graph: Relationship Links and Extended Categorization

**Date:** 2026-05-10
**Status:** Design approved, pending implementation
**Scope:** Global CLAUDE.md (all projects, all machines)

## Problem

The `.claude/memory/` system stores memories as flat markdown files connected only by a one-line MEMORY.md index. Relationships between memories (this session implements that plan, this feedback led to that hook, this decision supersedes that older approach) exist in prose but are invisible to the system. Claude can't navigate from one memory to related ones without reading file contents and recognizing references by name.

Additionally, the current four memory types (user, feedback, project, reference) conflate distinct categories. `project` holds both facts about state ("merge freeze starts Thursday") and resolved trade-offs ("we chose X over Y because Z"). `feedback` holds both corrections and validated approaches. The most important missing distinction is between observations and decisions.

## Inspiration

Graph-native memory architectures track entity, temporal, semantic, and causal links between memory units. These approaches typically require infrastructure (graph databases, LLM extraction pipelines, in-memory processing). This design borrows the structural concepts while keeping the zero-infrastructure constraint: git-tracked markdown files, no services, no APIs, no billing.

## Design Decisions

### Approach: Frontmatter-Only Graph

Relationships are stored as optional fields in each memory file's YAML frontmatter. No new files, no new indexes, no separate graph structure.

**Alternatives considered:**
- Separate GRAPH.md index file mapping relationships explicitly. Rejected: two-file maintenance creates sync drift.
- Clustered MEMORY.md with indented sub-entries showing relationships. Rejected: maintenance burden scales with file count and cross-cutting memories require arbitrary clustering decisions.
- Combined frontmatter + clustered MEMORY.md. Rejected: maximum maintenance overhead for marginal discoverability gain.

**Why frontmatter-only:** Zero context cost increase at session start. Relationship data is colocated with the content it describes. MEMORY.md format stays unchanged. The graph is implicit (reconstructed by reading files when needed) rather than explicit, which matches the navigational-only loading decision.

### Loading: Navigational Only

Relationship links are metadata that helps Claude find related context when it's already looking at a memory. No automatic traversal. No hop-following at session start. Zero additional context cost.

**Why:** The user's primary concern is context budget. Auto-traversal (even one-hop) multiplies the number of files read at session start. Navigational-only means relationships are free until used, and even then the cost is bounded by Claude's judgment about which links to follow.

### Categorization: Add `decision` Type

Five types: user, feedback, project, decision, reference. The `decision` type captures architectural choices, approach selections, and resolved trade-off debates that were previously lumped into `project`.

**Why a new type instead of subtypes:** A `project` memory says "X is happening." A `decision` memory says "we chose X over Y for these reasons." The body structure is fundamentally different (decisions need Alternatives/Why/Revisit sections). A subtype field wouldn't enforce that structural difference.

### Migration: Lazy, Not Big-Bang

Existing memories are NOT bulk-updated. New memories use the full schema from day one. Existing memories gain relationship fields via touch-and-update: when Claude encounters a memory during normal work and notices an obvious relationship, it adds the fields at that point.

**Why:** Bulk migration would mean reasoning about relationships between 78+ files without the original context. The resulting links would be lower quality than ones made during actual work. The system works fine with a mix of linked and unlinked files.

## Extended Frontmatter Schema

### Current

```yaml
---
name: string
description: string
type: user | feedback | project | reference
---
```

### Proposed

```yaml
---
name: string
description: string
type: user | feedback | project | decision | reference
relates_to: [filename.md, ...]      # optional
supersedes: filename.md              # optional
superseded_by: filename.md           # optional
---
```

### Relationship Types

| Field | Cardinality | Meaning | When to use |
|---|---|---|---|
| `relates_to` | List (0-N) | Thematic/topical connection | Memories that share a topic, are part of the same effort, or provide context for understanding this memory |
| `supersedes` | Single | This memory replaces the target | Updated/corrected information that makes the target outdated |
| `superseded_by` | Single | This memory has been replaced by the target | Marks a memory as historical; the target is the current truth |

### Rules

1. `relates_to` is a list; `supersedes` and `superseded_by` are single values.
2. When writing `supersedes: X`, also update file X to add `superseded_by: this_file.md`. Keep both ends in sync.
3. `relates_to` is NOT symmetric by default. File A can relate to B without B relating back. Only add back-links when the relationship is genuinely bidirectional.
4. Filenames are relative to the same memory directory. No paths, just `filename.md`.
5. Most memories should have 0-2 `relates_to` entries. Occasionally 3. More than 3 means you're linking too broadly.
6. `supersedes` / `superseded_by` should be rare. Most memories add to the record; they don't replace older ones.

### What Counts as a Meaningful Relationship

Link when:
- The related memory describes a decision that led to this work
- The related memory describes a prior attempt at the same problem
- The related memory documents a rule or constraint that applies to this work
- The related memory is the plan that this session implements

Do NOT link when:
- "Both are about the same project" (too broad)
- "Both happened on the same day" (not a relationship)
- The connection is trivially obvious from the names alone

## The `decision` Memory Type

### Definition

| Field | Value |
|---|---|
| Type name | `decision` |
| What it captures | Architectural choices, approach selections, resolved trade-off debates |
| Body structure | Choice made, then **Alternatives considered:**, then **Why this one:**, then **Revisit when:** |
| When to save | When a trade-off is resolved, an approach is selected over alternatives, an architecture question is answered, or a design debate concludes. Not every small choice - only ones where there were meaningful alternatives and the reasoning matters for future work. |
| How to use | When facing a similar decision, check for existing decision memories. The Alternatives and Why sections tell you whether the original reasoning still holds or whether conditions have changed enough to revisit. |

### Example

```yaml
---
name: Frontmatter-only relationship graph
description: Chose frontmatter fields over separate graph index for memory relationships
type: decision
relates_to: [session_2026-05-10_memory-graph-design.md]
---

Relationships between memory files are stored as frontmatter fields
(relates_to, supersedes, superseded_by) rather than a separate graph
index file.

**Alternatives considered:**
- Separate GRAPH.md index file: rejected because two-file maintenance
  creates sync drift
- Clustered MEMORY.md with indentation: rejected because maintenance
  burden scales with file count

**Why this one:** Zero context cost increase. Relationship data
colocated with content. Navigational-only loading means the implicit
graph (reconstructed by reading files) is sufficient.

**Revisit when:** Memory count exceeds ~200 files and navigating by
opening individual files becomes impractical. At that point, a
computed index might be worth the maintenance cost.
```

### Distinction from `project`

| | `project` | `decision` |
|---|---|---|
| Captures | State, facts, ongoing work | Choices between alternatives |
| Tense | "X is happening" / "X is true" | "We chose X over Y" |
| Body | Fact, Why, How to apply | Choice, Alternatives, Why this one, Revisit when |
| Shelf life | Decays fast (state changes) | Long-lived (reasoning persists) |
| Value | Know what's happening now | Know why things are the way they are |

## Write-Time Linking Protocol

Updated memory write protocol (current two-step becomes three-step):

### Step 1: Write the memory file

Write the memory file with the full frontmatter schema, including relationship fields if relationships are known at write time.

### Step 2: Update MEMORY.md

Add a one-line pointer to MEMORY.md. Format unchanged.

### Step 3: Link check

Before finishing, scan the MEMORY.md index for memories that share the same topic area. The index contains one-line descriptions of every memory and is already in context.

- If a clear relationship exists (same feature, same problem, evolution of the same idea), add the filename to `relates_to` in the new memory's frontmatter.
- If this memory replaces an older one, set `supersedes` and update the old file's `superseded_by`.
- Apply the 0-2 density guideline. Don't link broadly.

### Context cost of the link check

Minimal. Claude already has MEMORY.md in context. The scan is against one-line descriptions, not full file contents. Only additional file reads happen if Claude needs to update an old file to add `superseded_by`.

## Navigational Loading Behavior

When Claude reads a memory file and sees `relates_to` entries:

- If Claude is actively investigating a topic and the related memory would provide useful context, it may read the related file. This is a judgment call, not automatic.
- If Claude is just loading session context at startup, it does NOT follow links. The relationship metadata is noted but not traversed.

When Claude reads a memory with `superseded_by` set:

- Treat the memory as historical. The superseding memory is the current truth.
- If Claude needs the current version, read the superseding file instead.

## CLAUDE.md Changes Required

1. **Type list**: Add `decision` to the type enum in the `<types>` block. Add a new `<type>` element with name, description, when_to_save, how_to_use, body_structure, and examples.
2. **Frontmatter template**: Add `relates_to`, `supersedes`, `superseded_by` as optional fields with inline comments explaining each.
3. **Write protocol**: Add Step 3 (link check) after the current Step 2. Include meaningful-relationship criteria and density guideline.
4. **Navigational loading**: Add paragraph to "When to access memories" about following relationship links when actively investigating, and treating superseded memories as historical.
5. **No other changes**: MEMORY.md format, loading protocol, exclusion rules, and all existing type definitions remain unchanged.

## What This Design Does NOT Include

- No graph database or query engine
- No automatic relationship extraction via LLM
- No cross-source integration (Slack, Notion, etc.)
- No temporal versioning beyond what's already in filenames
- No full-graph visualization or traversal tools
- No changes to MEMORY.md format or auto-loading behavior
- No bulk migration of existing memories

These are deliberate scope exclusions, not oversights. Each could be revisited as the system matures.

## Success Criteria

1. New memories created after implementation include relationship fields when relationships exist.
2. Claude can navigate from one memory to related ones via frontmatter links during active investigation.
3. Decision memories are distinguishable from project memories by type and body structure.
4. Context cost at session start is unchanged (zero increase).
5. Existing memories continue to work without modification.
6. The MEMORY.md index stays under 200 lines.
