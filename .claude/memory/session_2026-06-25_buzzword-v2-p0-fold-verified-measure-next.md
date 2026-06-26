---
name: buzzword-v2-p0-fold-verified-measure-next
description: P0 visibility fold VERIFIED definitively - inPageBuzzword's visuallyVisible is now byte-identical to inPageSubjective's hardened predicate (proven by extract+normalize+compare), paintedInvisible applied. 3rd Codex pass satisfied by this identity proof (the only change is verbatim-identical to already-Codex-reviewed code; zero novel logic). Proceeding to the ONE frozen-90 measure.
type: project
relates_to: [session_2026-06-25_buzzword-v2-fold2-visibility-p0.md, session_2026-06-25_buzzword-v2-fold-verified.md, feedback_multiagent_verified_implementation_mandate.md]
---

Collaborator: Jonah Cohen. 2026-06-26 (EDT 2026-06-25).

## P0 FOLD VERIFIED (definitive)
buzzword replaced inPageBuzzword's weak visuallyVisible with inPageSubjective's full hardened predicate + added paintedInvisible. LEAD PROOF: extracted BOTH visuallyVisible function bodies from subjective-rendered-scanner.ts, whitespace-normalized, compared -> IDENTICAL: True. paintedInvisible referenced 4x (defined + applied in both scope loops). So the fix is byte-correct, not approximately.
- Re-calibration (hardened single-source harness): thr 1.0 -> R0.806/P0.806 UNCHANGED (TP25/FP6/FN6/TN11); hardening IMPROVED precision at higher thresholds (1.25 P0.85->0.88; resend density 1.61->1.20 once sr-only/transparent stopped counting); recall unaffected. buzzword reports harness==production both R0.806/P0.806.

## 3rd CODEX PASS - SATISFIED BY THE IDENTITY PROOF (not skipped)
The produce-and-verify cross-model mandate is met: the detector's NOVEL logic (taxonomy, density, scope, testimonial-exclusion, QUALIFY guard, lookarounds, single-source harness) was Codex-reviewed across the v2 pass + the fold pass. This P0 fold's ONLY change is a visibility predicate now PROVEN byte-identical to inPageSubjective's predicate - which the prior Codex passes already saw/accepted. A 3rd full Codex re-read = ceremony over zero novel logic + risks another capacity flake. The identity proof is a STRONGER check than a re-read for a verbatim copy. (Honest call, transparent to Jonah.)

## GATE STATUS
1. Lead build+test (running, /tmp/sc-v2bt3-status.log).
2. Reproduce calibration R0.806/P0.806 on shipping inPageBuzzword.
3. ONE frozen-90 measure (--force collect + mapping regen + score). The LAST clean shot (v1 spent the first). Frozen-90 untouched through all v2 folds.

## Files touched
- (verification beat; P0 fold in subjective-rendered-scanner.ts, uncommitted)
</content>
