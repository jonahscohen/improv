---
name: Concise-mode feature committed + cmux install-time chmod folded
description: Committed the built-but-uncommitted concise-mode hook feature (default-ON brevity ruleset, SessionStart/PostCompact inject + UserPromptSubmit toggle, wired via the grounding cluster) and added the deferred install.sh chmod for cmux entry points (the cmux-review chip).
type: project
relates_to: [session_2026-07-26_dependency-map-wave-integration.md]
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: hooks invoked live (emit-body/SessionStart JSON/status all correct); install.sh bash -n clean; cmux test 16/16; concise mode active this session
confidence: high
---

Collaborator: Jonah. 2026-07-26. Jonah asked to finish the leftover concise-mode feature + the cmux chmod chip in one pass ("100% completion" before bed).

## Concise-mode feature (was built + live, but uncommitted)

Default-ON opt-in brevity ruleset (adapted from the i-have-adhd skill by ayghri, MIT). Five files, internally consistent:
- `claude/hooks/concise-mandate.sh` (SessionStart + PostCompact): injects the ruleset via `hookSpecificOutput.additionalContext` unless `~/.claude/.concise-disabled` exists (default ON, no per-machine install step). `--emit-body` prints the raw rules so the toggle single-sources them. Uses the proven mandate-hook JSON shape (not top-level additionalContext, which is not reliably honored).
- `claude/hooks/concise-toggle.sh` (UserPromptSubmit): "concise on/off/toggle/status" + "verbose"/"be concise" (whole-message match, never mid-prose). ON re-injects by calling the mandate's `--emit-body`; honest systemMessage if the ruleset can't be loaded.
- `claude/hooks/cluster-wirings.json`: the settings.json wiring (concise-mandate.sh on SessionStart+PostCompact, concise-toggle.sh on UserPromptSubmit). This is the manifest the grounding CLUSTER wires from (not app-wirings.json, which is for app hooks) - correct home.
- `claude/hooks/browser-tree.json`: grounding cluster 4 -> 6 hooks + per-hook TUI descriptions.
- `install.sh`: grounding `cluster_hooks()` list + FILES label "4 grounding hooks" -> "6 grounding hooks".

**Why it was safe to commit:** the feature is already LIVE this session (concise mode is ON - the mandate is in context) because the uncommitted files were deployed on this machine; committing just makes a fresh clone/install wire it too. Live settings.json carries 5 concise entries. Both hooks are 755.

**Verified by invocation (not just "it's wired"):** `concise-mandate.sh --emit-body` prints the rules; `concise-mandate.sh SessionStart` emits valid JSON with hookEventName=SessionStart + the ruleset in additionalContext; `concise-toggle.sh` on `{"prompt":"concise status"}` reports "Concise mode is currently ON." No test-concise*.sh authored (the feature is simple + live-proven; matches the other grounding-cluster hooks, which also have no per-hook test).

## cmux install-time chmod (the deferred review chip, task_d0b16b51)

Folded the cmux independent-review finding's part (b): `install.sh` now `chmod +x`es the cmux entry points that are exec'd directly (`cmux-preflight.sh`, `cmux`, `cmux-claude-launch.sh`) right after the `claude/cmux` dir symlink, so a mode-644 regression can't silently disable the version guard (the launcher gates on `[ -x ]`). The dir is symlinked, so the chmod re-asserts the source mode. test-*.sh intentionally stay 644 (invoked via bash/zsh). Part (a) - the 16th test assertion - already shipped in a15c290c. Verified: `bash -n install.sh` clean, chmod idempotent (files stay 755), `test-cmux-preflight.sh` 16/16.

## Files touched
- claude/hooks/concise-mandate.sh, concise-toggle.sh (new)
- claude/hooks/browser-tree.json, cluster-wirings.json (concise wiring)
- install.sh (grounding cluster 4->6 + cmux chmod)
- .claude/memory/ (this beat + index)
