---
name: oracle-path-finder-fold
description: Codex gate on the scrub's one new logic (the de-named dynamic comparator-path finder) caught a P1 - it returned the FIRST cached plugin detect.mjs, which could be a different plugin's detector. Folded - now returns ONLY an unambiguous single match, else null (forcing the SIDECOACH_ORACLE_DETECT pin). Verified.
type: project
relates_to: [session_2026-06-26_competitor-scrub-complete.md, session_2026-06-26_codex-gate-claude-fallback.md]
---

Collaborator: Jonah Cohen. 2026-06-26.

## CODEX P1 (the gate worked, applying the new fallback rule - codex was available so codex ran)
The scrub genericized the comparator's install-path lookup (findCachedOracleDetect) to avoid hardcoding the competitor's plugin name. Codex caught: walking the plugins cache and returning the FIRST scripts/detect.mjs could pick a DIFFERENT plugin's detector and silently run the wrong comparator -> wrong eval results.

## FOLD
findCachedOracleDetect now COLLECTS all candidate detect.mjs and returns the match ONLY when there is exactly ONE (unambiguous); zero or multiple -> null. Ambiguity must be resolved explicitly via SIDECOACH_ORACLE_DETECT (resolveOraclePath still tries the env var first). Fail-closed: never guesses which detector is the comparator.

## VERIFIED
- This machine has exactly 1 cached plugin detect.mjs -> findCachedOracleDetect returns it; resolveOraclePath resolves a real path.
- A machine with multiple cached detectors -> null -> operator pins SIDECOACH_ORACLE_DETECT (the eval marks unavailable rather than running the wrong tool).
- npm run build green. (oracle-comparator is eval-only .mjs, not in the 57-suite test path; build + node probe are the verification.)

## Files touched
- sidecoach/eval/oracle-comparator.mjs (findCachedOracleDetect unambiguous-match fold)
</content>
