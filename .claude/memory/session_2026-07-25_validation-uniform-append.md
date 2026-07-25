---
name: Uniform-append fix for the 3 orchestrator validationResults overwrite sites (Jonah decision)
description: Jonah ruled FIX (uniform append) on the composite + natural-language flow branches that OVERWROTE result.validationResults, dropping handler/taste-gate/mandate results before the build-report. Converted sites 297/313/1490 to the append pattern already at 1007/1346. New Test 4 proves preservation.
type: project
relates_to: [session_2026-07-25_domain-validation-coverage-ordering-fix.md, session_2026-07-25_pull-tight-leading-blinking-cursor.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: DONE - committed 9e5e5bf9; 86 suites + domain-validation-coverage 11/11 (incl. Test 4 discriminator); Codex reviewed (append correctness confirmed)
confidence: high
---

Collaborator: Jonah. 2026-07-25. Decision via AskUserQuestion: "Fix it: uniform append."

## The bug (pre-existing, flagged by domain-validation-fix, DECLINED then as a design call)
`result.validationResults` (top-level) is a MIXED array: the taste gate (runTasteValidationGate L520-521), a ClaudemdMandate check, and the handler itself all PUSH into it. Three domain-validation sites then did `result.validationResults = validations` - a hard OVERWRITE that DROPPED every prior push before recordFlowWithMemory persisted it (entry.domainValidationResults) and before the build-report read it. So flowJ polish/ban results, taste findings, and mandate outcomes silently vanished on the composite + natural-language paths.

## Fix (uniform append - the pattern already at L1007 + L1346)
Converted all 3 overwrite sites to `result.validationResults = [...(result.validationResults || []), ...validations]`:
- **L297** composite loop, auto domain validators (getValidatorsForFlow) - the primary path.
- **L313** composite loop, explicit step.domainValidation.domains - now accumulates onto L297's append (auto + explicit are distinct validator sets, both kept).
- **L1490** natural-language single-flow path (executeFlow, with RegressionDetector).
Each keeps its LOCAL `validations` for the soft-fail warning filter (only warn on the new ones) - correct. The failOnError halt at 313 still checks only the explicit set. No double-count: auto vs explicit are different domains.

## Why this is a real fix, not a behavior regression
domain-validation-fix DECLINED this as "changing validation identity" (the spec's "a flow that WAS validated must validate identically"). Jonah's ruling reframes it: the overwrite was DROPPING real handler results = data loss; append RESTORES the dropped data. The identity that shifts is a flow now reporting MORE (its handler results + domain results) where it previously reported only domain results. That is the correction.

## Test (domain-validation-coverage.test.ts Test 4)
A fake flowE handler pre-pushes `validationResults: [{domain:'handler-preexisting', status:'fail', ...}]` (standing in for the taste gate / mandate / handler push). After runCompositeLoop: assert the pre-existing entry SURVIVES in result.validationResults (the DISCRIMINATING assertion - FAILS under the old overwrite), the 'performance' domain outcome is ALSO present (append added, not replaced), and BOTH persist to entry.domainValidationResults. Directly exercises site 297; 313/1490 apply the byte-identical append expression (verified by Codex over the diff, honestly scoped in the test comment).

## Verify
- `npm run build` clean (tsc + generate-validators --check no drift). Combined gate (items 1+3) running. Codex review over the whole diff pending -> fold -> re-verify -> commit + rebuild dist.

## Files
- edited: src/sidecoach-orchestrator.ts (3 append sites), src/__tests__/domain-validation-coverage.test.ts (+Test 4).
