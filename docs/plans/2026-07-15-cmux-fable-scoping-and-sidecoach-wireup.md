# Stage 1 execution (v3): full base<->deploy reconciliation + fable + sidecoach-mcp wire-up + anti-drift test

**Stamp:** `f3677189` (re-verify `git rev-parse --short HEAD`). Stage 1 of docs/plans/2026-07-15-hook-taxonomy-and-install-restructure.md. **v3** folds the 2 Codex NO-GO rounds. Staging revised: Stage 1 is now the COMPLETE correctness pass (every base-wired hook is deployed for its selection; no dangles for any `--only`), because a partial base is the inconsistency Codex kept flagging. Stage 2 (dissolve config into selectable clusters, nothing-forced) stays additive/later.

**Invariant Stage 1 establishes:** for every install selection, every hook wired in the resulting `settings.json` has its script on disk. App hooks are wired by their component; standalone/QA hooks by config. Base `claude/settings.json` wires nothing that config does not deploy.

**Sandbox convention:** `SB=$(mktemp -d); HOME="$SB" bash install.sh --only <keys>`; assertions read explicit `"$SB/.claude/..."` (never `~`). Component blocks that wire settings.json must be standalone-safe: start with `mkdir -p "$CLAUDE_DIR/hooks"; [ -f "$SETTINGS_JSON" ] || echo '{}' > "$SETTINGS_JSON"` (Codex 5 - applies to cmux, fable, and any block reachable via bare `--only`).

---

## Baseline (reproduce before fixing)
- [ ] Green: `test-cmux-close-guard.sh`, `test-fable-orchestrator-guard.sh` PASS; `cd sidecoach && npm test` -> `N_BASE`; settings.json valid JSON.
- [ ] Repro cmux leak (FAILs now): `SB=$(mktemp -d); HOME="$SB" bash install.sh --only config >/dev/null 2>&1; python3 -c "import json,sys; s=json.dumps(json.load(open('$SB/.claude/settings.json'))); sys.exit(0 if any(x in s for x in ['cmux-close-guard','resume-guard','team-reaper']) else 1)"` -> exit 0 (bug); `test -f "$SB/.claude/hooks/cmux-close-guard.sh"` -> absent.

## Unit A - cmux (6 hooks + shim dir)
Owned: `cmux-close-guard`(PreToolUse/Bash/12), `cmux-teammate-shim-heal`(SessionStart/5), `resume-guard`(SessionEnd/5), `resume-toggle`(UserPromptSubmit/5), `team-reaper`(SessionStart+SessionEnd/5), `teammate-relay-stop`(Stop) + the `~/.claude/cmux` shim dir.
- [ ] A1. Remove all 6 from base `claude/settings.json` (drop emptied groups). Verify: none of the 6 strings remain; JSON valid.
- [ ] A2. Remove `cmux-teammate-shim-heal.sh` from `CONFIG_HOOKS` (1858).
- [ ] A3. Move the `~/.claude/cmux` symlink (1876-1879) from the config block into the cmux block (Codex 6).
- [ ] A4. cmux block: add standalone-safe guard; symlink the 4 not-yet-symlinked (`cmux-close-guard`, `cmux-teammate-shim-heal`, `team-reaper`, `teammate-relay-stop`), chmod +x.
- [ ] A5. cmux block settings-merge: wire all 6 at their exact events/timeouts, add-if-absent.
- [ ] A6. `deactivate_cmux`: rm the 4 new symlinks + `~/.claude/cmux`; strip all 6 from settings.json.
- [ ] A7. Verify: repro inverts (`--only config` -> no cmux refs); `--only config,cmux` -> 6 refs + 6 scripts + shim dir; `--only cmux` (no config) -> standalone-safe, succeeds.

## Unit B - fable component
- [ ] B1. Add `detect-session-model.sh` to `CONFIG_HOOKS` (Codex 5: live dep of base model-router-guard).
- [ ] B2. KEYS + arrays (DESCS/FILES/PICKS, aligned; `PICKS+=(0)` default-unchecked). Wording: opt-in; `--yes` installs it (safe - no-op for non-Fable). `--help` lists fable.
- [ ] B3. `detect_component fable)` -> active iff the guard symlink exists.
- [ ] B4. fable block (standalone-safe): symlink `fable-orchestrator-guard.sh` + defensively `detect-session-model.sh`, chmod +x, wire PreToolUse `Write|Edit|MultiEdit|NotebookEdit|Bash`/10, add-if-absent.
- [ ] B5. `deactivate_fable()` + dispatch entry: rm symlink, strip PreToolUse; leave detect-session-model.
- [ ] B6. Verify: `--only fable` (no config) standalone-safe, 1 ref + script, not in base; `test-fable-orchestrator-guard.sh` PASS.

