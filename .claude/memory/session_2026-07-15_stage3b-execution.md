---
name: Stage-3b EXECUTION progress - packaging the unmanaged hooks
description: Live execution of the Stage-3b plan. app-wirings.json foundation DONE (5 new entries). Remaining - install.sh chrome/figma components + justify-standing-by + memory project-scoped note + 2 cosmetic fixes + parity/audit/Codex/commit. Continuation carrier if the session dies.
type: project
relates_to: [session_2026-07-15_stage3b-plan.md, decision_beats_hooks_stay_project_scoped.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: app-wirings.json JSON-valid + 5 entries present; bash -n baseline clean; parity baseline exit 0
confidence: high
---

Executing session_2026-07-15_stage3b-plan.md from a fresh context. Stamped against HEAD 24d1d1f3. Baseline GREEN before edits: `bash -n install.sh` clean; test-settings-deploy-parity.sh exit 0 (19 selections); tree clean except the pre-existing .bak (Jonah's to delete).

**RULING folded (see decision_beats_hooks_stay_project_scoped.md):** the 7 "unmanaged" hooks are TWO architectures. Global (become app-component hooks): chrome-tabgroup-track/clear/stop, figma-fidelity-stop, justify-watch-standing-by. Project-scoped (STAY as-is, wired in repo .claude/settings.json via $CLAUDE_PROJECT_DIR): beats-rebuild, beats-staleness-guard - Jonah ruled keep-project-scoped; memory block gets a doc-comment only, NOT globalized.

**EXACT WIRING extracted/authored (all confirmed from source):**
- chrome-tabgroup-track: PostToolUse / matcher `mcp__claude-in-chrome__` / no timeout (from LIVE ~/.claude/settings.json)
- chrome-tabgroup-clear: PostToolUse / matcher `mcp__claude-in-chrome__tabs_close_mcp` / no timeout (LIVE)
- chrome-tabgroup-stop: Stop / matcher null / no timeout (LIVE had ""; normalized to null to match app-wirings.json convention - semantically identical for Stop)
- figma-fidelity-stop: Stop / matcher null / timeout 10 (LIVE)
- justify-watch-standing-by: Stop / matcher null / timeout 10 (AUTHORED - header says "Stop hook, LEAD session, non-blocking"; mirrors sibling justify-watch-guard's shape)

**DONE:**
- app-wirings.json: 5 entries added (13 -> 18 scripts). JSON-valid, all 5 present.
- install.sh component-wiring unit (chrome/figma components + justify-standing-by + memory doc-note) COMPLETE + VERIFIED E2E:
  - KEYS+=(chrome figma) block with TITLES/DESCS/FILES/DIRS/PICKS=0 (accurate descs read from hook headers).
  - deactivate_chrome / deactivate_figma; deactivate_justify extended (+justify-watch-standing-by.sh).
  - detect cases chrome (any of 3 via is_our_hook) / figma; deactivate dispatch chrome/figma.
  - section 16e: justify line +justify-watch-standing-by.sh; new picked chrome (3 hooks) + picked figma (1 hook) lines; header updated to Stage 3/3b; memory-block NOTE documenting beats-rebuild/staleness as intentionally project-scoped.
  - parity SELECTIONS +config,chrome +config,figma.
  - VERIFIED: bash -n clean; default parity ALL PASS (21 selections, exit 0); PARITY_FULL ALL PASS (config,justify covers standing-by); FUNCTIONAL sandbox round-trips: chrome install=3 hooks+3 wired -> deactivate=0+0; figma install=active/1 hook -> deactivate=not-installed/0; component isolation confirmed (figma install leaves chrome not-installed).

**REMAINING (install.sh, following the clickup/visualizer/codex app-hooks pattern):**
1. chrome + figma components: KEYS+= / TITLES / DESCS / FILES / DIRS / PICKS=0 (block after line 503's `KEYS+=(clickup visualizer codex justify)`).
2. deactivate_chrome / deactivate_figma (beside deactivate_clickup/visualizer/codex ~L730); extend deactivate_justify (+justify-watch-standing-by.sh, L1454).
3. detect cases chrome/figma via is_our_hook (~L1193, beside clickup/visualizer/codex).
4. deactivate dispatch chrome/figma (~L1676).
5. section 16e (~L3571): extend `picked justify` line (+justify-watch-standing-by.sh); add `picked chrome` (3 hooks) + `picked figma` (1 hook) lines.
6. memory block: doc-comment that beats-rebuild/staleness are intentionally project-scoped (NOT globalized).
7. Cosmetic (a): fix "what was installed" config line (L3635, drop "hooks" - config is core-only); add chrome/figma summary lines.
8. Cosmetic (b): returning_flow cluster drill-in (L1932 installs `--only <pick> --yes` full-cluster). Mechanism = env-passthrough: init `HOOK_OFF="${HOOK_OFF:-}"` at L575 (respect inherited), run the same phase-2 gum drill-in for cluster picks, pass computed HOOK_OFF as env to the recursive `bash "$0" --only <cluster> --yes`.
9. Extend test-settings-deploy-parity.sh SELECTIONS: config,chrome / config,figma.
10. VERIFY: bash -n; parity all PASS; unmanaged-audit == 0; test-content-guard.sh; then Codex review -> fold -> commit + beat.

**DONE (cont):**
- Cosmetic (a): "what was installed" config line rewritten (core-only, no "hooks" claim); stale memory "3 hooks" -> "its memory hooks"; added summary lines for all hook-owning app components (clickup/visualizer/codex/chrome/figma/fable/justify); added an "Apps:" line to --help so chrome/figma (and the other app components) are discoverable as --only keys. VERIFIED: bash -n; --help Apps line renders; --only config summary no longer claims hooks.
- Cosmetic (b): returning_flow cluster drill-in. Mechanism = env-passthrough: HOOK_OFF init at ~L594 now `${HOOK_OFF:-}` (respects inherited); install|activate action runs the same phase-2 gum drill-in (verbatim from run_tui_gum) for CLUSTER picks and passes deselected members as HOOK_OFF env to the recursive `--only <cluster> --yes`. Non-cluster picks unchanged (empty HOOK_OFF). VERIFIED (mechanism, non-interactive): `HOOK_OFF=content-guard.sh --only safety --yes` -> content-guard absent+unwired, other 4 members present+wired, rc=0.
- BUG FIXED (latent Stage-2, surfaced by cosmetic b): the cluster HOOK_OFF reconcile (install.sh 16d, ~L3590) calls `rm_hook_if_ours` on deselected members that, on a FRESH install, were never installed. `rm_hook_if_ours` returned non-zero (its `is_our_hook && rm` short-circuits to is_our_hook=false) and `set -euo pipefail` killed the script AFTER wiring but BEFORE "installed" (rc=1) - so the fresh-flow drill-in (U7, "code-verified not run") AND the new returning-flow drill-in would both false-report "install failed". ROOT FIX: `rm_hook_if_ours` now `return 0` (best-effort; nothing-to-remove is not an error). Hardens all 3 call sites (reconcile + deactivate_cluster + deactivate_app_hooks). VERIFIED: HOOK_OFF install now rc=0 + prints "installed"; chrome deactivate still 3->0.

**VERIFICATION (all green):** bash -n clean; default parity ALL PASS (21 sel, exit 0); PARITY_FULL ALL PASS; test-content-guard.sh 35/0; UNMANAGED-HOOK AUDIT == 0 (all 7 formerly-unmanaged now OWNED: 5 via app-wirings+install.sh, beats x2 project-scoped); chrome/figma install+detect+deactivate round-trips clean + isolated; HOOK_OFF reconcile rc=0 after the bug fix.

**SELF-ANALYSIS (PARITY_FULL side-effect, per protocol):** running `PARITY_FULL=1 test-settings-deploy-parity.sh` against the LIVE repo executed the `config,sidecoach` selection, whose install does `cd $REPO_DIR/sidecoach && npm run build` IN-TREE - churning ~240 git-tracked sidecoach/**/node_modules/package.json + package-lock files (sidecoach node_modules is committed). The test file's own header warns "real-repo side effects ... run it in a clean checkout / CI." Why I missed it: I reached for PARITY_FULL to cover config,justify (standing-by) without registering that the SAME run also builds sidecoach in-tree. Fix: reverted with `git checkout -- sidecoach/` (Stage 3b touches nothing there); next time verify a single app selection surgically (e.g. a one-off `HOME=sb --only justify` sandbox) rather than the whole PARITY_FULL set, or run PARITY_FULL only in a throwaway checkout.

**CROSS-MODEL GATE:** Codex is BROKEN on this machine (SyntaxError "Unexpected reserved word" at @openai/codex codex.js:188 under node v20.19.6 - pre-existing, also fails `codex --version`; codex-review.py -> exit 5 empty). Per the produce-and-verify FALLBACK, ran an INDEPENDENT Claude reviewer (fresh general-purpose agent, not the producer) on the code diff. VERDICT: no Critical/High/Medium bugs; all risk areas verified empirically (all 6 parallel arrays = 42 elements, chrome@40/figma@41 aligned; confirmed the rm_hook_if_ours change is a genuine bug fix; deactivate isolation round-trip clean). Codex breakage flagged to Jonah as separate infra (not caused by 3b).

**REVIEW FINDINGS FOLDED (2 Low, both fixed + re-verified):**
1. HOOK_OFF env-inheritance footgun: `${HOOK_OFF:-}` init would let a user's stray exported HOOK_OFF silently drop cluster members. FIXED: seed from a DEDICATED sentinel `${_AMPERSAND_HOOK_OFF:-}` (same namespace as _AMPERSAND_NO_SUMMARY); returning-flow recursive call sets `_AMPERSAND_HOOK_OFF="$_hook_off"`. RE-VERIFIED: sentinel still subtracts (content-guard dropped, rc=0); a stray `HOOK_OFF=content-guard.sh` env NO LONGER drops it (footgun closed).
2. Doc drift: justify FILES array didn't list justify-watch-standing-by.sh. FIXED (added to the FILES entry so the returning-flow detail/list-files view is accurate).
(Finding 3 - justify-standing-by only covered under PARITY_FULL - accepted, not a defect; wired identically to the other justify hooks.)

**STAGE 3b COMPLETE + COMMITTED** to main as 1c8f6569 (code: install.sh + app-wirings.json + test-settings-deploy-parity.sh, matching the Stages 1-3 direct-to-main pattern per Jonah's ruling). NOT pushed (needs a separate ask). Final verify: bash -n clean; default parity ALL PASS; footgun test passes; unmanaged-audit == 0; content-guard 35/0.

**FLAGGED TO JONAH (separate, pre-existing infra):** Codex is broken on this machine - `@openai/codex` codex.js:188 throws `SyntaxError: Unexpected reserved word` under node v20.19.6, so `codex`/`codex --version`/`codex-review.py` all fail before any review. Not caused by 3b (predates this session). Needs a durable fix (node-version pin for codex, or reinstall) - out of 3b scope; the cross-model gate used the sanctioned independent-Claude-reviewer fallback.

The pre-existing untracked `claude/settings.json.pre-standingby-unregister.bak` (Jonah's to delete) was left out of the commit.

Files touched: claude/hooks/app-wirings.json, install.sh, claude/hooks/test-settings-deploy-parity.sh (+ beats). sidecoach/ churn reverted (not part of 3b).
