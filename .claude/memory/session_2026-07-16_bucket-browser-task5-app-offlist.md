---
name: bucket-browser Task 5 - per-hook off-list for app components
description: install_app_hooks now honors HOOK_OFF (KEEP deploy+wire / DROP reconcile-remove), matching the QA-hook cluster pass
type: project
relates_to: [decision_bucket_browser_engine_leaf_master.md, decision_installer_bucket_browser.md, session_2026-07-15_stage3b-execution.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: tests
confidence: high
---

Task 5 of the installer bucket-browser TDD build. Made `install_app_hooks` in
install.sh honor the per-hook off-list so APP components can suppress individual
hooks, mirroring the QA-hook CLUSTER pass that already did this.

**What changed (install.sh, `install_app_hooks()` ~703):**
- Split the passed hooks (`$@`) into KEEP (not in `" $HOOK_OFF "`) and DROP (in it)
  via a `case` match, exactly like the cluster deploy loop at ~3534.
- Deploy loop now iterates `$keep` (was `"$@"`); `okh` is built from KEEP only, so
  the python wiring over app-wirings.json wires KEEP only. DROP hooks are neither
  deployed nor wired.
- Added a reconcile at the end: `if [ -n "${drop// /}" ]; then deactivate_app_hooks $drop; fi`.
  DRY reuse of the already-tested deactivator (`rm_hook_if_ours` + strip the EXACT
  app-wirings commands). This makes re-running `--only <comp>` with a hook now
  off-listed REMOVE a previously-installed hook + its wiring.

**Why deactivate_app_hooks reuse is safe:** DROP and KEEP are distinct hooks with
distinct wiring command strings (verified for chrome: track/clear/stop each have a
unique `~/.claude/hooks/*.sh` command), so stripping DROP's commands cannot touch
KEEP's. deactivate_app_hooks is defined later in the file than install_app_hooks but
is only CALLED at runtime (install call sites ~3636+), so definition order is fine.

**HOOK_OFF convention:** `HOOK_OFF="${_AMPERSAND_HOOK_OFF:-}"` (install.sh ~607) is
space-delimited hook FILENAMES WITH `.sh`. install_app_hooks compares them against
`$@` (also `.sh`-suffixed), matching the cluster convention. Confirmed no comparison
mismatch introduced.

**Scope discipline:** ONLY install_app_hooks changed. Did NOT touch the cluster pass,
deactivate_app_hooks, the app call sites, or HOOK_OFF seeding.

**Tests (new: claude/hooks/test-app-hook-offlist.sh, subject = chrome, 3 pure hooks):**
- Test A: `_AMPERSAND_HOOK_OFF="chrome-tabgroup-clear.sh" --only chrome --yes` -> clear
  neither deployed nor wired; track+stop deployed+wired; exit 0.
- Test B: full install (no off-list) -> all 3 present+wired; re-run with clear
  off-listed -> clear file+wiring REMOVED, track+stop retained (proves reconcile).
- Test C: generalizes to a different single hook (stop off-listed on re-run).
- Test D: empty off-list wires ALL three (guards the split-logic-drops-hooks regression).

**Verification (all green):**
- `bash -n install.sh` -> exit 0.
- TDD red first: test ran against unmodified install.sh = 30 passed / 6 failed (the
  6 off-list behaviors). After the change: `/bin/bash claude/hooks/test-app-hook-offlist.sh`
  -> TALLY 36 passed, 0 failed, exit 0.
- `bash claude/hooks/test-settings-deploy-parity.sh` -> ALL PARITY CHECKS PASSED,
  exit 0 (baseline AND post-change; off-list change introduced no dangles).
- Cross-model gate: codex-review.py (real Codex, gpt-5.5, effort high) smoke HEALTHY
  then reviewed the diff -> "No real findings", confirmed bash 3.2-safe.

**Known downstream mismatch (NOT this task - flagged for Task 6):** the browser's
apply_plan emits off-list hook names WITHOUT `.sh`; the `_AMPERSAND_HOOK_OFF` that
install.sh consumes expects names WITH `.sh`. Task 6 (apply_pending) adds the `.sh`
suffix when it builds `_AMPERSAND_HOOK_OFF`. install_app_hooks correctly honors a
`.sh`-suffixed HOOK_OFF (cluster convention); nothing to fix here.

**Files touched:**
- install.sh (install_app_hooks: KEEP/DROP split + DROP reconcile)
- claude/hooks/test-app-hook-offlist.sh (new)
