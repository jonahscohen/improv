---
name: hook taxonomy built - every hook classified by app-dependency vs standalone (Jonah's actual goal)
description: Jonah reframed the cmux/fable work as the first instance of his real goal - classify all ~69 hooks by dependent app (attach to that app's component) vs standalone upgrade (individually selectable), each described so the user picks what fits. Taxonomy doc built; 2 product decisions (granularity, forced-base) pending.
type: project
relates_to: [session_2026-07-15_settings-deploy-drift-audit.md, session_2026-07-15_cmux-fable-alacarte-leak.md, session_2026-07-15_cmux-fable-sidecoach-change-plan.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: evidence-based (per-hook purpose + dependency-token grep + judgment); classification not yet Codex-reviewed
confidence: medium
---

**Jonah's reframe (the real north star, subsumes cmux/fable/sidecoach):** "identify hooks by their dependent application, whether it be cmux, justify, sidecoach, discord, what have you, and then attach them to their dependent as part of install.sh. The user can choose which hooks to install alongside their dependent application of choice with a description explaining the hook's purpose. Some hooks stand alone and functionally upgrade Claude to perform better. I want to give the end user the option to choose which ones fit best for them + their applications of choice."

So the whole install.sh becomes a chooser: pick your apps (their hooks ride along, described) + pick standalone upgrades. cmux/fable/sidecoach were just the first instances.

**Inventory:** 99 hook files, ~30 tests -> ~69 real hooks (65 .sh + 4 .py). Classification rule: app-DEPENDENT only if meaningless/never-fires without that app; a hook that merely references app tool-names in a general policy is STANDALONE (token-grep over-attributes - e.g. bash-guard "mentions" every app but is standalone).

**Taxonomy (full table in docs/plans/2026-07-15-hook-taxonomy-and-install-restructure.md):**
- **12 app groups:** cmux (8 hooks + shim dir), sidecoach (6+lanes.py), voice-output (3), justify (3), codex (3), chrome (3 tabgroup), clickup (1), figma/lotus (1), reflect (1), memory (9 beats/consolidation), fable (1), visualizer (1).
- **8 standalone clusters:** safety (5), verification (8), question-discipline (4), grounding (2), api-drift (3), planning+git (2), surface/presentation (2), model-routing (1).
- **1 shared library:** detect-session-model.sh (dep of fable + model-routing).

**6 judgment calls flagged for Jonah** (I made defensible calls, alt noted): verify-clear/validation-guard (verification vs chrome); surface-visual-gate/claude-surface (surface vs visualizer); teammate-relay-stop (cmux vs codex); model-router-guard (own cluster vs fold into fable); figma-fidelity-stop (figma vs justify); justify/codex/chrome/clickup/figma as real components vs personal/hidden.

**2 PRODUCT decisions pending (Jonah's, they shape the execution):**
1. Granularity of standalone upgrades: 8 themed clusters (also --only-able, mirrors the skills-bundle pattern) vs ~30 individual toggles.
2. Forced base vs all-opt-in: nothing forced (even safety opt-in, default-on) vs safety is the only always-installed base.

Settled regardless: wiring mechanism (each owner wires its hooks add-on-pick/remove-on-deactivate, nothing app-specific in base - the sidecoach/voice pattern) + a committed anti-drift test asserting every wired hook is deployed by its owner (so this whole class of bug cannot regress).

**DECISIONS RESOLVED (Jonah 2026-07-15):**
1. Granularity = BOTH: cluster bundles you check off to install all, PLUS an expandable full-hook-list to edit at the individual level. Every cluster is a key AND every hook is its own --only-able key (the skills-bundle + individual-key pattern applied to all 8 clusters).
2. NOTHING forced - everything opt-in, even safety (default-checked in TUI but removable). Base claude/settings.json wires NO hooks; the config bundle dissolves into a small non-hook "core" (permissions/plugins/statusline) + the 8 clusters.
3. justify/codex/chrome/clickup/figma become public selectable components.

**Staging:** Stage 1 = active bugs + first instances (cmux full fix, fable, sidecoach-mcp wire-up, Category-3 dangler fix, anti-drift test; folds all 9 Codex findings) - every hook lands in its FINAL home so no rework. Stage 2 = dissolve config into core + 8 clusters (nothing-forced becomes real). Stage 3 = remaining app-component hook moves. Each stage: plan -> self-review -> Codex -> execute -> verify. Stage-1 plan being revised at docs/plans/2026-07-15-cmux-fable-scoping-and-sidecoach-wireup.md.
