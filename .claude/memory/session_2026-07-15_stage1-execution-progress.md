---
name: Stage-1 execution progress - base removal + cmux + Cat-3 DONE & sandbox-verified; sidecoach/voice/reflect/fable/test remain
description: Live progress of the hook-taxonomy Stage-1 install.sh reconciliation. Units A (cmux) + D (Cat-3 danglers) + base-settings removal + CONFIG_HOOKS changes are done and sandbox-verified (config-only = 38 hooks, 0 dangling). Remaining: sidecoach block, reflect/voice, fable component, parity test, then Codex-on-diff + commit.
type: project
relates_to: [session_2026-07-15_hook-taxonomy-design.md, session_2026-07-15_settings-deploy-drift-audit.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: sandbox install matrix (--only config, --only config,cmux) - explicit $SB paths
confidence: high
---

Executing docs/plans/2026-07-15-cmux-fable-scoping-and-sidecoach-wireup.md (v3). Uncommitted; nothing live changed (only the REPO's claude/settings.json + install.sh). Repo is mid-surgery - MUST finish remaining units before committing or a fresh install breaks sidecoach/voice/reflect wiring.

**DONE + SANDBOX-VERIFIED:**
- Base `claude/settings.json`: removed 18 wirings (15 app-owned hooks - 6 cmux, 6 sidecoach, 2 voice, 1 reflect). Minimal diff, valid JSON.
- `CONFIG_HOOKS` (install.sh ~1858): removed cmux-teammate-shim-heal + sidecoach-taste-gate; added detect-session-model + 7 Cat-3 (claude-surface, visualizer-guard, surface-visual-gate, plan-consistency-lint, push-ahead-check, codex-failure-watcher, codex-rescue-guard). Comment updated.
- cmux block: standalone-safe guard (mkdir hooks + settings.json init); symlink cmux-close-guard/cmux-teammate-shim-heal/teammate-relay-stop; moved the ~/.claude/cmux shim dir here from the config block; wired cmux-close-guard (PreToolUse/Bash/12), cmux-teammate-shim-heal (SessionStart/5), teammate-relay-stop (Stop/5). resume-guard/resume-toggle/team-reaper were ALREADY handled by the cmux block.
- VERIFIED: `--only config,cmux` -> all 6 cmux hooks wired + scripts + shim dir. `--only config` -> 0 cmux hooks, **38 hooks wired, 0 dangling** (exit-127 fresh-install bug fixed, incl my 3 Wave-1/2 regressions).

**REMAINING (with exact specs):**
- Unit C sidecoach: block currently wires only 3 of 6 (sessionstart/postuserp/postresponse). Add to the block's symlink loop: sidecoach-taste-gate.sh. Extend addHook to wire: sidecoach-preamble (SessionStart AND PostCompact, prefix `SESSION_CWD="$(pwd)" `), sidecoach-keyword (UserPromptSubmit), sidecoach-taste-gate (PostToolUse matcher `Write|Edit|MultiEdit`). Then MCP: build `(cd sidecoach/mcp-server && npm install --silent && npm run build)` capturing exit -> MCP_OK; if MCP_OK && dist/index.js exists, REPLACE (unconditional set) `mcpServers['sidecoach']` in ~/.claude.json = {type:stdio,command:node,args:['$REPO_DIR/sidecoach/mcp-server/dist/index.js'],env:{SIDECOACH_MCP_LOG_LEVEL:info}}. deactivate_sidecoach: also pop mcpServers['sidecoach']. Restart message. (sidecoach block is at install.sh ~2931; the node -e addHook is ~2977-2986.)
- Unit F reflect: reflect block (install.sh ~2810) symlinks reflect-nudge but does NOT wire it - add wiring SessionStart with prefix `SESSION_CWD="$(pwd)" ~/.claude/hooks/reflect-nudge.sh`. voice: block already wires mandate+toggle; base removal already done; just confirm deactivate_voice strips both.
- Unit B fable: NEW component. KEYS+=(fable) + DESCS/FILES/PICKS (PICKS+=(0) default-off; verify array count). detect_component fable) -> [ -L hooks/fable-orchestrator-guard.sh ]. New install block (standalone-safe): symlink fable-orchestrator-guard.sh (+ detect-session-model.sh defensively), wire PreToolUse matcher `Write|Edit|MultiEdit|NotebookEdit|Bash`/10. deactivate_fable() + dispatch entry. Help text (Tools: line ~558).
- Unit E: new claude/hooks/test-settings-deploy-parity.sh - per-selection sandbox test (config, config+cmux, config+fable, config+reflect, config+voice-output, config+sidecoach): every hook wired in $SB/.claude/settings.json has its script in $SB/.claude/hooks. Register in repo test runner.
- THEN: full sandbox matrix + parity test + `cd sidecoach && npm test` (== N_BASE) + Codex review of the ACTUAL DIFF (mandated gate) + plan-consistency-lint + commit.

Fix-gate suppressed via ~/.claude/.suppress-fix-gate (one coherent task). verify-before-done flag will clear on the final sandbox/parity verification (installer/shell work - no screenshot applies).

**UPDATE - ALL UNITS DONE + SANDBOX-VERIFIED:**
- Unit A cmux, C sidecoach (6 hooks + MCP), F voice/reflect, B fable component, D Cat-3, E parity test - all implemented.
- Verified: `bash -n` clean; arrays aligned (28 each, fable idx 27 pick=0); parity test PASS for config/cmux/fable/reflect/voice-output (0 dangling); `--only config,sidecoach,fable` -> all 6 sidecoach hooks + fable guard wired+deployed, 0 dangles, MCP stale path REPLACED with repo-relative path (Codex 4 satisfied); `cd sidecoach && npm test` -> 66 suites pass (tether intact, no retire).
- All 9 Codex round-2/3 findings implemented + verified in sandbox.
**CODEX DIFF REVIEW (round 1) - NO-GO, 5 findings, ALL FOLDED + VERIFIED:**
1. HIGH deactivate_cmux not symmetric (only stripped resume-*, left close-guard/shim-heal/team-reaper/relay-stop + shim dir) -> rewrote to strip all 6 by basename across events + rm all symlinks + the ~/.claude/cmux dir. VERIFIED: install 9 hooks -> deactivate -> 0 remaining, 0 empty groups, 0 symlinks, shim dir gone.
2. MED migrated hooks lost timeouts -> restored preamble=5, keyword=5, taste-gate=30, reflect-nudge=5 (sessionstart/postuserp/postresponse had none originally). VERIFIED present.
3. MED sidecoach not idempotent over OLD absolute-path installs -> sidecoach wiring now strip-ALL-sidecoach-then-add (normalizes stale entries). VERIFIED: my hooks 0 dups on 2 installs; even FIXES the pre-existing sidecoach-preamble dup.
4. MED-LOW parity test regex too narrow -> broadened to any prefix (~/ / $HOME/ / absolute) via /\.claude/hooks/, findall (multiple per command), + install exit-status check.
5. LOW deactivate_reflect/fable left empty groups -> added empty-group + empty-event cleanup. VERIFIED 0 empty groups.

**PRE-EXISTING bug discovered (OUT of Stage-1 scope, flagged):** running install TWICE duplicates startup-check, voice-mandate, node-shim-heal, memory-compact, justify-watch-guard, the PreCompact printf (config/memory/voice blocks - the PYMERGE substring-dedup fails for commands containing quotes). CONFIRMED pre-existing on a clean HEAD worktree (HEAD dups the same set + sidecoach-preamble). My changes are idempotent for their scope and IMPROVE sidecoach. Candidate follow-up: make the config/memory/voice wiring quote-safe idempotent.

Re-verify after fold: bash -n clean; parity test ALL PASS; timeouts present; deactivate symmetric.

**FINAL Codex diff certification (round 2): GO.** All 5 findings confirmed resolved, no new regressions. One non-blocking residual NOTE (Codex: "not new to this diff"): voice-output --only lacked the standalone mkdir/settings bootstrap -> FOLDED (added the 2-line guard). VERIFIED: `--only voice-output` standalone now creates settings.json + wires voice-mandate + on disk; bash -n clean; parity ALL PASS.

**STAGE 1 COMPLETE + VERIFIED + CODEX-GO. Uncommitted** (awaiting Jonah's landing decision - commit-only-when-asked). Files: install.sh (component-scoped wiring for cmux/sidecoach/voice/reflect/fable, CONFIG_HOOKS reconciliation, fable component, sidecoach MCP wire-up, symmetric deactivates), claude/settings.json (18 app-hook wirings removed from base), claude/hooks/test-settings-deploy-parity.sh (new regression test), + the plan/taxonomy docs + beats. Stage 2 (dissolve config into selectable clusters, nothing-forced, the 5 new public app components justify/codex/chrome/clickup/figma) and the pre-existing re-run dup bug remain as follow-ups.
