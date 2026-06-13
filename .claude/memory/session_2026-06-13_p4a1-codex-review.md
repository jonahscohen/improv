---
name: P4a-1 plan - Codex review NEEDS-FIXES (no P0, 8 P1, 3 P2) - drives v2
description: Codex found real spec-fidelity gaps in P4a-1 - evaluator drops findings/missing-required-rules/coverage-plan, types omit checkProduct/validateProduct/source-severity, generator+negative-tests underspecified, placeholder seed, alias-count error
type: project
relates_to: [session_2026-06-13_p4a1-plan-drafted.md, feedback_autonomous_phases_codex_partner.md]
---

Codex P4a-1 plan review (task-mqcyq1jw; session 019ec33a). NEEDS-FIXES. No P0.
All findings valid. Confirmed deferring validator-adaptation (P4a-2) + execution
(P4b) is coherent; the model/evaluator/generator just isn't spec-faithful yet.

**P1 (fold into v2):**
1. evaluateCleanPolicy always returns findings:[]. Must materialize a
   ProductFinding for every effective fail (needs validatorId in input),
   preserved for EVERY status (clean can carry tolerated/non-blocking findings).
2. Coverage gaps only applied to PRESENT rules: a MISSING required rule is
   silently ignored -> can become clean. Iterate policy.requiredRuleIds, treat
   missing/uninspected as inconclusive, RETURN the effective set (early returns
   use input.rules not effective - bug).
3. Evaluator ignores requiredCoverageByScope; inspectedRequiredRuleIds shortcut
   can't verify all-discovered-applicable-files / supported-evidence-alternatives.
   Define run-derived coverage input matching each RequiredCoverageRecord.
4. Types don't match spec: ProductRuleDefinition lacks checkProduct;
   ProductValidatorRegistration lacks validateProduct + generated fields;
   FlowValidationCapability.capability authored not GENERATED. Fix: include the
   full spec interfaces (checkProduct?/validateProduct? optional, attached P4a-2)
   OR rename phase-local types and don't claim they're the spec types; GENERATE
   capability in P4a-1.
5. Severity-divergence --check guard not implementable: rules carry only
   canonical severity, nothing for SEVERITY_TABLE to normalize+compare. Add
   declarative sourceSeverity (+ sourceVocabulary) metadata; require
   severityOverrideReason when table(sourceSeverity) != declared severity.
6. Required-rule + coverage generation underspecified: exact static-evidence
   predicate, level:'none' filtering, alternative derivation,
   requireAllDiscoveredApplicableFiles source. Specify pure derivation fns
   (evidenceRequirements.every(staticallySatisfiable); merge/filter source
   support; deterministic coverage boolean).
7. Generator tests only happy-path -> an impl could omit every rejection guard
   and pass. Expose pure validate/generate fns; failing-first fixtures for empty
   requiredRuleIds, missing metadata, duplicate key/owner, conflicting alias,
   unsatisfiable coverage, undocumented severity divergence.
8. "author the remaining 5 seed rules in the same shape" = placeholder. Spell out
   all 6 seed rules concretely + expected generated-policy assertions.

**P2:**
1. Alias wording WRONG: the 22 POLISH_* are 22 SEMANTIC rules; each is duplicated
   across polish-standard + extended-domain, so each canonical rule has the
   cross-registry source ids as aliases (22 canonical rules, 2 aliases each) -
   NOT all-22->one. Fix wording + test representative aliases + conflicting-alias
   rejection.
2. Capability test permits 'none' when productValidatorIds non-empty + doesn't
   verify every owner registration / lane classification. Assert exact generated
   capability equality; validate all owners + lane-member validators.
3. toleratedFindingCounts {} relies on evaluator default; emit explicit zero
   entries for every owned blocking (severity,findingClass) pair.

**v2 approach:** rewrite evaluateCleanPolicy (findings materialization +
missing-required-rule + coverage-plan); add checkProduct?/validateProduct?
optional + sourceSeverity metadata; generate capability + explicit-zero
tolerance; spell out pure generator derivation fns + all rejection guards with
negative tests; full 6-rule seed; fix alias wording/tests. Then re-Codex.

Collaborator: Jonah.
