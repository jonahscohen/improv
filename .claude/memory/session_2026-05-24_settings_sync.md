---
name: session-2026-05-24-settings-sync
description: Sync repo claude/settings.json to live ~/.claude/settings.json state (followup queue item 3). Hooks + permissions + enabledPlugins synced; personal-preference keys (mcpServers, voice, voiceEnabled, effortLevel) stripped.
type: project
relates_to: [sidecoach_followup_queue.md, session_2026-05-24_multiple_choice_third_failure_fix.md]
---

Human collaborator: Jonah.

## What this session is doing

Followup queue item 3 from `sidecoach_followup_queue.md`: sync repo `claude/settings.json` to live `~/.claude/settings.json` so a fresh-machine install gets all current hooks (voice-gate, validation-guard, multiple-choice-detect-stop, sidecoach-postresponse, etc.) wired correctly.

## Drift survey

- Live: 400 lines. Repo: 163 lines. 274 diff lines. Live has 34 hooks; repo has 7.
- 18 hook commands present in live but missing from repo.
- Top-level key drift: live has `effortLevel`, `mcpServers`, `voice`, `voiceEnabled`; repo has `model`.

## Strategy resolved during brainstorming

Hooks + permissions only. Filter rules:
- Keep all hook entries except `node $HOME/.nyx/hook-bridge.cjs ...` (private telemetry).
- Normalize `/Users/spare3/.claude/` -> `~/.claude/` in any hook command path.
- Keep `permissions` and `enabledPlugins` from canonical source.
- Strip top-level personal-preference keys: `mcpServers` (contains API key references), `voice`, `voiceEnabled`, `effortLevel`.
- Preserve `model` setting and update to latest per CLAUDE.md mandate (Opus 4.7[1m]; repo had outdated 4.6).

## Decisions during execution

- **enabledPlugins source:** kept REPO's version (not live) because repo has more entries (plugin-developer-toolkit, chrome-devtools) and matches the CLAUDE.md statement that oracle is enabled. Live had `oracle: false` which contradicts CLAUDE.md.
- **model update:** repo had `claude-opus-4-6[1m]` which is outdated per CLAUDE.md "no legacy model versions" mandate. Updated to `claude-opus-4-7[1m]`.

## Filter results (from python sanity check)

- live hooks count: 34
- repo (current) hooks count: 7
- merged hooks count: 26 (live minus 8 nyx telemetry entries)
- Merged file: /tmp/settings.merged.json, 8836 bytes, 10 top-level keys (env, permissions, model, hooks, statusLine, enabledPlugins, extraKnownMarketplaces, alwaysThinkingEnabled, skipDangerousModePermissionPrompt, verbose).

## Next steps

1. Inspect the diff between current repo settings.json and the merged /tmp file.
2. Apply the merge (copy /tmp file to repo location).
3. Validate JSON.
4. Commit.
5. Mark followup queue item 3 DONE.

## reflect-nudge.sh decision (user)

Found during diff inspection: `reflect-nudge.sh` was registered in repo's SessionStart but NOT in live. The script exists in both locations. CLAUDE.md documents it as wired. User chose "Add reflect-nudge to live too" - so:
- Merged file: reflect-nudge appended to SessionStart (preserved from repo intent).
- Live ~/.claude/settings.json: reflect-nudge ALSO added to SessionStart (so it fires on this machine too).
- Verified both files parse and contain reflect-nudge entry post-update.

## Applied + verified (2026-05-24)

Copied /tmp/settings.merged.json over claude/settings.json. Verification:
- JSON parses cleanly (verification proof for a text config file - no UI to screenshot).
- 10 top-level keys: alwaysThinkingEnabled, enabledPlugins, env, extraKnownMarketplaces, hooks, model, permissions, skipDangerousModePermissionPrompt, statusLine, verbose. (No mcpServers, voice, voiceEnabled, effortLevel.)
- 27 hooks total across 8 events: PostCompact 2, PostToolUse 7, PreCompact 1, PreToolUse 5, SessionEnd 1, SessionStart 4 (includes reflect-nudge), Stop 2, UserPromptSubmit 5.
- ZERO nyx hook-bridge entries leaked.
- ZERO absolute /Users/spare3/ paths leaked.

Ready to commit.

## Files touched

- `/tmp/settings.merged.json` (staging file; will be deleted after apply)
- `claude/settings.json` (target of merge; not yet modified)
- `.claude/memory/session_2026-05-24_settings_sync.md` (this file, new)
