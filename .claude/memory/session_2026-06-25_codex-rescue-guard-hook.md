---
name: codex-doctor hooks (no-relay guard + failure watcher) and protocol
description: Two hooks curing recurring codex harness failures - PreToolUse(Agent) codex-rescue-guard DENIES the no-relay teammate spawn; PostToolUse(Bash) codex-failure-watcher detects capacity/error in codex output and nudges retry-lean. Plus the 3-failure-mode codex-doctor protocol. Needs a session restart to take effect.
type: reference
relates_to: [reference_codex_rescue_teammate_no_relay.md, decision_hook_system_architecture.md, reference_codex_exec_hang_sigkill.md]
---

Collaborator: Jonah Cohen. Built 2026-06-25 to permanently cure recurring codex harness failures. Two hooks plus a protocol note.

# HOOK 1: codex-rescue-guard (no-relay disease)

## THE DISEASE
A `codex:codex-rescue` (also written `codex:rescue`) agent spawned as a NAMED teammate (cmux teams mode FORCES named spawns - unnamed Agent calls are blocked) runs codex fine but its toolset is Bash-ONLY. It has no SendMessage tool, so it CANNOT relay its findings back to the lead. It goes idle and the review is stranded in its own pane. ~7 minutes wasted each time before anyone notices. Full symptom/diagnosis writeup: [[reference_codex_rescue_teammate_no_relay]].

## THE CURE
A PreToolUse hook on the `Agent` tool (`claude/hooks/codex-rescue-guard.sh`) that detects the relay-incapable spawn shape AT SPAWN TIME and DENIES it, redirecting to the proven workaround: run codex DIRECTLY via the CLI (`codex exec -C <repo> -s read-only "$(cat prompt.txt)" < change.diff`), which is still a different model so it still satisfies cross-model produce-and-verify. Or use a general-purpose agent that runs codex and SendMessages the result.

**Trip condition** (all three): `tool_name == "Agent"` AND `subagent_type` contains both `codex` and `rescue` (case-insensitive substring test - matches `codex:codex-rescue` AND `codex:rescue`) AND `name` is non-empty (a named teammate). Otherwise emit `{}`. Any parse error -> emit `{}` (fail-open; never break Agent spawns).

**Why substring-on-both, not exact match:** the agent type is written two ways in the wild (`codex:codex-rescue` and `codex:rescue`); requiring both `codex` and `rescue` to be present catches both without also catching unrelated codex agents like `codex:setup`.

**Why unnamed = no-op:** an unnamed `codex:codex-rescue` is an in-process subagent whose final message returns as the Agent tool result, so it CAN relay normally. Only the NAMED-teammate form strands findings. The `name`-non-empty gate is what distinguishes the broken shape.

## WIRING
New PreToolUse entry in `claude/settings.json` with `matcher: "Agent"`, command `~/.claude/hooks/codex-rescue-guard.sh`, timeout 5. Added as a NEW object directly after the existing `Agent|Workflow` block (agent-teams-guard + model-router-guard); no existing entry was modified or reordered. Both Agent matchers fire on an Agent call and all their hooks run; a deny from any one stops the spawn. JSON validated with `python3 -m json.tool` -> JSON_OK.

The hook follows the standard contract in [[decision_hook_system_architecture]] section 6: `#!/bin/bash`, `INPUT=$(cat)`, parse with a small `python3 -c` block (never eval/shell-parse), emit the PreToolUse deny shape or `{}`, fail-open. Symlinked live at `~/.claude/hooks/codex-rescue-guard.sh` (hooks are per-file symlinks, not a directory symlink, so the link was created by hand to match the existing pattern; `ampersand --only claude` would also create it).

# HOOK 2: codex-failure-watcher (capacity/error disease)

## THE DISEASE
`codex exec` sometimes COMPLETES but returns a non-verdict: "Selected model is at capacity" (the recurring capacity flake - see session_2026-06-25_codex-capacity-retry.md) or a stream/request error line. When that slips by unnoticed, the produce-and-verify cross-model gate is silently skipped (a failed pass treated as if it ran).

## THE CURE
A PostToolUse hook on `Bash` (`claude/hooks/codex-failure-watcher.sh`) that, after a codex command completes, scans the output for a failure signature and INJECTS a reminder (not a deny - PostToolUse cannot deny) to retry with a leaner prompt or an alternate model rather than skip the gate.

