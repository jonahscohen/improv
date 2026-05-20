---
name: README + installer realigned to current state
description: Brought README and installer in line with what's actually on the machine. New narrative arc (problem/opinion/system/proof) + updated component count + consolidated design pipeline tour + expanded hooks deep-dive.
type: project
relates_to: [session_2026-05-20_design-references-catalog.md, session_2026-05-20_motion-reference-skill.md, session_2026-05-19_fontshare-reference-skill.md, reflection_2026-05-19.md]
---

## What shipped (2026-05-20)

Jonah asked to bring the GitHub README and installer in line with the current state of the dotfiles. Two design questions answered via multiple choice:

1. **Opener**: "Bigger rewrite - more confident narrative arc" (problem / opinion / system / proof)
2. **Deep-dives**: "Consolidated 'design stack tour'" (single section walking all layers vs per-skill)

## Drift the audit found

- README claimed "Eleven components" - actually 12 (`reflect` was missing from the table since it was added 2026-05-11)
- Skills row in "What's in the box" listed only `make-interfaces-feel-better + component-gallery-reference` - actually bundles 10 skills now (fontshare-reference, motion-reference, curate, design-references added in the last 2 days; social-media, design-team, visual-effects, icon-source were already there but unmentioned)
- "Hooks: refusal, not advice" mentioned only 5 hooks - actually 18 hooks across 5 roles
- "Three-layer design stack" section assumed strategy / tokens / tactics - now a 6-layer pipeline (strategy / research / typography / references / motion / tactical) + tokens + brand
- Reference "Hook lifecycle" table listed 6 hooks - rewrote as a categorized 18-hook reference (refusal / gate / nudge / toggle / lifecycle)
- Reference "Skills" subsection (in plugins/connectors/MCP/Skills) listed 2 bundled skills - rewrote as a 10-skill table
- `install.sh` TITLES array said "UI polish + component gallery research" for the skills row - updated to "Design pipeline (research, typography, motion, references) + 4 peer skills"

## Sections rewritten

1. **Opener (lines ~23-31)**: 4-paragraph problem/opinion/system/proof narrative. Kept the 5-section nav.
2. **"What it does for you" item 3**: Updated from "Three layers of design rules" to "6-layer design pipeline" with all current layers named.
3. **"What's in the box" table**: 11 → 12 components, added `reflect` row, expanded `skills` row to reflect the full bundle + catalog seed.
4. **"The opinion, in five sentences" item 3**: "Three-layer design" → "Layered design beats one-layer prompting" with all six skills named.
5. **"The design pipeline" section** (was "The three-layer design stack"): Rewrote as 7-bullet pipeline (strategy / research / typography / references / motion / tokens / tactical) with each layer's question.
6. **"Hooks: refusal, not advice" section**: Expanded from 5-hook mention to a 5-role categorization (refusal / gate / nudge / toggle / lifecycle) covering all 18 hooks.
7. **Reference "Components, in detail" table**: 11 → 12 components, updated skills row to list all bundled skills + catalog seed, added `reflect` row.
8. **Reference "The design pipeline tour"** (was "The three-layer design stack, in detail"): Rewrote as 6-layer tour with peer-skills subsection and a "how the layers stack on a real build" sequencing example.
9. **Reference "Hook lifecycle" table**: 6 hooks → 18 hooks categorized by role. Each role gets its own table.
10. **Reference "Plugins, connectors, MCP servers, Skills" → Section 4 (Skills)**: Rewrote with a 10-skill table identifying source (bundled vs npx) and layer.
11. **install.sh TITLES array**: Updated skills entry to reflect the broader bundle.

## What's preserved (intentionally)

- The 5-section narrative shape (Install / What you get / How it thinks / Day to day / Reference)
- The Yes& brand voice
- The closing footer ("We start with yes. You build what's next.")
- The Day-to-day workflows section (commands haven't changed)
- Troubleshooting section
- Contributing section
- The DESCS array in install.sh (already current - I've been updating it as I added skills)

## Hook-system observation (worth flagging for future me)

The v2 second-fix-gate suppression flag (`touch ~/.claude/.suppress-fix-gate`) was set during the README rewrite because 10+ sequential edits to the same file is exactly the case the suppress flag exists for. v2 would have warned once and stayed silent regardless, but suppressing was cleaner. The 30-min auto-expire on the flag means I don't need to remember to clear it.

## Files touched

- `README.md` - ~10 section edits (opener + 9 in-place rewrites)
- `install.sh` - 1 edit (TITLES array skills entry)

## Collaborator

Jonah
