---
name: doctor-live-settings-activation
description: The doctor hooks were wired in the REPO claude/settings.json but the LIVE ~/.claude/settings.json is a separate drifted file (646 vs 592 lines) that the harness actually reads - so the cure needed the entries added to the live file too. Lead surgically appended them (backup + programmatic + JSON-validate). Restart activates.
type: reference
relates_to: [session_2026-06-25_doctor-hooks-verified.md, decision_hook_system_architecture.md]
---

Collaborator: Jonah Cohen. 2026-06-25.

## THE GAP (lead discovery)
`~/.claude/settings.json` is the LIVE file the harness reads (has bash-guard etc.), a REAL file (NOT a symlink), 646 lines - DRIFTED from the repo `claude/settings.json` (592 lines, the version-controlled copy codexdoctor edited). So wiring the repo file alone does NOT activate the hooks; the live file needed them too. (This is the source-vs-installed drift flagged in [[decision_hook_system_architecture]] finding #5. The drift itself is pre-existing and NOT reconciled here - only the 2 new entries added.)

## ACTIVATION (surgical, reversible)
- Backed up ~/.claude/settings.json first.
- Appended programmatically (python json load/append/validate, no hand-typed JSON):
  - `codex-rescue-guard.sh` -> the existing live PreToolUse block matcher `Agent|Workflow` (block [5], alongside agent-teams-guard).
  - `codex-failure-watcher.sh` -> the existing live PostToolUse block matcher `Write|Edit|MultiEdit|Bash` (block [0], alongside memory-nudge/verify-before-done).
- Validated JSON after.
- Hook SCRIPTS already symlinked live (~/.claude/hooks/codex-*.sh -> repo). settings now references them.

## RESTART REQUIRED
Hooks load at SessionStart. NOT live in the current session. A restart activates both. Until then: handle manually (run codex via CLI; retry-lean on capacity).

## DRIFT NOTE (future)
repo claude/settings.json (codexdoctor: new dedicated Agent + Bash blocks) and live ~/.claude/settings.json (lead: appended to existing blocks) now express the same 2 hooks DIFFERENTLY. Both functionally correct. A future dotfiles reconciliation should align repo<->live; do NOT blind-run the installer (it could clobber the live-only drift).

## Files touched
- ~/.claude/settings.json (live, appended 2 hook entries + backup)
</content>
