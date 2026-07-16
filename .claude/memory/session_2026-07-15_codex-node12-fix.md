---
name: Fixed Codex broken-from-Bash-tool (node v12) - codex-review.py self-resolves node>=16
description: codex-review.py died because the Bash-tool shell's node is v12 but codex 0.142.5 needs >=16 (top-level await). Fixed by resolving a node>=16 absolutely in codex-review.py and invoking node+codex.js directly; also made the codex install.sh component DEPLOY codex-review.py. Cross-model gate restored (smoke HEALTHY, real Codex review exit 0).
type: project
relates_to: [reference_codex_broken_node12_path.md, reference_codex_review_tool.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: py compile; codex-review.py --smoke HEALTHY (exit 0); real cross-model review of the diff exit 0 (no blocking findings); default parity ALL PASS; --only codex deploys codex-review.py; deactivate round-trip clean
confidence: high
---

Spawned-task fix (chip from the Stage-3b session). Root cause was fully pre-diagnosed in [[reference_codex_broken_node12_path.md]]: the non-interactive Bash-tool shell's PATH lists nvm bins ascending (v12.22.12 first at position 5), so `node` -> v12; `codex` -> v20.19.6/bin/codex (a symlink to codex.js) whose `#!/usr/bin/env node` shebang re-picks v12; codex 0.142.5 uses top-level await -> `SyntaxError: Unexpected reserved word` at codex.js:188 before it runs. Available node>=16: v18.2.0, v18.20.0, v20.19.6.

**FIX (option 1 - the durable, self-contained one).** `claude/hooks/codex-review.py`:
- New `codex_argv()` returns the launch PREFIX, resolving a node>=16 absolutely: prefers `$CODEX_NODE_BIN`, then the node **co-located with the codex symlink** (`dirname(which codex)/node` = the version codex was installed under, so >=16), then the ambient node if >=16, then the newest nvm node>=16; every candidate is version-checked with `_node_major()`; falls back to `['codex']` if none (fails loudly, as before). Memoized.
- `build_cmd` now `codex_argv() + ["exec", ...]` instead of `["codex", "exec", ...]`, invoking `<node> <codex.js> exec ...`.
- Why option 1 not a PATH shim (option 2): a `codex` shim can't shadow the real codex - it sits at PATH position 8 (v20.19.6/bin), before any dotfiles-controlled bin dir (position 9+), so a shim in ~/.local/bin never wins. codex-review.py resolving absolutely is PATH-order-independent and is the sanctioned path (codex-rescue-guard redirects to it).

**DURABILITY (deployment gap closed).** codex-review.py was only manually symlinked (dated Jun 30), NOT installer-deployed, so a fresh clone wouldn't have it. The codex install.sh component now `link_or_copy`s codex-review.py into ~/.claude/hooks/ (deactivate_codex removes it via rm_hook_if_ours); DESCS/FILES updated.

**VERIFIED:** py compile OK; resolver returns `[v20.19.6/bin/node, codex.js]` (node major 20); `codex-review.py --smoke` -> HEALTHY (exit 0); a REAL cross-model Codex review of this very diff -> exit 0, no blocking findings (Codex confirmed the resolution order, memoization, edge cases, and that `node codex.js exec ...` == `codex exec ...` since codex.js forwards argv.slice(2)); one Low folded (docstring "guaranteed >=16" softened to "normally >=16, still version-checked"); default parity ALL PASS; `--only codex` deploys all 3 codex files; codex deactivate round-trip clean (codex-review.py removed, 0 left).

**KNOWN REMAINING (not fixable from dotfiles):** bare `codex` / `codex --version` from the Bash tool still fails (real codex is early on PATH; can't be shadowed by a dotfiles bin dir; and the ascending-nvm PATH order is harness-controlled). Not needed - codex-review.py is the cross-model gate and it works.

Files touched: claude/hooks/codex-review.py, install.sh (codex component: 16e deploy line + deactivate_codex + DESCS + FILES).
