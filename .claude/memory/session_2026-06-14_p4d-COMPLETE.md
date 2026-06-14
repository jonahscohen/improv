---
name: P4d COMPLETE (merged) - lanes exposed on the model-facing MCP surface; Codex SHIP
description: P4d (MCP migration) built+verified+Codex-reviewed+merged - classify_intent replaces resolve_keyword, list_lanes replaces list_modes, new sidecoach_lane 4-op tool; faithful hook eligibility port (3-way parity); response-deadline (not cancellation); required startRequestId; Codex code review = SHIP zero defects; merged to main (NOT pushed)
type: project
relates_to: [session_2026-06-14_p4d-v2-approved.md, session_2026-06-14_p4d-impl-done-verified.md, session_2026-06-14_p4d-corpus-eligibility-decision.md]
supersedes: session_2026-06-14_p4d-impl-done-verified.md
---

P4d COMPLETE and merged to main. The sidecoach lane system - CLI-only until now -
is exposed on the model-facing MCP server. Plan Codex-authored v2 (role inversion),
I reviewed+approved; impl-p4d executed 9 tasks TDD; I independently verified;
Codex code review = SHIP (zero defects); I merged.

**Deliverable:**
- classify_intent REPLACES resolve_keyword: returns the full classifier union incl
  NUDGE_ELIGIBLE; computes nudge eligibility from the intent registry but NEVER
  reads/mutates cooldown (cooldown delivery stays the Python hook's job).
- list_lanes REPLACES list_modes; cheatsheet section 'modes' -> 'lanes'.
- NEW sidecoach_lane tool: 4 ops (start/advance/status/list) wrapping the SAME
  engine methods the CLI uses (createExecutionEngine().{startLane,advanceLane,
  laneStatus,listLanes}).
- intentEligible() is a FAITHFUL behavior port of the production hook
  (sidecoach-keyword.sh): non-length-preserving sanitize (6 steps) + all 9
  is_informational frames (incl 'tell me about', 'what X does/is', escaped ’)
  + _intent_eligible (mlist/subst, fires=standalone||(action&&target),
  exempt-override). 3-way parity (python/engine/mcp) preserved + pinned by the
  SHARED classifier-corpus.json + a corpus-wide COMPUTED-eligibility assertion.
- MCP AbortSignal threaded into handlers as a RESPONSE DEADLINE only: returns
  TIMEOUT but does NOT cancel an already-started engine op (it continues under its
  P4b-1 lease/heartbeat; at-most-one-committed holds). Not threaded into the engine.
- Required caller-supplied startRequestId (no Date.now()); complete requires a
  StepReport; skip requires a reason; real advance round-trip e2e.

**Plan gap found+resolved in execution (DECISION beat):** Task 2's computed-
eligibility assertion assumed every declared outcome reproduces under computed
eligibility, but OUT_OF_SCOPE/SILENT sit AFTER the eligibility gate so a
genuinely-eligible prompt can't reach them. Fixed by correcting ONE corpus row
(eligible false->true, OOS->NUDGE_ELIGIBLE; truthful to production) - NOT a test
carve-out. OOS retained by another row; Python parity intact. See
[[session_2026-06-14_p4d-corpus-eligibility-decision]].

**Verification (3 legs):** impl 9 tasks each green + MY independent re-run (commit-
scope only mcp-server+parity, deletions confirmed, 0 dashes/NUL/emoji, port uses
escaped ’, zero-ref gate clean, validationIssues real, engine build+tsc clean,
mcp 295/294 OOM-only, engine 45 suites both parity loops) + Codex code review SHIP
(eligibility port faithful, corpus decision correct, deadline honest, idempotency
correct, migration complete, dist/commits sound, signal test non-tautological, all
6 deviations sound, engine wiring correct; Codex ran tsc + python parity 23/23 +
mcp declared+computed parity 23/23).

**Commit chain (4 on main, FF from 616cbca):** 01616cd (T1 loaders), 2c2f751 (T2
eligibility port+parity), 8fb5518 (T3 schemas), 9f0ad55 (T4-8 atomic cutover).
T9 = no artifact delta. lane dist committed in the atomic cutover (explicit
allowlist; the server runs from dist).

**6 deviations, all Codex-confirmed sound:** corpus flip (decision); e.code vs
String(e); minimal lanes bundle for liveness; validationIssues field; smoke id
5->7; dist-before-gate ordering (dist gate-excluded + gate-before-single-commit).

**Known env caveat:** mcp-server python_repl OOM test fails on macOS (no cgroup
memory enforcement) - pre-existing, not P4d. See
[[session_2026-06-14_p4d-baseline-oom-env-fail]].

**NOT pushed** to origin (Jonah's standing call; main ahead by ~145 commits).

**Remaining lane work:** P4f (FlowHistory outbox publisher - small). DEFERRED:
P4b-2 (browser-evidence collector - FLAG the new Playwright dependency to Jonah
before starting), P4e (copy/linguistic gating). Flagged follow-up: make
eligibility parity BIDIRECTIONAL (extract the hook's _intent_eligible into
sidecoach_lanes.py + assert in test_classifier_parity.py) - deferred out of P4d.

Collaborator: Jonah.
