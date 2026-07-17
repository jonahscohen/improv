---
name: figma-fidelity-arm registered in browser-tree.json + drift caught at all three sites (GUI-installer final Codex High finding)
description: Fixed the install.sh <-> browser-tree.json drift where figma installs 2 hooks (stop + arm) but the tree only registered figma-fidelity-stop; strengthened the drift test and, via cross-model review, found + fixed the SAME drift at a third site (detect_component)
type: project
relates_to: [session_2026-07-17_gui-installer-design.md, session_2026-07-17_hooks-only-buckets-no-install-affordance.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests (component-browser 124/1 -> 127/0; browser-render 146/146; installer-manifest PASS; behavioral detect probe; 6 negative controls; 4 Codex passes, final clean)
confidence: high
---

The High finding from the 2026-07-17 GUI-installer final Codex holistic review (follow-up task_25735f54). NOT committed - left in the working tree for Jonah.

**The drift (one hook, three code sites).** install.sh installs, deactivates, AND detects figma via two hooks - `figma-fidelity-stop.sh` + `figma-fidelity-arm.sh`. arm was added by the concurrent figma workstream (09af2d8f, 7fe3e249) but the sites that ENUMERATE figma's hook set were not all updated with it:
1. `browser-tree.json` knew only stop (hooks list, hook_owner, hook_desc all at 63, arm in none) -> arm invisible/uncontrollable in BOTH the terminal bucket browser and the GUI installer.
2. `install.sh:1211` `detect_component figma` probed only `figma-fidelity-stop.sh` (codex/chrome already OR over their full set) -> found by Codex, see below.

**Fix 1 - browser-tree.json (the ask):**
- Added `figma-fidelity-arm` to the figma node's `hooks` list (now 2).
- Bumped node desc "The 1 hooks" -> "The 2 hooks" (forced by the count-check test at :287).
- Added `hook_desc["figma-fidelity-arm"]` and `hook_owner["figma-fidelity-arm"]="figma"`.

**Fix 2 - install.sh:1211 (folded from Codex pass 3):** `detect_component figma` now `{ is_our_hook stop || is_our_hook arm; }`, mirroring codex/chrome. Real partial-state bug that THIS fix's own new toggle enables: toggle stop off while arm stays on -> old code read `not-installed`, skipping an installed hook. Behaviorally verified through the real functions + a real symlink: only-arm -> `active` (was `not-installed`); no-hooks -> `not-installed`; only-stop -> `active`.

**Key finding: the drift test the follow-up asked me to CREATE already existed and was already red.** `test-component-browser.sh` "installer and tree agree on every app hook (both directions)" derives truth from install.sh's own `picked X && install_app_hooks` lines and compares to the tree. It was already catching this (124 passed / 1 FAILED at HEAD 0fc4881d). Fix 1 flips it green.

**Test strengthening (three checks; every one negative-controlled):**
1. Both-directions check now verifies all THREE tree surfaces per install-declared hook - hook_owner routing, a rendered toggle, AND a desc label - not hook_owner alone (its old "no toggle" message was a proxy). The toggle check is PLACEMENT-AWARE (`placed[h]`: a named-key hooks node owns itself; a shared "Hooks" child owns the leaf siblings beside it, so Beats' Hooks node legitimately serves BOTH memory and reflect) PLUS a per-occurrence `misplaced` guard (every listed hook's hook_owner must be valid for the exact node it sits under, closing the union bypass where a stray duplicate under the wrong screen would still pass).
2. New: install/deactivate one-liner symmetry (each `deactivate_X() { deactivate_app_hooks ...; }` set == its `install_app_hooks` set).
3. New: detect_component<->install parity for `is_our_hook` app components (clickup/visualizer/codex/chrome/figma) - guards the third drift site so it fails loudly next time.

**Negative controls (mirror the repo to scratchpad, mutate, run the REAL test, restore):**
- NC1 hook_owner-only (no toggle) -> FAIL "no toggle on figma's screen"
- NC2 deactivate leak -> FAIL "leak"
- NC3 missing from all three surfaces (the original bug) -> FAIL naming all three
- NC4 mis-placed under codex's node -> FAIL "not in a hooks node owned by figma"
- NC5 correct + duplicated under sidecoach/Hooks -> FAIL "a toggle on the wrong screen"
- NC6 detect reverted to stop-only -> FAIL "detect_component never probes it"
All restore to green; Beats' multi-owner node never false-positives.

**Cross-model review: 4 real-Codex passes (codex-review.py, gpt-5.5, each exit 0).** Pass 1 -> Medium: global inlist proves "a toggle somewhere" not "under the right owner" -> folded placement-awareness. Pass 2 -> Medium: union placed[h] lets a duplicate-under-wrong-owner pass -> folded per-occurrence guard. Pass 3 -> confirmed the test fold correct + found the install.sh:1211 detection drift -> folded Fix 2. Pass 4 -> "No remaining correctness defect found" (Codex verified real repo state, not just the diff).

**Self-analysis - my own regex bug the harness caught.** My first deactivate-symmetry regex used non-greedy `(.+?);\s*\}` which, on `deactivate_codex() { deactivate_app_hooks a.sh b.sh; rm_hook_if_ours codex-review.py; }`, backtracked PAST the first `;`, gluing `.sh;` onto the last hook token so the `.endswith(".sh")` filter silently dropped `codex-rescue-guard`. I only saw it because I ran the check against real data before trusting it (it reported codex MISMATCH). Fix: `[^;]+` stops at the deactivate_app_hooks statement's own terminator; the `\}\s*$` anchor still requires a genuine one-liner. Lesson reinforced: run every new check against real inputs, in both directions, before believing green.

**Gates, all green:** component-browser 124/1 -> 127/0, browser-render ALL 146 PASSED, installer-manifest PASS, `bash -n` clean on install.sh + the suite, tree JSON valid, manifest shows figma-fidelity-arm under the figma bucket ("Design Tools").

## Files touched
- claude/hooks/browser-tree.json (figma node hooks + desc, hook_desc, hook_owner)
- install.sh (:1211 detect_component figma ORs both hooks)
- claude/hooks/test-component-browser.sh (three drift checks: strengthened both-directions + install/deactivate symmetry + detect/install parity)
