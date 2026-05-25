/**
 * Sprint 8 T6: Parameterized parity test across all 22 verbs.
 *
 * For every entry in VERB_REGISTRY:
 *   - invoke FlowExecutionEngine.process('/sidecoach <verb>') inside a sandbox
 *     project that has a real PRODUCT.md (so brand-verify does not gate-fail)
 *   - flatten the orchestrator's response (message + flowResults' guidance,
 *     checklist labels, artifact content, nextSteps + top-level guidance)
 *   - assert every parityChecklist substring appears in the flattened output
 *   - assert every parityPlus substring appears in the flattened output
 *
 * This test is expected to have MANY FAILs before T7 lands; T7 wires the
 * orchestrator to append the registry's guidanceAppend + parityPlus to the
 * result after the flow chain runs. The failure list this test prints is
 * the concrete target list T7 must satisfy.
 *
 * Do NOT weaken assertions to make this pass. Do NOT edit the registry to
 * match current orchestrator output. The assertions are the acceptance
 * criteria; T7 closes the gap.
 */
export {};
//# sourceMappingURL=sprint8-verb-parity.test.d.ts.map