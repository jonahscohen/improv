---
name: frozen90-milestone-launched
description: Frozen-90 milestone launched on the final gated tree (both codex folds in, lead build+test green 57 suites). Running --force collect + mapping regen + score in background. The ONE measurement of the Stage 5 batch; no dist rebuilds allowed until it completes (would corrupt the collect).
type: project
relates_to: [session_2026-06-25_codex-folds-verified.md, session_2026-06-25_stage6-milestone-mechanics.md, session_2026-06-24_sidecoach-option-B-convergence-PLAN.md]
---

Collaborator: Jonah Cohen. 2026-06-25.

## LAUNCHED (background blmtmlx4i, /tmp scratchpad milestone.log)
Final gated tree: both codex folds (P1 live dedup, P2 RENDERED_BACKED) + lead build+test GREEN (BUILD_OK, TEST_OK, 57 ": OK" suites; teammates 64). dist rebuilt with the folds.
Chain: `node eval/scorecard-collect.mjs --force` -> `scorecard-mapping.mjs` -> `scorecard-score.mjs`. ~15-30 min (2 pages db_datausa/db_worldbank_data ReDoS-timeout at 120s = expected unavailable).

## WHAT THE MILESTONE MUST SHOW (acceptance)
- OBJECTIVE unchanged (~0.936/0.917) - the folds don't change the scanner; marketing-buzzword is subjective; low-contrast wiring is live-only (eval bypasses registry). If objective moved, something's wrong.
- SUBJECTIVE: marketing-buzzword is the ONLY new eval signal. Expect ~+3-4 TP (8 present, Rule B dev recall 0.44), precision should HOLD (~0.42 aggregate - the banked win must not erode). Read the marketing-buzzword perClass row + the subjective aggregate + bootstrap CIs.
- Honest framing per the locked standard: even if subjective recall stays a statistical tie, we report it honestly (we win objective decisively + subjective precision significantly + closed the marketing-buzzword gap at higher precision than oracle's 0.4).

## HARD CONSTRAINT DURING THE MILESTONE
NO dist rebuilds until the collect finishes - the collect imports dist fresh per page, so a mid-run rebuild = inconsistent measurement. buzzword's hardening guard (inverse-invariant --check) is DEFERRED until after the milestone for this reason. codexdoctor's hook work (claude/hooks, settings.json) is safe - it doesn't touch sidecoach/dist.

## Files touched
- (checkpoint beat; milestone running, no code change)
</content>
