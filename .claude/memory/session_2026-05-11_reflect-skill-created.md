---
name: Reflect skill file created
description: claude/skills/reflect/SKILL.md written with full multi-agent corpus analysis spec
type: project
relates_to: [session_2026-05-11_reflect-design.md]
---

Created `claude/skills/reflect/SKILL.md` - the core skill file for the reflect feature.

**What was written:**
- Frontmatter with name, description, and trigger phrases
- Step 1: scope determination (project vs --all)
- Step 2: corpus assembly with token budget logic (80k token cap, truncation rules)
- Step 3: 5 parallel agent prompts (Pattern Hunter, Tension Detector, Gap Analyst, Drift Tracker, Decision Archaeologist)
- Step 4: synthesis agent prompt with weave-don't-concatenate instruction
- Step 5: persistence (reflection_YYYY-MM-DD.md, MEMORY.md update, timestamp file)
- Step 6: present to user + speak summary if voice active

**Files touched:**
- claude/skills/reflect/SKILL.md (created)