## Unit C - sidecoach (move all 6 hooks to the block + MCP wire-up) (Codex 2, 3, 4, 8)
Base currently wires 6 sidecoach hooks; the block wires only 3. Fix both halves.
- [ ] C1. Remove all 6 sidecoach hooks from base `claude/settings.json`: `sidecoach-sessionstart`(SessionStart), `sidecoach-preamble`(SessionStart+PostCompact), `sidecoach-keyword`(UserPromptSubmit), `sidecoach-postuserp`(UserPromptSubmit), `sidecoach-taste-gate`(PostToolUse Write|Edit|MultiEdit), `sidecoach-postresponse`(Stop).
- [ ] C2. Remove `sidecoach-taste-gate.sh` from `CONFIG_HOOKS` (it is sidecoach-owned); add it to the sidecoach block's symlink loop.
- [ ] C3. Extend the sidecoach block's `addHook` to wire all 6 (add `preamble` SessionStart AND PostCompact with the `SESSION_CWD="$(pwd)"` prefix as base had it; `keyword` UserPromptSubmit; `taste-gate` PostToolUse matcher `Write|Edit|MultiEdit`). Keep the existing 3.
- [ ] C4. Build the mcp-server, capturing exit (Codex 8): `if (cd "$REPO_DIR/sidecoach/mcp-server" && npm install --silent && npm run build); then MCP_OK=1; else MCP_OK=0; warn ...; fi`.
- [ ] C5. Register in `~/.claude.json` ONLY if `MCP_OK=1 && [ -f .../dist/index.js ]`, REPLACING any existing entry (Codex 7): set `mcpServers['sidecoach']` unconditionally to `{type:stdio,command:node,args:['$REPO_DIR/sidecoach/mcp-server/dist/index.js'],env:{SIDECOACH_MCP_LOG_LEVEL:info}}`.
- [ ] C6. `deactivate_sidecoach`: also pop `mcpServers['sidecoach']` from `~/.claude.json`. And strip all 6 sidecoach hooks (it already strips by `'sidecoach' in command`, which covers all 6 - verify).
- [ ] C7. Restart message. Leave the package + run-tests.ts:30 intact (no retire).
- [ ] C8. Verify:
  - `--only config` -> NO sidecoach refs in settings.json (Codex 2).
  - `--only config,sidecoach` -> all 6 sidecoach hooks wired + scripts on disk.
  - MCP path (Codex 4 - seed a stale bad path first): `printf '{"mcpServers":{"sidecoach":{"args":["/bad/old/path.js"]}}}' > "$SB/.claude.json"`; after `--only config,sidecoach`, `python3 -c "import json; a=json.load(open('$SB/.claude.json'))['mcpServers']['sidecoach']['args'][0]; assert a=='$PWD/sidecoach/mcp-server/dist/index.js', a"` (the stale path was REPLACED with the repo-derived one).
  - `cd sidecoach && npm test` == `N_BASE`.

## Unit F - voice + reflect base de-dupe
- [ ] F1. voice: the voice block ALREADY wires voice-mandate (SessionStart+PostCompact) and voice-toggle (UserPromptSubmit). Just REMOVE both from base `claude/settings.json`. (voice-gate stays in CONFIG_HOOKS - deployed, not dangling; its taxonomy move is Stage 2.)
- [ ] F2. reflect: the reflect block symlinks reflect-nudge but does NOT wire it. Add the wiring to the reflect block (SessionStart, with the `SESSION_CWD="$(pwd)"` prefix base used) + REMOVE reflect-nudge from base.
- [ ] F3. `deactivate_voice`/`deactivate_reflect`: ensure they strip their now-block-wired hooks (voice already does mandate; add toggle if missing; reflect add nudge).
- [ ] F4. Verify: `--only config` -> no voice-mandate/voice-toggle/reflect-nudge refs; `--only config,voice-output` -> mandate+toggle wired + scripts; `--only config,reflect` -> nudge wired + script.

## Unit D - Category-3 config-owned danglers -> CONFIG_HOOKS
Base-wired, deployed by nothing. For Stage 1 these are config's (standalone) hooks; Stage 2 relocates into clusters. Add to `CONFIG_HOOKS`: `claude-surface`, `visualizer-guard`, `surface-visual-gate`, `plan-consistency-lint`, `push-ahead-check`, `codex-failure-watcher`, `codex-rescue-guard`. (3 are my Wave-1/2 regressions.)
- [ ] D1. Add the 7. Verify: `--only config` -> all 7 on disk under `"$SB/.claude/hooks/"`.

## Unit E - per-selection anti-drift test (Codex 1 - the redesign)
- [ ] E1. New `claude/hooks/test-settings-deploy-parity.sh`: for each selection in {`config`, `config,cmux`, `config,fable`, `config,reflect`, `config,voice-output`, `config,sidecoach`}, install into a fresh `HOME=$(mktemp -d)` (set an env/`--only` that skips the sidecoach npm build for speed, or accept the build for the sidecoach case), then assert **every** hook command in `"$SB/.claude/settings.json"` has its script present in `"$SB/.claude/hooks/"`. Fail listing each (selection, dangling-hook). This tests installed-settings-vs-installed-files per selection - the exact class the static v2 test missed.
- [ ] E2. Register it in the repo test runner. Verify: passes with Units A-F applied; re-adding a bogus base wiring makes it fail.

---

## Verify gate (before reporting Stage 1 done)
1. All per-step verifies green.
2. `test-cmux-close-guard`, `test-fable-orchestrator-guard`, **`test-settings-deploy-parity`** PASS; `cd sidecoach && npm test` == `N_BASE`.
3. Sandbox matrix (explicit `$SB`): `--only config` dangles NOTHING; `--only config,{cmux|fable|sidecoach|voice-output|reflect}` each wired+deployed; bare `--only cmux`/`--only fable` standalone-safe.
4. **Codex review of the actual diff** (the mandated produce-and-verify gate on real code). Fold + re-verify.
5. `plan-consistency-lint.sh` clean on this doc.

## Note on process
Two Codex plan-rounds converged (round 2 resolved 6/9; round 3's 5 findings folded here). Rather than a 4th plan-round with diminishing returns, v3 goes to execution under rigorous self-review, and the authoritative Codex gate runs on the real diff (per the mandate). If diff-Codex surfaces a design miss, that is the signal to re-plan.

## Deferred (honest)
- Deactivate has no non-interactive path; INSTALL is tested directly, deactivate via function-source harness where feasible else manual. A `--deactivate KEY` flag is a Stage-2 candidate.
- voice-gate + any remaining CONFIG_HOOKS app-hooks keep their taxonomy move for Stage 2 (they are deployed, so not dangling - purity, not correctness).
