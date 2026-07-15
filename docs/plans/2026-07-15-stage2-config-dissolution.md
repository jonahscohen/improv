# Stage 2 execution plan (v2): dissolve config into core + 8 selectable clusters (nested drill-in, nothing-forced)

**Stamp:** `4135ddc1` (re-verify `git rev-parse --short HEAD`). Stage 2 of docs/plans/2026-07-15-hook-taxonomy-and-install-restructure.md. **v2** folds a Codex NO-GO (8 findings). Key reframe: individual hooks are NOT KEYS (that would pollute every KEYS-iterating UI loop); they live in separate `HOOK_ON`/`HOOK_OFF` state.

**Goal:** the QA hooks stop being a monolithic forced `config` bundle. They become **8 selectable clusters**; base `claude/settings.json` wires none of them; nothing is forced (clusters default-checked, all removable); two-level granularity via nested drill-in.

**Scope boundary (unchanged):** Stage 2 moves ONLY the 8 standalone clusters. App-owned hooks still in CONFIG_HOOKS (agent-teams-guard, node-shim-heal -> cmux; memory-*/consolidate-* -> memory; justify-* -> justify; block-clickup-writes -> clickup; voice-gate -> voice; visualizer-guard/codex-* -> Stage-3 apps) STAY in config until Stage 3. **So after Stage 2, `config` is NOT yet core-only** - it is core + the still-app-owned residue (base-wired + CONFIG_HOOKS-deployed). config becomes core-only only when Stage 3 empties CONFIG_HOOKS. (Codex finding 3: the v1 "config keeps only non-hook core" was premature.)

---

## The 8 clusters (member hook SCRIPTS - all in CONFIG_HOOKS; 25 base-wired, 2 deploy-only)

| Cluster key | Member hook scripts | Default |
|---|---|---|
| `safety` | bash-guard, content-guard, content-guard-stop, destructive-ops-guard, destructive-confirm-detect | on |
| `verification` | verify-before-done, verify-before-done-stop, verify-clear, verify-manual, screenshot-open-mandate, screenshot-open-clear, second-fix-gate, validation-guard | on |
| `question-discipline` | multiple-choice-detect-stop, multiple-choice-inject-prompt, multiple-choice-enforce, question-enforcement | on |
| `grounding` | grounding-gate, grounding-guard | on |
| `api-drift` | api-drift-detector, api-drift-stop, api-drift-ack | on |
| `planning-git` | plan-consistency-lint, push-ahead-check | on |
| `surface` | claude-surface, surface-visual-gate | on |
| `model-routing` | model-router-guard (+ detect-session-model.sh deployed as its exec dep) | on |

**27 scripts total** (5+8+4+2+3+2+2+1). **2 are deploy-only** (`multiple-choice-enforce`, `question-enforcement`) - in CONFIG_HOOKS but NOT base-wired (they are detection twins invoked by siblings). So the cluster SYMLINKS all 27 members but WIRES only the ~25 with entries (29 entries total). **Wiring is per-ENTRY, not per-script:** several scripts wire twice and ALL entries (exact objects) must be preserved - `grounding-guard` (2), `model-router-guard` (2), `claude-surface` (2, one with a `turn` arg), `verify-before-done` (2). cluster-wirings.json captures every entry object verbatim.

---

## Data model (bash-3.2 safe) - CORRECTED

- **Clusters ARE KEYS** (TUI row, `--only`-able, in state/summary/returning-flow as normal components). No new pollution - clusters are legit components.
- **Individual hooks are NOT KEYS.** Membership via `cluster_hooks <cluster>` (case fn). Wiring via a generated **`claude/hooks/cluster-wirings.json`** (script -> list of `{event, matcher, hook}` where `hook` is the EXACT settings.json entry object), extracted ONCE from current base settings.json. LOSSLESS - preserves command prefixes (`SESSION_CWD="$(pwd)"` on push-ahead-check), command args/variants (`claude-surface.sh turn` vs bare), `timeout`, AND `statusMessage` fields. (Codex finding 3: a parsed EVENT|MATCHER|TIMEOUT triple was lossy.)
- **Two hook-state sets** (space-delimited strings, bash-3.2 safe):
  - `HOOK_OFF` - scripts the user DESELECTED in drill-in.
  - `HOOK_ON` - scripts explicitly requested via `--only <hook>` (installs that hook even if its cluster is not picked).
