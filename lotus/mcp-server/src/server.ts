#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { FigmaBridge } from './bridge.js';
import { mcpTools } from './tools.js';

const DEFAULT_PORT = 9527;
const port = parseInt(process.env.LOTUS_PORT ?? '', 10) || DEFAULT_PORT;

const bridge = new FigmaBridge(port);

const server = new McpServer({
  name: 'lotus-mcp',
  version: '1.0.0',
});

// Register each Lotus tool as an MCP tool
for (const tool of mcpTools) {
  server.tool(
    tool.name,
    tool.description,
    tool.schema.shape,
    async (args: Record<string, unknown>) => {
      try {
        const requestId = `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const message = tool.pluginMessage(args, requestId);
        const result = await bridge.request(message);

        return {
          content: [
            {
              type: 'text' as const,
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `Error: ${errorMessage}` }],
          isError: true,
        };
      }
    },
  );
}

// Start the MCP stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[lotus-mcp] MCP server started (HTTP bridge port: ${port})`);
}

main().catch((err) => {
  console.error('[lotus-mcp] Fatal error:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  bridge.close();
  process.exit(0);
});
process.on('SIGTERM', () => {
  bridge.close();
  process.exit(0);
});
