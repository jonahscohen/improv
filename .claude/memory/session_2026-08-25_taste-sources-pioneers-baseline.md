---
name: Taste-miner sourcing reconfigured - outside pioneers are the BASELINE, our beats de-weighted
description: Added Leon Lin (taste-skill) + Meng To (Skills design subset) as MIT sources; reranked SOURCE_RANK so expert-external is the baseline above measured + beats; design-filtered our 1418 beats to 433; kept other design refs + the filtered beats per Jonah; re-ingested (46 expert files)
type: decision
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: manifest valid + ingest allowlist OK (31 paths/4 sources); miner suite 64/0; npm run build green; real ingest 31 new, corpus expert-external 15->46
relates_to: [reference_external_taste_sources.md, session_2026-08-23_taste-miner-built.md, oracle-naming-rule.md]
---

Jonah (2026-08-24/25): "we should be learning from 1) oracle 2) Emil Kowalski 3) Jakub Krehel 4) leonxlnx 5) Matt Pocock 6) Mengto - their pioneering ... should be our BASELINE that we evolve from. i'm not trying to learn from our work as a baseline."

RESEARCH (all MIT, verified via gh):
- Leon Lin (leonxlnx/taste-skill, MIT) - design-taste core. ADDED (8 SKILL.md: taste-skill, taste-skill-v1, gpt-tasteskill, minimalist, brutalist, soft, redesign, brandkit).
- Meng To (MengTo/Skills, MIT) - huge catalog; ADDED the 10 design-PRINCIPLE ones (design-first-ui-prompting, animation-systems, beautiful-shadows, build-awwwards-quality-sites, cinematic-gsap-lenis, gsap, tailwindcss, progressive-blur, optimize-web-animations, audit-reference-originality); skipped the 100+ one-off styles + game/tooling.
- Emil Kowalski + Jakub Krehel - already sources (kept).
- Matt Pocock (mattpocock/skills, MIT) - ALL engineering (TDD/architecture), NOT design taste. Jonah chose SKIP (design scope).
- "oracle" (the competitor) - no open repo, copyrighted, name-banned. Jonah: "internal experiment not for redistribution, use the competitor's rules/code as you see fit." I have NO source for its actual rules (only our own gap-analysis/scorecard beats), so it stays the ASPIRATIONAL BAR, not an ingested source.

CHANGES:
1. sidecoach/data/taste-sources.json: +Leon +Meng (4 sources / 31 SKILL.md paths total); generated_note updated with the baseline intent + exclusions.
2. sidecoach/bin/sidecoach-mine.js SOURCE_RANK: was {measured:3, expert:2, beat:1}; NOW {expert-external:3, measured:2, beat:1} - the outside pioneers are the top-ranked BASELINE.
3. sidecoach/bin/sidecoach-mine.js assembleBeats: added a DESIGN_BEAT_RE filter - only design/taste-relevant beats enter the corpus (1418 -> 433), de-weighting our build/infra/session notes.
4. Re-ingested the manifest to the real quarantine (sidecoach/reference/_extracted/external): 31 new SKILL bodies; expert-external corpus 15 -> 46 files.

JONAH'S CURATION CALLS: KEEP the other external design refs already in the quarantine (Refactoring UI, shadcn/ui, Vercel guidelines, bencium, typeui) as extra baseline material; KEEP the ~430 filtered beats (rely on the ranking to make experts the baseline, don't cut further). So no deletions - additive ingest, filter + rerank only.

NOTE (clarified to Jonah after a bad phrasing): "zero rules enforced" referred ONLY to the NEW mined-LEARNED enforcement tier being empty (no learned rule promoted+proven+signed yet) - NOT the existing product-rule registry, which is full and running. The sourcing change is about what NEW rules the miner PROPOSES, learned from the pioneers, on top of the existing set.

MINOR (left for later, not blocking): the quarantine also has legacy SKILL-named dirs (emil-design-eng, taste-skill) that overlap the new source-slug dirs (emil-kowalski-skills, leon-lin-taste-skill) - a small duplication; additive ingest kept both per "keep everything." Can dedup later.
