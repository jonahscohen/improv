---
name: FlowDomainIntegrator SUPERSEDED - recommend delete
description: flow-domain-integration.ts ruled redundant vs the live validateMultipleDomains path; wiring rejected (would be broken, not just redundant)
type: decision
relates_to: [session_2026-07-24_simplification-phase2-deadcode.md, session_2026-05-23_flow_domain_integration_fix.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: codex-review + grep + tsc
confidence: high
---

Ruling on `sidecoach/src/flow-domain-integration.ts` (FlowDomainIntegrator / createDomainIntegrator /
shouldApplyDomain), built 2026-05-23 for "Task #2: extract 7 domain rules into flows". North star was
"make it real if not superseded". **Verdict: SUPERSEDED. Recommend DELETE. Did NOT wire, did NOT delete
(delete is the lead's call, flagged).**

Choice made: recommend deleting flow-domain-integration.ts as redundant, plus its sole dependency
flow-domain-mapping.ts (dead once the integrator goes).

**Alternatives considered:**
- Wire the integrator into the live flow-execution path (enrichContextForHandler @ sidecoach-orchestrator.ts:519, whose `_flowId` param is unused): REJECTED. Creates the redundant second path the spec banned AND would be actively broken - see "broken" below. Nothing reads the metadata it would inject.
- Refactor the live path to use the integrator's flow->design-law matrix as a cleaner abstraction: REJECTED. The matrix is a strictly less capable, stale parallel; adopting it would downgrade executable validation to inert rule lists.

**Why superseded (evidence, all re-verified by me + independently by Codex/gpt-5.4):**
- ZERO importers. No *.ts outside the file itself references FlowDomainIntegrator/createDomainIntegrator/shouldApplyDomain (only dist/ compiled output does). flow-domain-mapping.ts (FLOW_DOMAIN_MATRIX, DOMAIN_FLOW_MAP, getDomainsForFlow, getFlowsForDomain, getPrimaryDomainsForFlow, getValidationPointsForDomain) is imported by NOTHING except the integrator. Not re-exported from any barrel.
- Domain rules already reach flows via TWO live mechanisms, neither using the integrator:
  1. ~12 flow-handlers import SHARED_DESIGN_LAWS / REGISTER_SPECIFIC_LAWS directly from design-laws.ts and hardcode their domains (motion handler -> .motion; design-tokens -> all 7; brand-verify iterates all). Pre-execution rule injection.
  2. Orchestrator (sidecoach-orchestrator.ts ~279-311, ~1431) calls getValidatorsForFlow(flowId) (flow-domain-validators.ts:219, the LIVE flow->validator-domain map) then compositionEngine.validateMultipleDomains(domains, result) (flow-composition.ts:229), writing result.validationResults. Post-execution VALIDATION.
- The live result.validationResults IS consumed: convergence-loop.ts:179 and build-report-aggregator.ts:140/201 (full {domain,status,passedRules,failedRules,message} shape). Failures are surfaced into result.message and can halt composite flows.
- The integrator only ENUMERATES rules into result.executionMetadata.enhancedContext.domainValidations and context.metadata.flowDomains - NO consumer reads those. It produces no pass/fail (validateDomains @ :57 just lists+counts), so it can't feed the consumers the live path feeds.

**Why wiring would be BROKEN, not merely redundant (the decisive nail):**
- Stale coverage: FLOW_DOMAIN_MATRIX lists only flowA_brand_verify..flowJ_tactical_polish (10 of 26 registered flows through flowZ). getDomainsForFlow returns [] for the other 16.
- Wrong key: the matrix uses domain 'uxWriting' (flow-domain-mapping.ts:135,198,219) but SHARED_DESIGN_LAWS exposes the key 'writing' (design-laws.ts:303). getSharedLawsForDomain('uxWriting') -> undefined, silently dropping the writing law set for every flow that lists it.

**Live-path caveat (out of scope, flagged for lead):** Codex noted getValidatorsForFlow auto-validation is not attached in every orchestrator branch, and one composite branch records memory before attaching validation results. That is a live-path coverage/order issue in flow-domain-validators/orchestrator (fenced territory), NOT a reason to wire the integrator, and NOT my task.

**Relation to prior work:** simplification-phase2-deadcode (2026-07-24) already flagged flow-domain-integration as a zero-importer dead candidate and reported it to Jonah without deleting. This ruling deepens that: it is not merely unimported, its JOB is superseded, and reviving it is a bug.

**Revisit when:** a consumer of context.metadata.flowDomains / executionMetadata.enhancedContext.domainValidations appears, OR the project deliberately wants a pre-execution rule-text-into-context surface distinct from the live post-execution validators (in which case build it fresh against the current 26-flow registry and the correct 'writing' key - do not resurrect the stale matrix).

Verification run: whole-repo grep (zero source importers), `npx tsc --noEmit` -> exit 0 (baseline green, orphan not load-bearing), foreground Codex read-only audit -> "AGREE (superseded, delete)" with independent grep + two added findings (build-report-aggregator consumer, stale matrix/uxWriting bug). No code changed; dist not rebuilt; no test added.

Files touched: none (ruling only). Evidence files: sidecoach/src/flow-domain-integration.ts, sidecoach/src/flow-domain-mapping.ts, sidecoach/src/flow-domain-validators.ts, sidecoach/src/flow-composition.ts, sidecoach/src/sidecoach-orchestrator.ts, sidecoach/src/design-laws.ts, sidecoach/src/convergence-loop.ts, sidecoach/src/build-report-aggregator.ts.
