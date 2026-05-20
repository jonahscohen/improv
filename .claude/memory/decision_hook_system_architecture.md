---
name: Hook system architecture reference
description: Operational inventory of all hooks, flag files, precedence rules, duplications, and the procedure for adding a new hook
type: decision
relates_to: [reflection_2026-05-19.md, session_2026-05-05_memory-nudge-hook.md, session_2026-05-08_voice-gate-hook.md, session_2026-05-12_global-verification-hook.md, session_2026-05-18_screenshot-open-mandate.md, session_2026-05-18_validation-trigger-guard.md, feedback_hook_override_permission.md]
---

# Hook system architecture

Operational reference. Hooks live in `~/.claude/hooks/` (symlinked from `claude/hooks/` in this repo). Wired in `claude/settings.json`. All hooks read JSON input on stdin and emit JSON on stdout.

## 1. Hook inventory

| Filename | Event | Matcher | Type | Flag files | Purpose |
|---|---|---|---|---|---|
| `bash-guard.sh` | PreToolUse | `Bash` | HARD-DENY + GATE | reads `.memory-dirty`, `.needs-verification`, `.screenshot-pending` | Blocks attribution lines, force-push to main, rm on `.claude/memory`, legacy model IDs; gates `git commit` on memory/verify/screenshot flags; mirrors `validation-guard.sh` trigger-blocks for `cmux ... eval` |
| `content-guard.sh` | PreToolUse | `Write\|Edit\|MultiEdit` | HARD-DENY | none | Blocks file content with attribution lines, emdashes/endashes, legacy model IDs, or unicode emojis |
| `memory-approve.sh` | PreToolUse | `Write\|Edit\|MultiEdit` | GATE (allow) | none | Returns `permissionDecision:allow` for any path matching `.claude/memory/` so memory writes never prompt; deny from content-guard still wins |
| `memory-nudge.sh` | PostToolUse | (NOT WIRED in repo `settings.json` - see below) | INJECT + TOGGLE | sets/clears `.memory-dirty` | Toggles dirty flag on project file write; injects "PROJECT FILE CHANGED" nudge |
| `verify-before-done.sh` | PostToolUse | (NOT WIRED in repo `settings.json`) | INJECT + TOGGLE | sets/clears `.needs-verification` | Sets verify flag on code-file write; clears on screenshot/curl/Read of image |
| `verify-clear.sh` | PostToolUse | (NOT WIRED in repo `settings.json`) | TOGGLE | clears `.needs-verification` | Clears verify flag after any browser-tool call (Chrome MCP, cmux browser, Playwright) |
| `verify-manual.sh` | UserPromptSubmit | (NOT WIRED) | TOGGLE | clears `.needs-verification` | Clears verify flag when user types "verified", "looks good", "lgtm", etc. |
| `screenshot-open-mandate.sh` | PostToolUse | (NOT WIRED) | INJECT | sets `.screenshot-pending` | Captures path of cmux screenshot or chrome MCP screenshot, demands Read |
| `screenshot-open-clear.sh` | PostToolUse | (NOT WIRED) | TOGGLE | clears `.screenshot-pending` | Clears pending flag when Read targets the matching path |
| `validation-guard.sh` | PreToolUse | (NOT WIRED) | HARD-DENY | none | Blocks chrome MCP javascript_tool calls that use DOM inspection or synthetic events for validation |
| `voice-mandate.sh` | SessionStart | (none - all SessionStart hooks fire) | INJECT | reads `.voice-enabled` | Injects "VOICE ACTIVE" mandate or "VOICE MUTED" notice; no-op if voice-output MCP not installed |
| `voice-gate.sh` | PreToolUse | (NOT WIRED) | HARD-DENY | reads `.voice-enabled` | Blocks `mcp__voice-output__speak` when voice is muted |
| `voice-toggle.sh` | UserPromptSubmit | (NOT WIRED) | TOGGLE | sets/clears `.voice-enabled` | Toggles voice flag on "voice on/off/toggle/status" |
| `resume-guard.sh` | SessionEnd | (NOT WIRED) | TOGGLE (cleanup) | reads `.no-auto-resume` | Deletes cmux/nyx agent-session files at session end when no-auto-resume is on |
| `resume-toggle.sh` | UserPromptSubmit | (NOT WIRED) | TOGGLE | sets/clears `.no-auto-resume` | Toggles auto-resume flag on "resume on/off/toggle/status" |
| `reflect-nudge.sh` | SessionStart | (none) | INJECT | reads `~/.claude/last-reflect-timestamp` | Counts memory files newer than last reflection; injects one-liner nudge when threshold (15) exceeded |

