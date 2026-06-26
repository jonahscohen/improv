---
name: stage6-milestone-mechanics
description: How to run the Stage 6 frozen-90 milestone correctly after the marketing-buzzword detector lands - the scorecard cache keys on collectorVersion+page-SHA (NOT detector code), so a --force re-collect + mapping regeneration is required or the new detector won't be measured/credited.
type: reference
relates_to: [session_2026-06-25_stage5-6-kickoff-grounding.md, session_2026-06-25_stage6-oneengine-audit-and-lowcontrast-hole.md]
---

Collaborator: Jonah Cohen. 2026-06-25. Lead prep for the Stage 6 milestone.

## CACHE GOTCHA (verified in eval/scorecard-shared.mjs + scorecard-collect.mjs)
- `isCompleteRecord` validates a cached page record on `collectorVersion === COLLECTOR_VERSION (3)` + `corpusSha` (page-content hash) ONLY. It does NOT hash the sidecoach detector code. So after changing the detector (adding marketing-buzzword), a plain `scorecard-collect.mjs` run would REUSE the stale sidecoach findings and NOT measure the new detector.
- => the milestone MUST run `node eval/scorecard-collect.mjs --force` (re-runs both tools; oracle cheap/unchanged, sidecoach re-renders ~89 pages via Playwright, ~30 min; 2 pages db_datausa/db_worldbank_data time out on the STATIC subjective ReDoS subprocess - expected, unavailable, not a regression).

## MAPPING REGEN (verified in scorecard-score.mjs:68,89,106 + scorecard-mapping.json)
- The scorer credits a finding as TP only if its rule is in `effectiveMapping[tool]` (exact ∪ semantic); unmapped findings are dropped + the scorer asserts the mapping was built from THIS cache's vocabulary (Codex score-review #2 guard) - so an unmapped new rule can ERROR/flag.
- marketing-buzzword maps EXACT (`"marketing-buzzword":"marketing-buzzword"` already in scorecard-mapping.json) so it self-maps via the exact path - LOW RISK, no Codex semantic pass needed. BUT the effectiveMapping must be REGENERATED from the new cache vocabulary: `node eval/scorecard-mapping.mjs` after the --force collect.

## MILESTONE SEQUENCE (run ONCE, after both Stage 5/6 detectors built into dist + Codex-reviewed)
1. `npm run build` (detector in dist).
2. `node eval/scorecard-collect.mjs --force`  (~30 min; run when teammates are NOT using Playwright to avoid contention).
3. `node eval/scorecard-mapping.mjs`  (regenerate effectiveMapping; marketing-buzzword exact-maps).
4. `node eval/scorecard-score.mjs`  (-> eval/corpus/scorecard.json).
5. Compare to baseline scorecard: OBJECTIVE must be UNCHANGED (0.936/0.917 - marketing-buzzword is subjective; low-contrast wiring is live-only, eval calls scanner directly). SUBJECTIVE: read the marketing-buzzword perClass row + the subjective aggregate + the bootstrap recall/precision CIs.
- NOTE: low-contrast live-wiring (Task #5) does NOT affect this scorecard (eval bypasses the registry). It's verified separately by tests + behavioral smoke.

## Files touched
- (reference beat; no code)
</content>
