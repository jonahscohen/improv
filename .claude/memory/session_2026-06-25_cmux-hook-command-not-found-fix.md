---
name: cmux hook command-not-found fix (CMUX_CLAUDE_HOOK_CMUX_BIN empty)
description: cmux-injected hooks 500 with "/bin/sh: cmux: command not found" when CMUX_CLAUDE_HOOK_CMUX_BIN is empty; fixed by a cmux PATH shim at ~/.claude/cmux/cmux
type: reference
relates_to: [decision_hook_system_architecture.md]
---

Collaborator: Jonah.

## Symptom
At a Stop event the session showed a hook error: `/bin/sh: cmux: command not found`.
The failing hooks were the cmux-injected ones: `"${CMUX_CLAUDE_HOOK_CMUX_BIN:-cmux}" hooks claude stop` and `... hooks feed --source claude`.

## Where these hooks come from
They are NOT in ~/.claude/settings.json. cmux injects them at launch via `--settings` (base64 in `CMUX_AGENT_LAUNCH_ARGV_B64`). They are part of the app bundle launch and are not editable on this machine. Every cmux event hook (Stop, SessionStart, UserPromptSubmit, PreToolUse, Notification, SubagentStop, SessionEnd) uses the same `"${CMUX_CLAUDE_HOOK_CMUX_BIN:-cmux}"` form.

## Root cause (verified + reproduced 2026-06-25)
The hooks depend entirely on the env var `CMUX_CLAUDE_HOOK_CMUX_BIN` (absolute path to the bundled binary). When that var is empty/unset at hook-run time, the `:-cmux` fallback runs the bare name `cmux`. There is NO `cmux` binary on PATH anywhere on this machine (the bundled CLI lives only at `/Applications/cmux.app/Contents/Resources/bin/cmux`, which is not on PATH). So the fallback dies with `command not found` (exit 127) and the hook fails.

Reproduction:
- `env -u CMUX_CLAUDE_HOOK_CMUX_BIN /bin/sh -c '"${CMUX_CLAUDE_HOOK_CMUX_BIN:-cmux}" hooks claude stop </dev/null'` -> "command not found", exit 127.
- Same command with the var set to the absolute path -> "OK", exit 0.

So the failure is purely PATH resolution of the fallback, not a broken binary. The bundled binary is fine (57MB universal Mach-O, executable).

## Fix
A durable `cmux` PATH shim at repo `claude/cmux/cmux`, live via the existing symlink `~/.claude/cmux -> improv/claude/cmux`. `~/.claude/cmux` is already the second entry on PATH and is inherited by hooks, so the bare-name fallback now resolves to the shim, which exec's the real bundled binary (resolved from `CMUX_CLAUDE_HOOK_CMUX_BIN` / `CMUX_BUNDLED_CLI_PATH` / `CMUX_CLAUDE_TEAMS_CMUX_BIN` / `CMUX_AGENT_LAUNCH_EXECUTABLE` / the hardcoded `/Applications/...` path). The shim only ever exec's an absolute path, never the bare name, so it cannot recurse; if no candidate exists it exits 127 (no worse than before).

**Why a shim, not an env-var or settings edit:** the cmux hooks come from the app bundle at launch and cannot be edited here; controlling the launch env is also out of reach. Making bare `cmux` resolvable on PATH is the one lever in our control, and it heals the fallback no matter why the env var goes empty (belt-and-suspenders).

**Restart:** not required for the shim. `~/.claude/cmux` is already on PATH for the running session, so subsequent hook runs pick up the shim immediately (the file just needs to exist). A restart only matters for the CLAUDE.md behavioral change below, which applies next session.

## Standing protocol added
Jonah's directive: any time a hook error is produced, detect it and act in the moment - deploy an agent to permanently fix it, write a beat, and tell the user to restart if needed. A shell hook cannot "deploy an agent," but the harness already surfaces hook errors into Claude's context (that is how this one was caught), so the durable mechanism is a behavioral rule. Encoded as "## Hook Error Response Protocol (MANDATORY)" in claude/CLAUDE.md, referencing this incident as precedent.

## Re-applied 2026-06-25 (files had not persisted)
This beat existed but the two artifacts it describes were MISSING from the working tree at the start of a later 2026-06-25 session: `claude/cmux/cmux` did not exist (`command -v cmux` returned exit 1) and HEAD's `claude/CLAUDE.md` contained zero copies of the "Hook Error Response Protocol" section. Both were re-materialized this session (shim recreated + `chmod +x`, CLAUDE.md section re-added immediately after "Hook Override Protocol"). Likely cause: the original session authored them in an isolated worktree where only the beat made it back. Lesson for next session: the shim is untracked (`??`) and the CLAUDE.md edit is unstaged (`M`); they survive only as long as the working tree does - commit them to make the fix permanent.

Re-verification (verbatim):
- `command -v cmux` -> `/Users/spare3/.claude/cmux/cmux` (exit 0).
- `env -u CMUX_CLAUDE_HOOK_CMUX_BIN /bin/sh -c 'cmux hooks claude stop </dev/null; echo exit=$?'` -> `OK` then `exit=0` (previously exit 127). Empty-env fallback healed.
- Recursion-safety: each candidate is guarded by `[ -x "$c" ]`; a bare name like `cmux` is tested as a relative path against CWD (not searched on PATH) so it fails the test and is skipped - only absolute candidates can `exec`. Confirmed by reading the live shim back from `~/.claude/cmux/cmux`.

## Files touched
- claude/cmux/cmux (new - the PATH shim)
- claude/CLAUDE.md (new "Hook Error Response Protocol" section)
- .claude/memory/session_2026-06-25_cmux-hook-command-not-found-fix.md (this beat)
