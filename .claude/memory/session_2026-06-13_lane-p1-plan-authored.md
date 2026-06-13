---
name: Lane P1 classifier-tier TDD plan authored
description: Bite-sized writing-plans-format TDD plan for the first staged subsystem of the frozen v10 lane-intent-detection spec (registry + generation + classifier/hook tier), 13 tasks
type: project
relates_to: [reference_lane_impl_grounding_v10.md]
---

Collaborator: Jonah

Authored `docs/superpowers/plans/2026-06-13-lane-p1-classifier-tier.md` (Plan 1 of the
staged v10 lane-intent-detection rollout) as team member `plan-author-p1`.

## What the plan covers (P1 scope only)
Natural-language LANE routing replaces the six mode words (forge/kiln/bloom/canvas/
trim/ralph). 13 bite-sized TDD tasks:
1 lane registry JSON (`claude/hooks/sidecoach-lanes.json`) + python loader/validator
(`sidecoach_lanes.py`); 2 clause segmentation; 3 sanitize + occurrence-aware
informational/quoted blanking (length-preserving); 4 grouped-evidence scoring +
clause-bound 3-state scope (segment->negation->bind->aggregate); 5 decision flow
(ROUTE|CLASSIFY|CONTEXT_CHECK|OUT_OF_SCOPE|VERB|NUDGE_ELIGIBLE|SILENT) with explicit-
verb-beats-scope precedence + outcome table (route_floor 3 / route_margin 2); 6 wire
classifier into `sidecoach-keyword.sh` (NUDGE_ELIGIBLE->NUDGE/SILENT via cooldown);
7 TS mirror in `keyword-resolver.ts` + shared `sidecoach/parity/classifier-corpus.json`
run against BOTH python+TS; 8 `/sidecoach <phrase>` union in `slash-command-router.ts`;
9 enumerating test runner; 10 `generate-lanes.ts` + checked-in `lanes.generated.ts` +
`--check` (JSON/derivation/doc-section drift); 11 remove `modes.ts`; 12 hook corpus in
`test-sidecoach-keyword.sh`; 13 `install.sh` wiring.

Explicitly DEFERRED to later plans (stated in the plan): lane execution API, checkpoints,
lease/outbox, product validators, cleanPolicy/rule-registry generation, lane_converge
enablement, MCP tool rename (classify-intent/list-lanes).

## Key v10-spec ambiguities resolved
- Shared python classifier path unspecified -> `claude/hooks/sidecoach_lanes.py`; both
  python + TS load the single `sidecoach-lanes.json`; registries.ts consolidation -> P4.
- Fixture corpus path unspecified -> `sidecoach/parity/classifier-corpus.json`.
- `classify_floor` never named (only route_floor/route_margin) -> introduced
  `scoring.classify_floor=1`, derived from the (1,0)/(2,0)=CLASSIFY outcome rows.
- TS package boundary: classifier core made a shared engine module
  `sidecoach/src/lane-classifier.ts`, re-exported by mcp `keyword-resolver.ts` and imported
  by engine `slash-command-router.ts`; Step-0 fallback (duplicate + corpus guard) if the
  mcp tsconfig cannot cross-import.
- "generated-doc-section drift" -> P1 emits self-contained `sidecoach/LANES.generated.md`
  marker block that `--check` verifies; SKILL.md/CHEATSHEET.md/marketing wiring -> P4.
- prereqWaivers stored in JSON + lanes.generated.ts now; semantic --check enforcement
  (unused/duplicate/broad/stale) deferred to P2 (needs the flow-prereq graph).

## Golden lane->flow-sequence derivations (from verb-command-registry.ts, dedup/first-owner)
lane_build: A,B,E,F,G,H,I,M,J | lane_ship: K,I,L,V,M,J | lane_delight: F,H,T,J,M |
lane_live: N,F,J,M,L,K | lane_calm: J,X,M | lane_converge(loop): J,M,K,I,L. (lane_converge
matches spec section 9.)

## Environmental blocker (HARNESS BUG - flag to user)
Mid-session, an OS-level file-access grant (macOS TCC/Full Disk Access for the Read-tool
process) closed: the first ~7 Read calls succeeded, then ALL subsequent reads in
`~/Documents/Github/improv` returned `EPERM: operation not permitted, open ...`. Bash
(even sandbox-disabled) and subagents never had the grant; the auggie MCP returns HTTP 402.
Read VERBATIM before it closed: sidecoach-keyword.sh, sidecoach-modes.json,
sidecoach-intent.json, modes.ts, verb-command-registry.ts (plus the spec + grounding beat).
Could NOT re-read: slash-command-router.ts, keyword-resolver.ts, test-sidecoach-keyword.sh,
package.json, install.sh. Those 5 modify-targets are grounded in the spec + grounding beat
and each carries a "Step 0: confirm anchor" sub-step. NOTE: file WRITES worked throughout
(the plan and this beat wrote fine) - only content reads were denied. A 150s wait + retry
did not restore the grant.

## Files touched this session
- Created: docs/superpowers/plans/2026-06-13-lane-p1-classifier-tier.md (the plan)
- Created: this beat
