---
name: Installer bucket browser Task 2 - pure bash accessor layer
description: browser-lib.sh tree loader + accessors over browser-tree.json; built TDD; bash-3.2-safe encoded-var storage instead of associative arrays
type: project
relates_to: [session_2026-07-16_bucket-browser-task1-data.md, decision_installer_bucket_browser.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: tests + independent-claude-review
confidence: high
---

Task 2 of the installer bucket-browser build. Worktree `installer-bucket-browser`, branch `feat/installer-bucket-browser`. Built the pure bash accessor layer over Task 1's `browser-tree.json`.

Files (TDD: failing tests -> implement -> pass):
- `claude/hooks/browser-lib.sh` (NEW) - tree loader + accessors.
- `claude/hooks/test-component-browser.sh` (appended 14 accessor assertions before the summary).
- `install.sh` (guarded `source` of browser-lib.sh near the early helpers; no top-level `browser_load`).

Public API (unchanged from the task spec): `browser_load <tree.json>`, `browser_buckets`, `node_kind`, `node_children`, `node_hooks`, `node_tag`, `node_desc`, `node_label`, `hook_desc`, `bucket_section`. Kind is DERIVED (members->group, hooks->hooks, else leaf), never read from the stored `kind` field. Paths are keys slash-joined ("Beats/Hooks", "sidecoach"). One python invocation emits all assignments; `eval` populates the globals. Loading is pure and single-shot.

KEY DECISION - storage mechanism (bash 3.2, not associative arrays):
The task spec said "populate associative arrays ... declare -gA". The ONLY bash on this machine is macOS system bash 3.2.57, which has NO associative arrays and no `declare -g` (both are bash 4.x). `declare -gA` errored immediately ("declare: -g: invalid option") and left the arrays undeclared, so string-subscript assignments were treated as indexed-array arithmetic and blew up under set -u ("Foundation: unbound variable").
Why the deviation is correct: install.sh uses ZERO bash-4 features by design (grep confirmed: no `declare -A`, no mapfile/readarray/case-mod), runs under `#!/usr/bin/env bash` = 3.2, and it SOURCES this lib. An associative-array implementation would break the installer on every default-macOS machine, i.e. exactly the target runtime.
How: each field/path pair is a PLAIN global scalar named `BR_<FIELD>_<hex>`, where `<hex>` is the byte-hex encoding of the path (a collision-free, valid identifier suffix). `browser_load` emits `BR_KIND_<hex>='group'` etc. from python (`path.encode().hex()`) and evals them; accessors recompute the same encoded name via `_br_enc` (pure-bash per-char `printf '%02x' "'$c"`) and read back with indirect expansion `${!n-}`. Probed in 3.2 and confirmed: indirect-with-default is set -u safe; `${!BR_KIND_@}` prefix reset is safe on no-match; bash per-char hex == python `.encode().hex()` for all ASCII keys including "Voice & chat" and slashed paths; plain/eval assignment inside a function is global.

Multi-word key handling (the flagged tricky part): bucket keys "Design Tools", "Voice & chat", "Dev surface" contain spaces. Ordered lists (bucket list + each node's children) are stored TAB-delimited internally and converted to spaces only for display (`_br_untab` = `${v//$'\t'/ }`). A tab never appears in a key, so the round-trip is lossless. Verified: `node_children "Voice & chat"` -> `discord voice-input voice-output`; `browser_buckets` reproduces all three multi-word bucket keys intact.

Verification (all green):
- `bash claude/hooks/test-component-browser.sh` -> 16 passed, 0 failed (3 Task-1 + 13 Task-2 assertions; the 14th appended line is the source, counted within the 13 that assert).
- Manual run under `set -euo pipefail` (install.sh's exact strictness): multi-word children, node_hooks (sidecoach -> 2 hooks; tilt-lab leaf -> empty), and missing paths (empty, no abort) all correct.
- `bash -n install.sh` and `bash -n claude/hooks/browser-lib.sh` clean.

Review gate (produce-and-verify): Codex is present on this box but crashes on invocation (documented node-path breakage), so per the fallback I dispatched an independent Claude reviewer (fresh context, NOT the producer) on the diff. Verdict CLEAN - re-ran the suite (16/16) and every hard check on the real bash 3.2.57: encoding parity (0 mismatches across all paths + hook names), no collision, set -u/-e safe, eval escaping sound, globals persist, no top-level load. Two minor non-defect notes carried forward: (1) `_br_enc` is ASCII-only (matches python only for ASCII; header documents it; all current keys are ASCII - latent trap only if a non-ASCII label is ever added); (2) Task 3's eventual `browser_load` call site must invoke defensively (`|| handle`) because a missing python3 makes it `return 1`, which would abort install.sh under set -e.

Files touched: claude/hooks/browser-lib.sh (new), claude/hooks/test-component-browser.sh, install.sh.
