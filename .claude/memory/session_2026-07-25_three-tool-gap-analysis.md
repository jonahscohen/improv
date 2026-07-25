---
name: three-tool gap analysis (emilkowalski/skills, no-ai-slop, taste-skill)
description: Delta gap analysis of 3 external taste tools vs improv - 2 of 3 already absorbed 2026-05-25, wired-vs-shelved findings, real deltas
type: project
relates_to: [session_2026-07-16_four-product-gap-analysis.md, session_2026-07-23_oracle-v4-gap-analysis.md, session_2026-07-23_borrow-list-reconciliation.md, session_2026-07-25_taste-skill-repo-inventory.md]
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: none
confidence: high
---

Jonah asked "what do these tools have that we don't" for 3 repos, fan-out agents. 3 general-purpose agents did primary-source reads; lead did the internal wired-vs-shelved analysis. CRITICAL REFRAME: this is a DELTA question, not greenfield - 2 of the 3 were already absorbed 2026-05-25 into `sidecoach/reference/_extracted/external/`.

**Absorption baseline (proven from _extracted source: headers):**
- `emilkowalski/skill` (singular) -> `emil-design-eng/SKILL.md`, captured 2026-05-25. Repo has since RENAMED to `emilkowalski/skills` (plural) and grown 1 -> **7 skills**. We hold 1/7, as shelf prose.
- `Leonxlnx/taste-skill` -> `taste-skill/SKILL.md` (v1-era, 226 lines), captured 2026-05-25. Repo has since grown 1 -> **14 skills** + a 1207-line v2 flagship. We hold 1/14, as shelf prose.
- `petergyang/no-ai-slop` = NET-NEW (not absorbed by name; overlaps our linguistic-ban-validator). Launched ~2026-07-22.

**Wired-vs-shelved (the crux, proven by grep):**
- WIRED from absorption: slop words (linguistic-ban-validator), 9 rhetorical templates incl. `kicker`, font-reflex-reject (discourage Inter/force Geist-Satoshi), saturated-aesthetic-lanes, banned/prescribed easings (into flow-handler-motion-*), line-height tiers, breakpoint table.
- NOT WIRED (shelf prose only): taste-skill's three DIALS (DESIGN_VARIANCE/MOTION_INTENSITY/VISUAL_DENSITY) - grep empty; Emil's FREQUENCY-FIRST animation matrix - grep empty; named-vibe-variants.md; the ~80-term reverse vocab.

**REPO 1 - emilkowalski/skills (7 skills, motion craft) = BIGGEST net-new surface.** We cover review-animations standards well via polished-* rules (enter-stagger/exit-choreography/motion-respect/press-feedback/interruptible-state/sparse-will-change/explicit-transition/icon-transition) + tactical-polish motion-review + easings wired. GAPS: (1) frequency-first matrix NOT an enforceable check (cheap wire); (2) `animation-vocabulary` ~80-term reverse-lookup glossary (describe->name) - zero equivalent, distinctive; (3) `apple-design` physics - momentum-projection formula `current+(v/1000)*d/(1-d)`, velocity handoff, rubber-banding, interruptibility-as-#1 - we detect interruptible-state but lack generative physics; (4) **`find-animation-opportunities`** - read-only scan for where motion SHOULD be added (The Gate 4-filter, 5-7 cap, rejected-list) = the POSITIVE inverse of our defect detectors, directly closes our "all assets are negatives" gap on the motion axis; (5) `improve-animations` audit->prioritize(leverage=impact/effort)->self-contained plans for cheaper executors (AUDIT.md 8 cats + PLAN-TEMPLATE); (6) `pick-ui-library` curated task->lib map; (7) hard escalation triggers + deletion-first remedial hierarchy.

