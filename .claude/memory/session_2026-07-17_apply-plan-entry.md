---
name: installer --apply-plan headless entry
description: Task 2 of the GUI installer - install.sh --apply-plan reads a JSON plan on stdin, allowlists leaves against the tree, seeds pending sets, runs apply_pending
type: project
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: tests
confidence: high
---

Task 2 of the browser-GUI-installer plan (branch gui-installer, builds on Task 1's --manifest emitter).

## What was added
- install.sh `--apply-plan`: production headless apply. Reads `{"install":[leafpaths],"uninstall":[leafpaths]}` on stdin, validates every leaf against the loaded tree (allowlist built from leaf_paths over all BR_BUCKETS), seeds PENDING_INSTALL / PENDING_UNINSTALL, and runs the existing apply_pending executor from browser-lib.sh. This is the GUI server's apply backend.
- Promotes the mechanism already proven by test-apply-pending.sh (the _AMPERSAND_APPLY_TEST=1 seam) to a real flag.
- Arg parser: `--apply-plan) RUN_APPLY_PLAN=1; shift ;;` after the --manifest case; default `RUN_APPLY_PLAN=0` beside RUN_MANIFEST.
- Handler sits immediately before the _AMPERSAND_APPLY_TEST seam (~install.sh:3221), runs and exits before the interactive block.

## Key mechanics
- Allowlist is newline-BOOKENDED so membership is an exact-line test (prevents suffix false-accepts). Buckets iterated via `${BR_BUCKETS//$'\t'/$'\n'}` (space-safe; bucket keys contain spaces), NOT browser_buckets.
- Whole stdin drained with `_plan_json="$(cat)"` BEFORE apply_pending runs its recursive child install pass (which would otherwise contend for stdin).
- Leaf format from leaf_paths is e.g. `Guardrails/chrome/chrome-tabgroup-track`. apply_plan's _owner_of maps the 3 chrome leaves to owner "chrome"; apply_pending runs `bash "$0" --only chrome --yes`.
- No bash 4.3 namerefs (macOS bash 3.2). Explicit loops only.
- Exit codes: invalid JSON or unknown leaf -> 2; apply_pending's own code otherwise.

## Test
- claude/hooks/test-apply-plan.sh (NEW): fresh throwaway HOME, derives chrome leaves via leaf_paths+grep (same source as the allowlist), feeds the plan on stdin, asserts exit 0 and chrome-tabgroup-track.sh lands; asserts an injection/unknown leaf is rejected non-zero and installs nothing.
- Verified: `--only chrome --yes` installs chrome cleanly in a fresh HOME (no base seed needed).

## Verification
- test-apply-plan.sh: 8/8 PASS (fresh->fail confirmed at exit 2 before flag added, PASS after).
- No-regression: test-apply-pending.sh 33/33, test-installer-manifest.sh PASS, --help exit 0, --dry-run --only task-list exit 0 ("no files were touched").
- Edge: empty plan -> no-op exit 0; invalid JSON -> exit 2.
- Stress: 45 valid apply-plan runs (0 wrongful rejections), 30 invalid-JSON runs (all exit 2), 20 --manifest runs (0 failures).

## Codex cross-model review (codex-cli 0.142.5, real verdict 236.6s) - findings folded
- HIGH (final-bucket drop): allowlist loop used `printf '%s'` (no trailing newline), so `while read` skipped the LAST bucket - dropped Personal/ghostty + Personal/shaders (90 vs 92 leaves). Fixed to `printf '%s\n'`, matching the sibling --manifest handler.
- HIGH + MEDIUM (loose JSON): replaced the two get()-based one-liners with ONE strict python parse: top level must be an object; install/uninstall must be arrays of non-empty strings with no control chars (blocks embedded-newline leaf smuggling); no leaf may be in both lists; any violation -> exit 2 (unified contract, uninstall no longer relies on set -e). python emits validated "I<tab>leaf" / "U<tab>leaf" lines; bash routes by tag.
- MEDIUM (personal accept-then-fail): now mirrors the manifest handler - `_br_personal_load` + skip personal buckets unless PERSONAL=1. Personal leaves fail-closed at the allowlist instead of being accepted and then rejected in apply_pending's child --only pass.
- MEDIUM (personal --personal child forwarding) + confirmed NO command-injection: apply_pending runs `bash "$0" --only ... --yes` without --personal (browser-lib.sh:752, OFF-LIMITS this task). So `--apply-plan --personal <personal leaf>` would still fail in the child pass; left for the orchestrator. Codex confirmed no injection: leaves are only compared in a quoted case, never eval'd.
- Confirmation pass (89.7s): both HIGH findings confirmed fixed; one remaining strictness note - `d.get(key,[])` treated a missing install/uninstall as empty (`{}` accepted). Folded: require both keys (`if key not in d: die`). Empty pass is now the explicit `{"install":[],"uninstall":[]}`.
- Final pass (180.6s): found PINNED hook leaves (Beats/Hooks/beats-rebuild, beats-staleness-guard) were allowlisted. They are always-on and non-toggleable; apply_plan's hooks_owned_by omits them, so seeding one triggered an unfaithful whole-owner (memory) install instead of toggling the hook. Reproduced (exit 0 + memory install pass). Folded: allowlist now skips pinned leaves via the same guard counts/item_state/stage_toggle use (parent is a hooks node AND hook_pinned key). Pinned leaves now reject fail-closed with "unknown leaf rejected".
- 4th pass (157.3s): --personal hole - under `--apply-plan --personal`, personal leaves passed the allowlist but apply_pending's child `--only` drops --personal (child fails "Unknown component in --only: ghostty") and deactivate_component has no ghostty/shaders case (uninstall silently no-ops). Folded: allowlist now excludes personal buckets UNCONDITIONALLY (not just by default), because the apply_pending executor (off-limits) cannot faithfully apply personal components. Personal leaves now reject fail-closed with/without --personal.
- Test extended to 28 assertions covering all folded cases (non-array install/uninstall, embedded newline, install/uninstall conflict, personal leaf with AND without --personal, missing key, both-empty no-op, pinned leaf) + a manual end-to-end uninstall-one-hook probe.

- 5th pass (139.3s): `--dry-run --apply-plan` still applied (ran apply_pending before the global dry-run no-touch gate). Folded: gate apply_pending on DRY_RUN - all validation above is read-only, so under --dry-run report the validated plan and exit 0 without touching files (mirrors the interactive browser block's DRY_RUN gate). --dry-run doubles as plan validation (invalid plans still exit 2). Test now 31 assertions (added dry-run valid/invalid).

- 6th pass (218.8s): schema silently ignored unknown top-level keys (`{"install":[],"uninstall":[],"remove":[...]}` accepted as no-op). Folded: `if set(d) != {"install","uninstall"}: die` (subsumes the missing-key check, rejects extras). Test now 33 assertions (added unknown-extra-key). Stale docstring comments (personal gating, schema) corrected to match unconditional-personal + exact-key reality.

- 7th pass (87.7s): found NO defect in the apply-plan code. Flagged only that `figma-fidelity-arm` is installed/deactivated by install.sh but browser-tree.json registers only `figma-fidelity-stop`, so apply-plan (correctly) rejects the figma-arm leaf. This is a TREE-registration gap in browser-tree.json (OFF-LIMITS for this task) caused by the concurrent figma workstream (figma-fidelity-arm.sh / test-figma-arm.sh are untracked/in-flight). Not fixed here (forbidden file + other workstream). Because the apply-plan allowlist is derived from leaf_paths over the tree, it will accept figma-fidelity-arm automatically once that workstream registers it - no apply-plan code change needed. Reported for the orchestrator.

## Residual limitation (out of scope, for orchestrator)
- apply-plan supports only NON-personal, toggleable, tree-known leaves - exactly what apply_pending can faithfully apply. Full personal support (ghostty/shaders) would require forwarding --personal through apply_pending's child pass (browser-lib.sh:752) and adding ghostty/shaders cases to deactivate_component (install.sh) - both off-limits for this task. The GUI manifest can DISPLAY personal items under --personal, but apply-plan will reject applying them; Task 3-6 server should not offer personal toggles (or the orchestrator lands the browser-lib work first).

## Known minor observation (pre-existing, not introduced here)
- Once in ~30 early runs, an EINTR surfaced as `printf: write error: Interrupted system call` from browser-lib.sh:231 inside leaf_paths (during allowlist build). It did NOT change the exit code and never recurred across 65+ later runs. This is a browser-lib.sh leaf_paths printf property (off-limits to modify here) shared by the shipped --manifest handler, not specific to --apply-plan. No action taken; flagged for the orchestrator.

## Files touched
- install.sh (arg-parser case + default + handler + one help line)
- claude/hooks/test-apply-plan.sh (NEW)

## Commit
- Landed as 23f0ccac on gui-installer (2 files changed: install.sh + claude/hooks/test-apply-plan.sh). main untouched.
- Committing only the two code/test files (install.sh + claude/hooks/test-apply-plan.sh); this beat and other memory files stay out of the task commit per the plan.
- Final state: apply-plan test 33/33, apply-pending 33/33, manifest test PASS, --help/--dry-run/--manifest all exit 0, bash -n clean. Codex: 7 review passes, every in-scope finding folded; only out-of-scope finding is the browser-tree.json figma-fidelity-arm gap (other workstream).

Collaborator: Jonah
