---
name: P4d v2 (Codex-authored) reviewed + APPROVED - all 8 findings closed
description: Codex authored P4d v2 (1993 lines) closing all 6 P1 + 2 P2; I verified integrity (0 dashes/NUL/emoji) + line-by-line eligibility port faithfulness + response-deadline honesty + idempotency contract + migration completeness; approved for execution
type: project
relates_to: [session_2026-06-14_p4d-codex-review-handoff.md, feedback_codex_takeover_on_round_fail.md]
supersedes: session_2026-06-14_p4d-codex-review-handoff.md
---

Codex authored P4d v2 in place (task-mqdjr0v3; session 019ec555; 19m30s),
1477 -> 1993 lines. I reviewed; APPROVED for execution.

**Integrity (Codex --write bypasses content-guard, so I check):** 0 em/en-dashes,
0 smart-unicode, 0 NUL/control bytes, 0 emoji. git diff --check clean.

**Per-finding verification (substance, not notes):**
- P1-1 ELIGIBILITY PORT - VERIFIED LINE-BY-LINE. Task 2 ports the production hook
  EXACTLY: hookEligibilitySanitize = all 6 sanitize() steps same order/flags;
  hookEligibilityIsInformational = all 9 frames incl the U+2019 what's frame
  (encoded ’ to stay ASCII) + 'tell me about' + 'what X does'; intentEligible
  replicates mlist/subst + fires = hasStandalone||(hasAction&&hasTarget) +
  exempt-override (hasExempt && !hasNewBuild && !hasStandalone -> false). Intent
  registry confirmed to have all 5 keys (actions/substantive_targets/standalone/
  exempt/new_build). loadIntentRegistry defined+tested in Task 1. 4 divergence
  rows added to the SHARED parity corpus (not a parallel one). + the constructive
  corpus-wide COMPUTED-eligibility outcome assertion (not the wrong
  computed===declared one).
- P1-2 - stdio.test.ts in audit; cheatsheet 'modes' removed; MANDATORY repo-wide
  zero-reference gate (rg deleted tool names + 'modes' section, expect exit 1)
  BEFORE any dist build (Task 8 Step 6).
- P1-3 - every typed RegistryBundle (tools + 3 fault files) + every direct
  handler-dep fixture enumerated; lanes:null/intent:null + signal asserted via rg.
- P1-4 - response-deadline framing HONEST: raceResponseDeadline 'does not cancel
  p'; error 'engine operation may still complete under lease'; prose 'P4d does not
  thread the MCP signal into the engine'; at-most-one-committed via P4b-1 lease.
- P1-5 - startRequestId REQUIRED for start via .refine (no Date.now()); complete
  requires report; skip requires reason; e2e does real start->advance(complete w/
  valid StepReport)->status->list + same-startRequestId idempotency.
- P1-6 - explicit per-file dist allowlist (40 paths), never git add dist/.
- P2-1 - green intermediates; no surviving 'proceed when fail' language.
- P2-2 - server-signal test drives buildServer + in-memory MCP client + probe
  handler; asserts wrapHandler supplies a real AbortSignal (non-tautological).
- DEFERRED + flagged: bidirectional Python eligibility parity (extract hook
  _intent_eligible into sidecoach_lanes.py) kept OUT of P4d scope.

**Plan structure (9 tasks):** 1 registries loaders, 2 eligibility port+parity, 3
schemas (additive), 4 classify_intent (deletes resolve_keyword), 5 list_lanes
(deletes list_modes + cheatsheet rename), 6 AbortSignal propagation, 7
sidecoach_lane (4 ops + deadline), 8 pre-dist audit+gate+atomic cutover, 9 dist
build+transcript+staging+verify.

**Next:** commit v2 plan, then execute via subagent-driven-development (fresh
impl subagent per task in a named cmux team; spec + code-quality review between;
Codex final code-review; verify; merge). NOT pushed.

Collaborator: Jonah.
