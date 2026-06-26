---
name: sidecoach-stage2-closure-fold
description: Codex closure review of the Stage 1+2 convergence diff returned DO NOT COMMIT with 5 findings. Folded 4 (passRateByDomain owner-keying, forms per-control labelling, image per-img lazy-load, model-routing stale count); deferred finding-2 (retired-domain 0/0 handler rows) to Stage 4 as pervasive handler coupling. 64 suites green. Codex fold-verification re-review running.
type: project
relates_to: [session_2026-06-25_sidecoach-convergence-resume-codex-gate.md, session_2026-06-24_sidecoach-option-B-convergence-PLAN.md, session_2026-06-25_sidecoach-stage2-findings-folded.md]
---

Collaborator: Jonah Cohen. 2026-06-25.

## CODEX CLOSURE REVIEW VERDICT: DO NOT COMMIT (5 findings, no P0)
Ran a focused Codex review (gpt-5.5, effort=high, 107KB focused diff) of the uncommitted Stage 1+2 convergence. Findings were real catches, not noise:
1. [P1] extended-domain-validator.ts:194 passRateByDomain keyed only by findingClass -> Forms reported 0/16 (flow-handler-component-implementation reads passRateByDomain['forms']). SIBLING of the already-folded getRulesByDomain bug, in a different field.
2. [P1] retired-domain 0/0 sections: handlers (constraint-design, motion-patterns, layout-optimization, component-implementation) call getRulesByDomain('motion'/'typography'/'color'/'spatial'/'interaction'/'responsive'/'writing') -> empty -> silent 0/0 rows.
3. [P1] forms-checks.ts:30 form-control-labelled passed if ANY label existed anywhere (one labelled input masks an unlabelled sibling).
4. [P1] page-quality-checks.ts:35 image-lazy-load passed if ANY image was lazy.
5. [P2] model-routing.ts:159 hardcoded "114-rule synthesis" (stale; live total 46).

## FOLDED 4 OF 5 (verified, 64 suites green)
- **#1 passRateByDomain**: validateAll now builds violationsByDomain/passRateByDomain keyed by BOTH findingClass AND ownerValidatorId (domainKeys set; per-domain passed via ruleId-intersection). passRateByDomain['forms']/['page-quality'] now resolve.
- **#3 form-control-labelled -> PER-CONTROL**: enumerates labelable controls (excludes input type=hidden/submit/button/reset/image); each needs inline aria-label/aria-labelledby, an id targeted by a label for/htmlFor, or a wrapping <label> (unclosed <label> precedes it). Added masking + wrapping + non-labelable test cases.
- **#4 image-lazy-load -> PER-IMAGE**: first <img> exempt (above-the-fold hero); every later <img> must be loading="lazy" or fetchpriority="high". Updated the test (a single eager hero now PASSES - the old "any image, no lazy => fail" wrongly failed a legit hero) + added masking/priority cases.
- **#5 model-routing**: "114-rule synthesis" -> "multi-rule synthesis" (count-free, can't go stale).
- VERIFIED: npm run build clean (no drift), npm test = 64 suites green; Flow J fixture still Extended 22/22 (stricter rules return N/A on token-only context).

## DEFERRED #2 TO STAGE 4 (engineering call, with rationale)
Finding #2 is NOT just display rows - the handlers are coupled to the retired domains THROUGHOUT: checklist rows + guidance "Domain Validation Results:" headers + memory `.addRule('color', colorDomainRules.map(...))` (empty) + customData (0s) + severity calcs. Guarding only the visible rows would be a THROWAWAY half-fix that STILL leaves empty memory rules + dishonest headers. Properly de-coupling the handlers from retired domains IS Stage 4's defined scope ("absorb remaining + collapse handlers"). So #2 becomes the FIRST Stage 4 task, not a Stage-2 patch.

## OPEN DECISION (commit boundary) - for Jonah
The review said DO NOT COMMIT, primarily for #2. With #2 deferred to Stage 4, the commit boundary is a real call: (A) commit Stage 1+2 now with #2 known-open/tracked, (B) hold the commit and roll #2 into Stage 4 then commit one clean converged milestone, or (C) protective WIP checkpoint commit now + clean milestone after Stage 4. Awaiting Jonah + the Codex fold-verification re-review (job b5km38zkm) confirming #1/#3/#4/#5 are clean before deciding.

## Files touched (fold)
extended-domain-validator.ts (passRateByDomain owner-keying), validators/checks/forms-checks.ts (per-control labelling), validators/checks/page-quality-checks.ts (per-img lazy-load), model-routing.ts (count-free rationale), __tests__/forms-checks.test.ts + __tests__/page-quality-checks.test.ts (new both-direction cases).
