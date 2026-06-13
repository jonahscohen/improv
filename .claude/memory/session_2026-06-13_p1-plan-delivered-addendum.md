---
name: P1 plan delivered (addendum to env-incident resume)
description: plan-author-p1 delivered Plan 1 to disk before the env fully broke; corroborates the reads-die/writes-survive breakage; lists the 5 files the plan could NOT confirm against live code
type: project
relates_to: [session_2026-06-13_env-cwd-eperm-incident-and-resume.md, feedback_multiagent_verified_implementation_mandate.md]
---

Addendum to the env-incident beat. `plan-author-p1` (team lane-impl) finished
and SAVED Plan 1 before reads fully died:

**Artifact on disk:** docs/superpowers/plans/2026-06-13-lane-p1-classifier-tier.md
- 13 bite-sized TDD tasks + Setup + Final integration check + inline
  writing-plans self-review. Scoped to the classifier/registry/generation tier
  ONLY; explicitly defers execution API, checkpoints, lease/outbox, validators,
  cleanPolicy/rule-registry, lane_converge, and the MCP classify-intent/
  list-lanes rename to later plans.
- Resolved spec-silent choices (record so the fresh session doesn't relitigate):
  Python classifier = claude/hooks/sidecoach_lanes.py (both Py + TS load the one
  sidecoach-lanes.json); parity corpus = sidecoach/parity/classifier-corpus.json
  (pytest + ts-node assert identical outcomes); classify_floor = 1 (derived from
  the (1,0)/(2,0)=CLASSIFY outcome rows); core scope logic = shared engine module
  sidecoach/src/lane-classifier.ts re-exported by keyword-resolver.ts and imported
  by slash-command-router.ts (Task 8 has a duplicate+corpus-guard fallback if the
  mcp tsconfig can't cross-import); P1-scope --check = JSON/derivation/doc-section
  drift only (waiver --check enforcement deferred to P2); modes.ts removed, engine
  importers repointed getMode->getLane / .chain->.flowSequence.

**ENV breakage independently corroborated:** plan-author-p1 saw reads under
~/Documents/Github/improv return EPERM after ~7 successful reads, while WRITES
kept working; Bash (sandbox off), subagents, 150s-wait retry, all failed;
auggie MCP returns HTTP 402. Same signature I saw. Confirms harness/OS-level,
not session-specific.

**5 FILES THE PLAN COULD NOT CONFIRM against live code (reads died first) -
the task#2 verifier MUST anchor-check these before trusting their edits:**
slash-command-router.ts, keyword-resolver.ts, test-sidecoach-keyword.sh,
package.json, install.sh. Each carries a "Step 0: confirm anchor" guard in the
plan; treat those tasks as draft-grounded-in-spec, not live-verified.

**STATE:** Plan 1 is DRAFTED, NOT yet verified, NOT committed (git dead in the
broken session). On a healthy fresh session: (1) verify the plan per the regime
(separate agent + Codex), with extra scrutiny on the 5 files above; (2) commit
it; (3) then execute via subagent-driven-development. Do NOT re-author P1 from
scratch - verify-and-correct the existing draft.

Collaborator: Jonah.
