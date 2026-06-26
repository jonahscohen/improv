---
name: stage4-antipattern-absorbed
description: AntiPatternValidator absorbed onto the registry via the SHIM pattern (lower-risk than the agent's delete+adapter+handler-rewrite). validateCode now runs the registry's 5 anti-pattern owner rules; all methods (validateCSS/validateBatch/etc.) funnel through it so the 3 handler sites are UNCHANGED; the 21 theater design-laws patterns are retired. Detection verified, 64 suites green. Stage 4 absorption COMPLETE.
type: project
relates_to: [session_2026-06-25_stage4-polish-absorbed.md, session_2026-06-25_stage4-absorption-scope.md]
---

Collaborator: Jonah Cohen. 2026-06-25. The AntiPattern half - done via SHIM (not the absorb agent's delete+project-adapter+handler-rewrite, which also introduced a false-pass-on-empty bug).

## WHAT I DID (src/anti-pattern-validator.ts)
- Kept the class + ALL method signatures (validateCode/validateCSS/validateMarkup/passes/violationsBySeverity/reportForPattern/validateBatch/getPatternStats) + the AntiPatternViolation/ValidationResult interfaces + createAntiPatternValidator. So the 3 handler call sites (flow-handlers-tier3-tier4.ts:200/470/607) are UNCHANGED.
- Rewrote the funnel method validateCode(code) to run the REGISTRY's anti-pattern owner rules (5: gradient-text, glassmorphism-default, side-stripe-borders, hero-metric-template, modal-as-first-thought) over a ProductCheckContext {cssText:code, markup:code}, shaping failures into AntiPatternViolation[] (severity mapped blocker->critical/major->high/minor->medium/advisory->low; match=verdict.message, fix=verdict.remediation). Score = 100 - 10*crit - 5*high - 2*med (unchanged). All other methods delegate to validateCode -> all registry-backed.
- Removed the `import { ANTI_PATTERNS } from './design-laws'` + the 27-pattern loop + the now-dead extractMatch/getSuggestedFix helpers (76 lines). KEPT generateRecommendations + severityRank (untouched - they carry pre-existing emoji I must not edit). RULES lazy-required (cycle-safe).
- design-laws.ts left intact (SHARED_DESIGN_LAWS still used by handlers; ANTI_PATTERNS now just an unused export).

## WHY SHIM (not the agent's delete+adapter+rewrite)
The shim keeps the validateCode(code:string) interface, so (a) zero handler-site rewrites = minimal blast radius, and (b) it AVOIDS the false-pass-on-empty bug the absorb agent's project-level validateProduct adapter introduced (validateCode is only called with actual code blocks by the handlers; empty code -> 100 is the original, correct semantics).

## VERIFIED (real detection, not score-100-always)
- build clean (no drift, tsc). Behavioral probe: gradient-text input -> 1 violation (anti-pattern/gradient-text, score 95); glassmorphism input -> 1 violation; validateBatch detects; clean input -> score 100 (no false fail). npm test 64/64 green; anti-pattern-checks suite OK.

## STAGE 4 ABSORPTION COMPLETE
All three standalone validators are now registry-backed shims: ExtendedDomainValidator (Stage 2), PolishStandardValidator + AntiPatternValidator (this). The registry is THE engine. NEXT: one Codex review of the whole absorption (polish + anti-pattern), then Stage 4 is done.