- **Effective hook set** (computed at install): `( union over picked clusters of cluster_hooks ) minus HOOK_OFF, union HOOK_ON`.
- **Install unit = the effective hook.** One "standalone hooks" pass: for each effective hook, symlink it + wire EVERY entry from `hook_wirings` (add-if-absent, exact-command; the Stage-1 python idiom). model-routing/model-router-guard also symlinks detect-session-model.sh (Codex finding 6).
- **No separate resolution pass** (Codex finding 1): drill-in is the ONLY place HOOK_OFF is set, and the effective-set formula is applied once at install. There is no later step that can re-enable a deselected hook.

## apply_only (install.sh:507) - cluster + hook expansion
For each `--only` token: if it is a KEY (cluster/app/core) -> `set_pick`. Elif it names a known hook (appears in any `cluster_hooks`) -> `HOOK_ON+=" $token"`. Else -> the existing unknown-key error. So `--only safety` picks the safety cluster (all 5 hooks via the effective-set); `--only bash-guard` -> HOOK_ON, installs just bash-guard.

## Nested TUI (two-phase)
- **Phase 1:** unchanged flat `gum choose` over KEYS - now includes the 8 cluster keys (clusters ARE components, so summary/returning-flow/state all work with no filtering). Default-selected = current PICKS.
- **Phase 2 (drill-in):** after phase 1, for each PICKED cluster: `gum confirm "Customize the N hooks in <cluster>? (default: all)"`. If yes -> `gum choose --no-limit` over `cluster_hooks` (default all selected); each DEselected script -> `HOOK_OFF`. If no -> none off.
- **Fallback TUI / --yes / --preset:** no drill-in; `--preset all`/`--yes` -> all clusters picked, HOOK_OFF empty -> every member installs.

---

## Units

