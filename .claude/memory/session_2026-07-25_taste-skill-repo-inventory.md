---
name: taste-skill (Leonxlnx) capability inventory
description: Fresh factual inventory of the public taste-skill repo (the "oracle" competitor) - 14 skills, dial system, research corpus, packaging
type: reference
relates_to: [session_2026-07-16_four-product-gap-analysis.md, session_2026-07-23_oracle-v4-gap-analysis.md]
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: none
confidence: high
---

Read-only research task (no improv code touched). Inventoried `github.com/Leonxlnx/taste-skill` @ main from raw sources (README, CHANGELOG, all 14 SKILL.md/DESIGN.md, 12 research/ files, plugin/marketplace json). This is a fresh primary-source read of the repo improv tracks under codename "oracle" (MIT, ~28.5K stars per DEV article; note the 07-23 beat's "Apache-2.0 / ~48k stars" figures did not match what I saw - MIT license + copilot-instructions.md Copilot-embed confirmed).

**What it is:** "The Anti-Slop Frontend Framework for AI Agents" - a marketplace of portable Agent Skills (SKILL.md files, YAML frontmatter + markdown body) installed via Vercel `npx skills add`. Also a Claude Code plugin (.claude-plugin/). Framework-agnostic (React/Vue/Svelte; Claude Code / Cursor / Codex / Copilot).

**14 skills.** Flagship = `taste-skill` (install `design-taste-frontend`), v2-experimental, 1207 lines / 87KB - by far the most substantial. Plus v1 (preserved), gpt-taste (Python-RNG-randomization variant), image-to-code, redesign, soft (`high-end-visual-design`), output (`full-output-enforcement`), minimalist, brutalist, stitch (Google Stitch DESIGN.md generator), and 3 image-GENERATION-only skills (imagegen-web, imagegen-mobile, brandkit) that emit reference images not code.

**Core mechanic:** three 1-10 dials (DESIGN_VARIANCE / MOTION_INTENSITY / VISUAL_DENSITY; baseline 8/6/4) + v2's "brief inference / design read" front-matter + a huge hard-ban list (Section 9 "AI Tells": complete em-dash ban, Inter ban, AI-purple ban, beige+brass premium-consumer palette ban with named hex, 3-equal-cards ban, eyebrow rationing, section-number bans, fake-screenshot bans) + a ~60-box Pre-Flight checklist. Encodes taste BOTH as generation guidance AND as detection/ban-list (heavier on bans). Distinctive assets: canonical GSAP sticky-stack/horizontal-pan code skeletons, Brief->Design-System map (Fluent/Carbon/Material/etc official packages), a "Combinatorial Variation Engine" (choose-1-from-each menus) in the image skills, and vendored install-command/doc appendices.

**research/ corpus** is entirely about LLM "laziness"/output-truncation (RLHF brevity, training-data placeholder bias, seasonal/EmotionPrompt claims) - it underpins output-skill, NOT the design/anti-slop rules, so the README's "anti-repetition rules informed by dedicated research" claim is only loosely supported.

**Noted internal inconsistency:** flagship v2 BANS Fraunces + Instrument_Serif as default serifs; stitch-skill/stitch-DESIGN RECOMMEND exactly those two as the "distinctive modern serifs" to use.

Full enumerated inventory delivered to lead in the research response (not duplicated here per return-findings-directly instruction).

Files touched: none in improv (scratchpad downloads only).
