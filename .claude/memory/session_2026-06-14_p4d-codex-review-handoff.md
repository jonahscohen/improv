---
name: P4d plan review NEEDS-FIXES (6 P1 incl parity-breaking eligibility) -> Codex authors v2
description: agent-drafted P4d hit 6 P1 + 2 P2 (eligibility port breaks 3-way parity, missed test-caller migrations, unsound raceSignal cancellation claim, weakened startRequestId idempotency, dirty-dist staging, broken intermediates); role inversion - Codex authors v2, I review
type: project
relates_to: [session_2026-06-14_p4c-COMPLETE.md, feedback_codex_takeover_on_round_fail.md]
superseded_by: session_2026-06-14_p4d-v2-approved.md
---

Codex P4d plan review (task-mqdjgmk9; session 019ec54e) = NEEDS-FIXES (no P0, 6 P1
+ 2 P2). Spec-bound + a 3-way-parity hazard -> Codex authors v2, I review.
CONFIRMED: resolve_keyword deletion (no remaining product caller), two test
runners + stale dist-tool removal correctly identified.

**6 P1 + 2 P2 for Codex to close:**
- P1-1 ELIGIBILITY PARITY: the helper uses laneSanitize + 7-frame
  laneIsInformational, but the hook eligibility path uses the non-length-preserving
  sanitize() + 9-frame is_informational (incl 'tell me about', 'what X does').
  Divergence -> e.g. 'tell me about design system' = MCP NUDGE_ELIGIBLE but hook
  suppresses -> breaks 3-way parity. FIX: port the hook's eligibility sanitizer +
  ALL 9 frames exactly; divergence tests ('tell me about', 'what X does',
  sanitized inline-code).
- P1-2 MISSED CALLERS: Task 8 omits __tests__/integration/stdio.test.ts (calls
  both deleted tools + cheatsheet 'modes') + tools.test.ts cheatsheet-modes case.
  FIX: add them; require a repo-wide old-tool-name scan before dist generation.
- P1-3 BUNDLE/SIGNAL fixtures: typed RegistryBundle + ToolDependencies.signal not
  migrated across all direct-handler tests (python-repl-faults, state-store-faults,
  ast-grep-faults). FIX: include every typed bundle + handler-dep fixture in Task 8.
- P1-4 raceSignal cancellation CLAIM unsound: it only stops AWAITING; the engine
  methods take no external signal, so after MCP returns TIMEOUT the engine
  continues + persists. FIX (decision): define the lane tool's external signal as a
  RESPONSE DEADLINE - the MCP call returns aborted/TIMEOUT but the in-flight engine
  op CONTINUES, bounded by its OWN P4b-1 lease/heartbeat (at-most-one-committed
  still holds). Do NOT claim it aborts engine execution. Threading the signal into
  the engine is OUT of P4d scope. State this honestly in the plan.
- P1-5 LANE INPUT idempotency: startRequestId optional + Date.now()-generated
  (conflicts spec 286 required transport idempotency key); schema doesn't require
  report for complete or reason for skip; e2e never exercises advance. FIX: require
  startRequestId on start (caller-supplied, or deterministic - NOT Date.now());
  validate complete-report + skip-reason; add a real advance round-trip e2e.
- P1-6 DIRTY-DIST staging: stages the whole mcp-server/dist while the workspace is
  dirty. FIX: explicit generated-dist allowlist (the P4c dist-staging discipline).
- P2-1 broken intermediates: plan proceeds when unit tests fail after deleting the
  old tool + defers broken fixtures. FIX: reorder/combine so every commit is green.
- P2-2 tautological signal test (creates deps w/ signal, asserts signal exists).
  FIX: handler probe through buildServer + in-memory client.
- CONSTRUCTIVE (Codex): add a corpus-wide assertion that classification using
  COMPUTED eligibility still yields each declared outcome (valid parity check).

**Action:** codex task --write authors v2. Then I verify+review (eligibility
parity port, all callers migrated, signal=response-deadline honesty,
startRequestId required, green intermediates), commit, gate, execute.

Collaborator: Jonah.
