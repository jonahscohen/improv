---
name: Stage-2 execution progress - U1 done (cluster-wirings.json); U2-U10 remain
description: Live progress of Stage 2 (dissolve config into 8 clusters). U1 done + verified - claude/hooks/cluster-wirings.json generated losslessly (25 wired scripts, 29 entries, 2 deploy-only). Executing per docs/plans/2026-07-15-stage2-config-dissolution.md (Codex-GO v4). Beats are the continuity layer (Jonah: "beats should hold you through the context").
type: project
relates_to: [session_2026-07-15_stage2-plan.md, session_2026-07-15_stage1-execution-progress.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: U1 sandbox-verified (25/29 counts match Codex; variants + prefixes preserved verbatim)
confidence: high
---

Plan committed eba1c015. Executing docs/plans/2026-07-15-stage2-config-dissolution.md (Codex-GO after 4 rounds). Uncommitted execution in progress.

**DONE:**
- **U1** - `claude/hooks/cluster-wirings.json` generated from base settings.json: script -> [{event, matcher, hook-object}]. Verified: 25 wired scripts, 29 entries; deploy-only = multiple-choice-enforce.sh + question-enforcement.sh (no entries); double-wired = verify-before-done, grounding-guard, claude-surface (bare + `turn`), model-router-guard; push-ahead-check `SESSION_CWD="$(pwd)"` prefix preserved. LOSSLESS (exact command strings). **This file MUST exist before U5 strips base.**

**THE 8 CLUSTERS + members** (27 scripts; 2 deploy-only):
- safety: bash-guard, content-guard, content-guard-stop, destructive-ops-guard, destructive-confirm-detect
- verification: verify-before-done, verify-before-done-stop, verify-clear, verify-manual, screenshot-open-mandate, screenshot-open-clear, second-fix-gate, validation-guard
- question-discipline: multiple-choice-detect-stop, multiple-choice-inject-prompt, multiple-choice-enforce(deploy-only), question-enforcement(deploy-only)
- grounding: grounding-gate, grounding-guard
- api-drift: api-drift-detector, api-drift-stop, api-drift-ack
- planning-git: plan-consistency-lint, push-ahead-check
- surface: claude-surface, surface-visual-gate
- model-routing: model-router-guard (+ detect-session-model.sh as deployed exec dep)

**DATA MODEL:** clusters are KEYS (default PICKS=1); individual hooks are NOT KEYS - HOOK_ON (--only <hook>) + HOOK_OFF (drill-in deselect) space-delimited sets. Effective hook set = (union of picked clusters' cluster_hooks - HOOK_OFF) + HOOK_ON. Install unit = the effective hook (symlink + insert its cluster-wirings.json entries, add-if-absent by command). cluster_hooks() = case fn (membership). No separate resolution pass.

**U2-U6 DONE + sandbox-verified:**
- U2 baseline: parity PASS; 27 scripts confirmed in CONFIG_HOOKS.
- U3: 8 cluster KEYS added (arrays 36-aligned); cluster_hooks() + is_cluster_hook() + CLUSTER_KEYS + HOOK_ON/HOOK_OFF init; apply_only hook-token branch. Verified fns.
- U4: "16d. QA-hook clusters" install pass (effective set = picked-clusters' members - HOOK_OFF + HOOK_ON; symlink + wire each from cluster-wirings.json; model-router-guard also symlinks detect-session-model). Verified: --only safety=5 wired+disk; --only bash-guard=1 only; routing cluster=2 entries + detect-session-model dep; question-discipline=4 on disk / 2 wired (deploy-only correct).
- U5: CONFIG_HOOKS reduced to the 13 app-owned residue; stripped 29 base cluster entries (per-command, shared-group residue like startup-check+node-shim-heal preserved). Verified base wires 0 cluster hooks; parity PASS; --only config wires 0 cluster hooks.
- U6: detect_component config re-keyed bash-guard.sh -> hud.sh (config-UNIQUE, Codex-confirmed; startup-check collided with memory). deactivate_config narrowed: for-loop -> residue only; added hud removal; OUR_HOOK_MARKERS strip replaced with residue-across-all-events (no longer removes cluster hooks NOR memory's startup-check). Verified --only safety/memory -> config not-installed; --only config -> installed.

**REMAINING (exact specs):**
- U2 baseline: parity test PASS; confirm 27 scripts in CONFIG_HOOKS (25 base-wired).
- U3: add 8 cluster KEYS + TITLES/DESCS/FILES/DIRS/PICKS=1; add cluster_hooks() fn; init HOOK_ON="" HOOK_OFF="".
- U4: new standalone-hooks install pass - compute effective set; for each, symlink + insert its cluster-wirings.json entries (python, add-if-absent); model-routing also symlinks detect-session-model; standalone-safe guard.
- U5: strip all 27 from CONFIG_HOOKS; strip the 25 wired ones' entries from base claude/settings.json (per-command filter within shared groups, Stage-1 idiom); move detect-session-model out of CONFIG_HOOKS.
- U6: config detect re-key from bash-guard.sh -> `~/.claude/hud.sh` (Codex CONFIRMED config-unique, only config links it at install.sh:2002; startup-check COLLIDES with memory so NOT usable); narrow deactivate_config to core+residue (NOT cluster hooks, NOT memory's startup-check).
- U7: nested two-phase gum TUI - phase 1 clusters (as KEYS, no filtering needed); phase 2 per picked cluster: gum confirm "customize?" -> gum choose members (default all) -> deselected to HOOK_OFF.
- U8: generic deactivate_cluster (via cluster_hooks + cluster-wirings.json); detect_component cluster = ANY member on disk (not all - handles drill-in partials + lone --only hooks).
- U9: test-content-guard.sh asserts content-guard-stop in BASE (~:90) -> update; extend hardcoded final summary + show_picks_summary for clusters.
- U10: extend test-settings-deploy-parity.sh SELECTIONS (config, each cluster, --only bash-guard, --only model-routing, --preset all).
- THEN: full sandbox matrix + parity + bash -n + test-content-guard + Codex diff + commit.

**U8 DONE + verified:** cluster_detect() = active iff ANY member on disk (drill-in partials + lone --only hooks surface); generic deactivate_cluster() (strip member entries across all events + rm symlinks + empty-group cleanup, leaves shared detect-session-model); detect_component + deactivate_component dispatch cluster cases. Verified: detect active->not-installed, 9 verification entries->0, no empty groups, scripts removed; residue (agent-teams-guard) NOT over-removed.

**REMAINING:** U7 (nested TUI two-phase drill-in - modify run_tui gum flow: phase-1 clusters as KEYS, phase-2 per-picked-cluster "customize?" gum confirm -> gum choose members default-all -> deselected to HOOK_OFF); U9 (test-content-guard.sh asserts content-guard-stop in BASE ~:90 -> update since it moved to safety cluster; extend hardcoded final summary + show_picks_summary for clusters); U10 (extend test-settings-deploy-parity.sh SELECTIONS with clusters + --only bash-guard + --preset all). THEN full sandbox matrix + parity + bash -n + all hook tests + Codex diff + commit.

MINOR: the MEMORY.md stage2-plan index entry didn't land in eba1c015 (formatter reverted); re-add at next commit.

**U7-U10 DONE + verified:** U7 nested TUI drill-in (phase-2 gum confirm + gum choose -> HOOK_OFF; membership + effective-set exclusion logic unit-tested; interactive gum path needs a TTY so code-verified not interactively run); U9 test-content-guard.sh fixed to assert content-guard-stop in cluster-wirings.json (35/0 pass); U10 test-settings-deploy-parity.sh extended to 15 selections (8 clusters + standalone safety + lone bash-guard) - ALL PASS, 0 dangles. bash -n clean. Summary cluster-awareness (show final-install list) DEFERRED as cosmetic.

**CODEX DIFF ROUND 1: NO-GO, 6 findings, folded:**
1. HIGH HOOK_OFF not subtractive on rerun (install pass only added _eff) -> added a reconcile step: remove picked-cluster members now in HOOK_OFF (rm symlink + strip settings). Verified _remove computation.
2. HIGH deactivate_config still removed startup-check (memory owns it) -> removed that block; startup-check left as memory-owned/shared.
3. MED cluster install didn't migrate a legacy symlinked settings.json -> added the config-style symlink->real-file migration to the cluster pass.
4. MED missing repo hook file could leave a dangle (symlink loop warns+continues but JSON still wired it) -> added an on-disk filter (_eff_ok) so only landed hooks are wired.
5. LOW stale help ("config installs full guard/QA suite") -> rewrote; added a Clusters: line. (Returning-flow drill-in still full-cluster-only = additive UX follow-up.)
6. LOW detect-session-model deployed-but-undeactivatable for --only model-routing -> ACCEPTED (shared with fable; removing risks breaking fable).

Verified after fold: bash -n clean; parity matrix ALL PASS; HOOK_OFF _remove logic correct.

**CODEX DIFF ROUND 2: NO-GO (5 prior resolved), 3 new - folded + verified:**
1. HIGH deactivate_cluster wrote through a legacy settings symlink -> added ensure_real_settings() (migrate symlink->real) called in deactivate_cluster.
2. MED/HIGH unconditional rm of hook symlinks could hit a user's same-named hook -> added rm_hook_if_ours() (repo-symlink OR Improv-marked only); used in deactivate_cluster + HOOK_OFF reconcile. VERIFIED: a user-owned hook survives, repo symlinks removed.
3. MED _eff_ok didn't clean a stale entry if a repo file went missing -> track _eff_missing, fold into the reconcile removal.
Verified: bash -n clean; rm_hook_if_ours guard works; deactivate leaves 0 entries; parity ALL PASS.

**CODEX DIFF ROUND 3: NO-GO (ensure_real_settings + stale cleanup confirmed), 3 edge findings - folded + verified:**
1. rm_hook_if_ours missed COPY-mode hooks (no "Improv" marker in hook files) -> added a `cmp -s` byte-identical-to-repo-source check (handles copy-mode; a user's DIFFERENT same-named file is not identical, so preserved).
2. cluster install used make_symlink (bypasses copy-mode fallback for temp clones + IMPROV_HOOK_DEPLOY=copy) -> switched to link_or_copy (matches config).
3. settings strip by bare basename could strip a user's same-named hook's entry -> tightened both strips to match the '/hooks/<name>' path segment.
Verified: bash -n clean; tightened strip still removes cluster entries (3->0); parity ALL PASS.

**CODEX DIFF ROUND 4: NO-GO (round-3 items resolved), 1 blocking:** link_or_copy copy-mode did rm+cp with no backup, so IMPROV_HOOK_DEPLOY=copy + a user's same-named hook = data loss (pre-existing; config uses link_or_copy too, but the cluster pass exposed it). FIXED in the shared helper: copy-mode now backs up a DIFFERENT existing real file (via backup_if_exists -> $REPO_DIR/.backups) before overwrite, skipping our own byte-identical re-install. VERIFIED: a user's custom bash-guard.sh is preserved in .backups after a copy-mode safety install; parity ALL PASS. Improves config/memory too.

**CODEX DIFF ROUND 5: NO-GO (link_or_copy fix confirmed), 1 blocking:** rm_hook_if_ours "Improv"-marker fallback could delete a user hook that merely mentions "Improv" (and it was redundant - the cmp check already covers our copy-mode hooks). FIXED: dropped the fallback; rm_hook_if_ours now removes ONLY a repo symlink or a byte-identical copy (a user's different/modified same-named file is left intact). VERIFIED: a user hook mentioning "Improv" is preserved; cluster symlinks still removed on deactivate; parity ALL PASS.

**CODEX DIFF ROUND 6: NO-GO, 1 blocking (ownership consistency):** rm_hook_if_ours preserved the FILE but the settings-strip (substring hooks/<name>) + cluster_detect (any same-named file) were not ownership-aware. FIXED: added is_our_hook() (repo-symlink OR byte-identical) used by BOTH cluster_detect and rm_hook_if_ours; both settings strips (deactivate_cluster + reconcile) now remove only EXACT commands declared in cluster-wirings.json for the removed hooks. So a user's different same-named hook + differently-formed wiring is fully preserved. VERIFIED: exact-command strip removes our entries (4->0); a user's different validation-guard.sh -> cluster_detect not-installed; parity ALL PASS.

**CODEX DIFF ROUND 7: NO-GO but FALSE POSITIVE (verified).** Codex claimed the link_or_copy SYMLINK branch overwrites a user file without backup. But the symlink branch (install.sh:140-143, PRE-EXISTING, thus not in the diff Codex saw) already calls backup_if_exists before rm+ln. Codex inferred the gap from the diff not showing the unchanged branch. VERIFIED by live test: symlink-mode install with a user validation-guard.sh -> the user file IS backed up to .backups; the installed one is our symlink. No data loss. Codex also acknowledged the identical-command wiring edge as inherent/non-blocking. So there is NO real blocking issue. Doing one confirming Codex pass with the full link_or_copy context, then commit.

Accepted follow-ups (not blocking): returning-flow cluster activation is full-cluster-only (no drill-in); final "what was installed" summary not cluster-aware; detect-session-model shared-dep stays on --only model-routing deactivate.