**SURPRISE / FINDING:** Only `bash-guard.sh`, `content-guard.sh`, `memory-approve.sh`, `voice-mandate.sh`, and `reflect-nudge.sh` are wired in this repo's `claude/settings.json`. The other 11 scripts exist on disk and are referenced by CLAUDE.md and memory files but are **not wired into the current `hooks` block of settings.json**. Either they are wired in `settings.local.json` (per-machine), or they are dead code awaiting reconciliation. The reflection's finding #1 ("memory-nudge fires on Read") indicates the user is in fact running `memory-nudge.sh` on PostToolUse for Read, so the installed wiring includes Read in its matcher - which means there is undeclared per-machine wiring. This is the source-vs-installed drift called out in finding #5.

## 2. Flag file registry

All flags live in `~/.claude/`. Naming convention: leading dot, kebab-case, descriptive.

| Flag | Set by | Cleared by | Gates |
|---|---|---|---|
| `.memory-dirty` | `memory-nudge.sh` (PostToolUse on non-memory Write/Edit/MultiEdit, or Bash that writes files) | `memory-nudge.sh` (Write to a memory path; Bash touching `.claude/memory` or `MEMORY.md`) | `bash-guard.sh` denies `git commit` while set |
| `.needs-verification` | `verify-before-done.sh` (PostToolUse on code-file write; Bash with build/deploy indicators) | `verify-before-done.sh` (Read of `.png/.jpg/.jpeg/.gif/.webp`; cmux screenshot/snapshot; curl localhost); `verify-clear.sh` (any browser-tool PostToolUse); `verify-manual.sh` ("verified" / "looks good" / "lgtm" / "bypass verification" in prompt) | `bash-guard.sh` denies `git commit` while set |
| `.screenshot-pending` | `screenshot-open-mandate.sh` (cmux screenshot --out, or chrome MCP screenshot with save_to_disk) | `screenshot-open-clear.sh` (Read of the exact pending path) | `bash-guard.sh` denies further cmux screenshots and `git commit` while set |
| `.voice-enabled` | `voice-toggle.sh` ("voice on" / "voice toggle"); manual `touch` | `voice-toggle.sh` ("voice off" / "voice toggle"); manual `rm` | `voice-mandate.sh` SessionStart injection shape; `voice-gate.sh` denies `mcp__voice-output__speak` when absent |
| `.no-auto-resume` | `resume-toggle.sh` ("resume off" / "resume toggle"); manual `touch` | `resume-toggle.sh` ("resume on" / "resume toggle"); manual `rm` | `resume-guard.sh` deletes `~/.nyx/agent-sessions/*.json` at SessionEnd when set |
| `.voice-config` (JSON, not boolean) | manual edit | manual edit | Read by `tts-generate` and `voice-mandate` for voice/speed/verbosity preferences |
| `last-reflect-timestamp` (mtime, not flag) | `reflect-nudge.sh` (first-run touch); manual touch after reflection | replaced by `touch` after a fresh reflection | `reflect-nudge.sh` uses `find -newer` against this file to count |

Discord-related flags (`channels/discord/.skip-launcher`, `channels/discord/approved/<userId>`) live under `~/.claude/channels/discord/` and are owned by the Discord wrapper, not the hook layer.

## 3. Precedence rules

### Within a single event

