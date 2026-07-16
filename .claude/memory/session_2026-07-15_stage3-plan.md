---
name: Stage-3 plan + execution - move config residue to app components (config becomes core-only)
description: Stage 3 of the hook-taxonomy restructure. Move the 13 CONFIG_HOOKS residue hooks to their owning components (memory/cmux/voice absorb; NEW clickup/visualizer/codex; justify personal->public), then CONFIG_HOOKS empties = config core-only. app-wirings.json generated. Same proven pattern as Stage 1-2.
type: project
relates_to: [session_2026-07-15_stage2-execution-progress.md, session_2026-07-15_hook-taxonomy-design.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: app-wirings.json generated + owner-mapped; execution in progress
confidence: high
---

Jonah: "continue to Stage 3 now" (after Stage 2 committed 4b011ea3/968a34a5). Executing on main (uncommitted).

**GOAL:** move the 13 CONFIG_HOOKS residue hooks to their apps -> CONFIG_HOOKS empties -> config = core-only (permissions/plugins/statusline + startup-check + hud).

**DONE:** `claude/hooks/app-wirings.json` generated from base settings.json (13 scripts, 17 entries, 4 double-wired: memory-compact, node-shim-heal, justify-source-guard, justify-watch-guard). script->[{event,matcher,hook}], exact entries (lossless).

**OWNER MAP (residue -> component):**
- memory (existing): memory-approve, memory-nudge, memory-compact, consolidate-nudge (4)
- cmux (existing): agent-teams-guard, node-shim-heal (2)
- voice-output (existing): voice-gate (1)
- justify (PERSONAL -> make PUBLIC): justify-source-guard, justify-watch-guard (2)
- clickup (NEW): block-clickup-writes (1)
- visualizer (NEW): visualizer-guard (1)
- codex (NEW): codex-failure-watcher, codex-rescue-guard (2)

**MECHANICS (reuse Stage-2 ownership-aware machinery):**
- Generic helpers near the cluster machinery: `install_app_hooks <scripts...>` (standalone-safe; for each: link_or_copy from repo + wire its app-wirings.json entries add-if-absent by command) and `deactivate_app_hooks <scripts...>` (rm_hook_if_ours + strip EXACT app-wirings.json commands, empty-group cleanup). is_our_hook/ensure_real_settings/rm_hook_if_ours already exist.
- Each component block calls install_app_hooks with its scripts. New components (clickup/visualizer/codex) get KEYS+arrays+detect+deactivate+install block. justify: move from PERSONAL_KEYS to KEYS.
- U-strip: remove all 13 from base claude/settings.json; empty CONFIG_HOOKS (leave the array empty or comment - config core-only). config detect already keys on hud.sh (Stage 2), deactivate_config already narrowed - but with CONFIG_HOOKS empty, the residue RESIDUE list in deactivate_config should also empty (they're app-owned now). UPDATE deactivate_config: drop the for-loop residue + the RESIDUE python (now app-owned) - config only removes hud/startup-check-shared/core.
- Parity test: add config (should have 0 app hooks now), + each new component.

**Residue base wiring (for reference, from app-wirings.json):** memory-approve PreToolUse Write|Edit|MultiEdit/5; memory-nudge PostToolUse Write|Edit|MultiEdit|Bash/5; memory-compact SessionStart/5 + PostToolUse Write|Edit|MultiEdit/5; consolidate-nudge SessionStart/5; agent-teams-guard PreToolUse Agent|Workflow/5; node-shim-heal SessionStart/10 + Stop/10; voice-gate PreToolUse mcp__voice-output__speak/5; block-clickup-writes PreToolUse mcp__claude_ai_ClickUp__clickup_/5; justify-source-guard PreToolUse Bash/5 + Write|Edit|MultiEdit/5; justify-watch-guard SessionStart/10 + Stop/10; visualizer-guard PreToolUse mcp__visualize__show_widget/5; codex-failure-watcher PostToolUse Bash/5; codex-rescue-guard PreToolUse Agent/5.

**Stage 3b (follow-up, NOT this pass):** chrome (chrome-tabgroup-track/clear/stop) + figma (figma-fidelity-stop) are LIVE-only (hand-added to ~/.claude/settings.json, NOT installer-managed, NOT base-wired). Bringing them under management = create chrome/figma components from the live wiring. Deferred - they do not block config-core-only.

**STAGE 3 COMPLETE + Codex-GO.** Executed: install_app_hooks/deactivate_app_hooks generic helpers (reuse is_our_hook/ensure_real_settings ownership-aware machinery); section 16e installs each picked component's hooks from app-wirings.json; 13 residue stripped from base + CONFIG_HOOKS emptied (=> config core-only); NEW public components clickup/visualizer/codex (KEYS+arrays+detect via is_our_hook+deactivate+dispatch); justify moved PERSONAL->public; deactivate_config reduced to core-only; memory/cmux/voice/justify deactivates call deactivate_app_hooks.

**BUG found+fixed mid-execution (debugging-protocol):** emptying CONFIG_HOOKS=() crashed the config install under `set -euo` (`CONFIG_HOOKS[@]: unbound variable` at the deploy loop) - fixed with the `${CONFIG_HOOKS[@]+"..."}` +expansion idiom. Codex diff round 1 caught a 2nd: removing the RESIDUE block orphaned a later `if not hooks:` (NameError) -> changed to `if not d.get("hooks"):`, verified by running the PYCONFIG python directly. Help text updated (config = CORE only).

VERIFIED: --only config wires 0 app hooks (core-only); 19-selection parity ALL PASS; --only clickup/codex/memory/justify install their hooks; codex deactivate 2->0; bash -n clean; Codex GO. Cosmetic follow-up: the final "what was installed" summary still lists config as installing hooks (noted, non-blocking).

Stage 3b (chrome/figma live-only hooks -> components) still deferred. The full taxonomy is now realized: base settings.json wires nothing that isn't owned by a picked component/cluster; config is core-only.
