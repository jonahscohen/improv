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
      if (req.method === 'GET' && bundlePath === '/justify-core.js') {
      const filePath = join(this.distDir, 'justify-core.js');
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
          res.end('justify-core.js not found');
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

      if (req.method === 'GET' && bundlePath.startsWith('/justify-') && bundlePath.endsWith('.js')) {
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
        // Responding is Claude activity too - keep watch-status fresh so the
        // browser doesn't flash "Connection lost" the moment a result lands.
        this.lastMcpActivity = Date.now();
        this.watchSessionActive = true;
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            // Issue #1: a result must always be visually locatable. The submit
            // payload records which DOM element(s) the prompt was about; join the
            // original prompt by promptId and carry its selectors onto the
            // response so clicking the Changes entry can scroll to + select the
            // target even for diff-only responses that have no per-change
            // selectors. An explicit targetSelectors on the body wins if given.
            let targetSelectors: string[] = Array.isArray(data.targetSelectors) ? data.targetSelectors : [];
            if (targetSelectors.length === 0 && data.promptId) {
              const orig = this.readPromptsFile().find((p) => p.id === data.promptId);
              if (orig && Array.isArray((orig as { selectors?: string[] }).selectors)) {
                targetSelectors = (orig as { selectors?: string[] }).selectors as string[];
              }
            }
            const responseObj = {
              promptId: data.promptId + '-' + Date.now(),
              summary: data.summary,
              filesChanged: data.filesChanged || [],
              changes: data.changes || [],
              diffs: data.diffs || [],
              targetSelectors,
              status: data.status || 'completed',
              question: data.question,
              timestamp: Date.now(),
            };
            this.broadcastToClients('justify_response', responseObj);
            // Issue #2 (headless durability): if no browser is connected right
            // now, the broadcast lands nowhere and the result would be lost. The
            // connected client is what normally persists history to
            // responses.json; with zero clients, persist it here so the result
            // surfaces in the Changes panel the moment a tab (re)connects. When
            // a client IS connected it owns the write, so we skip to avoid
            // double-appends.
            if (this.manager.size() === 0) {
              this.appendResponseFile({ ...responseObj, reviewed: false });
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
          }
        });
        return;
      }

      // POST /activate - toggle the toolbar on every connected client. Mirrors
      // the justify_activate MCP tool over HTTP so /justify can run fully
      // session-independent (server-as-daemon + curl), no MCP required.
      if (req.method === 'POST' && req.url === '/activate') {
        this.broadcastToClients('activate');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      // POST /working - Claude has claimed the task and is applying it. The
      // auto-fire on GET /prompts only advances a browser still in 'sending';
      // a disconnect/reconnect (browser falls back to 'connected') swallows it,
      // so "Working" never shows. This explicit, UNGATED channel forces the bar
      // to "Working" regardless of current state - the symmetric partner to
      // /validating - so the loop always reads Working -> Validating -> Review.
      if (req.method === 'POST' && req.url === '/working') {
        this.lastMcpActivity = Date.now();
        this.watchSessionActive = true;
        this.broadcastToClients('justify_working_force');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      // POST /validating - Claude is verifying the applied change in a browser.
      // Surfaces the gap between "Working" (applying) and "Review" (done) so the
      // claudebar shows "Validating" instead of drifting to "Connected". Keeps
      // watch-status fresh (validating is active work, not idleness).
      if (req.method === 'POST' && req.url === '/validating') {
        this.lastMcpActivity = Date.now();
        this.watchSessionActive = true;
        this.broadcastToClients('justify_validating');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (req.method === 'GET' && req.url === '/prompts') {
        this.lastPromptPoll = Date.now();
        // A /prompts poll IS the watch heartbeat in the daemon/HTTP model (no
        // MCP). watch-status.active is what tells the browser "Claude is
        // connected" so it transmits queued tasks; mark it here so a pure-curl
        // listen loop (the /justify model) is recognized as a live watcher.
        this.watchSessionActive = true;
        this.lastMcpActivity = Date.now();
        const promptFile = join(this.distDir, '..', 'prompts.json');
        try {
          if (existsSync(promptFile)) {
            const content = readFileSync(promptFile, 'utf-8');
            // In the HTTP (curl) listen model a GET /prompts that returns
            // pending prompts IS Claude claiming them - the same moment the MCP
            // justify_watch/justify_get_prompts tools fire justify_working. Mirror
            // it here so the browser advances "Sending to Claude" -> "Working".
            // The browser ignores the event unless its state is 'sending', so
            // re-broadcasting on every poll while the prompt sits in the queue is
            // a harmless no-op.
            try {
              const parsed = JSON.parse(content);
              if (Array.isArray(parsed) && parsed.length > 0) {
                for (const p of parsed) {
                  this.broadcastToClients('justify_working', { promptId: p.id, timestamp: Date.now() });
                }
              }
            } catch {}
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
        // Window is generous (30s) because Claude stops polling /prompts while
        // it is busy applying a change; a tight window made the browser declare
        // "Connection lost" mid-apply. The browser also suppresses the disconnect
        // bar entirely while in the 'working' state, with the 60s retry timeout
        // as the real backstop for a genuinely dead Claude.
        const recentActivity = this.lastMcpActivity > 0 && (Date.now() - this.lastMcpActivity) < 30000;
        const active = this.watchSessionActive && recentActivity;
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ active, session: this.watchSessionActive, lastActivity: this.lastMcpActivity, pendingCount }));
        return;
      }

      if (req.method === 'POST' && req.url === '/prompts/clear') {
        this.lastMcpActivity = Date.now();
        this.watchSessionActive = true;
        // Issue #3: NEVER drop a task. A blanket clear after finishing one task
        // erased every prompt that arrived in the queue WHILE that task was
        // being worked - the user fires several, the first justify-done wipes
        // the rest, they are forgotten. Make clear id-aware: a body of
        // {"ids":[...]} or {"id":"..."} removes ONLY those handled prompts and
        // leaves everything that arrived since. An empty body keeps the old
        // clear-all behavior for back-compat (raw fallback callers).
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          const promptFile = join(this.distDir, '..', 'prompts.json');
          let ids: string[] = [];
          try {
            if (body.trim()) {
              const parsed = JSON.parse(body);
              if (Array.isArray(parsed?.ids)) ids = parsed.ids.map(String);
              else if (parsed?.id) ids = [String(parsed.id)];
            }
          } catch {}
          try {
            if (ids.length > 0) {
              const remaining = this.readPromptsFile().filter((p) => !ids.includes(p.id));
              writeFileSync(promptFile, JSON.stringify(remaining));
            } else {
              writeFileSync(promptFile, '[]');
            }
          } catch {}
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        });
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
                const justifyFiles = execFileSync('find', [
                  join(process.env.HOME || '', 'Documents', 'Github'),
                  '-name', '.justify', '-maxdepth', '2', '-type', 'f'
                ], { encoding: 'utf-8', timeout: 2000 }).trim().split('\n').filter(Boolean);
                for (const imp of justifyFiles) {
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
            // Optional line (and column) to jump to. Editors with a CLI
            // (code/cursor) support `--goto file:line:col`; that needs the CLI
            // binary, not `open -a`, so when a line is given we invoke the CLI
            // directly and fall back to `open -a` if the binary is missing.
            const rawLine = Number(data.line);
            const line = Number.isFinite(rawLine) && rawLine > 0 ? Math.floor(rawLine) : 0;
            const rawCol = Number(data.column);
            const col = Number.isFinite(rawCol) && rawCol > 0 ? Math.floor(rawCol) : 1;
            process.stderr.write(`[justify] open-file: resolved "${file}" -> "${fullPath}" cmd="${cmd}" line=${line}\n`);

            const openWithLauncher = () => {
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
              execFile('open', args, (err, _stdout, stderr) => {
                if (err) process.stderr.write(`[justify] open-file error: ${err.message}\n`);
                if (stderr) process.stderr.write(`[justify] open-file stderr: ${stderr}\n`);
              });
            };

            // Line-jump path: code/cursor CLIs accept `--goto <file>:<line>:<col>`.
            if (line > 0 && (cmd === 'code' || cmd === 'cursor')) {
              const cli = cmd === 'code' ? 'code' : 'cursor';
              execFile(cli, ['--goto', `${fullPath}:${line}:${col}`], (err) => {
                if (err) {
                  // CLI not on PATH (or failed) - fall back to opening the file.
                  process.stderr.write(`[justify] open-file goto via ${cli} failed (${err.message}); falling back to launcher\n`);
                  openWithLauncher();
                }
              });
            } else {
              openWithLauncher();
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, resolved: fullPath, line }));
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
          server: 'justify',
          port: this.port,
          connections: this.manager.size(),
        }));
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    } catch (err) {
      process.stderr.write(`[justify] HTTP request error (non-fatal): ${err instanceof Error ? err.message : err}\n`);
      try { res.writeHead(500); res.end('Internal error'); } catch {}
    }
  }

  private attachConnectionHandler(): void {
    if (!this.wss) return;
    if (this.httpServer) {
      this.httpServer.on('error', (err: Error) => {
        process.stderr.write(`[justify] HTTP server error (non-fatal): ${err?.message ?? err}\n`);
      });
    }
    this.attachConnectionHandlerTo(this.wss);
  }

  private attachConnectionHandlerTo(wss: WebSocketServer): void {
    wss.on('error', (err: Error) => {
      process.stderr.write(`[justify] WSS error (non-fatal): ${err?.message ?? err}\n`);
    });

    wss.on('connection', (ws: WebSocket) => {
      let handshakeDone = false;

      ws.on('error', (err: Error) => {
        process.stderr.write(`[justify] WebSocket client error (non-fatal): ${err?.message ?? err}\n`);
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

  // Prompt queue lives at <install-root>/prompts.json (same file the MCP layer
  // writes via push_prompt). Tolerant read for the id-aware clear and the
  // /respond -> targetSelectors join.
  private readPromptsFile(): Array<{ id: string; selectors?: string[]; [k: string]: unknown }> {
    const promptFile = join(this.distDir, '..', 'prompts.json');
    try {
      if (!existsSync(promptFile)) return [];
      const parsed = JSON.parse(readFileSync(promptFile, 'utf-8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  // Headless durability (issue #2): when no browser is connected, append a
  // finished response to responses.json so it is restored into the Changes
  // panel as soon as a tab connects. Mirrors the array shape the browser's
  // _changeHistory persists, so a connected client's later full-array write is
  // a clean superset.
  private appendResponseFile(response: Record<string, unknown>): void {
    const respFile = join(this.distDir, '..', 'responses.json');
    try {
      let arr: unknown[] = [];
      if (existsSync(respFile)) {
        const parsed = JSON.parse(readFileSync(respFile, 'utf-8'));
        if (Array.isArray(parsed)) arr = parsed;
      }
      arr.push(response);
      writeFileSync(respFile, JSON.stringify(arr));
    } catch {}
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
