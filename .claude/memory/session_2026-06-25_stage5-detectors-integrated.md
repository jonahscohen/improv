---
name: stage5-detectors-integrated
description: Both Stage 5/6 detector units built + integrated into the shared tree (marketing-buzzword Rule B + low-contrast live-wiring); combined batch = 18 files +244/-90 + 13 synthetic fixtures; lead running independent build+test verification before the Codex review + frozen-90 milestone.
type: project
relates_to: [session_2026-06-25_sidecoach-marketing-buzzword-operating-point.md, session_2026-06-25_stage6-oneengine-audit-and-lowcontrast-hole.md, session_2026-06-25_stage6-milestone-mechanics.md]
---

Collaborator: Jonah Cohen. 2026-06-25.

## INTEGRATED (both units composing in the shared tree)
- **Task #1 marketing-buzzword (buzzword teammate): DONE + accepted.** Own two-tier taxonomy, prominent-scope (>=20px), Rule B `(distinct>=3&&strong>=1)||(distinct>=2&&strong>=2)`. Dev recall 0.4375 / precision 1.0 on 18 negatives (5 dev + 13 synthetic). Wired into eval (subjective-rendered scan auto-flows + scorecard-score RENDERED_SUBJECTIVE) AND live (registry polish.marketing-buzzword + checkMarketingBuzzword). LEAD DECISION: Rule B FINAL, NO Rule A flip (a milestone-driven flip = train-on-test; the recall gap to oracle's 0.50 = 1 page, handled by honest framing - we win precision ~1.0 vs 0.4). One-line Rule A condition stays as documented future option, NOT a milestone lever.
- **Task #5 low-contrast live-wiring (sidestripe teammate): finalizing.** checkLowContrast added (mirrors checkGrayOnColor); a11y.color-contrast id-20 re-pointed ['contrast']->['rendered-scan'] so activateRenderedPolicy promotes it (live path now surfaces the biggest objective class); collector contrast probe ORPHANED (not deleted - lower risk/reversible). 9 test files retargeted off the old collector wiring. DETECTION-PRESERVING (eval calls scanner directly, frozen-90 unchanged).

## COMBINED BATCH (for the one Codex review)
18 files, +244/-90 + eval/fixtures/buzzword-negatives/01..13. generate --check passes (codegen reads the registry, picked up both). Golden count 59.

## GATE SEQUENCE (lead, pending)
1. Independent build+test of the combined tree (running, /tmp/sc-combined.log) + sidestripe's formal smoke-state report (renderUrl->required-fail, no-renderUrl->dormant).
2. ONE Codex adversarial review on the combined batch; fold findings.
3. Frozen-90 milestone (--force collect + mapping regen + score) per [[session_2026-06-25_stage6-milestone-mechanics]]. Objective must stay 0.936.
4. Stage 6 honest final framing + commit.

## Files touched
- (progress beat; code in the 18-file batch above, not yet committed)
</content>
