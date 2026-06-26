---
name: sidecoach-taste-prioritization
description: ST1 gate - eval-weighted taste-class prioritization (cross-ref dev coverage x frozen-90 GT weight), reshapes the architect's undifferentiated top-up
type: decision
relates_to: [session_2026-06-24_sidecoach-decoupling-gate.md, session_2026-06-24_sidecoach-m2-committed.md]
---

Collaborator: Jonah Cohen.

ST0 done (commit f42e4322): Codex labeled all 22 dev pages (author!=labeler confirmed: labeledBy/model=codex, signal=screenshot, method=screenshot-vision+text+motion, rubricSha recorded = render-basis parity + reproducibility hold). The architect surfaced the per-class dev COVERAGE MAP + recommended an undifferentiated "top-up all 11 thin/zero classes."

## I cross-referenced dev coverage against FROZEN-90 subjective GT WEIGHT (the eval score) - reshapes everything
(First cut miscounted all label entries = 1980; corrected to present-only = 188, matching the established baseline.) Per-class frozen-90 PRESENT count (eval weight) vs dev coverage:

HIGH-WEIGHT + DEVELOPABLE (attack FIRST, buildable now):
- tiny-text          eval 66  dev 22   <- 35% of ALL subjective GT
- layout-transition  eval 38  dev 17   <- 20%   (these TWO = 104/188 = 55% of the entire subjective score)
- tight-leading      eval 14  dev 8
- bounce-easing      eval 12  dev 4
- marketing-buzzword eval 8   dev 17
- nested-cards       eval 7   dev 19
- icon-tile-stack    eval 5   dev 10 ; repeated-section-kickers eval 5 dev 7 ; aphoristic-cadence eval 4 dev 10

HIGH/MED-WEIGHT but THIN/ZERO dev (TOP-UP before developing):
- side-stripe-borders eval 10 dev 2  <- the ONLY high-weight thin class; top-up priority #1
- cream-palette eval 5 dev 2 ; ai-color-palette eval 3 dev 2 ; numbered-section-markers eval 3 dev 2 (secondary)
- hero-metric-template eval 2 dev 0 ; wide-tracking eval 2 dev 0 (minor)

LOW/ZERO eval weight - DEPRIORITIZE or SKIP (detecting them cannot move the score):
- hero-eyebrow-chip eval 2 dev 8 ; dark-glow eval 1 dev 7 ; gradient-text eval 1 dev 1 (low weight, dev-ok but small payoff)
- ZERO eval weight (SKIP for the eval entirely): italic-serif-display 0, glassmorphism-default 0, all-caps-body 0, extreme-negative-tracking 0. Note 4 of the architect's 5 "zero-dev" classes ALSO have 0 eval weight -> topping them up is wasted effort.

## Decision
Develop by EVAL WEIGHT, not by "developable" alphabetically. tiny-text + layout-transition are the mission (55% of the score) and need NO top-up. Top-up ONLY side-stripe-borders (eval 10) as priority, cream/ai/numbered secondary. SKIP the 4 zero-eval classes (italic-serif-display, glassmorphism, all-caps-body, extreme-negative-tracking) - no detector dev, no top-up; the existing glassmorphism detector still ships + gets precision-validated (no-grandfathering) but won't move eval recall.

**Alternatives considered:**
- Architect's "top-up all 11 thin/zero then develop": rejected - wastes effort on zero-eval classes, under-prioritizes the 2 classes that are 55% of the score.
- Top-up everything first, develop later: rejected - tiny-text+layout-transition are buildable NOW (dev 22/17); no reason to wait on a top-up to start the highest-leverage work.

**Why:** the mission is to raise frozen-90 subjective recall past oracle's 0.277 (53/188). The score is dominated by tiny-text(66)+layout-transition(38); to beat oracle you must win those two. Effort should track eval weight x developability, not coverage alone.

**Revisit when:** the top-up lands (re-check side-stripe-borders dev count >=3), or if a developed detector's precision craters (condition 3) forcing a rethink.

ST1 GREENLIT for the high-weight developables (tiny-text first). Precision first-class on every detector (condition 3). Top-up stays disjoint (condition 1). Codex + my gate per batch.
