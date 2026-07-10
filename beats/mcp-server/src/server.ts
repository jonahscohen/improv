#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { beatsTools } from './tools.js';
import { CORPUS_DIR } from './corpus.js';

const server = new McpServer({
  name: 'beats-mcp',
  version: '1.0.0',
});

// Register each read-only beats tool as an MCP tool.
for (const tool of beatsTools) {
  server.tool(
    tool.name,
    tool.description,
    tool.schema.shape,
    async (args: Record<string, unknown>) => {
      try {
        const result = await tool.handler(args ?? {});
        return {
          content: [{ type: 'text' as const, text: result.text }],
          isError: result.isError ?? false,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    },
  );
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[beats-mcp] read-only MCP server started (corpus: ${CORPUS_DIR})`);
}

main().catch((err) => {
  console.error('[beats-mcp] Fatal error:', err);
  process.exit(1);
});

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
