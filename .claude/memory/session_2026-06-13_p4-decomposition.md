---
name: P4 decomposition - durability folded in; split into 4 sub-plans
description: Jonah chose fold-P3-into-P4; P4 (the largest phase) split into P4a rule-registry+validators, P4b async-validator-execution+durability(folded P3), P4c loops+convergence, P4d MCP+cleanup; each plan->Codex->execute->merge
type: decision
relates_to: [session_2026-06-13_lane-p3-pivot-gutcheck.md, feedback_autonomous_phases_codex_partner.md]
supersedes: session_2026-06-13_lane-p3-plan-v2.md
---

Decision: Jonah chose "Fold P3 into P4, keep driving." Standalone P3 is dropped;
the P3 v2 plan doc (docs/superpowers/plans/2026-06-13-lane-p3-durability.md,
committed 143794b) becomes P4's durability sub-plan input. No P3 execution branch
was ever created (only plan docs on main) - nothing to clean up.

**P4 decomposition (4 coherent sub-plans, each its own plan->Codex->execute->
Codex->merge cycle):**
- **P4a - Canonical rule registry + product validators (identity layer).**
  product-rule-registry.ts (ProductRuleDefinition + CanonicalSeverity table),
  flow-validation-capabilities.ts (3 registries: ProductValidatorRegistration,
  FlowValidationCapability, LaneValidationPolicy), generated derivations
  (ownedRuleIds/registryScope/supportedSourceKinds/cleanPolicy + --check), and
  adapt the existing validators (polish-standard-validator.ts,
  extended-domain-validator.ts, domains/*) to four-status results + sourceRuleAlias
  canonicalization of the 22 duplicated POLISH_* rules. NO execution wiring yet.
  Foundation.
- **P4b - Async validator execution + durability (folded P3).** advanceLane runs
  bound product validators at sequence-step gates + loop iteration boundaries
  (worst-status-wins: clean/findings/inconclusive/error), as ASYNC EXECUTE - and
  THIS is where the lease/lock/fencing/schema-v2/outbox/AbortSignal durability gets
  built (per the P3 v2 plan, now meaningful + testable because there IS async work
  + external side effects to protect).
- **P4c - Loop execution + lane_converge + convergence floor.** loop lanes run
  iterations gated by requiredProductValidatorIds (release floor); lane_converge
  ENABLED only when the floor is met; ralph-loop.ts -> convergence-loop.ts.
- **P4d - MCP migration + cleanup.** sidecoach_classify_intent (replaces
  resolve_keyword), list-modes->list-lanes, sidecoach_lane tool, registries.ts lane
  loader + NUDGE parity, schemas/tools/get-cheatsheet, transcripts; delete modes.ts
  + dist/modes.js; SKILL.md/CHEATSHEET.md generated sections; marketing regen.

**Sequencing rationale:** P4a is the foundation (validators must exist before
execution can gate on them). P4b builds async execution + durability together
(durability protects the async validators - the whole point). P4c adds loops on top
of the validator gate. P4d is the surface/cleanup, last. Each merges to main before
the next.

**State:** P1+P2 merged. Starting P4a. Per autonomous mandate, continue the
loop; surface only genuine blockers / outward-facing calls.

Collaborator: Jonah.
