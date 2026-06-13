---
name: fix - cmux NODE_OPTIONS restore shim deleted by temp cleanup
description: macOS temp-cleaned /var/folders/.../T/cmux-claude-node-options/restore-node-options.cjs, so every node/npx/MCP-hook process inheriting NODE_OPTIONS crashed with MODULE_NOT_FOUND on the --require preload. Recreated the shim (strips its own --require for children, preserves --max-old-space-size, never throws). Verified node/npx work.
type: reference
superseded_by: session_2026-06-11_node-shim-self-heal.md
---

Collaborator: Jonah. 2026-05-31. Symptom: "node:internal/modules/cjs/loader:1210 ... Cannot find module '.../cmux-claude-node-options/restore-node-options.cjs'" breaking npx tsc, npm test, and an MCP hook.

## Cause
NODE_OPTIONS = `--require=/var/folders/14/v99g5syx2z7cq0q23jwzhknh0000gp/T/cmux-claude-node-options/restore-node-options.cjs --max-old-space-size=4096`. The cmux dir existed but was EMPTY - macOS T/ cleanup deleted restore-node-options.cjs. Any node process inheriting NODE_OPTIONS fails to preload the missing file.

## Fix
Recreated the shim at that path. It strips the self-referential `--require ...restore-node-options.cjs` token from process.env.NODE_OPTIONS (so child node processes don't keep depending on the temp file) while preserving --max-old-space-size; wrapped in try/catch so a preload never throws.

## Verified
- `node -e ...` -> node-ok, exit 0, NODE_OPTIONS for children = "--max-old-space-size=4096".
- `npx tsc --noEmit` -> exit 0 WITHOUT the `unset NODE_OPTIONS` workaround.

## Note
Fragile to recurrence: it lives in macOS T/ which gets cleaned periodically (same root cause). If it recurs, recreate this file, or have cmux place the shim outside T/ at the harness level. Workaround in a pinch: prefix node commands with `unset NODE_OPTIONS` (bash itself is unaffected; only node reads NODE_OPTIONS).
