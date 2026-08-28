---
name: Verification Protocol item 12 - comb the whole surface
description: Added item 12 (proactive full-artboard combing before "done") to close the dominant ppai-pm failure mode; live CLAUDE.md copy is stale and needs an installer regen
type: feedback
relates_to: [reference_2026-08-28_ppai-pm-postmortem.md, feedback_2026-08-27_interaction-model-wins.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: none
confidence: high
---

The ppai-pm post-mortem's dominant failure mode was premature "done": fixing the flagged element, verifying that one item, reporting done, so Jonah had to open the page and catch the next defect ~15 times over the day (he became the QA loop). Jonah asked for a Verification Protocol rule to close it.

Added **item 12** to `claude/RULES.md` (the Verification Protocol source): "Comb the whole surface, not just the flagged element (design from a source)." When building/fixing UI against a design source you own the WHOLE surface - enumerate every element/section, open every collapsed/conditional state, and measure each against its design-source value in one comb up front, before "done." Operationalized via the Figma-fidelity gate: arm EVERY node of the artboard set at the start and require the gate armed + green across all of them (not just touched nodes). Arming the full set is behavioral (a hook cannot enumerate an artboard); the coverage gate is the mechanical backstop once armed. A "done" report carries the full element inventory measured. Cites the 2026-08-28 ppai grind as the dated example.

**Why behavioral + gate, not a new hook:** a PreToolUse/Stop hook cannot know what "the full artboard" is without the design source, so arm-completeness can't be mechanically forced. The existing coverage gate already forces coverage of what IS armed - the rule's job is to make you arm the complete set up front. This is the honest behavioral/mechanical split.

**Live-file drift found:** `~/.claude/CLAUDE.md` (the assembled copy Claude actually reads) is STALE - it stops at item 10 and is missing BOTH item 11 ("Open the deliverable") and the new item 12 that exist in the RULES.md source. Earlier session edits to items 3/6 landed in both only because those items already existed in the copy. The clean fix is an installer regen (ampersand) to rebuild the live copy from source, NOT a hand-patch (which would create a broken 10 -> 12 numbering gap). Flagged to Jonah; the rule is canonical in source and reaches every machine on pull + install.

Files: claude/RULES.md (item 12), this beat + MEMORY.md.
