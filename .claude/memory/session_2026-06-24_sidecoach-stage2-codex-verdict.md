---
name: sidecoach-stage2-codex-verdict
description: Codex's grounded Stage-2 design review verdict - wrap-then-retire as specified is mostly BUSYWORK and a naive merge TRIPLE-COUNTS the polish rules. Recommends folding Stage 2 into Stage 3 (migrate alias-by-alias) OR building a full sidecar contract (alias ledger + golden display tests). Re-surfacing to Jonah per the commitment.
type: decision
relates_to: [session_2026-06-24_sidecoach-stage2-sequencing-decision.md, session_2026-06-24_sidecoach-stage2-callsite-map.md]
---

Collaborator: Jonah Cohen. Codex (GPT-5.4) Stage-2 design review (adversarial, pre-build) via file handoff (scratchpad/stage2-design-findings.md, 187 lines, line-cited). The produce-and-verify loop caught this BEFORE I built ~22 call-site changes.

## VERDICT: wrap-then-retire as specified = mostly busywork; naive merge triple-counts
- **P0-1 TRIPLE-COUNT (the load-bearing finding, verified by 2 sources):** ExtendedDomainValidator EMBEDS the 22 polish rules (DOMAIN_RULES POLISH_001..022, extended-domain-validator.ts:176-180), PolishStandardValidator separately runs 24, and the registry ALIASES the same rules (sourceRuleAliases polish-standard:N/POLISH_0NN). Flow J already sums polish+extended; adding registry polish/static-a11y counts POLISH_001..022 THREE times. Anti-pattern flows would double-surface the 5 named bans. => NO count merge is safe.
- **P0-2:** one facade can't fit 3 structurally-different models (Polish numeric; Domain has violationsByDomain/passRateByDomain + skipped-state; AntiPattern is score/severity/list via validateBatch/validateCSS - NO validateAll). Registry is ASYNC; legacy is SYNC.
- **P0-3:** merging registry status into legacy counts LOSES Stage-1's fail-closed gate (a registry error/inconclusive could read as clean because legacy counts passed).
- **P1-1:** "migration" is unverifiable while static validators stay the count source. Real def of "migrated" = an alias has EXACTLY ONE active count source, enforced by a ledger (legacy_count_source / registry_shadow_only / registry_count_source) + golden display-preservation tests + retirement tests.
- **P1-2:** evaluateCleanPolicy treats duplicate registry ruleIds as ambiguity -> inconclusive (poisons the gate); synthetic ids give no coverage. Keep coverage registry-only; never inject static results into ProductValidationResult.
- **P1-5:** DomainCheckContext != ProductCheckContext (legacy passes metadata cssRules[]; registry wants projectPath/files -> empty collection/inconclusive). Facade needs a separate product-validation context.
- **P1-4:** my inventory was slightly stale (16 Extended SOURCE sites not 18; the brief's anti-pattern path was wrong - it's src/anti-pattern-validator.ts). Use a generated rg/AST call-site inventory test.
- **Question-2 answer (verbatim intent):** "busywork as specified. Meaningful only if Stage 2 produces a durable sidecar contract, alias ledger, and golden display-preservation tests used by Stage 3. A pure call-site facade rewrite while static validators remain active delivers no new validation signal."

## Codex's RECOMMENDED shape
PREFERRED: **fold the broad call-site rewrite into Stage 3** (the lane/registry path already exists via VALIDATOR_REGISTRATIONS + makeProductValidator; lane-runner already calls async validators with {projectPath,target,renderUrl}). Rewriting every legacy display call site now is mostly churn.
IF Stage 2 must exist: a SIDECAR facade with discriminated display payloads (exact legacy reports, unchanged) + a separate registryGate surface (worst status/findings/coverage) + registryOnlyAdditions OFF by default. HARD RULE: no registry result contributes to any legacy count until the corresponding alias is retired. Plus the alias ledger so Stage 3 can move aliases legacy->registry one at a time, with golden display tests.

## JONAH'S DECISION (2026-06-25, deliberate): MERGE - absorb + migrate together
First click was ACCIDENTAL ("absorb first, call sites after"); on the deliberate re-pick Jonah chose **"Merge: absorb + migrate together"** (my original recommendation).
NEW PLAN: Stage 1 DONE (rendered scanner -> registry). **NEXT = MERGED Stage 2**: absorb ExtendedDomainValidator's ~90 domain rules into the registry AND migrate the call sites in the SAME pass, alias-by-alias. As each rule gets a registry home, migrate its flow-handler call site so "migrated" is real (Codex: exactly ONE active count source per alias; no registry result in legacy counts until its alias retires; golden display tests; never inject static results into ProductValidationResult). Then Stage 4 (absorb remaining standalone validators) / Stage 5 (subjective) / Stage 6 (proof).
Why merge over the other options: sidesteps the triple-count + busywork entirely (no double-count or indirection when the migration only happens once the registry genuinely owns the rule), and it's ONE pass over the code rather than absorb-then-a-separate-migration-pass. Codex's verdict + the consumption heterogeneity both point here.
Task list: #2 = MERGED absorb+migrate (in_progress), #3 deleted, #4 blockedBy #2.

## My read (recorded): the wrap-then-retire intermediate was largely scaffolding (static validators stay the count source = no real migration without a ledger; the 90 domain rules have no registry home regardless). Re-sequencing to absorb-first makes the eventual migration genuine. Produce-and-verify WIN: Codex's adversarial design review caught this before I built ~19-22 call-site changes that would have triple-counted polish rules.

## Files referenced
scratchpad/stage2-design-findings.md (Codex), stage2-consumption-map.md (mapper), extended-domain-validator.ts:176, polish-standard-validator.ts:530, anti-pattern-validator.ts, clean-evaluator.ts:136/161, run-validator.ts:333.
