---
name: Justify shared emitResponse helper (closure-contract Task 1)
description: Both respond paths now route through one durable emitResponse helper that persists headless, joins targetSelectors, and stamps respondedAt on the originating prompt
type: project
relates_to: [session_2026-08-08_justify-closure-contract-plan.md, decision_improv_http_polling_watch.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests
confidence: high
---

Task 1 of the 3-task justify-closure-contract plan. Foundational: Tasks 2 and 3 consume the `emitResponse` interface and the `respondedAt` prompt-stamp added here. Branch `justify-closure-contract` (not main).

## What changed

- Extracted a single public `emitResponse(input)` helper on `WsServer` (justify/server/ws-server.ts). It owns build + broadcast(`justify_response`) + headless-persist (`manager.size() === 0` -> appendResponseFile) + a new `respondedAt` stamp. The targetSelectors join (from the original prompt by promptId), the `promptId + '-' + Date.now()` response id, and the headless persist all moved verbatim from the old inline `POST /respond` body.
- Added a private `stampResponded(promptId)`: marks the ORIGINAL prompt (bare id) with `respondedAt = Date.now()` once (only if currently null), written tmp+rename like the claim path. Wrapped in try/catch so a failed stamp never sinks a response that already broadcast.
- `POST /respond` handler body collapsed to `this.emitResponse(data)` (kept the surrounding JSON.parse + 400 error handling).
- MCP path (justify/server/mcp-tools.ts justify_respond tool) now calls `ws.recordMcpActivity()` then `ws.emitResponse({ promptId, summary, filesChanged, changes, status, question })` instead of a bare `ws.broadcastToClients('justify_response', {...})`. This is the whole point: the MCP path was NOT persisting headless, NOT joining targetSelectors, NOT carrying diffs, NOT stamping. Now it is as durable/complete as the HTTP path.

## Why

The two respond paths had drifted: HTTP `/respond` was enriched over time (headless durability, targetSelectors join) while the MCP `justify_respond` tool stayed a bare broadcast. On a headless/disconnected daemon an MCP-delivered result vanished. One shared helper makes drift structurally impossible and gives later tasks a `respondedAt` signal to tell a finished task from a still-open one.

## How verified

- TDD: wrote justify/__tests__/server/respond-parity.test.ts first (2 cases), watched it fail on `s.emitResponse is not a function`, implemented, watched it pass.
- Inline test harness (no exported makeTestServer): construct WsServer over a temp `JUSTIFY_STATE_DIR` with zero sockets (start() never called, so manager.size() === 0), seed prompts.json, read responses.json/prompts.json directly. Same construction pattern as ws-server.test.ts.
- Full suite: 35 files / 301 tests green (`npx vitest run` from justify/).
- Typecheck: `npx tsc --noEmit` shows zero new errors in server/ (only pre-existing core/ react-alias + timer-typing noise, resolved by esbuild at build time). `node build.js` succeeds (all 4 bundles).
- Cross-model gate: real Codex review of the diff (gpt-5.5, exit 0, 17,378 tokens - a genuine pass, not a stub) returned "CLEAN - no findings".

## Harness bug surfaced (flagged to lead, not fixed here)

The mandated `~/.claude/hooks/codex-review.py` wrapper crashes instantly on this machine (exit 1, Node module-loader stack, "CODEX EMPTY OUTPUT after 0s"). Root cause: `codex_argv()` does `codex_js = os.path.realpath(which("codex"))` then runs `node <codex_js>`, assuming codex on PATH is a Node script. Here `codex` is a cmux-cli SHELL SHIM (/var/folders/.../cmux-cli-shims/.../codex), so `node <shell-shim>` fails on module load. The shim itself works: `codex exec` runs real Codex fine. Durable fix belongs in the dotfiles hook (detect a non-JS realpath target and fall back to invoking the shim directly, or honor the shim as the launcher). Worked around here by invoking `codex exec -s read-only --skip-git-repo-check -c model_reasoning_effort=medium` with instructions+diff piped as the stdin prompt - a real, deterministic, exit-code-checked cross-model pass. Note: macOS has no `timeout` builtin (use `gtimeout` from coreutils or none).

## Interface produced (for Tasks 2 and 3)

- `emitResponse(input: { promptId: string; summary?: string; filesChanged?: string[]; changes?: unknown[]; diffs?: unknown[]; targetSelectors?: string[]; status?: 'completed'|'needsInfo'|'failed'; question?: string }): void` (public)
- `respondedAt: number` stamped on the bare-id prompt in prompts.json, set once (null-guarded).

## Files touched

- justify/server/ws-server.ts (emitResponse + stampResponded added; POST /respond body collapsed)
- justify/server/mcp-tools.ts (justify_respond routes through emitResponse)
- justify/__tests__/server/respond-parity.test.ts (new)
