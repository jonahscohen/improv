---
name: reflect
description: >
  Multi-agent memory corpus analysis. Invoke this skill when the task involves: "reflect", "what patterns",
  "what are we missing", "anything feel off", "what's emerging", "deep reflect",
  "analyze our memories", "what do you see across our work", "reflect on",
  "reflect across everything", "what themes", "what contradictions",
  "blind spots", "what changed over time", "decision archaeology".
  Also available as /reflect.
---

# Reflect - Memory Corpus Analysis

You have been asked to analyze the accumulated memory corpus. This skill orchestrates
a multi-agent pipeline that surfaces patterns, tensions, and gaps across all memory
files in scope.

## Step 1: Determine scope

Check what the user said:

- If they said "across everything", "all projects", or used `--all`: scan ALL memory directories (current project + global project memories at `~/.claude/projects/*/memory/`).
- Otherwise: scan only the current project's `.claude/memory/` directory.

## Step 2: Assemble the corpus

Read the `MEMORY.md` index in each in-scope memory directory. For each entry in the index, read the referenced file. Extract:

- `filename` (just the filename, no path)
- `type` (from frontmatter: user, feedback, project, decision, reference)
- `name` (from frontmatter)
- `description` (from frontmatter)
- `relates_to` (from frontmatter, list or empty)
- `supersedes` (from frontmatter, single or null)
- `superseded_by` (from frontmatter, single or null)
- `body` (everything after the frontmatter closing `---`)
- `project_path` (the memory directory this file came from)

Build a JSON array of these objects. This is the corpus.

**Token budget:** Estimate total corpus size. If it exceeds 80,000 tokens (~320,000 characters):
1. For files with `superseded_by` set: keep frontmatter fields only, drop body.
2. If still over budget: truncate the oldest files (by date in filename) to description-only, starting from the oldest. Never truncate files with type `decision` or files less than 30 days old.

## Step 3: Spawn 5 parallel analysis agents

Use the Agent tool to spawn all 5 agents simultaneously in a single message (so they run in parallel). Each agent receives the full corpus JSON and returns structured findings.

**Agent 1 - Pattern Hunter (recurrence)**

Prompt the agent:

