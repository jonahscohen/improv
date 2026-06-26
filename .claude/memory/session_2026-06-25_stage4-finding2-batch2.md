---
name: stage4-finding2-batch2
description: Finding-2 repo-wide cleanup, batch 2 - re-routed 5 more simpler handlers (clone-match, font-research, typography-excellence, component-research, design-references, motion-integration) off retired domains by hand. 11 of ~15 handlers done. Full suite 64 green. 4 complex 7-domain aggregate handlers remain (all-seven-qa, accessibility, design-tokens, migration).
type: project
relates_to: [session_2026-06-25_stage4-finding2-handlers-progress.md, session_2026-06-25_stage4-agent-integration-and-gaming-catch.md]
---

Collaborator: Jonah Cohen. 2026-06-25. Jonah said "continue now" - doing the remaining finding-2 handlers by hand in the main tree, full-suite verified.

## BATCH 2 DONE (6 handlers, by hand, 64/64 green)
clone-match, font-research, typography-excellence, component-research, design-references, motion-integration. Per handler: removed the dead domain block (validateAll/getRulesByDomain for retired domains, passRate/passed, 0/0 checklist rows, orphaned "Domain Validation Results:" guidance header, getSeverity, domain memory addRule/addMetric/addValidation, customData *-rules entries, unused ExtendedDomainValidator/DomainCheckContext import).

## KEY NUANCE (why the bulk script failed + why by-hand is right)
These handlers interleave RETIRED domain vars with REAL ones that must be preserved:
- clone-match: kept literal .addRule('typography'/'spacing'/'shapes'/'layout', [...]); the "Color match" checklist row kept its label, only the retired 0/0 description dropped.
- font-research / component-research / design-references: kept the REAL rule lists (typographyRules, interactionRules, writingRules, colorRules, spatialRules, SHARED_DESIGN_LAWS) - distinct vars from the retired *DomainRules. Repointed a couple of count refs (e.g. component-research "rules reviewed" + message) from interactionDomainRules.length -> interactionRules.length.
- motion-integration: kept SHARED_DESIGN_LAWS.motion.rules + all the real duration/easing/reduced-motion metrics+validations; dropped only the motion/interaction DomainRules pieces.

## PROGRESS: 11 of ~15 handlers
Committed earlier: the 4 Codex-flagged (949f4957) + ambitious-motion (62784558). This batch: the 6 above (committing now). REMAINING: the 4 complex 7-domain AGGREGATE handlers - all-seven-qa, accessibility, design-tokens, migration - which compute totalRules/totalPassed/overallPassRate by SUMMING the per-domain vars, so they need the aggregate + "Overall quality score" rows handled too, not just per-domain rows.

## NEXT: the 4 aggregate handlers, then the PolishStandard+AntiPattern absorption redo (keep all exported predicates the registry imports; the absorb agent's reconciliation: all 22 polish rules already in registry, only 6 of 27 anti-patterns real).