- [ ] **U1. Generate cluster-wirings.json.** From `git show HEAD:claude/settings.json`, extract for each of the 27 cluster scripts its full list of `{event, matcher, hook}` entries (the EXACT hook objects) into `claude/hooks/cluster-wirings.json` (only the ~25 WIRED scripts get entries; the 2 deploy-only ones have none). -> verify: re-inserting yields BEHAVIORAL equivalence - each hook fires at its recorded event+matcher with its exact command/prefix/args/timeout/statusMessage. NOT byte-for-byte: settings has shared/ordered groups (e.g. SessionStart mixes startup-check + claude-surface + node-shim-heal), and multiple hooks sharing an event+matcher may land in one group or separate groups - identical firing behavior either way.
- [ ] **U2. Baseline:** parity test PASS; record `--only config` wired count; confirm the 27 cluster scripts are in CONFIG_HOOKS (25 base-wired, 2 deploy-only).
- [ ] **U3. Cluster KEYS + membership.** Add 8 cluster KEYS to the parallel arrays (KEYS/TITLES/DESCS/FILES/DIRS/PICKS=1) with descriptions; add `cluster_hooks()` + `hook_wirings()` fns; init `HOOK_ON=""` `HOOK_OFF=""`. -> verify: arrays aligned; `--help` lists clusters; bash -n clean.
- [ ] **U4. Standalone-hooks install pass.** New section: compute the effective hook set; for each, symlink it + read its entries from `cluster-wirings.json` and insert each EXACT hook object into the right event/matcher group (add-if-absent by command). standalone-safe guard; model-routing also symlinks detect-session-model.sh. -> verify (sandbox): `--only safety` wires the 5 safety scripts (all entries, prefixes/statusMessage intact) + on disk; `--only bash-guard` wires only bash-guard; `--only model-routing` deploys detect-session-model.
- [ ] **U5. Strip cluster hooks from base + CONFIG_HOOKS.** Remove all 27 cluster scripts from `CONFIG_HOOKS`; remove the 25 wired ones' entries from base `claude/settings.json` (only the cluster commands within any shared group, Stage-1 per-command filter idiom - leaves app-owned/core hooks in shared groups). Move detect-session-model out of CONFIG_HOOKS into the model-routing deploy. -> verify: base wires none of the 25; `--only config` wires 0 cluster hooks (only the app-owned residue remains).
- [ ] **U6. Config detect + deactivate.** `detect_component config` keys on `bash-guard.sh` (moves to safety); AND `startup-check.sh` COLLIDES with memory (memory symlinks+wires it too, install.sh:2030/2075) so it is unsafe. Re-key config on a config-UNIQUE core artifact: verify whether `~/.claude/hud.sh` is config-only (config symlinks it) and use it; else have config `touch ~/.claude/.improv-config` on install and detect on that marker. `deactivate_config` -> narrow to CORE only (hud/marker, the permissions/plugins/statusLine PYMERGE additions, and the still-app-owned CONFIG_HOOKS residue) - it must NOT remove cluster hooks NOR memory's startup-check. PYMERGE UNCHANGED. -> verify: `--only safety` -> config not-installed; `--only memory` -> config not-installed (no startup-check collision); `--only config` -> installed; deactivating config leaves safety + memory hooks intact.
- [ ] **U7. Nested TUI drill-in (U-TUI).** Phase-2 loop over picked clusters with the customize prompt + gum choose -> HOOK_OFF. -> verify: manual TUI walk (drill into verification, deselect validation-guard -> only 7 verification hooks install); non-interactive paths unaffected.
- [ ] **U8. deactivate + detect per cluster.** `deactivate_cluster <name>` (generic, via cluster_hooks + cluster-wirings.json: strip entries + rm symlinks + empty-group cleanup) wired into the dispatch for each cluster key. `detect_component <cluster>` = active iff **ANY** member script is on disk (NOT all) - so a drill-in partial (7 of 8) still shows active + deactivatable, and a lone `--only <hook>` surfaces via its cluster (Codex finding 2). -> verify (source-harness): deactivate verification -> its hooks gone, no empty groups, other clusters intact; a partial verification (validation-guard in HOOK_OFF) still detects active.
- [ ] **U9. Fix collateral (Codex findings 6,7,8).** (a) model-routing deploys detect-session-model (in U4). (b) `test-content-guard.sh` asserts `content-guard-stop` wiring in BASE settings (~:90) -> update to assert it via the safety cluster install (or drop the base assertion). (c) the hardcoded final "What was installed" summary (install.sh ~:3256-3272) + `show_picks_summary` -> extend to mention picked clusters (+ any HOOK_OFF customization). -> verify: `bash claude/hooks/test-content-guard.sh` PASS; summary shows clusters.
- [ ] **U10. Extend the parity test.** Add selections: config, config+each cluster, `--only bash-guard`, `--only model-routing`, `--preset all`. -> verify: all PASS (0 dangles), including detect-session-model present for model-routing.

## Verify gate
1. Every unit verify green. 2. Parity test PASS across the expanded matrix. 3. Sandbox matrix (config core-only-of-clusters; each cluster; one hook; preset all; a drill-in deselection honored). 4. bash -n clean; arrays aligned; `test-content-guard.sh` + other hook tests PASS. 5. **Codex review of the actual diff.** 6. plan-consistency-lint clean.

## Residual risks
- The nested-TUI phase-2 + HOOK_OFF is the novel piece; verify a deselection actually excludes the hook AND that re-running with the same choices is idempotent.
- After Stage 2, `--only config` still wires the app-owned residue (correct, not core-only yet). Do not assert config is hook-free until Stage 3.
