---
name: Apply Codex review fixes (8 items) and remove the review file
description: Acted on every actionable finding from CODEX_REVIEW_FINDINGS.md. MultiEdit security gap closed, bootstrap --help made side-effect-free, install.sh stale comments fixed, dead picked-yesplease check replaced with picked-ampersand, statusline gained jq guard, startup-check load-order rewritten to match the CLAUDE.md contract, README bootstrap description corrected, bypassPermissions documented as a deliberate choice, additive language tightened, review file removed.
type: project
---

Collaborator: Jonah Cohen

# What changed (per Codex finding)

## High priority

### MultiEdit content-guard gap (security hole)

Previous matcher was `Write|Edit`. AI-attribution lines, emdashes, emoji, and legacy model IDs could land via MultiEdit and skip the guard entirely.

- `claude/settings.json` matcher: `Write|Edit` -> `Write|Edit|MultiEdit`
- `claude/hooks/content-guard.sh` Python branches: added `elif tool == "MultiEdit"` that joins every `new_string` from the `edits` array, so the same forbidden-pattern checks run against the combined content.
- Smoke-tested via python (couldn't use bash directly because the test payload contains the literal forbidden string and bash-guard correctly blocks it from the command line). Result: deny decision fires correctly when forbidden content is in any of the MultiEdit edits.

### bootstrap.sh `--help` was not side-effect-free

Codex caught this. `--help` fell through to the catch-all in the flag parser, got added to INSTALLER_ARGS, and the bootstrap proceeded to clone+install before install.sh's --help finally fired.

- Added a `print_help()` function with full usage block including all bootstrap-specific flags (`--dir`, `--no-reload`, `--help`/`-h`) and the env var overrides.
- Added `--help|-h)` case at the top of the flag parser that calls `print_help` and exits 0 BEFORE any side effect (clone, pull, install).
- Verified: `bash bootstrap.sh --help` now prints usage and exits cleanly.

### `claude/settings.json` permissions documentation

`defaultMode: bypassPermissions` + `skipDangerousModePermissionPrompt: true` is the most aggressive Claude Code permission setup. Codex flagged it as too broad for public reuse. Both my own security review and Codex agree.

Decision: keep the settings (intentional Yes&-machine velocity tradeoff), but document it explicitly in CLAUDE.md so new developers see what they're inheriting and how to change it.

- Added a new `## Permission Posture (deliberate choice)` section between the Oracle QA gate and Code Quality. Documents what bypassPermissions does, why we chose it, what the hook layer still blocks regardless, and exactly how to change to per-tool prompting (`defaultMode: default` / `acceptEdits` and remove `skipDangerousModePermissionPrompt`).

### Memory loader load-order didn't match the CLAUDE.md contract

CLAUDE.md mandates project root memory FIRST, then global project memory, then anything else. `startup-check.sh` was loading global memory full-content first, then session files mixed across all dirs, then MEMORY.md indexes last. With MAX_CHARS=9200, project root memory could be truncated out before its index even loaded.

- Rewrote sections 2-4 of `startup-check.sh` to match the contract.
- New helper `emit_dir(dir, label, max_sessions)` emits a single dir's MEMORY.md INDEX first, then up to N newest session files. Index-first ensures the canonical pointer document is never the truncation casualty.
- Tier order: project root (max 12 sessions) -> global project (max 6) -> global cross-project (max 4 sessions plus full-content feedback/reference files).
- Verified with a SESSION_CWD test: project root's MEMORY INDEX appears at byte 886; global project at 7286; global at 7521. Order matches contract.

### "Additive" story was overstated

Codex's nuance: the `memory` component IS additive (markers, JSON-merge, no overwrites of your content), but it does mutate active user config (your CLAUDE.md and settings.json files get modified). Saying "fully additive" without qualification was too clean.

- `README.md` bullet 5 of "What it does for you" rewritten: "Additive-where-possible beats wholesale" with explicit explanation that `memory` mutates your CLAUDE.md and settings.json (appends + JSON-merges) and `skills` writes only to `~/.claude/skills/`.
- "The additive components" subsection in deep-dive #8 retitled to "The additive-where-possible components" with the same nuance.

### Discord account metadata is tracked

Already discussed in my own security review. `claude/channels/discord/access.json` contains a real Discord user ID `740463860175077388`. Not a token, but identifying. No code change here - just acknowledging.

## Medium priority

### Stale install.sh header comments

Header said "six components" with `minimal = claude + nvm`. Real numbers: ten components, `minimal = claude + memory + skills + nvm`.

- Rewrote the entire header comment block. New version lists all ten components with one-liners and the correct minimal preset.

### Dead `picked yesplease` reference (line 847)

After renaming the `yesplease` component key to `ampersand`, one stale check survived. Codex pin-pointed line 847.

- Changed `[ "$SHORTCUTS_NEW" -eq 0 ] && picked yesplease && NEED_SHELL_RELOAD=1` to use `picked ampersand`.

### Statusline depends on `jq` without a guard

`claude/statusline-command.sh` started using `jq` immediately on line 5. If jq isn't installed, the statusline failed every render.

- Added `command -v jq` check at the top. If jq isn't found, prints `'no-jq | install with: brew install jq'` and exits 0 cleanly. Claude Code's prompt never sees a command-not-found error.

### Discord shell wrapper shadows `claude` globally

Codex flagged this as invasive for a public fork. Disagreed for the Yes& repo - the shadowing is the whole point of the discord-chat-launcher pattern. No change. Documented as a deliberate Yes& choice in the existing component description; would be different in a public Codex-team fork.

### README outdated bootstrap description (line 393)

Said bootstrap "re-execs install.sh with `</dev/tty`" but current default is shortcut-only-and-exit. Doc drift.

- Rewrote that paragraph in the "Day-to-day workflows" deep-dive section. New version describes the default flow (clone, install ampersand only, exec a fresh login zsh) and the args-passed flow (still re-execs install.sh through the TTY).

### Tracked `.claude/memory` and `claude/memory` are conceptually confusing

Codex's point: they serve different roles correctly but the naming clash is confusing. Acknowledged in the existing README architecture section. No structural change - the names are pinned by Claude Code's expectations on `.claude/memory/` (project memory) and our installer's symlink target on `~/.claude/memory/` (global memory we ship from `claude/memory/`).

# Removed

- `CODEX_REVIEW_FINDINGS.md` deleted from repo root per user instruction. The actionable items are captured in this memory entry; the review's narrative recommendations (Codex Fork Vision) are out of scope for this repo.

# Files touched

- `claude/settings.json` (matcher: Write|Edit -> Write|Edit|MultiEdit)
- `claude/hooks/content-guard.sh` (added MultiEdit branch + header comment)
- `bootstrap.sh` (added print_help, --help/-h flag handling)
- `install.sh` (rewrote header comment block, fixed picked-yesplease -> picked-ampersand)
- `claude/startup-check.sh` (memory loader rewritten to match CLAUDE.md contract: project root first, index-first within each tier)
- `claude/statusline-command.sh` (jq guard with graceful degradation)
- `claude/CLAUDE.md` (new "Permission Posture" section documenting bypassPermissions choice)
- `README.md` (bootstrap description fixed, additive language tightened)
- `CODEX_REVIEW_FINDINGS.md` (deleted)
- `.claude/memory/session_2026-04-28_codex-review-fixes.md` (this file)
- `.claude/memory/MEMORY.md` (index entry)
