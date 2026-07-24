---
name: Sidecoach staged upgrade plan authored (oracle v4 regroup)
description: Staged PLAN (not implementation) at docs/superpowers/plans/2026-07-23-sidecoach-upgrades.md operationalizing the 4 chosen gaps from the oracle v4 gap analysis - defect-mining loop (TOP), staged generative authoring, unified detect CLI, taste rule-count delta. Live/in-browser-variant HARD-EXCLUDED. Codename only.
type: project
relates_to: [session_2026-07-23_oracle-v4-gap-analysis.md, session_2026-06-24_sidecoach-option-B-convergence-PLAN.md, feedback_sidecoach_mission_beat_oracle.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: none - plan only, grounded in read of sidecoach/src + SKILL.md + eval harness at commit a22d41fc; not committed
confidence: high
---

Collaborator: Jonah. 2026-07-23. Team-lead tasked a regroup PLAN (not implementation) for the sidecoach upgrades, grounded in the just-completed oracle v4 competitive gap analysis. Plan written to `docs/superpowers/plans/2026-07-23-sidecoach-upgrades.md`, stamped against commit `a22d41fc`. Reported to team-lead via SendMessage. NOT committed (per instruction).

## What the plan covers (4 ranked stages)
1. **(TOP) Provider-specific defect-mining loop + skill-prose ablation.** 1a provider sampling harness (Claude/gpt-5.4/Gemini adapters, key-gated, briefs input) -> 1b defect-distribution measurement (shipping scanner over samples, per-provider per-rule fire rates, committed JSON) -> 1c build-time counter-rule compilation (generate-counter-rules.ts + --check, CLASSES not per-page) -> 1d prose-ablation loop (with/without each guidance line, delete lines that PRIME defects). Periodic/release workflow, not per-commit. Sits on the eval-corpus + briefs + rendered-scanner + buzzword-calibrate + Codex substrate we already own. MED-HIGH.
2. **Integrated generative authoring, staged.** 2a palette-construction recipe (OKLCH ramps + WCAG-checked pairs -> DESIGN.md tokens, fail-closed) -> 2b pre-render authorship (design board + first-surface mock, RENDERED + audited before build) -> 2c outside-ranking direction roll (OUR OWN curated deck, model instinct ranked LAST, re-roll excludes prior draws, seeded/deterministic) -> 2d deck presentation as surface-aware artifact/markdown (NOT interactive browser). HIGH but stageable.
3. **Unified scanner productized.** 3a one `bin/sidecoach-detect.js` (URL->rendered lenses, source->ban detectors+checks, normalized findings, fail-closed inconclusive) -> 3b real hook path (advisory, fail-open decision but honest counts; replaces the removed FAKE) -> 3c registry consolidation (product-rule-registry as single manifest feeding CLI+hook+audit+eval). MED.
4. **Taste rule-count delta (cheap rendered-engine wins).** 4a font-family read (fontshare vocab) -> 4b typographic extremes (extreme-negative-tracking, tight-leading, all-caps-body, oversized-h1, sub-11px) -> 4c structural (thin-border-wide-shadow, repeating-stripe-gradients, text-under-overlay, first-viewport-overflow, dot/grid, radial-glow, image-hover) -> 4d motion (marquee, blink, numbered-markers) + HONEST EXCLUSIONS (stock hero raster art, aphoristic-cadence/theater-slop-phrase = copy-semantic, not render-detectable). Adopt ~17 CLASSES not 59 hand rules. Each clears Contract-6 A5a before shipping. LOW-MED per class.

## Key design decisions in the plan
- **Why defect-mining is TOP:** durable, field-can't-easily-copy, fits our existing eval + Codex rails better than the generative UI. The one thing to borrow if we borrow one.
- **HARD EXCLUSION honored:** no live/Live-Mode/in-browser variant-preview anywhere. The generative pipeline's "browser decision page" is HELD OUT (Section 6) and replaced by an exclusion-safe artifact/deck (2d); Live Mode fold is noted as a SEPARATE Justify track, out of scope.
- **Edges preserved:** rendered Playwright engine (not static), fail-closed honesty (inconclusive never clean), independence (held-out briefs + Codex labels + author!=labeler), beats memory. Stated as cross-cutting guardrails every stage respects.
- **"More capable AND simpler":** adopt the ~17 issue CLASSES, never 59 hand-maintained rules; buzzword-calibrate single-source pattern reused for every new class.
- **Baseline (Rule #9) EXISTS:** npm build (generate-lanes + generate-validators --check + tsc) + npm test + eval/*.test.mjs. Every stage adds a RUNNABLE verify on top.
- **Sequencing:** 3a -> 4a/4b -> 1a/1b -> 3b/3c -> 1c -> 4c/4d -> 1d -> 2a-2d. Stage 3 is a soft prereq for clean 1b/4; Stage 4 feeds 1b (wider rule set = richer distribution); Stage 2 is the most independent track.

## Grounding facts confirmed at a22d41fc (for future drift checks)
- Rendered scanners: objective (5 rules) + subjective (3 classes: tiny-text, nested-cards, marketing-buzzword). Static ban detectors: 5 real (of 27 declared anti-laws). No `detect` CLI (fake removed). Generated rule registry via product-rule-registry + validators.generated.ts. Font vocab in fontshare-reference.ts. Eval Contract-6 gate: A1-A4 parity + A5a/A5b differentiator, oracle-comparator runs oracle headless.

## Files touched
- docs/superpowers/plans/2026-07-23-sidecoach-upgrades.md (NEW, the plan; not committed)
- this beat + MEMORY.md index. No sidecoach code changed - plan only.
