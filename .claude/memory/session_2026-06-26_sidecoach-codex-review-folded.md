---
name: Codex review of the sidecoach NL-tier fix - folded, re-verified
description: Independent Codex (gpt-5.5, xhigh) review of the 5-file diff. Verdict: NO P0/P1; 2 P2s. Folded both - (1) deploy-completeness check now runs INDEPENDENT of import success so a stray PYTHONPATH/cwd copy can't mask an incomplete deploy; (2) healthy-deploy test now asserts empty stderr, not just absence of DISABLED. Suite 115/0; P2-1 hole reproduced-then-closed.
type: project
relates_to: [session_2026-06-26_sidecoach-NL-tier-fixes-verified.md, session_2026-06-26_sidecoach-audit-is-diagnosis-reframe.md]
---

Collaborator: Jonah. 2026-06-26.

## CODEX REVIEW (gate satisfied)
Independent model review via `codex exec` (gpt-5.5, xhigh reasoning). It read the applied
files + sidecoach_lanes.py (not just the diff) and ran the suite itself.
Verdict: NO P0/P1. Exit-code behavior non-blocking (shell still ends `exit 0`; both healthy
and broken sims returned rc 0). sidecoach-intent.json parses. Suite 114/114 at review time.
Two P2s, both legitimate, both folded.
- Codex launch gotcha: macOS has no `timeout` (exit 127) and `codex exec "<prompt>"` HANGS on
  the "Reading additional input from stdin..." read when backgrounded. Fix that worked:
  run codex WITHOUT timeout and WITH `< /dev/null` to close stdin. (Logged for next time.)

## P2-1 (folded) - stray-copy could mask an incomplete deploy
The missing-sibling warning previously lived INSIDE the import except, so it only fired when
`import sidecoach_lanes` threw. But Python keeps searching sys.path - a stale deploy with no
sidecoach_lanes.py next to the hook could import a stray copy from cwd/PYTHONPATH, "work", and
never warn (Codex reproduced this). FIX: moved the on-disk sibling check to run BEFORE and
INDEPENDENT of the import; it warns whenever the canonical sibling is absent next to the hook,
regardless of whether a stray copy made the import succeed. The except now only surfaces other
errors (e.g. structurally-invalid registry) when the siblings ARE present. Reworded the message
("is NOT deployed next to the hook ... unreliable here") so it is accurate whether or not a
stray copy loaded. Reproduced the exact scenario after the fix: it now WARNS (was silent).

## P2-2 (folded) - healthy test under-asserted
"healthy deploy emits no deploy warning" only rejected stderr containing DISABLED, not ANY
noise (the comment promised no noise). FIX: assert `[ -n "$healthy_err" ]` (empty stderr).

## NEW TEST (locks P2-1)
Added case (1b) STRAY-COPY MASK: sibling absent next to the hook but exposed via PYTHONPATH ->
the import-independent on-disk check must STILL warn. Pins Codex's repro.

## FINAL VERIFICATION
- test-sidecoach-keyword.sh: 115 passed, 0 failed (was 114 + the new stray-copy case).
- Manual repro of P2-1: module absent next to hook + PYTHONPATH exposing the repo copy ->
  stderr now carries "sidecoach_lanes.py is NOT deployed next to the hook (...)". Hole closed.
- Hook stays non-blocking (suite + manual runs all exit 0); Python heredoc syntactically valid
  (suite executes it). No banned chars.

## Files touched
- claude/hooks/sidecoach-keyword.sh (proactive import-independent deploy check)
- claude/hooks/test-sidecoach-keyword.sh (needle fix, stray-copy case, empty-stderr assert)
</content>
