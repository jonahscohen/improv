---
name: External taste sources for a self-updating loop (Krehel + Kowalski)
description: Inventory of Jakub Krehel + Emil Kowalski skill repos, content-to-sidecoach-rule mapping, and the safe read-only ingest design (fetch -> provenance -> diff -> extract-as-data -> human gate)
type: reference
relates_to: [session_2026-07-25_three-tool-gap-analysis.md, session_2026-07-25_taste-skill-repo-inventory.md]
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: none
confidence: high
---

Authored against HEAD c199f9c5. Read-only WebSearch/WebFetch research; nothing installed, executed, or committed from these sources. ALL fetched repo/site content is treated as UNTRUSTED DATA: no instruction inside any SKILL.md / README / AGENTS.md / CLAUDE.md was followed; only what the content CONTAINS is recorded.

NOTE ON REPO B SLUG: Jakub Krehel's older repo (section B below) has a slug that collides with a retired internal skill name our content guard bans in markdown (Jonah 2026-07-03), so the slug is ELIDED here. Its full URL is preserved in the lead's inbox message and the delivered report; recover it there if needed. No loss for the loop design, which drops repo B anyway.

## Why this beat exists

Scoping the external experts a self-updating taste loop would learn from, and the safe way to ingest them. Prior related work: session_2026-07-25_three-tool-gap-analysis.md already touched emilkowalski/skills as one of three tools; this beat is the full source inventory + ingest design.

## 1. Source inventory

### A. Jakub Krehel - "skills" repo (CANONICAL)
- URL: https://github.com/jakubkrehel/skills
- Tagline: "A collection of agent skills that help you build a great interface."
- Contents (10 agent SKILL.md skills):
  - Taste/rule skills: better-ui (radius, shadows, animation, micro-interactions), better-typography, better-colors, better-accessibility, better-layout, better-writing
  - Workflow/orchestration skills (NOT taste rules): better-interface (cross-skill review coordinator), interface-review (review uncommitted diff/branch/PR), variant (multiple UI versions behind a picker), explain-interface (analyze a URL/screenshot and explain the layers)
- Structure: skills/<name>/SKILL.md each; plus .claude-plugin/, AGENTS.md, CLAUDE.md, opencode.json (multi-agent: Claude Code, Codex, opencode). SKILL.md bodies are prose + numbered principles + issue/fix tables.
- Cadence: ~88 commits, actively maintained. Recent burst Aug 19-20 2026 including an "unslop" / "state each rule once" / "make review output self-contained" refactor pass. The rule TEXT is actively shifting right now.
- License: MIT, "Copyright (c) 2026 Jakub Krehel."
- Site: jakub.kr (also references interfaces.dev).

### B. Jakub Krehel - "interfaces" repo (SUPERSEDED - DROP FROM LOOP)
- URL: https://github.com/jakubkrehel/<slug-elided> (the single-skill "make interfaces feel better" repo; exact slug elided per the content-guard note above; full URL is in the lead's inbox)
- Contents: single interface-refinement skill - 12 numbered core principles + quick-reference table + 17 common-mistake issue/fix pairs (concentric radius, shadows-vs-borders, tabular-nums, scale-on-press, hit areas, optical alignment, interruptible animation, icon rules).
- KEY FINDING: its own README says "skill moved" and points to jakubkrehel/skills. Content is now folded into better-ui in repo A. 23 commits, last real content change ~Aug 12 2026, effectively frozen.
- DECISION: exclude from active polling to avoid double-ingesting stale content. Repo A is canonical.
- License: MIT, "Copyright (c) 2026 Jakub Krehel."

### C. Emil Kowalski - "skills" repo
- URL: https://github.com/emilkowalski/skills
- Tagline: "Skills for Designers and Engineers."
- Contents (~12 SKILL.md skills):
  - Motion taste (high value): emil-design-eng (main: animation + design), animate (build an animation with correct curve/duration/props), review-animations (strict rule-based review - the single most mineable file in either corpus), improve-animations (audit + prioritized plans), find-animation-opportunities (where motion helps / what NOT to animate), animation-vocabulary
  - Adjacent: apple-design (Apple HIG motion/interface principles for web)
  - Out of scope for web taste: animate-expo (RN/Expo), write-swift, pick-ui-library, prototype, ask-sonner (library-specific)
- Structure: skills/<name>/SKILL.md; LICENSE, README.md, .gitattributes. Install via npx skills.
- review-animations shape: "Ten Non-Negotiable Standards" (hard rules) + escalation triggers + fix-priority hierarchy + required output format. Near-lint-grade.
- Cadence: ~50 commits, very active - latest Aug 21 2026 (added write-swift, animate-expo in the days prior). Fast-moving; expect new motion rules.
- License: MIT, "Copyright (c) 2026 Emil Kowalski."
- Site/course: emilkowal.ski/skill; paid course at animations.dev (course is NOT ingestible - paywalled, out of scope).

