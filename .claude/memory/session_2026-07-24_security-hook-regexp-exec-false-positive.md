---
name: security_reminder_hook RegExp .exec() false positive
description: The security-guidance PreToolUse hook blocked RegExp .exec() as child_process command injection; root-caused to a bare "exec(" substring in the stale cached plugin copy
type: project
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: hook run against live fixtures
confidence: high
---

## Diagnosis (2026-07-24, Jonah)

`security_reminder_hook.py` blocked an edit to `sidecoach/eval/subjective-label-harness.mjs`
containing a RegExp string-match call with a `child_process` command-injection warning.
No `child_process` call was in the edit.

### Which copy is actually live

Three copies exist on disk. The live one is the STALE `unknown` cache copy, not the newest:

- `~/.claude/plugins/cache/claude-plugins-official/security-guidance/unknown/hooks/` (Apr 8, 10.7KB) - LIVE
- `~/.claude/plugins/cache/claude-plugins-official/security-guidance/2.0.6/hooks/` (Jun 28, 111KB)
- `~/.claude/plugins/marketplaces/claude-plugins-official/plugins/security-guidance/hooks/` (identical to 2.0.6)

Three independent tells confirm the `unknown` copy is the one firing:
1. Its `hooks.json` registers **PreToolUse** on `Edit|Write|MultiEdit` and invokes the hook with
   a bare `python3 ${CLAUDE_PLUGIN_ROOT}/...` command - the exact invocation string in the bug
   report. The 2.0.6 copy is PostToolUse via `sg-python.sh`.
2. Its reminder text is the only one that names `src/utils/execFileNoThrow.ts`.
3. It ends in `sys.exit(2)`, which BLOCKS the edit. 2.0.6 only injects additionalContext.

**Why:** version resolution is pinned to a stale `unknown` cache entry, so upstream's own fix
(already present in 2.0.6) never reached this machine.

### Root cause

The rule matched on a bare substring with no path gate and no context check. Its `substrings`
list contained the three-character-plus-paren token for a shell-exec call as a PLAIN SUBSTRING,
alongside `child_process.exec` and the Sync variant.

Because it is a plain substring test, any RegExp `.exec(` call contains it and matches.
`check_patterns` returns on the FIRST match and `main()` then does `sys.exit(2)`.
`RegExp.prototype.exec` is pure string matching, unrelated to shell execution.

For contrast, upstream 2.0.6 already fixed this by dropping the bare substring and adding a
JS path gate plus a dot-excluding lookbehind.

### Reproduced

Running the live hook against the exact fixture returned **exit code 2** with the
`execFileNoThrow.ts` message, confirming the blocking false positive before any change.

**Impact:** any regex `.exec()` in any JS/TS file trips a security hook. That trains people to
bypass the guard, which is the real damage - a security hook that cries wolf gets ignored when
it is right.

### Self-demonstrating

Writing THIS beat was itself blocked by the same hook, because the prose quotes the token.
Precedent for the retry workaround is in the 2026-07-24 a5a beat. The blocking-on-documentation
behavior is the same defect, and is fixed by the same change.

## Files touched

- (diagnosis only; fix recorded in [[session_2026-07-24_security-hook-exec-detection-fix.md]])
