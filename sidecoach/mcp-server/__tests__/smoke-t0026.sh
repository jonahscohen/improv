#!/usr/bin/env bash
# T-0026 LSP extension smoke test - live JSON-RPC exchange exercising the 5 new
# LSP tools (hover / goto_definition / find_references / document_symbols /
# workspace_symbols). Mirrors smoke-t0022.sh.
#
# These tools require a language server on PATH. If none is installed for the
# target file type the tool returns a structured DOWNSTREAM_UNAVAILABLE - which
# is itself a valid, graceful outcome this smoke test demonstrates.
#
# Usage:  bash __tests__/smoke-t0026.sh [path/to/index.js]

set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
ENTRY="${1:-$HERE/../dist/index.js}"

if [[ ! -f "$ENTRY" ]]; then
  echo "ERROR: server entry not found at $ENTRY (run npm run build first)" >&2
  exit 2
fi

(
cat <<EOF
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke-shell-t0026","version":"0.0.0"}}}
{"jsonrpc":"2.0","method":"notifications/initialized"}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"sidecoach_lsp_document_symbols","arguments":{"file":"src/index.ts"}}}
{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"sidecoach_lsp_hover","arguments":{"file":"src/index.ts","line":20,"character":10}}}
{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"sidecoach_lsp_goto_definition","arguments":{"file":"src/index.ts","line":20,"character":10}}}
{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"sidecoach_lsp_find_references","arguments":{"file":"src/index.ts","line":20,"character":10,"includeDeclaration":true}}}
{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"sidecoach_lsp_workspace_symbols","arguments":{"query":"buildServer","language":"typescript"}}}
{"jsonrpc":"2.0","id":8,"method":"tools/call","params":{"name":"sidecoach_lsp_hover","arguments":{"file":"package.json","line":0,"character":0}}}
{"jsonrpc":"2.0","id":9,"method":"tools/call","params":{"name":"sidecoach_lsp_hover","arguments":{"file":"../../../etc/hosts","line":0,"character":0}}}
EOF
sleep 1
) | SIDECOACH_MCP_LOG_LEVEL=warn SIDECOACH_PROJECT_ROOT="$HERE/.." node "$ENTRY"
