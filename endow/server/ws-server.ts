import { WebSocketServer, WebSocket } from 'ws';
import { createServer, type Server as HttpServer, type IncomingMessage, type ServerResponse } from 'http';
import { createServer as createHttpsServer, type Server as HttpsServer } from 'https';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { execFile, execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { ConnectionManager } from './connection-manager.js';
import type { JsonRpcRequest, JsonRpcResponse, JsonRpcMessage } from './types.js';

type MessageHandler = (connectionId: string, params: Record<string, unknown> | undefined) => unknown | Promise<unknown>;

export class WsServer {
  private wss: WebSocketServer | null = null;
  private httpServer: HttpServer | null = null;
  private httpsServer: HttpsServer | null = null;
  private manager = new ConnectionManager();
  private handlers = new Map<string, MessageHandler>();
  private port: number | null = null;
  private httpsPort: number | null = null;
  private distDir: string;
  private lastPromptPoll: number = 0;
  private lastMcpActivity: number = 0;
  private watchSessionActive: boolean = false;

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
        // Start HTTPS on port + 1 so HTTPS pages (lando, etc.) can load the
        // bundle without mixed-content blocking. The HTTPS listener uses an
        // auto-generated self-signed cert; first time a browser hits it, the
        // user trusts the cert once via macOS Keychain (sudo command in
        // setup-cert.sh) and all subsequent loads are silent.
        try {
          this.httpsPort = await this.tryListenHttps(port + 1);
        } catch (e) {
          // HTTPS is optional; log and continue with HTTP-only.
          // eslint-disable-next-line no-console
          console.error('HTTPS listener could not start:', (e as Error).message);
        }
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

  private tryListenHttps(port: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const { keyPath, certPath } = this.ensureCert();
      const creds = {
        key: readFileSync(keyPath),
        cert: readFileSync(certPath),
      };
      const httpsServer = createHttpsServer(creds, (req: IncomingMessage, res: ServerResponse) => {
        this.handleHttpRequest(req, res);
      });
      const wssSecure = new WebSocketServer({ server: httpsServer });
      httpsServer.once('listening', () => {
        this.httpsServer = httpsServer;
        this.attachConnectionHandlerTo(wssSecure);
        resolve(port);
      });
      httpsServer.once('error', (err) => {
        reject(err);
      });
      httpsServer.listen(port);
    });
  }

  // Generate a self-signed cert for localhost on first run. Stored under the
  // dist/server/certs/ directory so it persists across rebuilds (the cert
  // itself is what the user trusts in their keychain; regenerating would
  // break that trust). Returns absolute paths to the key and cert files.
  private ensureCert(): { keyPath: string; certPath: string } {
    const certsDir = join(this.distDir, 'server', 'certs');
    const certPath = join(certsDir, 'cert.pem');
    const keyPath = join(certsDir, 'key.pem');
    if (!existsSync(certPath) || !existsSync(keyPath)) {
      mkdirSync(certsDir, { recursive: true });
      // openssl on macOS is LibreSSL which doesn't support `-addext`, so use
      // a config file with subjectAltName declared for proper SAN matching.
      const configPath = join(certsDir, 'openssl.cnf');
      writeFileSync(configPath, `[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no
[req_distinguished_name]
CN = localhost
[v3_req]
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names
[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
`);
      execFileSync('openssl', [
        'req', '-x509', '-nodes', '-newkey', 'rsa:2048',
        '-keyout', keyPath,
        '-out', certPath,
        '-days', '3650',
        '-extensions', 'v3_req',
        '-config', configPath,
      ], { stdio: 'pipe' });
    }
    return { keyPath, certPath };
  }

  private handleHttpRequest(req: IncomingMessage, res: ServerResponse): void {
    try {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST');

      // Serve/save responses
      if (req.method === 'GET' && req.url === '/responses') {
        const respFile = join(this.distDir, '..', 'responses.json');
        try {
          const data = existsSync(respFile) ? readFileSync(respFile, 'utf-8') : '[]';
          res.setHeader('Content-Type', 'application/json');
          res.end(data);
        } catch { res.end('[]'); }
        return;
      }
      if (req.method === 'POST' && req.url === '/responses') {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          const respFile = join(this.distDir, '..', 'responses.json');
          try { writeFileSync(respFile, body); } catch {}
          res.end('ok');
        });
        return;
      }
      // Serve fonts
      if (req.method === 'GET' && req.url?.startsWith('/fonts/')) {
        const fontName = req.url.replace('/fonts/', '');
        const fontPath = join(this.distDir, '..', 'fonts', fontName);
        if (existsSync(fontPath)) {
          const data = readFileSync(fontPath);
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Content-Type', 'font/woff2');
          res.setHeader('Cache-Control', 'public, max-age=31536000');
          res.end(data);
          return;
        }
      }
      // Bundle requests: strip query string before matching so cache-busting via
      // ?ver=... works. Send no-store headers so the browser always revalidates -
      // the bundle is rebuilt freely via deploy.sh and we want the latest served.
      const bundlePath = (req.url || '').split('?')[0];
      if (req.method === 'GET' && bundlePath === '/endow-core.js') {
      const filePath = join(this.distDir, 'endow-core.js');
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf-8');
          res.writeHead(200, {
            'Content-Type': 'application/javascript',
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
          });
          res.end(content);
        } else {
          res.writeHead(404);
          res.end('endow-core.js not found');
        }
        return;
      }

      // Queue persistence
      if (req.method === 'GET' && req.url === '/queue') {
        const queuePath = join(this.distDir, 'queue.json');
        if (existsSync(queuePath)) {
          const data = readFileSync(queuePath, 'utf-8');
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(data);
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end('[]');
        }
        return;
      }

      if (req.method === 'POST' && req.url === '/queue') {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          const queuePath = join(this.distDir, 'queue.json');
          try {
            writeFileSync(queuePath, body, 'utf-8');
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end('{"ok":true}');
          } catch {
            res.writeHead(500);
            res.end('write failed');
          }
        });
        return;
      }

      // Claude state persistence
      if (req.method === 'GET' && req.url === '/claude-state') {
        const statePath = join(this.distDir, 'claude-state.json');
        if (existsSync(statePath)) {
          const data = readFileSync(statePath, 'utf-8');
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(data);
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end('{"state":"none"}');
        }
        return;
      }

      if (req.method === 'POST' && req.url === '/claude-state') {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          const statePath = join(this.distDir, 'claude-state.json');
          try {
            writeFileSync(statePath, body, 'utf-8');
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end('{"ok":true}');
          } catch {
            res.writeHead(500);
            res.end('write failed');
          }
        });
        return;
      }

      if (req.method === 'GET' && req.url?.startsWith('/spark-') && req.url?.endsWith('.svg')) {
        const fileName = req.url.slice(1);
        const filePath = join(this.distDir, fileName);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf-8');
          res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Access-Control-Allow-Origin': '*' });
          res.end(content);
        } else {
          res.writeHead(404);
          res.end('not found');
        }
        return;
      }

      if (req.method === 'GET' && bundlePath.startsWith('/endow-') && bundlePath.endsWith('.js')) {
        const fileName = bundlePath.slice(1);
        const filePath = join(this.distDir, fileName);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf-8');
          res.writeHead(200, {
            'Content-Type': 'application/javascript',
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
          });
          res.end(content);
        } else {
          res.writeHead(404);
          res.end(`${fileName} not found`);
        }
        return;
      }

      if (req.method === 'POST' && req.url === '/respond') {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            this.broadcastToClients('endow_response', {
              promptId: data.promptId + '-' + Date.now(),
              summary: data.summary,
              filesChanged: data.filesChanged || [],
              changes: data.changes || [],
              status: data.status || 'completed',
              question: data.question,
              timestamp: Date.now(),
            });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
          }
        });
        return;
      }

      if (req.method === 'GET' && req.url === '/prompts') {
        this.lastPromptPoll = Date.now();
        const promptFile = join(this.distDir, '..', 'prompts.json');
        try {
          if (existsSync(promptFile)) {
            const content = readFileSync(promptFile, 'utf-8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(content);
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end('[]');
          }
        } catch {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('[]');
        }
        return;
      }

      if (req.method === 'GET' && req.url === '/watch-status') {
        const promptFile = join(this.distDir, '..', 'prompts.json');
        let pendingCount = 0;
        try {
          if (existsSync(promptFile)) {
            pendingCount = JSON.parse(readFileSync(promptFile, 'utf-8')).length;
          }
        } catch {}
        const recentActivity = this.lastMcpActivity > 0 && (Date.now() - this.lastMcpActivity) < 10000;
        const active = this.watchSessionActive && recentActivity;
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ active, session: this.watchSessionActive, lastActivity: this.lastMcpActivity, pendingCount }));
        return;
      }

      if (req.method === 'POST' && req.url === '/prompts/clear') {
        const promptFile = join(this.distDir, '..', 'prompts.json');
        try { writeFileSync(promptFile, '[]'); } catch {}
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (req.method === 'POST' && req.url === '/open-file') {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const file = data.file as string;
            const cmd = data.cmd as string;
            const allowed = ['open', 'code', 'cursor', 'opencode'];
            if (!file || !cmd || !allowed.includes(cmd)) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid file or cmd' }));
              return;
            }
            let fullPath = file;
            if (!file.startsWith('/')) {
              // Try as relative path from each project root first, then search by filename
              const baseName = file.split('/').pop() || file;
              try {
                const endowFiles = execFileSync('find', [
                  join(process.env.HOME || '', 'Documents', 'Github'),
                  '-name', '.endow', '-maxdepth', '2', '-type', 'f'
                ], { encoding: 'utf-8', timeout: 2000 }).trim().split('\n').filter(Boolean);
                for (const imp of endowFiles) {
                  const projectRoot = dirname(imp);
                  // Try as relative path from project root
                  const asRelative = join(projectRoot, file);
                  if (existsSync(asRelative)) { fullPath = asRelative; break; }
                  // Fallback: search by filename
                  try {
                    const found = execFileSync('find', [
                      projectRoot, '-name', baseName, '-type', 'f', '-maxdepth', '8',
                      '-not', '-path', '*/node_modules/*'
                    ], { encoding: 'utf-8', timeout: 2000 }).trim().split('\n').filter(Boolean);
                    if (found.length > 0) { fullPath = found[0]; break; }
                  } catch {}
                }
              } catch {}
            }
            process.stderr.write(`[endow] open-file: resolved "${file}" -> "${fullPath}" cmd="${cmd}"\n`);
            let args: string[];
            if (cmd === 'open') {
              args = ['-R', fullPath];
            } else if (cmd === 'code') {
              args = ['-a', 'Visual Studio Code', fullPath];
            } else if (cmd === 'cursor') {
              args = ['-a', 'Cursor', fullPath];
            } else if (cmd === 'opencode') {
              args = ['-a', 'OpenCode', fullPath];
            } else {
              args = [fullPath];
            }
            execFile('open', args, (err, stdout, stderr) => {
              if (err) process.stderr.write(`[endow] open-file error: ${err.message}\n`);
              if (stderr) process.stderr.write(`[endow] open-file stderr: ${stderr}\n`);
            });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, resolved: fullPath }));
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
          }
        });
        return;
      }

      if (req.method === 'GET' && req.url === '/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          server: 'endow',
          port: this.port,
          connections: this.manager.size(),
        }));
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    } catch (err) {
      process.stderr.write(`[endow] HTTP request error (non-fatal): ${err instanceof Error ? err.message : err}\n`);
      try { res.writeHead(500); res.end('Internal error'); } catch {}
    }
  }

  private attachConnectionHandler(): void {
    if (!this.wss) return;
    if (this.httpServer) {
      this.httpServer.on('error', (err: Error) => {
        process.stderr.write(`[endow] HTTP server error (non-fatal): ${err?.message ?? err}\n`);
      });
    }
    this.attachConnectionHandlerTo(this.wss);
  }

  private attachConnectionHandlerTo(wss: WebSocketServer): void {
    wss.on('error', (err: Error) => {
      process.stderr.write(`[endow] WSS error (non-fatal): ${err?.message ?? err}\n`);
    });

    wss.on('connection', (ws: WebSocket) => {
      let handshakeDone = false;

      ws.on('error', (err: Error) => {
        process.stderr.write(`[endow] WebSocket client error (non-fatal): ${err?.message ?? err}\n`);
      });

      const timer = setTimeout(() => {
        if (!handshakeDone) {
          try { ws.close(4001, 'Handshake timeout'); } catch {}
        }
      }, 5000);

      ws.once('message', (raw: Buffer | string) => {
        clearTimeout(timer);

        let msg: JsonRpcRequest;
        try {
          msg = JSON.parse(raw.toString()) as JsonRpcRequest;
        } catch {
          try { ws.close(4002, 'Invalid JSON'); } catch {}
          return;
        }

        if (msg.method !== 'handshake') {
          try { ws.close(4002, 'Expected handshake'); } catch {}
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
        try { ws.send(JSON.stringify(response)); } catch {}

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
      try { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(errorResponse)); } catch {}
      return;
    }

    try {
      const result = await handler(connectionId, msg.params);
      const response: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: msg.id,
        result,
      };
      try { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(response)); } catch {}
    } catch (err) {
      const errorResponse: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: msg.id,
        error: {
          code: -32000,
          message: err instanceof Error ? err.message : 'Internal error',
        },
      };
      try { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(errorResponse)); } catch {}
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

  recordMcpActivity(): void {
    this.lastMcpActivity = Date.now();
  }

  setWatchSession(active: boolean): void {
    this.watchSessionActive = active;
    if (active) this.lastMcpActivity = Date.now();
  }

  isWatchSessionActive(): boolean {
    return this.watchSessionActive;
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
