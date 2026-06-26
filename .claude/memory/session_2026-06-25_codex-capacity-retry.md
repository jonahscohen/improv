---
name: codex-capacity-retry
description: Codex review #1 cross-checked the batch thoroughly but hit "model at capacity" on the FINAL synthesis (no ranked verdict, exit=0 misleading). The trace DID verify the key risk (retargeted tests are legitimate, not gamed). Re-running tighter; lead review already strong as fallback.
type: reference
relates_to: [session_2026-06-25_stage5-batch-verified-codex-running.md, reference_codex_exec_hang_sigkill.md, reference_codex_rescue_teammate_no_relay.md]
---

Collaborator: Jonah Cohen. 2026-06-25.

## CODEX FLAKE #3 (after no-relay + hang): "model at capacity" on final synthesis
`codex exec` ran the full adversarial review (275,930 tokens, ~7 min, thoroughly grepped call sites) but the FINAL model response errored twice with "Selected model is at capacity. Please try a different model." -> NO ranked findings emitted. The CLI still exited 0 (misleading - check the output tail for the verdict, not just exit code).
- WHAT THE TRACE DID confirm (before the capacity error) on the highest-risk item (test-gaming): the 10 retargeted tests are LEGITIMATELY retargeted, not assertions-deleted-to-go-green. Evidence pulled by codex:
  - generate-validators.test.ts:57-60 POSITIVELY asserts a11y.color-contrast is NOW a rendered rule + NOT a browser rule (new-behavior assertion).
  - browser-evidence-degradation.test.ts:8-15 documents the migration + still tests min-hit-area dormancy.
  - browser-evidence-contrast.test.ts:37-44 keeps the collector's own contrast-measurement test (orphan still produces the kind correctly).
- FIX: re-ran with a tighter prompt (review-prompt2.txt: terse, findings-only, give codex the already-verified context to cut synthesis token load) -> codex-review2.out (bg bpc8cx7yy). `-m <MODEL>` is available as a fallback if capacity persists (team rule: newest = gpt-5.4; gpt-5-codex is a current fallback, NOT outdated).

## FALLBACK IF CODEX KEEPS FAILING
Per [[reference_codex_rescue_teammate_no_relay]]: codex flakiness -> lead-gate + calibration is an acceptable fallback for produce-and-verify. The lead review is already strong: independent build+test green (57 suites), behavioral states are PERMANENT regression tests (rendered-scan-integration cases 1b + 4), eval-unchanged proven (scanner called directly), and codex's own partial trace cleared the test-gaming risk. A clean codex verdict is preferred; if unobtainable, document the partial-trace + lead-gate as the cross-model check.

## Files touched
- (reference beat; no code)
</content>
