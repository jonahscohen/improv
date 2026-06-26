---
name: watcher-overfire-fix
description: Fixed the codex-failure-watcher over-fire (it tripped on ANY command mentioning "codex", e.g. greps of codex logs). Now trips only when codex is actually INVOKED as a command (start / after a shell separator / behind timeout/env-vars), not as a grep/cat argument. Hand-tested across 5 cases.
type: reference
relates_to: [session_2026-06-25_doctor-hook-fired-live.md, session_2026-06-25_doctor-live-settings-activation.md]
---

Collaborator: Jonah Cohen. 2026-06-26.

## THE OVER-FIRE (deferred item from the doctor build, now closed)
codex-failure-watcher.sh tripped when `command matches /codex/` ANYWHERE + the output had a failure signature. So a monitoring `grep -n codex codex-failure-watcher.sh` (whose output contained "at capacity"/"ERROR") falsely injected the codex-doctor directive. It fired again this session on a log grep = the live trigger to fix it.

## FIX (command-position match) + CODEX FOLD
Replaced `re.search(r"codex", command)` with an INVOKE regex matching codex only at a command position:
`(?:^|[\n;&|])\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*(?:timeout\s+\S+\s+)?codex\b` (IGNORECASE). Matches `codex exec ...`, `... && codex ...`, `timeout 240 codex ...`, `PATH=x codex ...`, `... | codex ...`; does NOT match `grep codex file` / `cat log | grep codex`.
- CODEX REVIEW caught a residual over-fire in my first cut: I had included `(` in the separator class (to catch `$(codex ...)`), but `(` ALSO matches inside quoted grep patterns like `grep -E "(codex|ERROR)"` -> still over-fired. FOLD: dropped `(` from the separator class. Our codex calls all start at a command position anyway, so nothing real is lost. (Codex flaked 4x on "at capacity" during the review but its internal retry got the verdict through - the doctor treating itself.)
- ACCEPTED LIMITATION (Codex P2, not fixed): a path-qualified `/usr/bin/codex` or a backticked `` `codex ...` `` is not matched. The watcher is a best-effort NUDGE, codex is always on PATH in our usage, and shell-tokenization is over-engineering here.

## VERIFIED (hand-test, 5 cases)
1. `grep -n codex <file>` + failure output -> {} (no-op, the bug). 2. `codex exec ...` + "at capacity" -> TRIP. 3. `timeout 240 codex exec` + ERROR -> TRIP. 4. `cat log | grep codex` + "at capacity" -> {} (no-op). 5. `codex exec` + clean output -> {} (no failure sig). All correct.

## STATUS
Repo hook updated (claude/hooks/codex-failure-watcher.sh). The LIVE ~/.claude/hooks/codex-failure-watcher.sh is a symlink to the repo file, so the fix is live immediately (no restart - symlinked script, settings unchanged). Not yet committed (batching with the RENDERED_BACKED codegen guard).

## Files touched
- claude/hooks/codex-failure-watcher.sh
</content>
