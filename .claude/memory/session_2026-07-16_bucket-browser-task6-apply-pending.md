---
name: Bucket-browser Task 6 - apply_pending executes the staged plan in one pass
description: apply_pending_plan (pure translation of apply_plan into one install pass + a deactivate list) + apply_pending (thin executor), an env-gated test seam in install.sh, and 20 new tests. Codex round-1 caught a real silent-success bug; round 2 clean.
type: project
relates_to: [decision_bucket_browser_engine_leaf_master.md, decision_installer_bucket_browser.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: tests
confidence: high
---

Task 6 of the bucket-browser TDD build (worktree `feat/installer-bucket-browser`, authored against 163c8803). apply_plan already COMPUTED a per-owner plan; this task EXECUTES it.

## What changed

**`claude/hooks/browser-lib.sh`** - two new functions at the end:

- `apply_pending_plan` (PURE, unit-tested): collapses apply_plan's N per-owner lines into exactly TWO lines, always both emitted:
  - `INSTALL <owners-csv>|<off-list>` - owners comma-joined in apply_plan first-seen order; off-list = every off-hook across ALL INSTALL lines, each `.sh`-suffixed, space-joined. No install owners yields exactly `INSTALL |`.
  - `DEACTIVATE <owners space-joined>` - empty yields `DEACTIVATE ` (the trailing space is part of the contract; it is the prefix apply_pending strips).
  - **Why the `.sh` is added here:** apply_plan emits bare tree names; install.sh's `HOOK_OFF`/`_AMPERSAND_HOOK_OFF` contract expects hook FILENAMES. This is the only translation point.
- `apply_pending` (thin executor): runs ONE `_AMPERSAND_HOOK_OFF="<offlist>" _AMPERSAND_NO_SUMMARY=1 bash "$0" --only "<csv>" --yes` pass (mirrors the returning flow at install.sh:2021), then `deactivate_component` per DEACTIVATE owner, then `stage_reset`. Only ever runs at install.sh runtime, where `$0` = install.sh and deactivate_component is in scope.

Exit codes (fail-loud; pending is cleared ONLY on a fully-applied plan): `0` applied / `3` apply_plan invariant violation (owner in BOTH lists, nothing executed) / `<installer code>` install pass failed, deactivates skipped / `<deactivate code>` a deactivate failed. Non-zero always PRESERVES pending for retry.

**`install.sh`** - a 17-line TEST-ONLY seam at the entry-point boundary (before the `NONINTERACTIVE` dispatch, after every function and all state are defined, before anything below has run):

    if [ "${_AMPERSAND_APPLY_TEST:-}" = "1" ]; then
      browser_load "$REPO_DIR/claude/hooks/browser-tree.json"
      PENDING_INSTALL="${_AMPERSAND_TEST_PI:-}"
      PENDING_UNINSTALL="${_AMPERSAND_TEST_PU:-}"
      unset _AMPERSAND_APPLY_TEST _AMPERSAND_TEST_PI _AMPERSAND_TEST_PU
      if apply_pending; then exit 0; else exit $?; fi
    fi

The `unset` is load-bearing: without it the recursive `bash "$0" --only ...` child inherits the env vars and re-enters the seam. Codex confirmed the seam cannot leak into any normal path (`--only`/`--yes`/`--preset`/`--dry-run`/`--help`/TUI) absent an explicit `_AMPERSAND_APPLY_TEST=1`.

## Key decisions

**Why merging all owners' off-lists into ONE `_AMPERSAND_HOOK_OFF` is safe (and how it is now guarded).** Off-lists are component-scoped: install_app_hooks only matches HOOK_OFF against the hooks each call passes in, so another component's entry is inert. Codex sharpened this: the merge actually depends on hook filenames being GLOBALLY unique across owners, not merely on component scoping. If two owners ever shipped the same filename, off-listing it for A would silently drop it from B in the same pass. The merge is spec'd by the plan, so the design stands - but the hidden precondition is now mechanically guarded by test 22, which parses install.sh's REAL call sites (`picked X && install_app_hooks ...` + the `cluster_hooks()` arms; 17 owners / 45 filenames) and fails if any filename has two owners.

**RESOLVED (Jonah ruled 2026-07-16, follow-up commit): apply_pending DOES state_set. Not deferred to Task 9.** I had implemented the literal spec (stage_reset only) and flagged STATE_FILE ownership as an open question. Jonah traced it and ruled: after each SUCCESSFUL `deactivate_component "$owner"`, call `state_set "$owner" "inactive"` (returning_flow parity, install.sh:2033). NOT for install owners - the child install pass's end-of-run sync reconciles those from disk.

Why the ruling is right (I verified all three claims against install.sh before folding):
- `effective_state` (install.sh:1263) checks `detect_component` (DISK) FIRST, so a stale entry can NEVER mis-report a removed component as active. Stale state is cosmetic, not a correctness bug - which is why this was easy to under-weight.
- BUT the end-of-run sync (install.sh ~3903, `for k in "${KEYS[@]}"; state_set "$k" "$(detect_component "$k")"`) runs inside the CHILD install pass, which completes BEFORE the parent's deactivates. So it records the about-to-be-removed owner as "active", and the deactivate half leaves that stale.
- A DEACTIVATE-ONLY apply spawns no child at all, so it gets no sync whatsoever. Nothing but apply_pending will ever record the removal.
- returning_flow does this bookkeeping today and Task 9 retires it, so omitting it would SILENTLY DROP existing behavior. That is the real cost, and it is invisible in any single test.

Proven empirically: removing the `state_set` call makes the deactivate-only integration assertion fail with `deactivated owner state is 'active' (want inactive)` - exactly the stale entry Jonah predicted.

**Judgment call inside the ruling (Codex-validated):** a `state_set` FAILURE is reported loudly to stderr but does NOT fail the apply. The removal itself succeeded (the real outcome), effective_state reads disk first so status stays correct, and failing would preserve pending and send a retry back through `deactivate_component`, which is NOT reliably idempotent (`deactivate_task_list` is `[ -d dir ] && rm -rf dir`, returning 1 once the dir is gone - a retry would report a bogus deactivate failure forever). Codex round 3 attacked this specifically and cleared it: "not the round-1 silent-success pattern in disguise: the failure is explicitly checked, loudly reported, and intentionally classified as non-authoritative bookkeeping."

**My error worth recording:** I classified this as "deferred design" partly because I checked `effective_state` saw disk first and concluded "not a correctness bug, therefore not mine." That reasoning stopped one step short - the question was never "does status break" but "does the browser drop behavior returning_flow has today." Correctness and parity are different tests, and I only ran the first.

## Cross-model review (Codex, real, 2 rounds)

Codex is on PATH but `codex --version` errors (the known node breakage); `codex-review.py` self-resolves a working node and smoke-tested HEALTHY in 35.9s, so the gate ran with a genuinely different MODEL, not a same-model fallback.

Round 1 (220.4s) - 3 findings, all folded:
1. **HIGH, and a REAL bug in my code.** `set -e` is disabled inside a function whose status is tested by `if`. The seam uses `if apply_pending`, so my unchecked `deactivate_component "$owner"` fell through to `stage_reset` + `return 0`: partial work reported as success with pending cleared. Fixed with an explicit if/else status check that propagates the code and preserves pending. Proven real: reverting the check makes test 23 report `got 0`.
2. **MEDIUM** - merged off-list depends on global filename uniqueness -> folded as test 22 (above).
3. **LOW** - the overlap guard warned then returned 0 (a silent success). Moved to step (0) BEFORE any execution, now returns a distinct exit 3 with nothing run and pending preserved.

Round 2 (198.2s) - "No new runtime code defects found. The 3 round-1 findings are closed." One test gap raised and folded: test 25 only trapped the deactivate leg, so a guard accidentally moved AFTER the install pass would still pass. Also folded its note that test 22 could pass vacuously under regex drift (added a REQUIRED-owners floor).

## Self-analysis - my fix for Codex's test gap was itself broken

Fixing the test-25 gap, I stubbed `bash()` to echo `INSTALL_RAN` to **stderr** and asserted it was absent from the captured output. The negative control (moving the guard after the install pass) still passed 73/73 - the trap never fired.

**Why:** apply_pending redirects the install pass with `>"$logfile" 2>&1`, so the stub's stderr went into the temp logfile, invisible to `$(apply_pending 2>&1)`. Exit code alone cannot catch it either (a guard moved after the install still returns 3), so the assertion was decorative - it could never fail.

**How it went wrong:** I reached for the reviewer's suggested shape (a `bash()` stub printing a marker) without tracing where that marker actually lands through the function's own redirect. The failure mode is folding a review finding by pattern-matching its wording instead of re-deriving it against the code. Fix: both stubs now mark a FILE (`mktemp` sentinels), and the negative control now correctly FAILS with `apply_pending ran no install pass on refusal`.

**The general lesson, twice over this session:** a green test proves nothing until it has been made to fail. Every assertion added here was negative-controlled, and two of them (this one, plus the `.sh`-suffix and drift guards) were only shown to be real because of it. This is the "shortcuts are lies" standard applied to tests: an assertion that cannot fail is theater.

## Verification (all re-run AFTER folding both review rounds)

| Gate | After first commit (81fb0833) | After the state_set ruling |
|---|---|---|
| `bash -n install.sh` + browser-lib + both test files | clean | clean |
| `/bin/bash claude/hooks/test-component-browser.sh` | 73 passed, 0 failed (was 53) | **75 passed, 0 failed** |
| `/bin/bash claude/hooks/test-apply-pending.sh` | 30 passed, 0 failed | **33 passed, 0 failed** |
| `bash claude/hooks/test-settings-deploy-parity.sh` | ALL PARITY CHECKS PASSED | **ALL PARITY CHECKS PASSED** |
| `bash claude/hooks/test-app-hook-offlist.sh` | 36 passed, 0 failed | **36 passed, 0 failed** |

Canonical contract asserted (justify + codex installed; stage codex-rescue-guard OFF + chrome install):

    INSTALL chrome,codex|codex-rescue-guard.sh
    DEACTIVATE

Owner order `chrome,codex` is apply_plan first-seen: PENDING_INSTALL is scanned before PENDING_UNINSTALL, so chrome (staged install) precedes codex (staged uninstall). DEACTIVATE is empty because turning off ONE codex hook is an off-list install, never a component uninstall (the leaf-master rule).

Integration test runs the REAL install.sh in a throwaway HOME: seeds `--only codex,task-list --yes`, then drives apply_pending through the seam. Proves chrome's 3 hooks deployed + wired, codex-rescue-guard.sh gone with its PreToolUse wiring stripped, codex-failure-watcher.sh + codex-review.py surviving, task-list untouched, exit 0. Scenario B proves the deactivate pass (whole-component uninstall of task-list); Scenario C proves an empty plan is a clean no-op. justify was dropped for `task-list` per the plan's own note (justify builds a daemon; task-list is a pure skill copy - sandbox-safe).

Negative controls run (each temporarily broken, confirmed FAIL, restored): `.sh` suffix dropped (unit 3 FAIL / integration 4 FAIL), deactivate check reverted (`got 0`), a shared hook filename injected (`visualizer-guard.sh owned by BOTH figma and visualizer`), the overlap guard moved after the install pass, and a simulated regex drift (`expected owners not parsed: ['codex']`).

## Files touched

Commit 81fb0833 (`browser: apply_pending runs installs + uninstalls in one pass`):
- `claude/hooks/browser-lib.sh` - added `apply_pending_plan` + `apply_pending`
- `install.sh` - added the 17-line `_AMPERSAND_APPLY_TEST` seam (only change)
- `claude/hooks/test-component-browser.sh` - tests 15-25 (+20 assertions)
- `claude/hooks/test-apply-pending.sh` - NEW sandbox integration suite (30 assertions)

Follow-up commit (`browser: apply_pending records inactive state on deactivate (returning_flow parity)`):
- `claude/hooks/browser-lib.sh` - `state_set "$owner" "inactive"` after each successful deactivate
- `claude/hooks/test-apply-pending.sh` - `state_of` reader + 3 state assertions (seed active, install owner active, deactivate-only recorded inactive)
- `claude/hooks/test-component-browser.sh` - stubs `state_set` (apply_pending now requires it; an undefined call would return 127 and, with errexit off, silently continue) + asserts state is recorded on success and NOT on failure. Staged despite not being on Jonah's file list: leaving it out would leave the unit suite silently degraded against the new dependency.
