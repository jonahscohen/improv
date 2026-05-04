import { WebSocketServer, WebSocket } from 'ws';
import { createServer, type Server as HttpServer, type IncomingMessage, type ServerResponse } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ConnectionManager } from './connection-manager.js';
import type { JsonRpcRequest, JsonRpcResponse, JsonRpcMessage } from './types.js';

type MessageHandler = (connectionId: string, params: Record<string, unknown> | undefined) => unknown | Promise<unknown>;

export class WsServer {
  private wss: WebSocketServer | null = null;
  private httpServer: HttpServer | null = null;
  private manager = new ConnectionManager();
  private handlers = new Map<string, MessageHandler>();
  private port: number | null = null;
  private distDir: string;

  constructor() {
    const serverDir = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url));
    this.distDir = join(serverDir, '..');
  }

  async start(preferredPort: number): Promise<number> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = preferredPort + attempt;
      try {
        const port = await this.tryListen(candidate);
        this.port = port;
        return port;
      } catch {
        // port occupied, try next
      }
    }
    throw new Error(`Could not find an available port in range ${preferredPort}-${preferredPort + 9}`);
  }

  private tryListen(port: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
        this.handleHttpRequest(req, res);
      });

      const wss = new WebSocketServer({ server: httpServer });

      httpServer.once('listening', () => {
        this.httpServer = httpServer;
        this.wss = wss;
        this.attachConnectionHandler();
        resolve(port);
      });

      httpServer.once('error', (err) => {
        reject(err);
      });

      httpServer.listen(port);
    });
  }

  private handleHttpRequest(req: IncomingMessage, res: ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    if (req.method === 'GET' && req.url === '/improv-core.js') {
      const filePath = join(this.distDir, 'improv-core.js');
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(content);
      } else {
        res.writeHead(404);
        res.end('improv-core.js not found');
      }
      return;
    }

    if (req.method === 'GET' && req.url?.startsWith('/improv-') && req.url?.endsWith('.js')) {
      const fileName = req.url.slice(1);
      const filePath = join(this.distDir, fileName);
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(content);
      } else {
        res.writeHead(404);
        res.end(`${fileName} not found`);
      }
      return;
    }

    if (req.method === 'GET' && req.url === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        server: 'improv',
        port: this.port,
        connections: this.manager.size(),
      }));
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  }

  private attachConnectionHandler(): void {
    if (!this.wss) return;

    this.wss.on('connection', (ws: WebSocket) => {
      let handshakeDone = false;

      const timer = setTimeout(() => {
        if (!handshakeDone) {
          ws.close(4001, 'Handshake timeout');
        }
      }, 5000);

      ws.once('message', (raw: Buffer | string) => {
        clearTimeout(timer);

        let msg: JsonRpcRequest;
        try {
          msg = JSON.parse(raw.toString()) as JsonRpcRequest;
        } catch {
          ws.close(4002, 'Invalid JSON');
          return;
        }

        if (msg.method !== 'handshake') {
          ws.close(4002, 'Expected handshake');
          return;
        }

        handshakeDone = true;

        const params = msg.params ?? {};
        const tabUrl = (params.tabUrl as string) ?? '';
        const tabTitle = (params.tabTitle as string) ?? '';
        const connectionId = this.manager.add(ws, tabUrl, tabTitle);

        const response: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: msg.id,
          result: { connectionId },
        };
        ws.send(JSON.stringify(response));

        ws.on('message', (data: Buffer | string) => {
          this.handleMessage(ws, connectionId, data.toString());
        });

        ws.on('close', () => {
          this.manager.remove(connectionId);
        });
      });

      ws.on('close', () => {
        if (!handshakeDone) {
          clearTimeout(timer);
        }
      });
    });
  }

  private async handleMessage(ws: WebSocket, connectionId: string, raw: string): Promise<void> {
    let msg: JsonRpcRequest;
    try {
      msg = JSON.parse(raw) as JsonRpcRequest;
    } catch {
      return;
    }

    const handler = this.handlers.get(msg.method);
    if (!handler) {
      const errorResponse: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: msg.id,
        error: { code: -32601, message: 'Method not found' },
      };
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(errorResponse));
      }
      return;
    }

    try {
      const result = await handler(connectionId, msg.params);
      const response: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: msg.id,
        result,
      };
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(response));
      }
    } catch (err) {
      const errorResponse: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: msg.id,
        error: {
          code: -32000,
          message: err instanceof Error ? err.message : 'Internal error',
        },
      };
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(errorResponse));
      }
    }
  }

  onMessage(method: string, handler: MessageHandler): void {
    this.handlers.set(method, handler);
  }

  broadcastToClients(method: string, params?: Record<string, unknown>): void {
    const message: JsonRpcMessage = {
      jsonrpc: '2.0',
      id: 0,
      method,
      params,
    };
    this.manager.broadcast(message);
  }

  getConnections() {
    return this.manager.getAll();
  }

  getPort(): number | null {
    return this.port;
  }

  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.httpServer) {
        resolve();
        return;
      }
      this.wss?.close();
      this.httpServer.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
