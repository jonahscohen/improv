---
name: Taste Tier-2 revisit - 1 real fix, 3 named-unfixable (architectural finding: hermetic render can't see JS idioms)
description: taste-revisit tuned only oversized-h1 (H1_VW_RATIO 0.11->0.09, Rreal 0.000->0.167, precision held, beats oracle) and honestly declared tight-leading/blinking-cursor/marquee UNFIXABLE - refused to trade FPs for recall. The real architectural finding: the hermetic render strips scripts, so JS-driven idioms (blinking carets, JS-built marquees) are structurally invisible to the rendered engine. Commit held for combined integration with domain-validation-fix (shared dist).
type: project
relates_to: [session_2026-07-25_stage4bcd-a5a-results-lead.md, session_2026-07-24_stage4cd-structural-motion-classes.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: taste-revisit self-verified (A5a before/after, tsc, taste suites, A2 non-regression, foreground Codex "Findings: None"); LEAD re-grade pending combined dist rebuild
confidence: high
---

Collaborator: Jonah. 2026-07-25. Loop iteration (Gap 1). The anti-overclaim discipline held - 1 genuine fix, 3 honest "cannot fix without faking it".

## The one real fix
- **oversized-h1**: H1_VW_RATIO 0.11 -> 0.09 (115px, mid-gap between asana's 102px tasteful h1 and upstash's 128px oversized, ~13px margin each side). Rreal 0.000 -> 0.167, Preal held 1.000 (0/35), Rc held 0.500, constructed-neg 0/43. Beats oracle here (0.167 vs 0.000). Modest - the ceiling is h1-scoping (4/6 Codex-present heroes render as non-h1, invisible to a largestH1Px measure); reaching them needs an any-first-viewport-text rescope that changes the class identity + adds a failure mode = a lead product call not taken.

## The 3 named-unfixable (honest, with proof - NO CHANGE made)
- **tight-leading**: CONSTRUCT MISMATCH. Codex judges small-font visual DENSITY; the detector measures line-height/font-size RATIO. The 8 missed positives sit at leading 1.2-1.5 (linear/asana at 1.5 = comfortable); the 2 FP are the objectively TIGHTEST pages, both Codex "readable". No ratio threshold catches linear@1.5 without firing on the 1.2 browser default (every page). -> PULL / strict audit-only.
- **blinking-cursor**: HERMETIC-RENDER GAP. The render strips scripts, so the 12 Codex-present carets (JS/focus-driven) are absent from the DOM -> Rreal structurally 0. Firing from keyframe declarations to reach them costs 10-22 FP (every fade/pulse). -> PULL / strict audit-only.
- **marquee**: HERMETIC-RENDER GAP. JS-built marquees' keyframes survive but no element runs them -> we miss. declared-OR-usage = Rreal 0.813 but 9 FP (Preal 0.65, WORSE than oracle 0.88). Oracle's 0.563@3FP is a better operating point we structurally can't reach. -> accept oracle wins here.

## THE ARCHITECTURAL FINDING (the real lesson, bigger than these 3 classes)
The rendered engine's hermetic capture STRIPS SCRIPTS. That is correct for determinism, but it means JS-DRIVEN idioms (script-built marquees, focus/JS blinking carets, and likely any JS-injected content) are STRUCTURALLY INVISIBLE to our detectors - we see the keyframe but not the running element. This is a systemic ceiling on real-world recall for motion/interaction classes, not a threshold bug. Oracle (which may render with scripts) can out-recall us on exactly these. Honest implication: our rendered-taste engine is precision-strong on DECLARED/static idioms and structurally weak on JS-DRIVEN ones. Worth a lead decision later: accept the static-only scope, or add a scripts-on render variant (which reopens the determinism question the hermetic render closed).

## Status
Only `subjective-rendered-scanner.ts` changed (1 constant + comment). No run-tests line needed (typography-extremes tests the imported H1_VW_RATIO). Commit HELD for combined integration with domain-validation-fix; lead re-grades oversized-h1 independently at that dist rebuild. Loop continues.

## Files
- sidecoach/src/validators/subjective-rendered-scanner.ts (uncommitted). this beat + MEMORY.md.
