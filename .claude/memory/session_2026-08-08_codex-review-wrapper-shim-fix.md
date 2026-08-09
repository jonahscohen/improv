---
name: codex-review.py wrapper node-vs-shim launch fix
description: codex-review.py crashed running the cmux codex SHIM through node; now detects node-script vs shell-shim and launches each correctly
type: project
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests
confidence: high
---

# codex-review.py crashed on cmux because it forced a bash shim through node

## The crash
`claude/hooks/codex-review.py` (symlinked to `~/.claude/hooks/codex-review.py`) is the reliable real-Codex review wrapper. Its `codex_argv()` was written for ONE codex shape: a Node script (`#!/usr/bin/env node`). To dodge an ancient ambient node (the old node12 problem, reference_codex_broken_node12_path.md) it resolved a node>=16 absolutely and returned `[<node>, <realpath-of-codex>]`, i.e. it always launched codex as `node <codex-file>`.

On this cmux machine `codex` on PATH is NOT a Node script. It resolves to a cmux-cli SHIM at `/var/folders/.../cmux-cli-shims/<uuid>/codex`, a `#!/usr/bin/env bash` script (confirmed via `file`: "Bourne-Again shell script text executable") that execs the real codex after stripping the shim dir from PATH. So `codex_argv()` produced `['/Users/spare3/.nvm/versions/node/v20.19.6/bin/node', '<bash-shim>']`, and `node <bash-shim>` crashed instantly:

```
SyntaxError: Unexpected token '['
    at wrapSafe (node:internal/modules/cjs/loader ...)
Node.js v20.19.6
```

Node's CJS loader tried to parse bash as JavaScript and threw before codex ever ran. jf-task1 had hit this and worked around it by calling `codex exec` directly; this makes the wrapper itself robust.

## Root cause
Single-shape assumption. `codex_argv()` unconditionally forced the resolved codex through `node`, which is correct ONLY when codex is a Node entrypoint. A shell shim (or any non-Node executable) must be invoked directly so its own shebang selects the interpreter.

## The fix (claude/hooks/codex-review.py)
**Why:** launch each codex shape correctly instead of assuming Node.
**How:** added `_is_node_script(path)` and branched `codex_argv()` on it.

- `_is_node_script(path)` returns True for a `.js/.mjs/.cjs` file OR a file whose shebang matches `\bnode\b`; returns False for a shell shim, a compiled binary, or any unreadable file (read failure falls through to False so we never force a non-node file through node - the exact crash guarded against).
- `codex_argv()`:
  - resolves `link = shutil.which("codex")`, `codex_target = os.path.realpath(link)`.
  - if `not _is_node_script(codex_target)` -> return `[link]` and invoke the shim/executable DIRECTLY (cmux case).
  - else (Node script) -> keep the prior node>=16 resolution ($CODEX_NODE_BIN, co-located node, ambient node, newest nvm node), returning `[node_bin, codex_target]`.
  - node-branch fallback when no compatible node found: return `[link]` (run codex directly, fail loudly) instead of the prior bare `["codex"]` - functionally equivalent, absolute path.

Everything else in the wrapper is unchanged and preserved: positional prompt after `--` (not stdin), the process-group SIGKILL watchdog, effort=high default, rc==0-and-nonempty success semantics, exit codes 0/2/3/4/5, and the reference_codex_exec_hang_sigkill.md behavior. Only HOW codex is launched changed.

## Verification (all green)
1. **Old crash gone / real verdict:** `~/.claude/hooks/codex-review.py --smoke` -> `HEALTHY: codex returned SMOKE_OK in 8.1s (exit 0)`. Real codex ran through the shim directly, exit 0. Full review of a tiny real diff (a `return a - b` -> `a + b` fix) returned a real Codex verdict, exit 0.
2. **Live shim detection:** `codex_argv()` on this machine returns `['/var/folders/.../cmux-cli-shims/<uuid>/codex']` (direct), and `_is_node_script(live shim)` is False.
3. **Node-branch preserved:** fixtures for `#!/usr/bin/env node`, `#!/usr/local/bin/node`, and a bare `.js` all detect as node scripts; a node-shebang fixture placed on PATH yields `codex_argv()` = `['<node v20.19.6>', '<fixture>']`. A bash-shim fixture and an unreadable file both detect as non-node -> direct.

## Cross-model review + fold
Ran the fix diff through the now-working wrapper itself (real Codex, effort=medium, verdict in 48.8s, exit 0). No high-severity issues; confirmed positional-prompt, SIGKILL watchdog, and 0/2/3/4/5 exit codes intact. Folded two cheap hardening findings into `_is_node_script`:
- shebang is now AUTHORITATIVE over the file extension, so a shim named `codex.js` that starts `#!/usr/bin/env bash` is correctly classified non-node (runs direct) instead of being forced through node. Extension is consulted only when there is no shebang.
- shebang read widened 256 -> 1024 bytes so a long `#!/usr/bin/env -S ... node` line is not truncated past its `node` token.
Re-verified after the fold: all 6 detection fixtures pass (added `codex_bashshim.js -> False`), `py_compile` OK, `--smoke` HEALTHY (SMOKE_OK, exit 0).

Collaborator: Jonah.

## Files touched
- claude/hooks/codex-review.py (added `_is_node_script`, branched `codex_argv()`, updated launcher-resolution comment)
