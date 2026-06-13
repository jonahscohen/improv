---
name: P1 plan verification - NEEDS-FIXES (separate agent), Codex secondary owed
description: plan-verifier (separate agent) verified the P1 classifier-tier plan vs v10 spec + live code; core sound, 1 P0 + 4 P1 grounded fixes; Codex secondary blocked by env residual
type: project
relates_to: [session_2026-06-13_p1-plan-delivered-addendum.md, feedback_multiagent_verified_implementation_mandate.md]
---

The separate-agent verification leg of the mandate ran (team lane-p1-verify,
agent plan-verifier) on docs/superpowers/plans/2026-06-13-lane-p1-classifier-tier.md.
Verdict NEEDS-FIXES. I confirmed the load-bearing findings against live code
myself (receiving-code-review discipline) - all accurate.

**Core is SOUND (verifier-confirmed, recomputed by hand):** all 6 golden
lane->flow derivations correct vs verb-command-registry.ts; decision-flow
precedence, scope tri-state, scoring constants (route_floor=3/route_margin=2/
classify_floor=1) faithful to spec sections 3-5; enum/field/fn names internally
consistent across Python/TS/corpus/tests; P1 spec coverage complete; deferred
items correctly excluded.

**Fixes to fold (all grounded, file:line-confirmed):**
- P0-1 Task 8: near-miss typo suggester does NOT exist (slash-command-router.ts
  unknown branch = `{isCommand:false, reason:'Unknown command'}` line 108; zero
  near-miss/matchKnownCommand/UNKNOWN anywhere). Plan must CREATE it (Levenshtein
  over VERB_REGISTRY names + SLASH_COMMANDS keys + lane labels) + matchKnownCommand;
  reword "reuse"->"build"; UNKNOWN test must assert the suggestion STRING, not
  just kind==='UNKNOWN' (current stub-passable).
- P1-1 Task 5+12: VERB outcome never sets winningLane, hook label derives from
  winningLane, so the "non-routing diagnostic" string never renders - yet Task 12
  asserts it. Derive the diagnostic label from the top laneScore>0 (or attach
  diagnosticLane on VERB) so the assertion holds (spec sec 5 step 8).
- P1-2 Task 9: npm test flip goes 1 -> ~90 existing __tests__ suites; bench
  suites (t13/t16) need tsconfig.bench.json and fail under plain ts-node; legacy
  src/intent-detector.test.ts (NOT under __tests__/) gets DROPPED. Audit the 90,
  segregate bench, explicitly preserve the legacy suite.
- P1-3 Task 11: modes.ts removal orphans mcp-server/src/registries.ts (line 22
  imports MODE_LIST/getMode from '../../dist/modes'; ModeEntry at 110; parsed.modes
  JSON path 128-141 breaks at modes.json->lanes.json; loadModesViaTs 249;
  getModeByName 259). Plan omitted it. Name it; decide P1 disposition (keep
  ModeEntry alive derived from LANES, or freeze legacy path until P4); note stale
  dist/modes.js landmine (tsc doesn't prune dist).
- P1-4 Task 12: harness helpers in the plan (assert_contains/assert_empty/
  assert_not_contains) DON'T exist; real ones are assert_fires/assert_silent/
  assert_mode_fires/assert_tiebreak (diff arg orders). Rewrite samples or add the
  3 helpers as the first step. (SIDECOACH_INTENT_COOLDOWN_FILE env var IS correct.)
- P2s: doc-section guard targets a new LANES.generated.md not the spec's
  SKILL/CHEATSHEET markers (OK as P1 scoping, flag for P4); fragile one-liner test
  (Task 5); parity test not run via mcp-server npm test; import-at-bottom (Task 7).

**Codex secondary: OWED, currently DOWN.** task-mqc3t968-boow1x failed:
"failed to load configuration: Operation not permitted (os error 1)" - the
macOS-temp-purge residual (shared Codex runtime broker socket in purged
/var/folders temp). My Claude shell recovered post-restart; Codex's runtime did
not. Must retry Codex before the plan is FINAL.

**Next:** corrector agent (plan-corrector, separate from author+verifier) applies
the fixes grounded in live files -> focused re-verify of changed tasks ->
Codex secondary retry -> commit verified plan -> execute via subagent-driven-dev.

Collaborator: Jonah.
