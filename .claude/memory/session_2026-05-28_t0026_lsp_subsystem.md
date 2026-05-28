---
name: T-0026 LSP integration subsystem shipped
description: sidecoach MCP server gains an LSP subsystem (src/lsp/ client/servers/manager) + 5 LSP tools; 204/204 tests, T-0018 quality bar preserved
type: project
relates_to: [session_2026-05-28_t0022_mcp_extension_shipped.md, session_2026-05-28_task-queue-team-deploy.md, session_2026-05-28_t0018_mcp_server.md]
---

Collaborator: Jonah. Shipped by teammate `t0026-lsp` (task-queue-0528), verified + integrated by lead. Closes the LSP deferral filed during T-0022.

## What shipped
New `src/lsp/` subsystem + 5 LSP tools on the sidecoach MCP server:
- `src/lsp/framing.ts` - Content-Length framed JSON-RPC codec (partial-read reassembly).
- `src/lsp/client.ts` - stdio LSP client: initialize -> capability exchange -> initialized -> workspace-folder registration, id-correlated requests, clean shutdown (shutdown -> exit).
- `src/lsp/servers.ts` - language-to-binary discovery by file extension (typescript-language-server, gopls, rust-analyzer, pyright, etc.).
- `src/lsp/index.ts` - `lspClientManager`: spawn-on-demand, lease-based concurrency (in-use server cannot be idle-evicted mid-request), idle eviction, graceful teardown.
- `src/lsp/tool-support.ts` - shared handler glue.
- 5 tools: `sidecoach_lsp_hover`, `sidecoach_lsp_goto_definition`, `sidecoach_lsp_find_references`, `sidecoach_lsp_document_symbols`, `sidecoach_lsp_workspace_symbols`. First four take file + 0-based line/character (positions 0-based to match the LSP wire); document_symbols treats line/character as optional (file-level); workspace_symbols takes a query string instead of a position.

## Quality bar preserved (T-0018/T-0022)
Zod schemas validate before handler body (LSP_FILE_MAX 2048, LSP_QUERY_MAX 1024, non-negative int positions); uniform wrapHandler guard (timeout race + structured ToolError + stderr-only logging); 5-code error taxonomy; binary-probe-and-cache per language -> DOWNSTREAM_UNAVAILABLE when no server on PATH (never crashes); path scoping reuses project-root.ts (realpath + symlink-escape protection); separate init-timeout vs per-call timeout for slow-starting servers.

## Tests: 204/204 PASS (was 145 baseline, +59)
- The LSP RPC layer is testable WITHOUT real servers via a transport/process seam (`__tests__/lsp-fakes.ts` + `__tests__/fixtures/` fixture subprocess LSP server).
- Unit: lsp-framing (Content-Length parse + reassembly), lsp-client (handshake/correlation), lsp-manager (lease prevents eviction; idle eviction fires), lsp-servers (extension->binary discovery).
- Fault-injection (lsp-faults): server crash mid-RPC rejects in-flight + evicts dead server; slow init > init-timeout -> TIMEOUT + evict; malformed frame ignored, later valid response still resolves; response for unknown id ignored, client stays usable; shutdown hang force-kills; binary-missing -> DOWNSTREAM_UNAVAILABLE per language.
- Integration (lsp-tools): real subprocess round-trips against the FIXTURE server for hover/document_symbols/goto_definition/workspace_symbols, plus DOWNSTREAM + path-escape + unsupported-filetype cases. No real language servers are installed on this machine (typescript-language-server/gopls/rust-analyzer/pyright all absent), so the real-binary path correctly exercised DOWNSTREAM; the fixture proves end-to-end JSON-RPC.
- `npx tsc --noEmit` clean. dist/ rebuilt (mcp-server's own dist, independent of parent sidecoach dist - no interaction with the T-0027 ralph drift).

## Docs
DESIGN-EXTENSION.md extended with a T-0026 section (subsystem architecture + lease rationale + failure-modes rows); README tool catalog lists the 5 LSP tools + their binaries; SMOKE_TRANSCRIPT.txt appended (not replaced) with a T-0026 section; `__tests__/smoke-t0026.sh` added.

## Coordination note
Built as the serialized FIRST writer of the shared MCP files (schemas.ts, tools/index.ts, src/index.ts, README, DESIGN-EXTENSION, SMOKE_TRANSCRIPT) because Agent worktree isolation was a no-op (see [[feedback_agent_worktree_isolation_unreliable]]). All shared-file additions carry `// T-0026` markers so T-0025 can layer on top without conflict.
