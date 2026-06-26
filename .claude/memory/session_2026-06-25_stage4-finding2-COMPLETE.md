---
name: stage4-finding2-COMPLETE
description: Stage 4 finding-2 (retired-domain 0/0 handler coupling) FULLY RESOLVED across all ~15 handlers. Re-routed the 4 complex 7-domain aggregate handlers (all-seven-qa, accessibility, design-tokens, migration) off retired domains by hand. Repo-wide grep confirms zero retired-domain getRulesByDomain/passRateByDomain theater remains; only real forms + honest registry breakdown left. 64 suites green.
type: project
relates_to: [session_2026-06-25_stage4-finding2-batch2.md, session_2026-06-25_stage4-agent-integration-and-gaming-catch.md, session_2026-06-25_sidecoach-stage2-closure-fold.md]
---

Collaborator: Jonah Cohen. 2026-06-25 ("continue now"). Finding-2 repo-wide cleanup is DONE - all ~15 handlers honest.

## FINDING 2 COMPLETE (15/15 handlers, by hand, full-suite verified)
- Committed earlier: 4 Codex-flagged (949f4957), ambitious-motion (62784558), 6 simpler (83cd4fa5).
- This batch (the 4 complex 7-domain AGGREGATE handlers): all-seven-qa, accessibility, design-tokens, migration. These summed per-domain vars into totalRules/totalPassed/overallPassRate + had "Overall quality score" rows + per-domain metrics/validations - all retired theater, removed. Kept all REAL content:
  - all-seven-qa: was ENTIRELY domain theater; now a clean manual-QA checklist (browsers/devices/a11y/perf/sign-off) + QA guidance.
  - accessibility: kept the literal WCAG-criteria addRules, domainAuditResults audit, screenReaderTests; dropped only the 7 domain-var metrics/validations/rows.
  - design-tokens: kept domainCheckContext (reused by the REAL typoReport typography validator!), SHARED_DESIGN_LAWS addRules, domainValidationResults artifact, typoP0/P1; dropped only ExtendedDomainValidator + the domain-var pieces (import kept DomainCheckContext).
  - migration: kept the real migration checklist + addRule('migration', [...]); dropped the 7 domain rows/metrics/validations.

## VERIFICATION (the finding-2 acceptance criterion)
- Repo-wide grep: NO retired-domain getRulesByDomain (motion/typography/color/spatial/interaction/responsive/writing) and NO retired-domain passRateByDomain reads remain in any handler. The only getRulesByDomain left: getRulesByDomain('forms') (real, absorbed) + tactical-polish's getDomains().map(d => getRulesByDomain(d)) (the HONEST live-registry breakdown - forms/page-quality).
- build clean (no drift), tsc 0 errors, npm test 64/64 suites green. tsc-checked after every 1-2 handlers; committed in batches.

## METHOD NOTE
Did all 15 by hand in the main tree (Jonah's call) after the bulk strip-script failed (broke 8/10 on varied downstream aggregates). Each handler read + surgically edited: dead domainCheckContext/validateAll block, getRulesByDomain/passRate/passed, aggregates, 0/0 + "Overall quality score" checklist rows, orphaned "Domain Validation Results:" guidance headers, getSeverity, domain memory addRule/addMetric/addValidation, customData *-rules entries, unused imports - PRESERVING every real var (typographyRules/interactionRules/SHARED_DESIGN_LAWS/domainAuditResults/typoReport/etc.).

## STILL OPEN (last Stage 4 piece)
PolishStandard + AntiPattern absorption redo - retire the duplicate engines while PRESERVING the exported predicates the registry imports (hasFocusVisible/hasFontSmoothing/hasKeyframe.../etc.). Absorb agent's reconciliation (reusable): all 22 polish rules already in the registry (19 polish-standard + 3 static-a11y); only 6 of 27 anti-patterns are real (already the registry's anti-pattern owner); the other 21 are presence-of-CSS theater. Its worktree branch worktree-agent-aa807216b1407a939 has a (broken) reference impl.
