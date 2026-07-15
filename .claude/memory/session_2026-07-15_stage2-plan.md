---
name: Stage-2 plan authored - dissolve config into 8 clusters (nested drill-in, nothing-forced)
description: Stage 2 of the hook-taxonomy restructure. Jonah chose nested drill-in for granularity. Plan splits config into a non-hook core + 8 selectable QA clusters (safety/verification/question-discipline/grounding/api-drift/planning-git/surface/model-routing), each a KEY, with member hooks also KEYS; two-phase gum TUI; base wires nothing. Plan-consistency-lint + Codex pending before execution.
type: project
relates_to: [session_2026-07-15_hook-taxonomy-design.md, session_2026-07-15_stage1-execution-progress.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: plan grounded in re-read install.sh mechanisms (TUI gum flow, apply_only, skills-bundle, CONFIG_HOOKS); lint + Codex not yet run
confidence: medium
---

Stage 1 landed + committed (20421f0b feature, 4135ddc1 beats). Jonah: "continue with stage 2/3." Granularity decision (the one fork): **nested drill-in** - TUI shows clusters; selecting one lets you expand + toggle its individual hooks in a second step.

Plan: docs/plans/2026-07-15-stage2-config-dissolution.md (stamped 4135ddc1).

**Grounded mechanisms (re-read from install.sh):**
- TUI (780) is a single flat `gum choose --no-limit` over KEYS; sets PICKS via set_all 0 + set_pick. Stage 2 makes it two-phase.
- `skills` bundle (2132) installs members directly; each design-skill ALSO installs on its own `picked X` line (KEYS+=DESIGN_SKILL_KEYS). Precedent for bundle+individual keys.
- apply_only (507) just set_pick's each --only key; needs cluster->member expansion.
- config = PYMERGE (permissions/plugins/statusLine/marketplaces + hooks) + CONFIG_HOOKS deploy. Core-split keeps the non-hook merge, moves hook deploy+wiring to clusters.

**Data model (bash-3.2 safe):** clusters + hooks BOTH become KEYS. `cluster_hooks()` case fn = membership source of truth. Resolution: for each picked cluster, set member hooks' PICKS=1, drill-in prunes. Install unit = the hook (single standalone-hooks pass iterates hook KEYS). Clusters have no install block - pure UI/resolution groupings.

**8 clusters + members** in the plan table (27 member hooks total, all currently in CONFIG_HOOKS + base-wired). Stage 2 moves ONLY these; app-owned hooks still in CONFIG_HOOKS (agent-teams/node-shim -> cmux; memory-*/consolidate -> memory; justify-*/block-clickup/voice-gate/visualizer/codex-* -> Stage 3 apps) stay until Stage 3, when CONFIG_HOOKS empties and config becomes core-only.

**Highest risk (flagged for Codex):** the nested-TUI ordering (phase-1 clusters -> per-cluster default-all-members -> drill-in prune) must not re-enable a deselected hook; hiding individual hook KEYS from phase-1 while keeping them --only-able; the ~63-key array growth vs any loop assuming top-level-only.

Plan-consistency-lint CLEAN. **Codex plan review (round 1): NO-GO, 8 findings** - all folded into v2:
1. HIGH single-bit PICKS can't hold "deselected" -> drill-in is the ONLY HOOK_OFF setter; no separate resolution pass that could re-enable.
2. HIGH config detect keys on bash-guard.sh (moves to safety) + deactivate_config removes cluster hooks -> re-key config detect on startup-check.sh; narrow deactivate_config to core+residue only.
3. HIGH "config core-only after Stage 2" was premature - config still wires app-owned residue until Stage 3 (PYMERGE unchanged; base just has fewer hooks).
4. HIGH hook->wiring is a LIST not one entry (grounding-guard/model-router/claude-surface/verify-before-done each wire twice) -> hook_wirings echoes all entries.
5. HIGH making hooks KEYS pollutes returning-flow/state/summary/fallback loops -> **REFRAME: hooks are NOT KEYS**. Clusters are KEYS; hooks live in HOOK_ON (--only <hook>) + HOOK_OFF (drill-in deselect) sets; effective set = (picked clusters' members - HOOK_OFF) + HOOK_ON.
6. MED model-router-guard execs detect-session-model -> model-routing deploys it; parity won't catch (not wired, exec'd).
7. MED test-content-guard.sh asserts content-guard-stop in BASE settings -> update.
8. MED hardcoded final summary + show_picks_summary need cluster awareness.

v2 written (cleaner HOOK_ON/HOOK_OFF model). **Codex round 2: NO-GO, HOOK_ON/HOOK_OFF confirmed sound, 4 findings** -> folded into v3:
1. HIGH startup-check.sh COLLIDES with memory (memory installs it too) -> config detect keys on a config-unique artifact (hud.sh if config-only, else a .improv-config marker).
2. HIGH detect_component cluster = "all members on disk" makes a drill-in partial (or lone --only hook) invisible/undeactivatable -> detect = ANY member on disk.
3. HIGH EVENT|MATCHER|TIMEOUT triple is lossy (real entries have SESSION_CWD prefixes, `claude-surface.sh turn` args, statusMessage) -> generate claude/hooks/cluster-wirings.json storing EXACT hook objects; cluster install inserts them verbatim.
4. MED 24 vs 27 script count -> 27 everywhere.

**Codex round 3: NO-GO but confirmed sound (hud.sh IS config-unique, cluster ANY-member detect sound, HOOK_ON/OFF sound, apply_only branch right), 3 findings** -> v4:
1. HIGH "byte-for-byte round-trip" overclaimed - settings has shared/ordered groups (SessionStart mixes startup-check+claude-surface+node-shim-heal); the requirement is BEHAVIORAL equivalence (each hook fires at its event+matcher), not byte-identical structure. Reworded.
2. MED multiple-choice-enforce + question-enforcement are DEPLOY-ONLY (in CONFIG_HOOKS, not base-wired - detection twins). So 27 scripts, ~25 wired (29 entries), cluster symlinks all 27 but wires 25. Made explicit.
3. LOW stale "24" in U2/U5 -> 27.

v4 written. Codex round 4 pending (expected GO - remaining were wording/count of an already-sound design). Given the marathon session, once GO the responsible move is to COMMIT the plan as an execution-ready checkpoint and let Jonah choose execute-now vs fresh-session (executing the big nested-TUI + cluster surgery at the tail of a long session is a quality risk, per the same principle that stopped the overnight run).