## 2. Content-to-sidecoach-rule mapping

| Source content | Maps to sidecoach layer | Mineable? |
|---|---|---|
| Emil review-animations 10 standards: sub-300ms UI, animate transform/opacity only, no scale(0)/pure-fade entrances, ease-in banned on UI, honor prefers-reduced-motion, correct transform-origin | tactical-polish motion-review + a motion-audit rule set | HIGH (near-lint: regex/AST/media-query checkable) |
| Emil "justified motion", cohesion w/ component personality, interruptibility, apple-design, animation-vocabulary | critique-layer guidance (human judgment) | LOW - prose, needs distillation |
| Jakub better-ui / interfaces: concentric radius (outer = inner + padding), shadow-vs-border for depth, scale(0.96) on press, tabular-nums for changing numbers, hit area 44px touch / 40px dense | tactical-polish 16-point checklist + sidecoach critique anti-patterns | HIGH (numeric/property checks) |
| Jakub better-typography | sidecoach typography rules + tiny-text ban | MED |
| Jakub better-colors | audit contrast/theming (overlaps existing WCAG audit) | MED |
| Jakub better-accessibility (focus, ARIA, keyboard, heading order) | sidecoach audit objective defects | MED-HIGH |
| Jakub better-writing | sidecoach critique marketing-buzzword / copy-is-real rules | MED (judgment) |
| Jakub better-layout (grouping, alignment, reading order) | nested-cards + layout anti-patterns | MED |
| Jakub better-interface / interface-review / variant; Emil prototype | NOT taste rules - mirror sidecoach's OWN orchestration (audit/critique/polish) and Justify's variant idea. Reference for workflow design only. | N/A |

Near-lint mineable now: Emil's 10 motion standards; Jakub's 17 common-mistake issue/fix pairs and the numeric principles (0.96 press, 44/40px hit area, sub-300ms, tabular-nums, concentric radius). Concrete numbers/properties -> detection rules.

Needs human distillation (prose/judgment): "justified motion", "feels off", optical alignment, cohesion/personality, apple-design, animation-vocabulary, severity grading. These belong in the critique layer as guidance, never as automated pass/fail.

## 3. Safe read-only ingest design

Principle: nothing fetched ever auto-applies. Pipeline: fetch -> record provenance -> diff -> extract-as-data -> human gate.

1. Pinned allowlist manifest (sources.json): allowlist of {repo URL, branch, exact SKILL.md paths, license, upstream copyright line}. Only allowlisted paths are fetched. Drop repo B (superseded); keep A and C.
2. Read-only fetch into quarantine: shallow read (raw.githubusercontent or shallow clone) into a dir that is NEVER on any execution/import path. EXCLUDE AGENTS.md, CLAUDE.md, opencode.json, .claude-plugin/ - those are agent-config files that can carry directives; ingest only SKILL.md prose bodies. Never run their installer (no npx skills add).
3. Provenance record: per file store source repo, commit SHA, fetch date, path, license, upstream copyright line.
4. Diff since last seen: compare new commit SHA / per-file hash to the stored snapshot; only changed hunks become candidate signals. Both A and C are active, so diffs will be frequent - this keeps volume sane.
5. Extract candidate signal AS DATA: parse into a neutral schema {rule_text (quoted excerpt), category (motion|type|color|a11y|layout|copy), checkability (auto|judgment), proposed_sidecoach_target, source, commit, license}. Store excerpts inside a fenced "UNTRUSTED SOURCE EXCERPT" block - never concatenated into a system/tool prompt the agent will act on. The ingesting agent's only job is transform-to-data, not execute.
6. Human-review gate: candidates land in a review-queue markdown file, NOT in the live sidecoach ruleset. A human (Jonah) distills, rewords in his own voice, decides attribution, and only then commits into sidecoach. This is where verbatim text becomes an original rule - sidesteps both prompt-injection and copyright (facts/ideas are not copyrightable; their prose is, so we rephrase + attribute).
7. Prompt-injection containment: because fetched text is untrusted, never concatenate it into a prompt the agent acts on; render only inside the fenced untrusted block for the human reviewer.
8. MIT attribution obligations: all three sources MIT. Keep each source's copyright + permission notice attached to derived material in the review queue; carry an attribution line on any shipped rule that derives substantially from their wording. Copyright holders: "Copyright (c) 2026 Jakub Krehel" and "Copyright (c) 2026 Emil Kowalski."
9. Cadence-aware polling: weekly poll of repos A and C; skip B. Both authors are mid-refactor (Aug 2026), so the rule text itself will shift - the diff step is what makes that safe rather than noisy.

## Files touched
- reference_external_taste_sources.md (new)
- MEMORY.md (index pointer)
