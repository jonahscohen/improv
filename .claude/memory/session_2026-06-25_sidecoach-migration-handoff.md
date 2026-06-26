---
name: sidecoach-migration-handoff
description: Handed the Stage-2 migration (gut ExtendedDomainValidator -> registry-backed sync facade, delete 196 theater rules + 2 Tier-2 files) to Codex to IMPLEMENT in fresh context, Claude reviewing - per the standing hand-off-risky-components mandate + decide-with-Codex. Spec is precise/bounded. Registry at 58 rules; absorb phase done.
type: decision
relates_to: [session_2026-06-25_sidecoach-page-quality-absorb.md, session_2026-06-25_sidecoach-stage2-strategy-decision.md, session_2026-06-24_sidecoach-option-B-convergence-mandate.md]
---

Collaborator: Jonah Cohen (autonomy: decide with Codex, get the win). 

## DECISION: hand the migration IMPLEMENTATION to Codex, Claude reviews
The convergence finish (migrate ~18 ExtendedDomainValidator.validateAll call sites + delete the validator) is HIGH-BLAST-RADIUS: 19 importers, 17 flow-handlers, a 2760-line deletion + facade rewrite + test updates. I'm at extreme context depth. Per the convergence mandate's hand-off rule (risky/stalling components -> Codex implements, Claude flips to reviewer) + produce-and-verify, I handed the bounded, precisely-specced implementation to Codex (codex:rescue, fresh context) rather than rush it myself at depth. Spec: scratchpad/stage2-migration-spec.md.

## THE MIGRATION DESIGN (registry-backed sync facade)
KEEP ExtendedDomainValidator's class name + method signatures (validateAll/getDomains/getRulesByDomain/getSummary) + all exported TYPES (19 importers) + the empty-input skipped gate. REPLACE the body: validateAll now runs the ABSORBED registry rules (forms + page-quality, static -> sync checkProduct) on a ProductCheckContext built from the DomainCheckContext, and shapes a DomainValidationReport (totalRules=absorbed ~22 not 112; violationsByDomain keyed by findingClass). DELETE the 196-rule DOMAIN_RULES array + only-used-by-rules helpers + the 2 tier2 domain files (the theater + gesture rules vanish). Flow-handlers DON'T change; their displayed numbers become HONEST (registry-derived, smaller) = the endorsed honest-display collapse. validator-integration.test totalRules>=90 assertion updated faithfully to the registry-absorbed count.

## WHY a facade (not full call-site rewrite)
Keeping the class as a sync registry-facade = minimal blast radius (call sites unchanged) while DELETING all theater. The registry is the single engine; the facade just shapes output for existing consumers. A full rewrite of 17 flows to call runValidator directly is a later cleanup if wanted. This is honest convergence (theater gone, registry is the source), not a shortcut.

## HANDOFF BLOCKED -> implemented myself (verify-disciplined)
The Agent spawn FAILED: the cmux team session re-initialized mid-session (session-2ddbdd02 -> session-3a9e97fd; old config.json gone), so named spawn errored ("team file not found") AND unnamed spawn was blocked ("must be named") - a catch-22 from the session desync. The codex-arch-review proc (PID 14047) is orphaned in the old session. Couldn't delegate. So I IMPLEMENTED the migration myself, relying on tsc + the full suite + flow-handler tests as the safety net (they catch any leaked reference / shape error / broken flow).

## DONE: gutted to a 225-line registry-backed facade (was 3024)
- extended-domain-validator.ts: assembled new file = preserved exact TYPE interfaces (lines 11-136, 19 importers intact) + new sync registry-backed ExtendedDomainValidator (validateAll/getDomains/getRulesByDomain/getSummary run the ABSORBED forms+page-quality rules via sync checkProduct; LEGACY_SEVERITY maps registry severity -> legacy enum; toProductContext builds ProductCheckContext from DomainCheckContext; kept the empty-input skipped gate). DELETED the 196-rule DOMAIN_RULES array + the gesture/forms helper fns.
- DELETED src/domains/tier2-content-perf.ts + tier2-visual-copy.ts (the 2 Tier-2 modules) + their 2 obsolete test files.
- validator-integration.test: updated the 2 stale theater-count assertions (totalRules>=90 and >=112) to the registry-backed reality (>0 && <90 + count invariant; combined >24 + aggregation invariant) - faithful, not gamed.
- VERIFIED: tsc clean (only the 2 obsolete tier2 tests errored -> deleted); facade validateAll -> totalRules=22 (the absorbed set), status completed, domains a11y/polish/theming; generate --check clean. The 17 flow-handlers compile unchanged + now display honest registry-derived numbers (the endorsed honest collapse). Full suite running.

## RESULT: ExtendedDomainValidator THEATER DELETED, registry is the engine
2799 lines of theater gone. The flows route through the same facade method, now backed by the registry's 22 absorbed real rules. Stage 2 (merged absorb+migrate) effectively DONE pending the suite + a Codex review of the migration diff (file-handoff, since the teammate is orphaned).
