---
name: codex-folds-verified
description: Both codex findings folded + lead-verified correct (P1 low-contrast/gray-on-color live dedup, scanner untouched; P2 marketing-buzzword added to RENDERED_BACKED). Combined tree 64 suites green (teammate runs) + lead build+test running. buzzword flagged an inverse-invariant hardening guard. Next = frozen-90 milestone.
type: project
relates_to: [session_2026-06-25_codex-verdict-and-doctor-deployed.md, session_2026-06-25_stage6-milestone-mechanics.md]
---

Collaborator: Jonah Cohen. 2026-06-25.

## FOLDS VERIFIED (lead read the diffs)
- **P1 (sidestripe)** rendered-checks.ts checkLowContrast: builds a Set of gray-on-color selectors from the scan, filters low-contrast hits to exclude those selectors (the subtype wins), KEEPS selector-less low-contrast hits (never silently drop a real defect), inconclusive/fail-closed when scan unavailable. LIVE-PATH-ONLY; scanner emission untouched -> eval frozen. New regression test case 1c (gray+pure on same scan -> color-contrast fires on pure only). Correct.
- **P2 (buzzword)** validator-generation.ts: 'polish.marketing-buzzword' added to RENDERED_BACKED_RULE_IDS (now mirrors tiny-text: promoted-required on renderUrl + fail-closed on subjective-scan-unavailable). Regenerated codegen. New tests 5b/5c/5d (finding->fail+promote; renderUrl+unavailable->required+inconclusive blocks; no-renderUrl->dormant). Dev numbers UNCHANGED (wiring-only, no train-on-test). Correct.
- Both teammates independently report 64 suites green on the COMBINED tree (file-disjoint folds composed). Lead build+test re-running (/tmp/sc-folds.log) as the independent gate.

## HARDENING FLAG (buzzword, valid - a "permanently cure" item)
generate-validators --check does NOT enforce the INVERSE invariant: "every rule with evidenceRequirements ['rendered-scan'] must be in RENDERED_BACKED_RULE_IDS." That missing guard is exactly why P2 slipped past the first --check (marketing-buzzword declared rendered-scan but wasn't promoted). Adding that assertion to the --check would prevent recurrence of this whole bug class. Small, high-value, in the spirit of the doctor work. Routing to buzzword to add in parallel with the milestone (touches validator-generation --check only; disjoint from the eval/ milestone).

## NEXT
1. Confirm lead build+test green.
2. Frozen-90 milestone (--force collect + mapping regen + score) per [[session_2026-06-25_stage6-milestone-mechanics]]. Objective must stay 0.936; marketing-buzzword the only new eval signal.
3. codexdoctor finishing both doctor hooks (guard built; runtime watcher in progress).

## Files touched
- (verification beat; folds in rendered-checks.ts + validator-generation.ts + tests, uncommitted)
</content>
