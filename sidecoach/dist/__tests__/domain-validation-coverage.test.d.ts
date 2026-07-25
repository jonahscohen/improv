/**
 * Domain-validation coverage + ordering regression tests.
 *
 * Guards the live flow domain-validation path in sidecoach-orchestrator.ts:
 *   1. ORDERING (the closed bug): the composite loop (runCompositeLoop) used to persist a
 *      step's memory BEFORE attaching its domain-validation outcomes, so a composite could
 *      persist memory without its domain-validation results. These tests drive the real
 *      private runCompositeLoop and assert a domain-rule failure lands in BOTH
 *      result.validationResults AND the persisted flow-history memory entry.
 *   2. ISOLATION: recordFlowWithMemory persists the { domain, status, ... } domain outcomes
 *      under a DISTINCT key (domainValidationResults) so the { check, result, details }
 *      memory-channel array (result.memory.validationResults -> entry.validationResults,
 *      consumed by session-memory-writer + build-report) is never shape-corrupted.
 *
 * Uses flowE_motion_patterns: it has NO prerequisites (flow-prerequisites.ts) and is mapped
 * to ['performance', 'content_quality'] (flow-domain-validators.ts), so a fake handler can
 * make the performance domain fail deterministically without any project/PRODUCT.md setup.
 */
export {};
//# sourceMappingURL=domain-validation-coverage.test.d.ts.map