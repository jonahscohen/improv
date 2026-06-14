---
name: Lane P4d MCP-migration plan drafted
description: no-placeholder TDD plan - expose lanes via MCP (classify_intent, list_lanes, sidecoach_lane tool, registries lane+intent loaders, AbortSignal); 3-way classifier parity preserved
type: project
relates_to: [session_2026-06-14_p4c-COMPLETE.md, session_2026-06-13_p4-decomposition.md, session_2026-06-13_lane-p1-task7-ts-mirror-parity.md]
---

Collaborator: Jonah

Drafted the P4d implementation plan (writing-plans format, TDD, no placeholders) at
`docs/superpowers/plans/2026-06-14-lane-p4d-mcp-migration.md`. NOT executed - a separate
implementer runs it. 1477 lines, 9 tasks + setup + deferred + self-review. Title ends ' - v1'.
ASCII-only verified (0 em/en dash, 0 NUL, 0 non-ASCII).

What P4d does: migrates the lane system into the MCP server (CLI-only today).
- registries.ts: loadLaneRegistry (sidecoach-lanes.json via the classifier's own validating
  loadRegistry; NO silent TS fallback - structure-invalid => null => DOWNSTREAM_UNAVAILABLE) +
  loadIntentRegistry (sidecoach-intent.json; null => eligibility false + no nudge text).
- sidecoach_classify_intent REPLACES sidecoach_resolve_keyword (tool DELETED, not aliased - spec
  says "REPLACES"). Returns full union ROUTE|CLASSIFY|OUT_OF_SCOPE|CONTEXT_CHECK|VERB|
  NUDGE_ELIGIBLE|SILENT. Computes eligibility itself via a NEW intentEligible() TS port of the
  hook's _intent_eligible(); NEVER reads/mutates the cooldown file (delivery = hook's job).
- sidecoach_list_lanes REPLACES sidecoach_list_modes; get-cheatsheet section enum modes->lanes.
- sidecoach_lane tool: start/advance/status/list wrap createExecutionEngine().{startLane,
  advanceLane,laneStatus,listLanes} (the same engine methods the CLI uses - NOT reimplemented).
- AbortSignal: ToolDependencies gains signal: AbortSignal; server.ts passes controller.signal;
  lane tool composes it via raceSignal at the tool boundary (INDEPENDENT of the runner's internal
  lease/heartbeat AbortController from P4b-1, which bounds validator EXECUTE inside the engine).

Key resolved ambiguities (reported to team-lead):
1. NUDGE_ELIGIBLE contract vs hook cooldown: MCP computes eligibility + returns NUDGE_ELIGIBLE,
   never touches cooldown (a no-cooldown-file test asserts this). Hook's NUDGE/SILENT mapping
   untouched (test-sidecoach-keyword.sh covers it).
2. resolve-keyword: REMOVED, not aliased.
3. AbortSignal composition: two independent layers, do not merge.
4. 3-way corpus: ALREADY covers all 7 outcomes (verified) - no extension needed; intentEligible()
   guarded by its own curated unit suite, NOT corpus-wide (eligibility is only meaningful for
   cases reaching the nudge branch, so a corpus-wide assertion would be wrong).

Two test runners both captured: mcp-server `npm test` (globs __tests__/{unit,integration,fault})
auto-discovers new tool tests; engine `npm test` (scripts/run-tests.ts SUITES) is the ONLY runner
of mcp-server/src/__tests__/classifier-parity.test.ts (unchanged). dist build+commit step included
(server runs from dist; tsc leaves stale removed-source artifacts so they are git rm'd explicitly).

Deferred: bidirectional Python eligibility parity (extract _intent_eligible into sidecoach_lanes.py)
flagged as recommended follow-up; list_lanes engine enrichment; legacy resolveKeyword/modes cleanup.

Why: grounds the plan in spec section 11 (1209-1232) + section 10 + merged code (keyword-resolver.ts
already has the P1 classifier; lane-runner/orchestrator expose the 4 lane methods).
How: read the merged mcp-server src, the engine lane runner/orchestrator/CLI, the Python hook +
intent json, the parity corpus + both run-tests; wrote bite-sized TDD tasks with real failing-first
tests, real impl, exact commands.

Files touched:
- docs/superpowers/plans/2026-06-14-lane-p4d-mcp-migration.md (new)
- .claude/memory/session_2026-06-14_lane-p4d-plan.md (new)
- .claude/memory/MEMORY.md (index entry)
