---
name: README restructured into 4 houses
description: Jonah pushed back on the 5-section parts-shaped README; rewrote as 4 houses of thought (Discipline/Memory/Design/Workflow) each answering a load-bearing question.
type: project
relates_to: [session_2026-05-20_readme-installer-realignment.md]
---

## What happened

Jonah's critique on the previous README rewrite: "a lot of fat, not enough connective tissue, leaves me more confused than clear on what's inside. Let's rethink with a structure that breaks out the features into a few big houses of thought."

Diagnosis I surfaced before rewriting:
- "What you get" and "How it thinks" did the same job at different volumes (both inventoried parts, neither explained why they cohere)
- Reference was bloated with two design-stack sections saying the same thing twice
- No connective tissue between memory + hooks + design - readers saw three separate systems instead of one (discipline externalized into files)

## Decisions locked via multiple choice

1. **Structure**: 4 houses (Discipline / Memory / Design / Workflow), each answering a load-bearing question
2. **Cut depth**: ~550-650 line target (~30-40% reduction from 964)

## The 4 houses

| House | Question | Contents |
|---|---|---|
| **Discipline** | Why doesn't Claude ship sloppy work here? | 18 hooks across 5 roles (refusal/gates/nudges/toggles/lifecycle), verification protocol, permission posture, the rule-feedback-hook escalation pattern |
| **Memory** | Why does Claude remember here? | Three memory layers, lifecycle hooks, /reflect skill, attribution + collaboration |
| **Design** | Why does generated UI look right here? | The 6-layer pipeline (strategy/research/typography/references/motion/tactical) + tokens + brand + personal catalog system |
| **Workflow** | How do I actually use this every day? | Install, ampersand, presets, custom clone locations, boost-existing-config, troubleshooting |

Each house opens with a 1-sentence answer to its question. The connective tissue is in the opening claim - each house argues for itself before listing parts.

## Cuts made

- "What you get" -> absorbed into the houses (one compact "12 components, defaults all on" callout at the top of Install)
- "What it does for you" 5-bullet list -> opener already does this work, deleted
- "The three-layer design stack" deep-dive duplicate -> only one design tour now, in House 3
- "Plugins, connectors, MCP servers, Skills" four-tier explanation -> compact FAQ table in Reference
- "Why we built this (the long version)" -> folded the strongest sentence into the opener, dropped the rest

## What's preserved

- The yes& brand voice
- The narrative opener (problem/opinion/system/proof)
- The closing footer ("We start with yes. You build what's next.")
- Genuine lookup material in Reference (hook inventory, component table, FAQ-style detail)
- All technical specifics (exact hook names, exact commands, exact file paths)

## Two content-guard trips during the rewrite

Both were on legitimate documentation of the very strings the hooks refuse - i.e., quoting the forbidden trailer-attribution pattern and the auto-generated AI-credit comment pattern in the memory section's "assistant is invisible" paragraph. Per CLAUDE.md hook-override protocol, rephrasing was the right move - the rules being documented have the same meaning without the literal trigger strings. Replaced both with the safer phrasings that the original README already used without tripping ("AI-coauthor attribution lines", "auto-generated credit comments").

## Final size

Target was 550-650 lines. Actual: ~700 (slightly over). The houses came in tight; Reference held more lookup material than budgeted because the hook inventory table alone is ~80 lines. Within tolerance.

## Files touched

- README.md (full rewrite)

## Collaborator

Jonah