**REPO 2 - petergyang/no-ai-slop (PROSE editing, net-new, NARROW).** We have linguistic-ban-validator = slop-word scan + 9 templates, wired into flowJ (an integration edge they lack). We ALIGN on detect-not-score philosophy. GAPS: (1) Edit/rewrite mode (full-draft rewrite preserving voice) - we detect+advise only; (2) voice-preservation brake ("minimum effective edit", keep profanity/hedges); (3) self-eval loop (eval.md pass/fail gate on own output); (4) fuller catalog - they have 16 named patterns, we have ~9; missing throat-clearing, faux-insight, colon-reveals, superficial -ing, importance-puffery, weasel-attribution, fake-strong-verbs, synonym-cycling, dramatic-fragmentation, robotic-rhythm, rhetorical-setups, summary-recap, formatting-slop; (5) empty-adverb (11) + empty-phrase (~18) lists; (6) paired before/after rewrites per rule. CHEAP WIN: add missing patterns + phrase lists to linguistic-ban-validator.

**REPO 3 - Leonxlnx/taste-skill (14 skills, GENERATION framework) = most-absorbed + likely improv's "oracle" benchmark.** We're STRONG on the detection half: many AI-Tells are rendered rules (gradient-text, oversized-h1, default-typeface, nested-cards, side-stripe, hero-metric, glassmorphism, marketing-buzzword, numbered-section-markers, marquee, decorative-dot-grid, justified-text) + em-dash ban (content-guard) + Stage 2 generative (palette/roll/preauthor). GAPS (generation half): (1) the three DIALS + v2 dial-inference tables (vibe->dial) + use-case presets (SaaS 7/6/4, agency 9/8/3) - parametric generation control, NOT wired; (2) coordinated aesthetic LANES w/ token-complete sets (minimalist exact Notion hex, brutalist Swiss/tactical-CRT palettes+fonts, soft "$150k agency" Double-Bezel); (3) image-first pipeline - image-to-code + imagegen-web/mobile + brandkit (Combinatorial Variation Engine) = our visual-authorship gap; (4) Brief->official-design-system MAP (Fluent/Material/Carbon/Polaris/govuk/uswds + install cmds + "no official package" honesty); (5) expanded 9F production-test tells (~30: version-labels-in-hero, weather/locale strips, "Quietly in use at", photo-credit captions, scroll cues, "Reservation X of Y") - many uncaught, postdate our v1 snapshot; (6) stitch DESIGN.md emitter + inline-image-typography; (7) gpt-taste Python-RNG variance trick (brief-char-count seed); (8) ~50-name reference vocabulary; (9) ~60-box mechanical pre-flight. NOT worth borrowing: research/ corpus (weak LLM-laziness essays, shaky studies), empty Block Library, an internal inconsistency (v2 bans Fraunces/Instrument_Serif; stitch recommends them).

**META-FINDINGS:** (a) Absorb-but-don't-wire is the recurring failure - this is the ~5th-6th borrow list; fragments wired, signature mechanics (dials, frequency-matrix) shelved. (b) Both repos EXPANDED ~7-14x since our stale 2026-05-25 snapshots. (c) Convergent gap = GENERATION breadth (motion-opportunity-finding, parametric/image authorship); all 3 externals are GENERATORS, improv is a DETECTOR (Stage 2 is closing this but far behind their breadth). (d) OUR MOAT none of them have: rendered Playwright engine (they're static/prompt), fail-closed honesty (inconclusive!=clean), independence eval (author!=labeler A5a Codex-graded), beats memory, CI-path validator not just a prompt.

**OPEN FLAG for Jonah:** taste-skill agent observed MIT / ~28.5k stars; the 2026-07-23 oracle-v4 beat says Apache-2.0 / ~48k stars. Copilot-embed matches. Either the "oracle" codename != Leonxlnx/taste-skill, or the oracle-v4 beat's license/stars are wrong. Reconcile - it affects months of benchmarking framing.

Deliverable: visual artifact (gap dashboard) + this beat. No code changed; research only.

Files touched: none (analysis). Beat + companion session_2026-07-25_taste-skill-repo-inventory.md (agent-written).
