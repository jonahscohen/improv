import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { WsServer } from './ws-server.js';
import { registerTools } from './mcp-tools.js';

const DEFAULT_WS_PORT = 9223;

async function killStaleProcess(port: number): Promise<void> {
  const { execFileSync } = await import('child_process');
  try {
    const result = execFileSync('lsof', ['-ti', `:${port}`], { encoding: 'utf-8' }).trim();
    if (result) {
      const pids = result.split('\n').filter(Boolean);
      for (const pid of pids) {
        if (parseInt(pid) !== process.pid) {
          try { process.kill(parseInt(pid), 'SIGTERM'); } catch {}
        }
      }
      await new Promise(r => setTimeout(r, 500));
    }
  } catch {}
}

async function main(): Promise<void> {
  await killStaleProcess(DEFAULT_WS_PORT);
  const wsServer = new WsServer();
  const port = await wsServer.start(DEFAULT_WS_PORT);
  process.stderr.write(`Improv WebSocket server listening on port ${port}\n`);

  const mcpServer = new McpServer({
    name: 'improv',
    version: '0.1.0',
  });

  registerTools(mcpServer, wsServer);

  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);

  process.on('SIGINT', async () => {
    await wsServer.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  process.stderr.write(`Improv server error: ${err}\n`);
  process.exit(1);
});