For `PreToolUse` on a single Bash call, the hooks block in `settings.json` defines order. Currently:

```
Bash -> bash-guard.sh (single hook)
Write|Edit|MultiEdit -> memory-approve.sh, then content-guard.sh
```

Inside `bash-guard.sh`, denial reasons are evaluated top-to-bottom and short-circuit. Implicit precedence:

1. Attribution lines - hard-deny
2. Force-push to main/master - hard-deny
3. `rm` against `.claude/memory` - hard-deny
4. Legacy model IDs - hard-deny
5. `git commit` while `.memory-dirty` set - gate (clears when memory written)
6. `git commit` while `.needs-verification` set - gate (clears when UI verified)
7. `.screenshot-pending` is set:
   - block additional cmux screenshots
   - block `git commit`
8. `cmux ... eval` containing synthetic interactions or DOM inspection - hard-deny (mirrors validation-guard)

So a single command can hit attribution -> force-push -> memory-dirty -> needs-verify -> screenshot-pending -> cmux-eval. The first match wins. **Practical ordering: hard-denies precede gates precede pattern-mirrors.**

For `Write|Edit|MultiEdit`, `memory-approve.sh` runs first to grant `allow` on memory paths, then `content-guard.sh` can `deny` on forbidden content. Deny beats allow when both fire on the same tool call - so the memory-approve grant is purely about skipping permission prompts in `bypassPermissions` mode, not about bypassing content-guard.

### Across events on the same tool call

```
PreToolUse hooks (deny path can stop the call)
  -> tool executes
PostToolUse hooks (can inject context, toggle flags, no deny)
```

A single Write call can therefore: be approved by memory-approve, blocked by content-guard (stops here), or pass both and then trip memory-nudge dirty + verify-before-done. The PostToolUse hooks run in parallel as far as the user can tell - their flag-file effects compose.

### SessionStart ordering

`settings.json` declares two SessionStart hook blocks. They run sequentially in declaration order: `startup-check.sh` (memory loader) then `reflect-nudge.sh`. `voice-mandate.sh` is presumably wired in `settings.local.json` and runs alongside.

## 4. Known duplications and consolidation candidates

