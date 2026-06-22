---
name: API-drift guard - detect breaking tool-contract changes + force an accommodation
description: Three hooks (api-drift-detector PostToolUse, api-drift-stop Stop, api-drift-ack UserPromptSubmit) that catch breaking API/tool-contract signals in tool results, log them, and block the turn until an accommodation is written. Built after the cmux-teams API change silently broke the teams workflow. 11/11 tests; wired live + repo + install.sh.
type: project
relates_to: [session_2026-06-22_cmux-teams-break-and-guard-fix.md, session_2026-06-22_verify-hook-hardening.md]
---

Collaborator: Jonah Cohen

Jonah asked for improv-wide guards that "detect changes in the API that are breaking, and then write accommodations to preserve the original workflow." He chose the **detect + force-accommodate** scope (fully-automatic accommodation-writing is unsafe - a script editing source on its own ships bad fixes). Motivating case: Claude Code 2.1.185 deprecated `team_name` / removed `TeamCreate`, which silently broke the cmux-teams workflow and the agent-teams-guard until I traced it by hand ([[session_2026-06-22_cmux-teams-break-and-guard-fix.md]]). This guard turns that class of silent break into a loud, blocking signal.

## The three hooks (claude/hooks/, symlinked live)
- **api-drift-detector.sh** (PostToolUse, all tools):
  - DETECT: on a NON-Bash tool result, if it matches a breaking-contract signature (deprecated / no longer supported|available|exists / has been removed / unknown parameter|argument|option|field / unexpected keyword / InputValidationError / should have been initialized / not a valid tool / is not a recognized / no such tool), append to `~/.claude/.api-drift.log`, set `~/.claude/.api-drift-pending`, and inject a directive (investigate + write an accommodation, do not just retry). Bash is skipped on purpose - its stdout ("not found", 404s) is too noisy; drift shows up in tool-API results.
  - CLEAR-ON-ACCOMMODATE: an Edit/Write/MultiEdit to a guard/wrapper/config (`/claude/hooks/`, `settings.json`, `*launcher*.sh`, `install.sh`) clears the pending flag - editing the guard IS the accommodation.
- **api-drift-stop.sh** (Stop): blocks ending the turn while pending is set. Safety: `stop_hook_active` short-circuit (block once per cycle, never loop forever); subagent/teammate exempt.
- **api-drift-ack.sh** (UserPromptSubmit): clears pending on a dismiss phrase ("drift handled" / "drift ok" / "false drift" / "ignore drift" / "drift cleared") for false positives.

## Wiring
Added to BOTH `~/.claude/settings.json` (live, backed up) and `claude/settings.json` (repo): PostToolUse -> detector, Stop -> stop, UserPromptSubmit -> ack. Added all three to `install.sh` CONFIG_HOOKS + the deactivate_config list. Live symlinks created in `~/.claude/hooks/`.

## Verification
Isolated test (/tmp, temp HOME): 11/11 PASS - drift result injects + sets pending; clean result no-ops; Bash drift-ish text skipped; edit-a-hook clears; edit-non-accom-file keeps pending; stop blocks on pending, allows on stop_hook_active, allows when no pending; "drift handled" clears, unrelated prompt keeps. `bash -n` clean on all three.

## Honest limitations (told Jonah)
- It does NOT auto-write accommodations (unsafe). It DETECTS the symptom and FORCES a human/assistant accommodation. "Write accommodations" = the block makes you write one, not a script writing code blindly.
- Detection is symptom-based (failure signatures in tool results), not a proactive schema diff. A hard pre-tool harness abort that never returns a PostToolUse result would not be caught (e.g. a PreToolUse deny). The cmux-teams "Internal error ... should have been initialized" DID return as a tool result, so it would be caught.
- Signatures are a tuned set; false positives are dismissible ("drift handled"), false negatives possible for novel wordings (extend the regex when found).

## Files
- claude/hooks/api-drift-detector.sh, api-drift-stop.sh, api-drift-ack.sh (new)
- claude/settings.json + ~/.claude/settings.json (wiring)
- install.sh (CONFIG_HOOKS + deactivate list)