**Trip condition** (all): `tool_name == "Bash"` AND `command` matches `/codex/` (case-insensitive) AND the command OUTPUT contains a failure signature. Output is pulled from `tool_response`, handling BOTH a bare string and an object with `stdout`/`output` (also `stderr`/`content`/`result`, with a `json.dumps` fallback). Signatures (case-insensitive): `selected model is at capacity`, `model is at capacity`, `at capacity`, `stream[ _]error`, `error sending request`, `request failed`; PLUS a case-SENSITIVE `^\s*ERROR\b` line (rust/codex-CLI style) so prose like "the error handling looks solid / 0 errors found" in a SUCCESSFUL review does not over-fire. Otherwise `{}`. Any parse error -> `{}` (fail-open; never break Bash).

**Why PostToolUse can't catch a hang:** PostToolUse only fires on tool COMPLETION. A wedged `codex exec` never completes, so this watcher targets capacity/error only. The hang path stays manual (failure mode 3 below).

## WIRING (hook 2)
New PostToolUse entry in `claude/settings.json` with `matcher: "Bash"`, command `~/.claude/hooks/codex-failure-watcher.sh`, timeout 5. Added as a NEW object alongside the existing PostToolUse `Bash`-touching entry (memory-nudge/verify-before-done/second-fix-gate); no existing entry modified. Both settings.json edits (hook 1 + hook 2) were done together to avoid file collision. Symlinked live by hand at `~/.claude/hooks/codex-failure-watcher.sh`.

# THE CODEX-DOCTOR PROTOCOL (3 failure modes)

No codex doc exists under `claude/docs/` (only `voice-discord-infra.md`), so per the lead's instruction the protocol lives here rather than in CLAUDE.md or a new doc.

1. **No-relay** (named codex-rescue teammate, Bash-only, strands its review) -> PREVENTED at spawn time by HOOK 1 (codex-rescue-guard). Redirect: run codex directly via the CLI, or a general-purpose agent that SendMessages the result.
2. **Capacity / error** (`codex exec` completes but returns "at capacity" or an error/stream-error line) -> DETECTED on completion by HOOK 2 (codex-failure-watcher). Treat: re-run with a LEANER findings-only prompt (feed codex the already-verified context to cut synthesis tokens) and/or `-m <alternate-model>`; if it persists after one retry, fall back to lead-gate + the partial trace (a completed cross-model pass still satisfies produce-and-verify). Do NOT silently skip the gate.
3. **Hang** (`codex exec` never completes, alive at ~0 CPU) -> CANNOT be hook-caught (no completion event). Manual: detect via elapsed-vs-CPU, kill with SIGKILL (`timeout -s KILL`), per [[reference_codex_exec_hang_sigkill]].

## RESTART REQUIRED (both hooks)
Hooks load at session start. Both scripts are on disk, symlinked live, and wired in settings.json, BUT this session's hook table was read at its own start and does NOT include the new entries. **Neither hook actually fires until the NEXT session.** Restart to activate. (Hand-invoking the scripts works now; only the automatic PreToolUse / PostToolUse wiring waits on restart.)

## HAND-TEST RESULTS (all pass)
HOOK 1 (codex-rescue-guard):
- TRIP `{"tool_name":"Agent","tool_input":{"subagent_type":"codex:codex-rescue","name":"codexreview"}}` -> deny JSON.
- TRIP `{"tool_name":"Agent","tool_input":{"subagent_type":"codex:rescue","name":"codexreview"}}` -> deny JSON.
- NO-OP `{"tool_name":"Agent","tool_input":{"subagent_type":"general-purpose","name":"buzzword"}}` -> `{}`.
- NO-OP `{"tool_name":"Agent","tool_input":{"subagent_type":"codex:codex-rescue"}}` (unnamed) -> `{}`.

HOOK 2 (codex-failure-watcher):
- TRIP codex command + `tool_response:{"stdout":"... Selected model is at capacity ..."}` -> inject JSON.
- TRIP codex command + string `tool_response:"stream error: connection reset"` -> inject JSON.
- NO-OP `ls -la` with clean stdout -> `{}`.
- NO-OP codex command + clean review output ("the error handling looks solid. 0 errors found") -> `{}` (precision: lowercase prose "error" does not over-fire).

## FILES TOUCHED
- `claude/hooks/codex-rescue-guard.sh` (new, chmod +x, symlinked to ~/.claude/hooks/)
- `claude/hooks/codex-failure-watcher.sh` (new, chmod +x, symlinked to ~/.claude/hooks/)
- `claude/settings.json` (new PreToolUse Agent entry + new PostToolUse Bash entry)
- `.claude/memory/MEMORY.md` (index pointer)
- this beat
