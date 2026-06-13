---
name: Lane P1 classifier-tier plan - verifier corrections applied
description: Applied 1 P0 + 4 P1 + 4 P2 already-confirmed fixes into the P1 implementation plan, grounded in live code
type: project
relates_to: [feedback_multiagent_verified_implementation_mandate.md, session_2026-06-13_lane-v10-review-repair-read.md]
---

Collaborator: Jonah

Applied an independent verifier's confirmed findings INTO `docs/superpowers/plans/2026-06-13-lane-p1-classifier-tier.md` (plan-only edits; no source touched). Each fix was re-grounded against the live code before editing.

**P0-1 (Task 8 - near-miss is NET-NEW, not reuse).** Verified: zero `matchKnownCommand`/`nearMissSuggestion`/levenshtein/"did you mean" anywhere in `sidecoach/src` or `mcp-server/src`; `parseSlashCommand`'s unknown branch just returns `{isCommand:false, reason:'Unknown command: /<cmd>'}`. Rewrote Task 8 to BUILD the near-miss machinery inline: `firstToken`, `knownCommandNames` (VERB_REGISTRY keys + SLASH_COMMANDS keys), `matchKnownCommand`, `levenshtein` (two-row), `nearMissSuggestion` (<=2 edit-distance over verbs/phase-commands/lane labels). Strengthened the UNKNOWN test to assert the suggestion string contains "did you mean" + "polish" (empty stub now fails). Fixed the provenance note + Step 0 (BUILD, not reuse) + File Structure row.

**P1-1 (Task 5 + 7 + 12 - VERB diagnostic must render).** `classify_intent` only set `winningLane` for ROUTE/CLASSIFY/CONTEXT_CHECK; a pure VERB outcome left it None, so the hook's VERB diagnostic ("non-routing diagnostic") never rendered yet Task 12 asserted it. Added a `diagnosticLane` field (Python result dict + TS `Decision` interface + both verb branches set it to the top score>0 lane). Hook VERB branch now derives its label from `diagnosticLane`. Strengthened the Task 5 test (`diagnosticLane == "lane_ship"`, `winningLane is None`).

**P1-2 (Task 9 - npm test blast radius).** A `src/__tests__/*.test.ts` glob would flip 1 suite -> ~88, pull in the two bench suites (t13-bench-harness, t16-bench-ledger; need `tsconfig.bench.json`, fail under plain ts-node), and DROP `src/intent-detector.test.ts` (lives outside `__tests__/`). Rewrote the runner to an explicit scoped SUITES list (intent-detector + the new lane suites), REQUIRED-set hard-fail for intent-detector, skip-with-warning for forward-declared lane suites, plus a baseline step.

**P1-3 (Task 11 - registries.ts orphan + freeze).** Verified the ONLY consumer of `modes.ts` is `mcp-server/src/registries.ts` (`../../dist/modes`); nothing in `sidecoach/src` imports it; `slash-command-router.ts` never imported modes (corrected that false claim). Since the MCP rename is P4, rewrote Task 11 to FREEZE `modes.ts` in P1 (do NOT delete) and documented the stale-`dist/modes.js` landmine (tsc does not prune dist, so deleting the source would let `npm run build` falsely pass). Named registries.ts/keyword-resolver.ts/list-modes.ts as the P4 consumers.

**P1-4 (Task 12 - real harness helpers).** Harness has `assert_fires/assert_silent/assert_mode_fires/assert_tiebreak/assert_intent_fires/assert_intent_silent` (label-first) + `run_hook/intent_out`; NO `assert_contains/assert_not_contains/assert_empty`. Added the two genuinely-missing helpers (full bash, label-first), reused `assert_silent` for empties, rewrote every corpus sample label-first, and drove the NUDGE cooldown cases through the real `intent_out(prompt, cdfile)` with the grounded nudge needle ("sidecoach flow or mode").

**P2s.** Noted LANES.generated.md is a P1 stand-in (real `<!-- lanes:generated -->` markers wired in P4); replaced the fragile `X if False else Y` one-liner with a plain assert; added `cd sidecoach/mcp-server && npm test` (+ the lane harness) to the final integration check; moved `import * as fs` to the top of keyword-resolver.ts in Task 7.

Self-review: re-scanned changed tasks for placeholders/stale-reference language and name/shape consistency. `diagnosticLane` threads through Python+TS result shapes and the self-review item-3 manifest; near-miss helpers are NET-NEW with full bodies; "enumerating" -> "scoped" everywhere; provenance + execution-handoff updated to reflect the files are now grounded. No new cross-task inconsistencies found.

Note: `grep`/`ugrep -c` returned empty under command-substitution in this sandbox; verified all edits via `python3 .count()` instead.

Files touched: docs/superpowers/plans/2026-06-13-lane-p1-classifier-tier.md (plan only).
