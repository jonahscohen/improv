---
name: Bucket-browser apply_plan - component leaf is master switch for dual-nature owners
description: For owners that have BOTH a tree leaf AND separately-toggleable hooks (memory, reflect), the leaf is the master on/off; toggling individual hooks never uninstalls the component. Hooks-only owners treat all-hooks-off as full uninstall.
type: decision
relates_to: [decision_installer_bucket_browser.md, session_2026-07-16_bucket-browser-build-kickoff.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: tests
confidence: high
---

In the bucket browser's `apply_plan` (browser-lib.sh), how a staged owner resolves to install/uninstall commands depends on whether the owner has its own component LEAF in the tree.

**Choice made:** owners that have BOTH a component leaf and separately-owned non-pinned hooks (`memory` -> Beats/memory leaf + memory-approve/nudge/compact/consolidate-nudge; `reflect` -> Beats/reflect leaf + reflect-nudge) treat the LEAF as the master switch. The hooks are sub-toggles. Concretely, per owner O with leaf path `lp` and owned non-pinned hooks `H`:
1. `lp` staged-uninstall -> `UNINSTALL_COMPONENT O` (master off).
2. no owned hooks (pure leaf) -> `INSTALL O` iff `lp` staged-install.
3. hooks-only owner (NO leaf: sidecoach, justify, codex, chrome, cmux, figma, clickup, visualizer, fable, voice-output, the 8 clusters) AND every h in H staged-uninstall -> `UNINSTALL_COMPONENT O`.
4. otherwise -> `INSTALL O` + off-list, where a hook is ON iff `(currently_on OR staged_install OR leaf_staged_install) AND NOT staged_uninstall`; off-list = H - on (tree order).

Net: toggling off `reflect-nudge` yields `INSTALL reflect reflect-nudge` (skill stays, nudge unwired), NEVER `UNINSTALL_COMPONENT reflect`. Toggling off all 4 memory hooks (engine leaf untouched) yields `INSTALL memory <all 4 off-listed>` (CLAUDE.md + startup-check stay, hooks unwired), NEVER removing the engine. Installing the memory engine leaf brings its hooks (`INSTALL memory`, no off-list).

**Alternatives considered:**
- Option B (uniform all-hooks-off -> UNINSTALL_COMPONENT): rejected. It was the original Task-4 spec and shipped as commit 8ecbb43f, but an independent review + a trace showed it makes toggling off the single `reflect-nudge` hook remove the ENTIRE reflect skill, and toggling off memory's hooks remove the CLAUDE.md memory-discipline scaffolding. That is a real defect, not just a wrinkle - the leaf and its hooks are different controls.
- Option C (scaffolding-without-hooks is a first-class state you reach only via the leaf): partially adopted - it IS reachable (turn off all hooks, leave leaf on), but we did not add a separate UI affordance for it; it falls out of rule 4.

**Why this one:** the browser deliberately surfaces memory/reflect with a distinct engine/skill LEAF plus their hooks in a Hooks folder (Jonah's validated design). The leaf is the natural master toggle; the hooks are fine-grained sub-controls. Uniform "all hooks off = uninstall" collapses that two-level model and destroys the component on a hook tweak.

**Revisit when:** a new component is added that has both a leaf and owned hooks (extend `_owner_leaf_path`/`BR_OWNERLEAF` coverage - it already emits for every leaf node, so this is automatic), OR if product wants "engine installed but zero hooks" to be disallowed (then rule 4's empty-target_on case should escalate to UNINSTALL_COMPONENT for leaf owners too).

Implemented: browser-lib.sh `apply_plan` + `_owner_leaf_path` + `BR_OWNERLEAF_<hex>` loader map. Commit f6c5ac52 (worktree feat/installer-bucket-browser). 53/53 tests pass under bash 3.2.
