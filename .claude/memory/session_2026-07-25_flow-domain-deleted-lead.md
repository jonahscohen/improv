---
name: flow-domain-integration + flow-domain-mapping DELETED (superseded, lead ruling) + live-path follow-up spawned
description: flow-domain teammate evaluated per Jonah's "you decide" and found FlowDomainIntegrator SUPERSEDED with decisive evidence (domain rules already reach flows two live ways; the integrator feeds no consumer; and reviving it is BUGGY - stale 10-of-26-flow matrix + wrong uxWriting/writing key). Codex agreed. Lead independently re-confirmed both files dead and deleted them. A real live-path issue Codex flagged (getValidatorsForFlow not attached in every orchestrator branch + memory-recorded-before-validation) spawned as its own task.
type: decision
supersedes: 
relates_to: [session_2026-07-24_wave4-and-wireup-decision.md, decision_2026-07-25_flow-domain-integration-superseded.md, session_2026-07-24_simplification-phase2-deadcode.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: grep - both flow-domain-integration.ts and flow-domain-mapping.ts have ZERO importers (excl. each other); commit + dist held for the combined wire-up integration
confidence: high
---

Collaborator: Jonah. 2026-07-25. Of the 3 built-never-wired services Jonah ruled "make real", flow-domain-integration was the one delegated to the lead ("you decide"). Verdict: DELETE (superseded), not wire.

## Why delete (evidence, not preference)
Domain rules ALREADY reach flows two live ways, neither touching the integrator:
1. Per-handler direct import of `design-laws.ts` (~12 handlers hardcode their domains).
2. Orchestrator post-execution: `getValidatorsForFlow(flowId)` (flow-domain-validators.ts) -> `compositionEngine.validateMultipleDomains` -> `result.validationResults`, CONSUMED by convergence-loop.ts:179 + build-report-aggregator.ts:140,201.
`FlowDomainIntegrator` has zero source importers, validates nothing, feeds no consumer (writes to `enhancedContext.domainValidations` / `context.metadata.flowDomains` that nobody reads); the central `enrichContextForHandler` seam ignores `_flowId`. DECISIVE: reviving it would be BROKEN - `FLOW_DOMAIN_MATRIX` covers only flowA-J (10 of 26 flows) and keys domain `'uxWriting'` while `SHARED_DESIGN_LAWS` exposes `'writing'`, so `getSharedLawsForDomain('uxWriting')` returns undefined and silently drops the writing laws. Codex independently AGREED (superseded, delete, "no defensible reason to wire it").

## Lead action
Independently re-confirmed both `flow-domain-integration.ts` AND `flow-domain-mapping.ts` (100% dead once the integrator goes - only the integrator imported it) have ZERO importers. Deleted both. This is the "if superseded, say so with proof" branch of Jonah's instruction. The deletion COMMIT + dist rebuild is held for the combined wire-up integration (ref-update + drift-detector still running - shared dist).

## Live-path follow-up (SPAWNED as a task, not folded here)
Codex flagged a REAL issue in the LIVE domain-validation path (fenced territory, out of this unit's scope): `getValidatorsForFlow` auto-validation is NOT attached in every orchestrator branch, and one composite branch records memory BEFORE attaching validation results (a coverage + ordering bug - some flows may skip domain validation; a composite may persist memory without its validation). Spawned so whoever owns flow-domain-validators/orchestrator fixes it.

## Files touched
- deleted: src/flow-domain-integration.ts, src/flow-domain-mapping.ts (staged, commit held). this beat + MEMORY.md.
