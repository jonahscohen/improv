---
name: sidecoach-stage2-sequencing-decision
description: Jonah chose WRAP-THEN-RETIRE for the Stage 2/3 coupling - Stage 2 routes the 22 call sites through a runValidator-based facade that WRAPS the not-yet-absorbed static validators, deriving the existing pass-rate checklist from the merged result (display-preserving). Stage 3 retires the wrapper as rules are absorbed.
type: decision
relates_to: [session_2026-06-24_sidecoach-stage2-callsite-map.md, session_2026-06-24_sidecoach-option-B-convergence-PLAN.md]
---

Collaborator: Jonah Cohen. Asked via AskUserQuestion after the [[session_2026-06-24_sidecoach-stage2-callsite-map]] discovery (Stage 2/3 coupling: registry lacks ExtendedDomainValidator's 90 domain rules until Stage 3).

Choice made: **WRAP-THEN-RETIRE** (the recommended option).

**Alternatives considered:**
- Re-sequence 3 before 2: rejected - front-loads the biggest/riskiest unit (108KB / 90-rule absorb) before any call-site migration ships.
- Merge 2+3 into one unit: rejected - largest single blast radius (registry + codegen + 17 handlers + tests at once), hard to verify incrementally.

**Why wrap-then-retire:** keeps the plan order, display-preserving (derive the existing pass-rate checklist from the merged result = ZERO user-facing change), incremental and lowest-risk. Stage 2 establishes ONE integration point (flows stop reaching into validateAll directly; they call a runValidator-based facade), and Stage 3 retires the wrapped static validators as their rules are absorbed into the registry.

**The shape to design (pending Codex adversarial review before build):**
- A facade (e.g. runFlowValidation) that: (1) runs the registry path (runValidator) -> ProductValidationResult; (2) for not-yet-absorbed rules, ALSO runs the wrapped static validator(s) (Extended/Polish/AntiPattern); (3) merges into a unified report exposing BOTH the clean-policy gate AND the pass-rate checklist (totalRules/passed/violations/combinedPassRate) the flow-handlers display today.
- Migrate the 22 sites (1 Polish + 18 Extended + 3 AntiPattern) to call the facade instead of validateAll directly.
- Preserve validator-integration.test + sprint7-polish-validator-result.test behavior.

**Revisit when:** Stage 3 absorbs the 90 domain rules - then the wrapper's wrapped-validator arm shrinks to zero and is retired (the convergence completes for these flows).

## NEXT
Draft the wrap-then-retire facade design -> Codex adversarial design review (file handoff) -> build -> verify. Per the loop.
