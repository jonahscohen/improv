---
name: stage4-finding2-handlers-progress
description: Stage 4 finding-2 repo-wide cleanup progress. 5 of ~15 handlers re-routed off retired domains (4 Codex-flagged committed 949f4957 + ambitious-motion). A bulk strip-script optimization FAILED (broke 8/10 handlers via varied downstream usages) and was reverted. Remaining 10 need careful by-hand removal. Full suite 64 green throughout.
type: project
relates_to: [session_2026-06-25_stage4-agent-integration-and-gaming-catch.md, session_2026-06-25_sidecoach-stage2-closure-fold.md]
---

Collaborator: Jonah Cohen. 2026-06-25. Doing the repo-wide finding-2 fix myself in the main tree (Jonah's choice), full-suite verified each batch.

## DONE (verified, committed)
- 4 Codex-flagged handlers (constraint-design, layout-optimization, motion-patterns, component-implementation): committed 949f4957.
- ambitious-motion: committed this batch. Removed the dead domain-validation block (validateAll/getRulesByDomain for retired motion+interaction, 0/0 checklist rows, customData rule counts, orphaned "Domain Validation Results:" guidance header, getSeverity helper, domain memory addRule/addMetric/addValidation). build clean, 64/64 suites.

## SCRIPT OPTIMIZATION FAILED (lesson)
Tried a Python line-removal script (scratchpad/strip_retired_domains.py) to bulk-strip the pattern across the other 10 handlers. It broke 8/10 (180 tsc errors): the handlers have VARIED downstream usages the blunt remover left dangling - 7-domain AGGREGATES (all-seven-qa, design-tokens, accessibility, migration compute `totalRules = colorDomainRules.length + ...`, overallPassRate, totalPassed), plus custom guidance/memory lines referencing the per-domain vars. Even "simple" handlers (clone-match, font-research) broke on guidance/memory refs. REVERTED all 10 via `git checkout HEAD -- <files>` (checkpoint made it clean). LESSON: these handlers are too varied for blind pattern-stripping; each needs reading + hand removal of its specific block + downstream aggregate/guidance/memory references. tsc + full suite are the safety net.

## REMAINING (10 handlers, by hand)
Simple (1-3 retired domains): clone-match, font-research, typography-excellence, component-research, design-references, motion-integration. Complex (7 domains + aggregates): all-seven-qa, accessibility, design-tokens, migration. Each: remove validateAll block + getRulesByDomain + passRate/passed + aggregates (totalRules/totalPassed/overallPassRate where present) + 'X domain validation' + 'Overall quality score' checklist rows + 'Domain Validation Results:' guidance + getSeverity + domain memory calls + customData *-rules entries. KEEP all non-domain content.

## ALSO STILL OPEN
- PolishStandard + AntiPattern absorption: needs correct redo preserving the shared helper exports the registry imports (absorb agent's shim wrongly gutted them).
- compactor agent (Task #3): edited claude/hooks/compact-memory.py, still running / report pending.
