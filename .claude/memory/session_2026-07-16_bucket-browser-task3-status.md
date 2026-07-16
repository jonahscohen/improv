---
name: Installer bucket browser Task 3 - status + rollup with injectable probe
description: leaf_paths / counts / item_state / _real_probe added to browser-lib.sh; per-leaf install probe rolls up to none|partial|active; built TDD, bash-3.2-safe
type: project
relates_to: [session_2026-07-16_bucket-browser-task2-lib.md, decision_installer_bucket_browser.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: tests
confidence: high
---

Task 3 of the installer bucket-browser build. Worktree `installer-bucket-browser`, branch `feat/installer-bucket-browser`. Added the status + rollup layer on top of Task 2's pure accessors in `claude/hooks/browser-lib.sh`. Built TDD: appended failing tests to `test-component-browser.sh` first, confirmed FAIL (8 failures, "command not found"), implemented, confirmed 24/24 PASS under `/bin/bash` (system bash 3.2.57).

Functions added to `browser-lib.sh`:
- `leaf_paths <path>` - every leaf path under a node, one per line. leaf -> itself; group -> recurse each child; hooks node -> emit `path/<hook>` for each hook directly.
- `counts <path>` - `on/total` over the leaves (total = leaf count, on = leaves whose probe returns 0).
- `item_state <path>` - leaf: probe -> active|none; group/hooks: on==0 none, on==total active, else partial.
- `_real_probe <path>` - default runtime probe: a leaf is a HOOK when its parent node's kind is `hooks` (-> `is_our_hook "<key>.sh"`), else a COMPONENT (-> `detect_component "<key>" == active`). is_our_hook / detect_component are install.sh functions in scope at browser runtime.
- `_br_children_lines <path>` (helper) - child keys ONE PER LINE, converting the internal TAB-delimited CHILDREN storage to newlines.

**Key technical decision - hooks-node children have NO sub-node KIND entry.**
Why: Task 2's python loader `walk()` recurses and emits KIND for `group` members but for a `hooks` node it only emits the hook-name list as CHILDREN; it never walks each hook. So `node_kind "Beats/Hooks/memory-approve"` returns empty.
How: `leaf_paths` cannot recurse hooks children via node_kind. It special-cases: `group` -> recurse `leaf_paths "$path/$child"` (children carry KIND); `hooks` -> emit `$path/$child` leaves directly. This is also why `_real_probe` keys the hook-vs-component decision off the PARENT node's kind, not the leaf's (the leaf has no stored kind).

**Injectable probe seam.** `${BR_STATE_PROBE:-_real_probe}` in both `counts` and `item_state`. Tests set `BR_STATE_PROBE=fake_probe` (a path is "installed" iff `|path|` is a substring of `$INSTALLED`) so the rollup logic is tested without install.sh's real detect functions. At runtime BR_STATE_PROBE is unset and `_real_probe` is used.

**Space-in-path safety (the task's hard constraint).** Bucket keys "Voice & chat", "Dev surface", "Design Tools" contain spaces, so paths do too. Every path list is newline-delimited; iteration is `while IFS= read -r ... done < <(...)`, never `for x in $(...)`. Verified live: `leaf_paths "Voice & chat"`, `counts "Design Tools"` (12 leaves across Skills+figma), `item_state "Dev surface"` (8 leaves) all correct. Also verified the whole layer runs clean under `set -euo pipefail` and that a top-level leaf bucket (tilt-lab, parent==self, kind==leaf) resolves to the component branch of `_real_probe`.

bash-3.2 compliance: parameter expansion `${p##*/}` / `${p%/*}` / `${c%/*}` / `${c#*/}`, pattern-substitution `${v//$'\t'/$'\n'}`, process substitution `< <(...)`, arithmetic `$((...))`. No associative arrays, no `declare -g`, no `mapfile`, no `${var^^}`.

Test results: `== 24 passed, 0 failed ==` under `/bin/bash`. `bash -n claude/hooks/browser-lib.sh` clean.

Review gate: Codex is broken on this box (node-v12 breakage, see reference_codex_broken_node12_path.md); per the standing fallback the passing bash-3.2 test suite is the gate for this unit. Pure additive functions, no changes to Task 1/2 surface.

Files touched:
- claude/hooks/browser-lib.sh (added leaf_paths, counts, item_state, _real_probe, _br_children_lines)
- claude/hooks/test-component-browser.sh (appended Task 3 status + rollup tests)
