---
name: default-off hook concept in the packaging engine (closes sidecoach-detect master-leaf gap)
description: Taught browser-lib.sh a default_off_hooks concept parallel to pinned_hooks so a browser MASTER-LEAF Sidecoach install leaves sidecoach-detect INSTALL-but-off instead of force-wiring the per-edit scan; every non-default-off hook is byte-for-byte unchanged under every install path.
type: project
relates_to: [session_2026-07-24_stage3b-detect-packaging.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests / codex-review
confidence: high
---

Closed the one uncovered opt-in path the Stage 3b detect packaging escalated (see session_2026-07-24_stage3b-detect-packaging.md, the Codex HIGH). Authored against HEAD c9985f6f.

**The gap.** `sidecoach-detect` ships OPT-IN via a default-off SEED in install.sh (adds it to HOOK_OFF unless `_AMPERSAND_HOOK_OFF` is set). A browser MASTER-LEAF install of the whole Sidecoach component defeated the seed: `apply_plan` sets `leaf_install=1` when the component leaf is staged install, which force-enabled EVERY owned hook -> empty off-list -> seed suppressed -> detect wired as an active per-edit PostToolUse scan on a fresh GUI install. Advisory hook (never blocks), so a latency/UX gap, not a hazard, but it contradicted the opt-in intent.

**The fix (mirror the proven pinned_hooks mechanism, do not invent a divergent one).** Taught the ENGINE a `default_off_hooks` tree property, PARALLEL to `pinned_hooks`, that exempts a hook from the master-leaf force-enable ONLY.

Why default_off is a DIFFERENT property from pinned (the load-bearing distinction): a pinned hook is never installer-managed (always-on, excluded from `hooks_owned_by`, not toggleable, reads active regardless of the probe). A default-off hook IS installer-managed - it stays in `hooks_owned_by`, stays per-hook toggleable, and reads its real on/off state from the probe. The ONLY behaviour default_off changes is exemption from the `leaf_install` blanket force-enable in apply_plan. So it touches the loader/reset/helper (to KNOW the property) and exactly one apply_plan branch - and deliberately NOT the status/counts logic, `hooks_owned_by`, or the staging layer.

How (4 surgical touch points in browser-lib.sh, all mirroring pinned, + 1 guard + 1 tree entry):
- Loader emit (python block, right after the `pinned_hooks`->PINNED loop): `for h in tree.get("default_off_hooks", []): emit("DEFAULTOFF", h, "1")`.
- Reset-unset loop (browser_load top): added `${!BR_DEFAULTOFF_@}` beside `${!BR_PINNED_@}` so a re-load leaves no stale entry.
- `hook_default_off <hook>` helper mirroring `hook_pinned` (reads encoded `BR_DEFAULTOFF_<hex>`, `-` default under set -u), with a comment stating the different-from-pinned semantics.
- The guard (the ONE behaviour change): the leaf-install force-enable branch `elif [ "$leaf_install" = "1" ]; then on=1` became `elif [ "$leaf_install" = "1" ] && ! hook_default_off "$h"; then on=1`. For any NON-default-off hook `! hook_default_off` is true, so the condition reduces to the original `[ "$leaf_install" = "1" ]` - identical behaviour. For a default-off hook under leaf install it falls through to the probe (current state), so a fresh install (file absent) -> off, and an existing opt-in (file present) -> stays on.
- browser-tree.json: `"default_off_hooks": ["sidecoach-detect"]` added parallel to `pinned_hooks`.

**Precedence is preserved (why every other path is untouched):** the enable chain is staged-uninstall > staged-install (per-hook) > leaf_install-force > probe. The guard sits ONLY on the third rung. Per-hook stage-install (browser toggle ON) is the second rung and still wins -> opt-in via the browser toggle still reaches detect. Staged-uninstall is first -> toggle OFF unchanged. The probe (current state) is fourth -> an existing opt-in survives a component re-install.

**Verify (all real, run against HEAD c9985f6f):**
- `/bin/bash claude/hooks/test-component-browser.sh` -> exit 0, 139 passed / 0 failed (was 127/0; +12 new assertions).
- NEW master-leaf INSTALL-but-off (exact match, the strongest form): `INSTALLED="||"; stage sidecoach/sidecoach` -> `apply_plan` == `INSTALL sidecoach sidecoach-detect`. The off-list is EXACTLY sidecoach-detect: detect install-but-off AND the other 6 sidecoach hooks force-enabled exactly as before (no-recall-loss proven by the same exact string).
- NEG-CONTROL (proves the assertion has teeth): same scenario with the DEFAULTOFF flags cleared (simulating pre-fix) -> `INSTALL sidecoach` (bare, detect armed). WITH the concept -> `INSTALL sidecoach sidecoach-detect`. The exact delta the fix introduces.
- NEW no-recall-loss (independent negative): the same plan does NOT off-list `sidecoach-preamble` (a non-default-off sibling); and the pre-existing case 13 `INSTALL memory` (bare, no off-list) still passes - a dual-nature component with NO default-off hooks is unchanged.
- NEW probe fall-through: leaf-install with detect ALREADY present (existing opt-in) -> `INSTALL sidecoach` (bare) - the guard withholds only the force-enable, an existing opt-in survives via the probe (distinguishes the correct `&& ! hook_default_off` from a wrong force-OFF).
- NEW predicate tests mirroring the pinned ones: `hook_default_off sidecoach-detect` true; `sidecoach-preamble` false; `memory-approve` false; `hook_pinned sidecoach-detect` false (default_off != pinned).
- NEW per-hook toggle BOTH directions: ON (`stage sidecoach/Hooks/sidecoach-detect`, nothing installed) -> off-lists the OTHER 6, installs detect (opt-in reachable); OFF (detect currently on) -> off-lists detect, keeps the component (no UNINSTALL_COMPONENT).
- NEW deliberate-boundary lock (from the Codex caveat): `stage_all 'sidecoach' install` ("Install all of Sidecoach.../Enable all hooks...") STILL stages detect -> `INSTALL sidecoach` (bare, detect NOT off-listed). Intended: the row says "all", staged-install wins like a per-hook opt-in, and skipping detect would be a label lie of the class the drift tests catch. The guard must not leak into the explicit-all path.
- CLI default-install path is untouched by construction (this change is only in browser-lib.sh + browser-tree.json; install.sh's seed is unchanged) - the end-to-end CLI opt-in proof in the stage3b beat still holds.

**Codex cross-model review** (deterministic wrapper `~/.claude/hooks/codex-review.py`, real codex-cli 0.142.5, 143.6s, exit 0). Diff scoped to my 3 files. NO blocking issues. Confirmed all three conservatism questions: (1) no behavior change for any non-default_off hook under any path - the leaf_install force-enable is byte-identical for them; (2) the plumbing is parallel to pinned ONLY where it should be (reset/emit/helper/guard) and does NOT touch hooks_owned_by (still excludes only pinned), counts, item_state, or stage_toggle - so default_off stays owned/toggleable/probe-read; (3) master-leaf install off-lists detect while the other 6 force-enable, and an explicit per-hook opt-in still wins (staged-install checked before the leaf_install branch). One CAVEAT surfaced and DELIBERATELY LEFT (not a regression): the bulk "Install all of Sidecoach.../Enable all hooks..." row uses `stage_all install`, which stages every non-pinned leaf incl. detect, so that explicit-all path opts detect in. Left as-is on purpose (an "install all" that skips detect would be a label lie; this is the same semantics as a per-hook opt-in), and now LOCKED by test case 19 so the boundary is intentional, not accidental. Folds: added the neg-control reasoning and the boundary test; no code change needed from the review.

**Self-analysis (why this needed the escalation in the first place).** The stage3b author's opt-in analysis traced only the CLI seed and the browser per-hook-toggle paths and missed that apply_plan has a SECOND enable route (the leaf_install force-enable) that short-circuits the probe. The lesson carried here: a per-hook default must be checked against BOTH the per-hook stage route AND the master-switch/leaf route. This fix guards exactly that second route, and the test matrix now exercises all four enable rungs (staged-uninstall, staged-install, leaf force-enable, probe) for a default_off hook.

Files touched:
- claude/hooks/browser-lib.sh (4 touch points: reset loop, loader emit, helper, the one guard)
- claude/hooks/browser-tree.json (default_off_hooks entry)
- claude/hooks/test-component-browser.sh (predicate + master-leaf + no-recall-loss + toggle-override assertions)
