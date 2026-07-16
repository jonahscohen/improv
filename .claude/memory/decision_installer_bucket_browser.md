---
name: Installer bucket-browser redesign - approved design (4 forks ruled)
description: Jonah wants the installer's flat ~30-item component list replaced with a siloed bucket browser (rollup status, drill-in, per-item toggle, install-all/uninstall-all). Brainstormed + 4 design forks ruled 2026-07-16. Spec at docs/superpowers/specs/2026-07-16-installer-bucket-browser-design.md. NOT yet built (design approval -> writing-plans next).
type: decision
relates_to: [reference_component_dependency_map.md, session_2026-07-15_stage2-execution-progress.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: design only (brainstorming skill); no code written; bucket members confirmed against live --help
confidence: high
---

Jonah: the current installer interactive flow (flat list of ~30 components with active/inactive/not-installed badges + a flat gum picker, `returning_flow`/`run_tui_gum` in install.sh) is not the desired browsing experience. He wants siloed buckets with active/partial/not-installed rollup status, drill-in to per-item status, per-item install/uninstall, and "Install all.../Uninstall all...". Brainstormed via the superpowers brainstorming skill.

**Four forks ruled (all via AskUserQuestion, 2026-07-16):**
1. Nav model = **nested screens** (gum + plain-text fallback), NOT a live expand/collapse tree (gum can't do it natively; a raw-terminal render loop is too fragile for a bash installer).
2. Drill depth = **all the way down** - QA clusters -> a cluster -> its hooks; Skills -> individual skills. Atomic buckets (Core/Channels/Apps) stop at the item.
3. Scope = **unified** - one browser for BOTH first-run and returning users (status is per-item, computed live either way). Replaces run_tui_gum + returning_flow.
4. Apply model = **staged, then apply** - toggling marks pending (+install/-uninstall); a persistent "Apply changes (N)" runs all pending installs in ONE `--only a,b,c --yes` pass + the uninstalls, then refreshes. First-run stages a set and applies once; managing stages a toggle. Warn on quit-with-unapplied. NOT immediate-per-toggle (would spawn N subprocesses on a first-run bulk pick).

**Buckets = the six existing --help categories** (Core, Channels, Tools, Apps, QA clusters, Skills; Personal hidden unless --personal). Membership defined ONCE as data + --help regenerated from it so they can't drift.

**Reuses existing machinery:** detect_component / cluster_detect (refined for all-vs-some = partial), the --only comma-list install path, deactivate_component family, and the Stage-3b `_AMPERSAND_HOOK_OFF` drill-in sentinel (so "install cluster X minus hook Y" rides through apply). Non-interactive flags (--only/--preset/--yes/--dry-run/--help) untouched.

**Status: design FULLY validated via the interactive prototype (7 iteration rounds, see session_2026-07-16_bucket-browser-prototype.md). Spec REWRITTEN 2026-07-16 to the validated structure** (purpose buckets, CORE COMPONENTS tier with Foundation + the 5 flagships, MORE COMPONENTS, Beats memory/reflect/Hooks-folder model, single-owner-drill-straight rule, per-hook descriptions, staged-apply, two-state update flow with real check_updates/apply_update + pull-and-re-run mechanics). The 4 original forks + 3 later refinements (Foundation->core, Centerpiece->"Core Components", update affordance, "Up to date" state) all folded. Spec at docs/superpowers/specs/2026-07-16-installer-bucket-browser-design.md. RESOLVED (Jonah 2026-07-16): FULL per-hook control - extend the cluster HOOK_ON/HOOK_OFF selective-install to app-components (Task 5 of the plan, the biggest build piece). IMPLEMENTATION PLAN WRITTEN: docs/superpowers/plans/2026-07-16-installer-bucket-browser.md - 10 TDD tasks (browser-tree.json data + test scaffold; tree loader/accessors in a new claude/hooks/browser-lib.sh; status/rollup; staging + apply-plan; per-hook app off-list; apply_pending; two-state update flow; gum render+nav+text fallback; wire-in replacing run_tui_gum/returning_flow + --help regen from the tree; full verify + cross-model review). The prototype is the reference implementation to port to bash.

**SHIPPED 2026-07-16 - BUILT, VERIFIED, MERGED TO MAIN (merge commit b25c1f0f; branch feat/installer-bucket-browser, 24 commits, 27 files, +6886/-590; NOT pushed to origin per Jonah).** All 10 plan tasks landed subagent-driven. The browser IS the interactive installer now: `run_tui_gum`, `run_tui_fallback`, `fresh_flow` and `returning_flow` are DELETED, plain `./install.sh` lands in the bucket browser, and `--help` is GENERATED from browser-tree.json so help and browser cannot drift. Gates on merged main: component-browser 104, check-updates 39, apply-pending 33, app-hook-offlist 36, browser-render 110, parity + PARITY_FULL ALL PASSED, content-guard 35/0, bash -n clean, Codex full-branch review NO HIGH / NO MEDIUM. Visually verified in a real 80x24 Terminal (banner + gum render). Full build record: [[session_2026-07-16_bucket-browser-build-kickoff.md]]; the engine-leaf contract: [[decision_bucket_browser_engine_leaf_master.md]].

The closing gate caught 2 HIGHs that 300+ passing assertions missed: (1) "Disable all" INSTALLED on a partially-installed owner (my apply_plan rule-3 contradiction - fixed to test `target_on` empty); (2) 4 owners (cmux/fable/reflect/sidecoach) silently ignored the per-hook off-list because only `install_app_hooks` implemented it - Jonah ruled "fix the debt now", 14 wirings converged into app-wirings.json, all 12 owners now honor it. Also: the tree was LYING (sidecoach claimed 2 hooks, wired 6; cmux omitted 2) because the completeness test only checked the tree against ITSELF - replaced with a structural test derived from install.sh's own `picked X && install_app_hooks` lines, running both directions.

Files: docs/superpowers/specs/2026-07-16-installer-bucket-browser-design.md (the spec).