| Duplication | Files | Notes |
|---|---|---|
| **Trigger-block logic** | `validation-guard.sh` (chrome MCP javascript_tool) AND `bash-guard.sh` (cmux eval branch) | Same six patterns: synthetic `.click()`, `dispatchEvent`, private `_method()`, `__improv.method()`, `._array.push/splice/...`, DOM-inspection (`getComputedStyle`/`getBoundingClientRect`/`.textContent` etc.). Reimplemented in two languages-of-grep with subtly different scopes. Consolidation: extract patterns to a shared `~/.claude/hooks/lib/trigger-patterns.sh` sourced by both. |
| **Legacy model ID regex** | `bash-guard.sh` (line 26, Perl regex) AND `content-guard.sh` (line 46, Python regex) | Same intent (the OpenAI legacy family + the older Claude-3 family). Two implementations drift independently. |
| **Attribution-line regex** | `bash-guard.sh` (line 11) AND `content-guard.sh` (lines 34-40) | Same three forbidden bigrams. |
| **JSON-stdin parsing boilerplate** | Every hook reimplements `INPUT=$(cat); printf ... \| python3 -c '...'` to extract `tool_name`, `tool_input.command`, or `tool_input.file_path`. | A `parse-hook-input.sh` helper could trim 5-10 lines per hook. |
| **Toggle-script pattern** | `voice-toggle.sh` and `resume-toggle.sh` | Near-identical case statements over `on/off/toggle/status` with different flag file paths. Could be a single `flag-toggle.sh <name>` invoked by a thin wrapper. |
| **Dirty-state nudge text** | `memory-nudge.sh` emits two near-identical strings ("PROJECT FILE CHANGED..." vs "BASH WROTE FILES...") | One reusable string with a placeholder would be clearer. |
| **`is_read_only_command` lists** | `memory-nudge.sh` and `verify-before-done.sh` each carry their own list of read-only Bash prefixes (`ls`, `cat`, `git status`, ...) | Diverged: memory-nudge includes `node -e`, `python3 -c`; verify-before-done does not. |
| **Voice subsystem (reflection finding #8)** | `voice-mandate.sh` (SessionStart), `voice-gate.sh` (PreToolUse deny), `voice-toggle.sh` (UserPromptSubmit) | Three hooks, one flag, one feature shipped muted-by-default. Collapse into one mandate hook that reads the flag and one toggle hook; gate can fold into mandate by simply not loading the tool. |

## 5. Override mechanism

When a hook denies a tool call whose content is intentionally a hook-blocked pattern (writing CLAUDE.md docs that document a forbidden bigram, editing a hook script that contains the very emdash it bans, etc.), the protocol is in `feedback_hook_override_permission.md`: ask Jonah for permission to bypass, do not silently rephrase, weaken the language, or burn turns on workarounds. The user grants or denies based on context. There is no programmatic override switch and no flag file - bypass is conversational, one-shot, per-edit. After bypass is granted, the operator typically deactivates the matcher temporarily by piping the file through an external editor, since the in-session edit will still trip the hook.

## 6. Adding a new hook (checklist)

1. **Script location.** Create `claude/hooks/<name>.sh` in this repo. Use `#!/bin/bash` (or `#!/usr/bin/env bash` for the toggle-script family). `chmod +x` it. The installer symlinks it to `~/.claude/hooks/<name>.sh`.
2. **Stdin contract.** Read JSON on stdin: `INPUT=$(cat)`. Extract via a small `python3 -c` block. Never `eval` it or shell-parse it.
3. **Stdout contract.** Emit either `{}` (no-op) or a JSON object with the appropriate `hookSpecificOutput` shape:
   - PreToolUse deny: `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"BLOCKED: <reason>"}}`
   - PreToolUse allow (skip the permission prompt): `permissionDecision:allow`
   - PostToolUse inject: `{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"<text>"}}`
   - SessionStart inject: `{"additionalContext":"<text>"}`
   - UserPromptSubmit: optional `systemMessage` plus `additionalContext`
4. **Wire it in `claude/settings.json`** under the right event/matcher. Add a `timeout` of 5 seconds unless the hook calls out (startup-check uses 10). Matchers are pipe-separated tool names for `PreToolUse`/`PostToolUse`; SessionStart and UserPromptSubmit have no matcher.
5. **Flag-file conventions.** If the hook uses a flag, name it `~/.claude/.<kebab-name>`, set with `touch`, clear with `rm -f`, never write content unless reading the content matters (e.g. `.screenshot-pending` stores a path). Document who sets and who clears in the script header.
6. **Test by hand.** Pipe a fake JSON payload through it and inspect stdout:
   ```
   echo '{"tool_name":"Bash","tool_input":{"command":"git commit -m test"}}' | bash claude/hooks/<name>.sh
   ```
   Confirm `{}` for the no-op path and the deny/inject JSON for the active path.
7. **Install via dotfiles.** Run `ampersand --only claude` (or whichever component owns the hooks). The installer's symlink logic handles the rest. Confirm with `ls -la ~/.claude/hooks/<name>.sh`.
8. **Write a session memory.** `session_YYYY-MM-DD_<name>-hook.md` per the memory format. Update `MEMORY.md`. If the hook supersedes an older one, set `supersedes` / `superseded_by` on both ends.

Reference exemplars: `session_2026-05-05_memory-nudge-hook.md` (PostToolUse + flag-file pattern), `session_2026-05-08_voice-gate-hook.md` (PreToolUse hard-deny), `session_2026-05-12_global-verification-hook.md` (multi-tool PostToolUse with INJECT + TOGGLE composition).

---

**Drift to reconcile:** the wired set in `claude/settings.json` is materially smaller than the on-disk set. Either back-fill the wiring or remove the unused scripts. Currently the installed runtime is the source of truth, and that is not in this repo.
