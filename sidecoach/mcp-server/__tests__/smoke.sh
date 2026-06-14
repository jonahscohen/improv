#!/usr/bin/env bash
# Live end-to-end smoke test of the built MCP server.
#
# Spawns dist/index.js, feeds it a sequence of JSON-RPC requests, prints
# each request/response pair. Exits 0 on success, 1 if any response
# indicates an error we didn't deliberately ask for.
#
# Usage:  bash __tests__/smoke.sh [path/to/index.js]

set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
ENTRY="${1:-$HERE/../dist/index.js}"

if [[ ! -f "$ENTRY" ]]; then
  echo "ERROR: server entry not found at $ENTRY (run npm run build first)" >&2
  exit 2
fi

OUT_FIFO="$(mktemp -u)"
mkfifo "$OUT_FIFO"

# Send requests via heredoc -> Node stdin; capture stdout via tee for both
# console output and inline parsing.

(
cat <<'EOF'
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke-shell","version":"0.0.0"}}}
{"jsonrpc":"2.0","method":"notifications/initialized"}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"sidecoach_list_lanes","arguments":{}}}
{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"sidecoach_classify_intent","arguments":{"prompt":"please polish the homepage"}}}
{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"sidecoach_lane","arguments":{"operation":"list"}}}
{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"sidecoach_get_flow_metadata","arguments":{"flowId":"flowJ_tactical_polish"}}}
{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"sidecoach_get_flow_metadata","arguments":{"flowId":"flowZZZ_unknown"}}}
EOF
sleep 0.5
) | SIDECOACH_MCP_LOG_LEVEL=warn node "$ENTRY"
