# Reflect - Multi-Agent Memory Corpus Analysis

**Date:** 2026-05-11
**Status:** Design approved
**Author:** Jonah

## Overview

A skill that treats the accumulated `.claude/memory/` corpus as a dataset and runs multi-agent analysis against it to surface patterns, tensions, and gaps that no individual memory file captures. Built on the dotfiles stack's existing memory system, relationship graph, and hook infrastructure.

The goal is organizational self-awareness: "what do we collectively know that none of us individually noticed?"

## Entry points

Two ways to trigger reflection, neither requiring a slash command:

### Conversational trigger

The skill's description field carries broad natural-language triggers: "reflect", "what patterns", "what are we missing", "anything feel off", "what's emerging", "deep reflect", "analyze our memories." Claude recognizes the intent and runs the pipeline without the user switching to command syntax.

`/reflect` also works as a direct invocation for users who prefer explicit commands.

### Lifecycle nudge

A SessionStart hook (`reflect-nudge.sh`) counts new memory files since the last reflection. When the count exceeds a configurable threshold (default 15), Claude's session opener includes a one-line nudge:

> "15 new memories since your last reflection. Worth taking a look?"

Not blocking, not automatic. The user says yes and it runs, or no and it drops.

State is stored in a single file: `~/.claude/last-reflect-timestamp`. The hook compares `find -newer` against it. The nudge is injected via the SessionStart hook's stdout, which Claude Code surfaces in the session context the same way other SessionStart hooks (voice-mandate, resume-guard) deliver their messages.

## Corpus discovery

### Scope tiers

1. **Current project** (default) - `<project-root>/.claude/memory/`
2. **Global project memories** (opt-in) - `~/.claude/projects/*/memory/`

Default behavior is current-project-only. Pass `--all` or say "reflect across everything" to include global project memories.

### Assembly

The skill reads every `MEMORY.md` index in scope, then reads each referenced file. It extracts frontmatter and body content into a structured JSON array:

```json
[{
  "filename": "session_2026-05-10_memory-graph-design.md",
  "type": "project",
  "name": "Memory graph design session",
  "description": "Designed relationship links and decision type...",
  "relates_to": [],
  "supersedes": null,
  "superseded_by": null,
  "body": "...",
  "project_path": "/Users/x/project/.claude/memory/"
}]
```

Files marked `superseded_by` are included but flagged as historical. Analysis agents can use them for drift detection but don't treat them as current truth.

### Token budget

Before spawning agents, the skill estimates total corpus tokens. If the corpus exceeds 80k tokens:

1. Drop `superseded_by` file bodies (keep frontmatter only)
2. Truncate oldest memories to description-only
3. Never truncate recent memories or `decision` type memories

This leaves room for agent prompts and responses within context limits.

## Agent pipeline

### Step 1 - Corpus assembly (main agent)

The skill itself handles file I/O: reading MEMORY.md indexes, reading referenced files, building the JSON array. No sub-agent needed for this - it's fast sequential I/O.

### Step 2 - Parallel analysis (5 agents)

Five sub-agents spawn simultaneously via the Agent tool. Each receives the full corpus JSON and a specific analytical lens:

| Agent | Lens | Mandate |
|---|---|---|
| Pattern Hunter | Recurrence | Themes that repeat across sessions. Decisions that keep getting revisited. Approaches the team gravitates toward whether they name it or not. |
| Tension Detector | Contradiction | Rules that conflict with practice. Decisions in one project that contradict decisions in another. Feedback memories that push in opposing directions. |
| Gap Analyst | Absence | Topics with no decisions recorded. Areas where work happened but no reasoning was captured. Memory types that are underrepresented. |
| Drift Tracker | Evolution | How practices, preferences, and priorities shifted over time. Changes gradual enough that nobody noticed. |
| Decision Archaeologist | Staleness | Decisions whose "revisit when" conditions may have been met. Superseded memories never formally replaced. Assumptions that may no longer hold. |

### Agent output format

Each agent returns:

```json
{
  "lens": "pattern|tension|gap|drift|staleness",
  "findings": [
    {
      "title": "Short finding title",
      "evidence": ["filename1.md: relevant quote", "filename2.md: relevant quote"],
      "confidence": "high|medium|low",
      "so_what": "One sentence on why this matters and what it implies"
    }
  ]
}
```

3-7 findings per agent. Every finding must cite specific memory filenames as evidence. No general claims without grounding.

### Step 3 - Synthesis (1 agent)

A single synthesis agent receives all five finding sets and weaves them into a unified narrative. Instructions:

- Weave, don't concatenate. Five separate lists is a failure mode.
- Find connections between lenses. A pattern that the tension detector also flagged is more interesting than either alone.
- Rank findings by impact, not by lens.
- Surface open questions the team should discuss, not just statements.

### Step 4 - Artifact persistence

The reflection output saves to `<project-root>/.claude/memory/reflection_YYYY-MM-DD.md` with type `project`. Frontmatter:

```yaml
---
name: Reflection - YYYY-MM-DD
description: Multi-agent corpus analysis - patterns, tensions, gaps
type: project
---
```

`~/.claude/last-reflect-timestamp` updates to current time. MEMORY.md gets a new index entry.

## Output format

```markdown
# Reflection - YYYY-MM-DD

## Narrative
[2-4 paragraphs weaving the key insights together.
Not a summary of five agent outputs - a unified story.]

## Key findings
[Ranked by impact. Each with:]
- **Title**
- Evidence: [cited memory files]
- Confidence: high/medium/low
- Implication: [what this means for the team]

## Open questions
[Things the reflection surfaced but couldn't answer.
Prompts for the team to discuss.]

## Recommended actions
[Concrete next steps, if any emerged naturally.
Not forced - only if the evidence supports them.]
```

## Installation

New `reflect` component in the dotfiles installer (`install.sh`):

- Copies skill file to `~/.claude/skills/reflect/reflect.md`
- Adds SessionStart hook entry for `reflect-nudge.sh` to settings.json
- Copies `reflect-nudge.sh` to `~/.claude/hooks/`
- Creates `~/.claude/last-reflect-timestamp` if missing
- Included in the `minimal` preset (lightweight, no external deps)

## Configuration

- `REFLECT_THRESHOLD` env var: number of new memories before nudge fires (default 15)
- `--all` flag or conversational "across everything": includes global project memories
- No other configuration required

## What this does NOT include

- No web UI or dashboard
- No scheduled/cron runs (can layer on later as Approach C)
- No cross-machine sync beyond what git already provides
- No special permissions or infrastructure beyond the Agent tool
- No external API calls beyond what Claude Code already uses

## Dependencies

- Claude Code Agent tool (for parallel sub-agents)
- Existing memory system (MEMORY.md index, frontmatter schema, relationship graph)
- Existing hook infrastructure (SessionStart)
- Existing installer TUI
