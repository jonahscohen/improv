---
name: codex-review.py - the reliable real-Codex review path
description: The canonical way to run a cross-model Codex review. ALWAYS invokes real Codex or fails with a distinct exit code - never silently downgrades to same-model. Use this for the produce-and-verify gate instead of the codex-rescue agent (which punts to self-review when codex is slow). Enforced by codex-rescue-guard.sh.
type: reference
relates_to: [session_2026-06-30_codex-rescue-silent-downgrade.md, reference_codex_exec_hang_sigkill.md]
---

Collaborator: Jonah Cohen. 2026-06-30.

## What / where
`~/.claude/hooks/codex-review.py` (source: `claude/hooks/codex-review.py`, executable, symlinked). A self-contained python3 tool that runs ONE real Codex review and either prints a genuine verdict (exit 0) or fails loudly. It exists because the `codex:codex-rescue` agent silently downgrades to a same-model self-review when codex is slow/wedged (see [[session_2026-06-30_codex-rescue-silent-downgrade]]). This tool cannot downgrade.

## Use it for the cross-model gate
```
git diff <base> | ~/.claude/hooks/codex-review.py "Review this diff for bugs. Findings by severity, terse." -C "$(git rev-parse --show-toplevel)"
~/.claude/hooks/codex-review.py --smoke    # health check (expects SMOKE_OK fast)
```
Prompt is POSITIONAL; the diff/context goes on stdin. Flags: `-C` repo, `-t` timeout secs (default 420), `-e` effort (default `high`; not xhigh), `-m` model override (default config gpt-5.5).

## Exit codes (the loud-failure contract)
- `0` real verdict (printed to stdout). Success = codex rc==0 AND non-empty stdout.
- `2` codex not installed -> use the independent-Claude-reviewer fallback (Verification Protocol #8).
- `3` wedged/timed out -> process group SIGKILLed (the documented hang).
- `4` capacity/backend error after one medium-effort retry, or any non-zero exit with output.
- `5` ran but produced no usable output.
A non-zero exit is NEVER reported as success. On 3/4/5, fall back to the independent-Claude-reviewer and SAY the cross-model pass did not complete - do not pretend it ran.

## Design rules baked in (hard-won)
- Prompt positional after `--`; diff via subprocess `input=` - NOT `codex exec < diff` (that stdin redirect wedges, per [[reference_codex_exec_hang_sigkill]]).
- Watchdog SIGKILLs the whole PROCESS GROUP (pgid captured right after Popen, before the leader can exit) - a wedged codex ignores SIGTERM and may spawn descendants.
- `model_reasoning_effort=high`, not xhigh (xhigh is what makes real reviews slow enough to trip the agent's wait window).
- SUCCESS is judged by codex's OWN exit code + non-empty output, NOT by absence of error words - codex emits ERROR/retry chatter on stderr even on success, and a real review legitimately DISCUSSES "at capacity"/"error". Capacity scanning is confined to the failure path (rc!=0) or a short rc==0 stub.

## Enforcement (codex-rescue-guard.sh, live)
The PreToolUse(Agent) guard now: DENIES any NAMED codex-rescue spawn (no-relay), and DENIES unnamed REVIEW-intent codex-rescue spawns (review/critique/audit + a code-artifact word) - both redirecting here. Investigation/fix/rescue use of codex-rescue is still allowed. Tests: `claude/hooks/_tests/test-codex-rescue-guard.sh` (17 cases, incl. word-boundary edges so `diff`/`patch`/`code` don't false-fire inside "different"/"dispatch"/"codebase" - folded from a real Codex review of the guard).

## Verified (2026-06-30)
Two full real-Codex review rounds of the tool itself (dogfood) folded 5 findings (exit-0-without-verdict, child-only SIGKILL/pgid race, stderr-ignored false-success, smoke loose match, retry false-positive on review content). Smoke healthy ~15s; timeout path exits 3 with no leaked process group.

## Files
- claude/hooks/codex-review.py
- claude/hooks/codex-rescue-guard.sh (extended)
- claude/hooks/_tests/test-codex-rescue-guard.sh
