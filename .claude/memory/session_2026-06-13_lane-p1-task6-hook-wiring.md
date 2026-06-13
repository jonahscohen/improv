---
name: Lane P1 Task 6 - wire classifier into sidecoach-keyword.sh
description: Replaced the MODE tier in the UserPromptSubmit hook with the lane classifier; outcome->directive mapping + cooldown-gated NUDGE; verb/intent plumbing retained. Smoke tests + python 35/35 green; 13 harness failures are expected (Task 12 rewrites the harness).
type: project
relates_to: [session_2026-06-13_lane-p1-task5-decision-flow.md]
---

Collaborator: Jonah

Implemented **Task 6 only** of `docs/superpowers/plans/2026-06-13-lane-p1-classifier-tier.md` on branch `lane-p1-classifier-tier`. Modifies the LIVE hook `claude/hooks/sidecoach-keyword.sh`. Committed only that one file.

## Anchor confirmation (team-lead requirement)

Read the full live hook first. ALL plan anchors matched verbatim (file was at committed state, no drift): line 32 MODE_FILE, guard 35-38, env line 42, mode-load block 90-103, line-152 guard, mode/verb emit block 251-303, legacy intent tier 305-378.

## What was done (6 edits)

1. `MODE_FILE` -> `LANE_FILE` (sidecoach-lanes.json).
2. existence guard: MODE_FILE -> LANE_FILE.
3. env-passing line: drop MODE_FILE_PATH, add LANE_FILE_PATH + HOOK_DIR_PATH (so the heredoc can import the shared module).
4. mode-loading block -> import `sidecoach_lanes` + `load_registry` (try/except disables the lane tier on a structure-invalid registry without breaking verb/intent tiers).
5. `if not verbs and not modes and not intent` -> `... not lane_registry ...`.
6. Replaced the mode/verb match+emit block (251-303) with the lane-classifier dispatch: `_intent_eligible()` (folds the old intent-tier eligibility, computed on the hook's `sanitized`), then `classify_intent(prompt, lane_registry, verbs, intent_eligible=...)` mapped to hook output - ROUTE/CLASSIFY/CONTEXT_CHECK/VERB directives (each touch_cooldown), NUDGE_ELIGIBLE -> NUDGE (cooldown inactive) / SILENT (active), OUT_OF_SCOPE -> stderr only, SILENT -> fall through. A fallback verb tier handles the lane-disabled case. DELETED the now-dead legacy intent tier (305-378).

## Verification

- `bash -n` parses clean.
- python classifier suite (untouched): `python3 test_sidecoach_lanes.py` -> 35 passed, 0 failed.
- Step 4 smoke tests (the plan's Task 6 verification), all exact:
  - "make the landing page production-ready" -> ROUTE, additionalContext has "a release-readiness pass" + "Announce in one sentence".
  - "make this production-ready" -> CONTEXT_CHECK, has "without domain evidence".
  - "refactor the database migration script" -> empty output.
- Team-lead-requested confirmations:
  - VERB branch renders diagnosticLane: "audit this and make it production-ready" -> `<verb>audit</verb>` + "(Lane signal 'a release-readiness pass' noted as a non-routing diagnostic; do not auto-expand it into a lane.)".
  - NUDGE_ELIGIBLE cooldown gating: fresh cooldown -> nudge emitted; same prompt with cooldown now touched -> empty/SILENT.
- model-router-guard: hook stays pure regex/python, no LLM/network.

## Bash harness: 89 passed, 13 failed - ALL 13 EXPECTED (Task 12 rewrites the harness)

The plan states Task 6's harness coverage is "covered by Task 12's harness"; the CURRENT harness still encodes the removed mode tier + old intent-tier behavior. The 13 failures, all by-design consequences of Task 6:
- 6 mode-fires (forge/kiln/bloom/canvas/trim/ralph) - MODE tier removed.
- "forge + polish picks mode forge" (now `<verb>polish</verb>`), "bloom + trim picks mode bloom" (empty) - MODE tier removed.
- 3 tie-break tests (audit+polish, craft+animate, shape+craft+polish): classifier's VERB branch correctly picks the FIRST verb but no longer emits the "tie-breaking to first in registry" stderr warning (the plan's single-emit VERB branch; that warning now only fires in the lane-disabled fallback as "using X").
- "intent: build a pricing page": now CONTEXT_CHECK (lane_build "build a" evidence without domain evidence) instead of the generic nudge - arguably an improvement.
- cooldown test: 2nd prompt "build a hero section" now CLASSIFY (lane_build IN_SCOPE via "hero"); lane routing is NOT cooldown-gated (only NUDGE is), same as verbs were never gated.
The 89 passes include all 22 verb-fires, all sanitization/backtick/URL/XML/transcript + informational + word-boundary + zero-match + mixed-sanitization suppressions, the 4 NUDGE-eligible intent-fires, all 5 intent-silent, and "verb routes alongside intent tier".

## Follow-up cleanups (verifier P2-a cosmetic + P2-b coherence fix)

**P2-b (real bug, tied to the anti-false-fire purpose):** when the lane tier is ACTIVE and classify_intent returns SILENT (e.g. a verb only inside a blanked quote), the hook fell through to the legacy verb-tier fallback, which runs `match_entries` on `sanitize()` WITHOUT `blank_informational` - so it re-fired the verb. Probe `the spec said "polish it"` wrongly emitted VERB(polish). Fix: when the lane tier is active, classify_intent is AUTHORITATIVE - added an unconditional `sys.exit(0)` at the end of the `if lane_registry is not None` block, so SILENT no longer falls through. The fallback verb tier now runs ONLY in the lane-DISABLED (structure-invalid registry) safe-degrade path. Verified no real-verb regression: all 22 verb-fires stay green (they route via classify_intent's VERB branch, never the fallback) and `polish the hero` still fires.

**P2-a (cosmetic):** deleted the dead `mode_file = os.environ.get("MODE_FILE_PATH", "")` line (MODE_FILE_PATH is never set after Task 6).

**Regression tests added** to test-sidecoach-keyword.sh: `assert_silent "quoted polish stays silent" 'the spec said "polish it"'` (was FAIL pre-fix, now PASS) and `assert_fires "real polish still fires" "polish the hero" "polish"`.

**Re-verified all three surfaces after the fix:** python `35 passed, 0 failed`; Step-4 smoke (ROUTE/CONTEXT_CHECK/empty) all correct; harness `91 passed, 13 failed` - the 89 Task-6 passes UNCHANGED + 2 new passing assertions; the 13 failures are the identical obsolete set (3 tie-break, 6 mode-fires, 2 mode-precedence, build-a-pricing-page, cooldown) awaiting Task 12. All 22 verb-fires confirmed green.

## Files touched

- claude/hooks/sidecoach-keyword.sh (mode tier -> lane classifier dispatch; legacy intent tier deleted; P2-b authoritative-SILENT exit; P2-a dead-line removal)
- claude/hooks/test-sidecoach-keyword.sh (P2-b regression assertions)
