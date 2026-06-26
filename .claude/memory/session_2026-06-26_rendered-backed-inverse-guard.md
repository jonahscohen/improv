---
name: rendered-backed-inverse-guard
description: Added the inverse-invariant guard to generate-validators --check (every rule declaring rendered-scan evidence MUST be in RENDERED_BACKED_RULE_IDS) - closes the gap that let marketing-buzzword ship un-promoted past the first --check. Verified it catches a synthetic violation + the real registry passes.
type: reference
relates_to: [session_2026-06-25_buzzword-v2-codex-harness-divergence.md, session_2026-06-25_codex-folds-verified.md]
---

Collaborator: Jonah Cohen. 2026-06-26. buzzword flagged this hardening when the Codex P2 (marketing-buzzword missing from RENDERED_BACKED) slipped past the first --check.

## THE GAP
src/validator-generation.ts validateRegistry enforced only the FORWARD rendered-allowlist invariant (rules IN RENDERED_BACKED declare only 'rendered-scan'). It did NOT enforce the INVERSE - a rule could declare evidenceRequirements ['rendered-scan'] yet be OMITTED from RENDERED_BACKED_RULE_IDS, so it was never promoted-required on a renderUrl and never failed-closed on an unavailable scan (silent false-clean). That is exactly the marketing-buzzword P2 (caught by Codex, not the suite).

## FIX
After the forward rendered-allowlist loop, added: for every rule whose evidenceRequirements include a RENDERED_EVIDENCE_KIND ('rendered-scan'), assert it is in renderedBackedRuleIds, else push an error. Forward + inverse together pin the set. Runs in the --check path (build fails on violation = caught at build time).

## VERIFIED
- Real registry: `generate-validators --check: OK` (no false positive - all rendered-scan rules are in RENDERED_BACKED).
- Synthetic violation: temporarily removed 'polish.tiny-text' from RENDERED_BACKED -> --check ERRORS "rule polish.tiny-text declares rendered-scan evidence but is missing from RENDERED_BACKED_RULE_IDS (it would never be promoted-required or fail-closed)". Source restored; re-check passes. Full build+test running.

## Files touched
- src/validator-generation.ts (inverse-invariant guard in validateRegistry)
</content>