> You are the Pattern Hunter. You analyze a corpus of memory files from a software team's
> Claude Code sessions. Your lens is RECURRENCE - themes, approaches, and decisions that
> repeat across sessions.
>
> Look for:
> - Themes that appear in 3+ separate memory files
> - Decisions that keep getting revisited (same topic, multiple dates)
> - Approaches the team gravitates toward repeatedly, whether they name it or not
> - Naming patterns, vocabulary, or framing that recurs
>
> Do NOT report:
> - Things that appear only once
> - Obvious structural patterns (like "they use session files" - that's the system, not a finding)
>
> Corpus (JSON array of memory files):
> [INSERT CORPUS JSON]
>
> Return your findings as a JSON object:
> ```json
> {
>   "lens": "pattern",
>   "findings": [
>     {
>       "title": "Short finding title",
>       "evidence": ["filename1.md: relevant quote or reference", "filename2.md: relevant quote"],
>       "confidence": "high|medium|low",
>       "so_what": "One sentence: why this matters and what it implies for the team"
>     }
>   ]
> }
> ```
> Return 3-7 findings. Every finding MUST cite specific filenames from the corpus as evidence.
> No general claims without grounding.

**Agent 2 - Tension Detector (contradiction)**

Prompt the agent:

> You are the Tension Detector. You analyze a corpus of memory files from a software team's
> Claude Code sessions. Your lens is CONTRADICTION - places where the team's stated rules,
> decisions, or practices conflict with each other.
>
> Look for:
> - Rules in feedback memories that contradict rules in other feedback memories
> - Decisions in one session that contradict decisions in another session
> - Stated preferences that conflict with observed practice (what they say vs what they do)
> - Feedback corrections that push in opposing directions
>
> Do NOT report:
> - Evolution over time (that's drift, not tension - a decision changing is not a contradiction)
> - Minor wording differences that mean the same thing
>
> Corpus (JSON array of memory files):
> [INSERT CORPUS JSON]
>
> Return your findings as a JSON object:
> ```json
> {
>   "lens": "tension",
>   "findings": [
>     {
>       "title": "Short finding title",
>       "evidence": ["filename1.md: relevant quote", "filename2.md: conflicting quote"],
>       "confidence": "high|medium|low",
>       "so_what": "One sentence: why this tension matters and what it implies"
>     }
>   ]
> }
> ```
> Return 3-7 findings. Every finding MUST cite specific filenames. No general claims.

**Agent 3 - Gap Analyst (absence)**

Prompt the agent:

> You are the Gap Analyst. You analyze a corpus of memory files from a software team's
> Claude Code sessions. Your lens is ABSENCE - what is NOT in the memory corpus that
> you would expect to find.
>
> Look for:
> - Topics where work happened (mentioned in session files) but no decisions were recorded
> - Areas with many session memories but zero feedback or decision memories
> - Memory types that are underrepresented (e.g., lots of project memories but few decision memories)
> - Relationships implied by content but not captured in relates_to fields
> - Topics where the team clearly has opinions (visible in feedback memories) but never formalized them as decisions
>
> Do NOT report:
> - Missing memories for things that obviously don't need them
> - Gaps that are explained by the project being new or small
>
> Corpus (JSON array of memory files):
> [INSERT CORPUS JSON]
>
> Return your findings as a JSON object:
> ```json
> {
>   "lens": "gap",
>   "findings": [
>     {
>       "title": "Short finding title",
>       "evidence": ["filename1.md: shows work happened", "observation: no decision memory exists for X"],
>       "confidence": "high|medium|low",
>       "so_what": "One sentence: why this gap matters and what should be captured"
>     }
>   ]
> }
> ```
> Return 3-7 findings. Ground every finding in specific corpus evidence.

**Agent 4 - Drift Tracker (evolution)**

Prompt the agent:

> You are the Drift Tracker. You analyze a corpus of memory files from a software team's
> Claude Code sessions. Your lens is EVOLUTION - how the team's practices, preferences,
> and priorities have shifted over time.
>
> Memory filenames contain dates (session_YYYY-MM-DD_topic.md). Use these to establish
> chronology.
>
> Look for:
> - Practices that were important early but disappeared from recent memories
> - New concerns or topics that emerged recently but weren't present before
> - Gradual shifts in approach, tooling, or methodology across sessions
> - Changes in what the team considers important enough to record as feedback or decisions
> - Scope expansion or contraction over time
>
> Do NOT report:
> - One-time events (a single session on a topic is not drift)
> - Intentional, documented pivots (if they wrote a decision memory about it, they noticed)
>
> Corpus (JSON array of memory files):
> [INSERT CORPUS JSON]
>
> Return your findings as a JSON object:
> ```json
> {
>   "lens": "drift",
>   "findings": [
>     {
>       "title": "Short finding title",
>       "evidence": ["early_file.md: shows old practice", "recent_file.md: shows new practice"],
>       "confidence": "high|medium|low",
>       "so_what": "One sentence: why this drift matters and whether it's intentional"
>     }
>   ]
> }
> ```
> Return 3-7 findings. Cite specific files with dates as evidence.

**Agent 5 - Decision Archaeologist (staleness)**

Prompt the agent:

> You are the Decision Archaeologist. You analyze a corpus of memory files from a software
> team's Claude Code sessions. Your lens is STALENESS - decisions and assumptions that
> may no longer hold.
>
> Look for:
> - Decision memories with a "Revisit when" clause whose conditions may have been met
>   (based on evidence elsewhere in the corpus)
> - Memories with superseded_by set to null that reference tools, patterns, or approaches
>   that appear to have been replaced (evidence in later session files)
> - Assumptions stated in older memories that are contradicted by facts in newer memories
> - Reference memories pointing to resources, tools, or processes that may no longer exist
>   or may have changed
> - Feedback memories whose corrections may no longer apply given subsequent changes
>
> Do NOT report:
> - Memories that are old but still accurate
> - Memories already marked with superseded_by (they're already handled)
>
> Corpus (JSON array of memory files):
> [INSERT CORPUS JSON]
>
> Return your findings as a JSON object:
> ```json
> {
>   "lens": "staleness",
>   "findings": [
>     {
>       "title": "Short finding title",
>       "evidence": ["old_decision.md: states X", "newer_session.md: shows X may no longer hold"],
>       "confidence": "high|medium|low",
>       "so_what": "One sentence: what should be revisited and why"
>     }
>   ]
> }
> ```
> Return 3-7 findings. Every finding must cite the stale memory AND the evidence for staleness.

## Step 4: Synthesize

After all 5 agents return, spawn one more agent with all five finding sets:

> You are the Synthesis Agent. You have received findings from 5 analysis agents that each
> examined the same memory corpus through a different lens. Your job is to weave their
> findings into a single, unified reflection.
>
> Rules:
> - WEAVE, don't concatenate. This is one narrative, not five sections.
> - Find connections between lenses. A pattern that the tension detector also flagged is
>   more interesting than either finding alone. A gap that explains a tension is insight.
> - Rank findings by IMPACT, not by which agent found them.
> - Surface open questions the team should discuss, not just statements.
> - Include concrete recommended actions only if the evidence naturally supports them.
>   Do not force recommendations.
>
> Finding sets:
> [INSERT ALL 5 AGENT OUTPUTS]
>
> Write the reflection in this format:
>
> ```markdown
> ## Narrative
> [2-4 paragraphs weaving the key insights together. Not a summary of five
> agent outputs. A unified story about what the memory corpus reveals.]
>
> ## Key findings
> [Ranked by impact. Each with:]
> - **Title**
> - Evidence: [cited memory files]
> - Confidence: high/medium/low
> - Implication: [what this means for the team]
>
> ## Open questions
> [Things the reflection surfaced but couldn't answer.
> Prompts for the team to discuss.]
>
> ## Recommended actions
> [Concrete next steps, if any emerged naturally.
> Not forced - only if the evidence supports them.]
> ```
>
> Write clearly and directly. No hedging. No filler.

## Step 5: Persist the reflection

1. Save the synthesis output to `<project-root>/.claude/memory/reflection_YYYY-MM-DD.md` with this frontmatter:

```yaml
---
name: Reflection - YYYY-MM-DD
description: Multi-agent corpus analysis - patterns, tensions, gaps synthesized into unified narrative
type: project
---
```

Prepend `# Reflection - YYYY-MM-DD` as an H1 before the synthesis content.

2. Update the project's `MEMORY.md` index with a new entry:
`- [Reflection (YYYY-MM-DD)](reflection_YYYY-MM-DD.md) - Multi-agent corpus analysis: patterns, tensions, gaps`

3. Update the timestamp file:
Run `touch ~/.claude/last-reflect-timestamp` via Bash.

## Step 6: Present to the user

Show the reflection output directly in the conversation. The saved file is for future reference; the user should see the results immediately.

If voice is active, speak a 1-2 sentence summary of the most impactful finding.
