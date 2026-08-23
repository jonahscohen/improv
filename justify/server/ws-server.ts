import { WebSocketServer, WebSocket } from 'ws';
import { createServer, type Server as HttpServer, type IncomingMessage, type ServerResponse } from 'http';
import { createServer as createHttpsServer, type Server as HttpsServer } from 'https';
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import { execFile, execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { ConnectionManager } from './connection-manager.js';
import type { JsonRpcRequest, JsonRpcResponse, JsonRpcMessage } from './types.js';
import type { WatchStateStore } from './watch-state.js';
import { DisarmConsentStore, ConsentStore, modeConsentPath } from './consent.js';
import { parseGitDiff, type FileDiff } from './parse-git-diff.js';

type MessageHandler = (connectionId: string, params: Record<string, unknown> | undefined) => unknown | Promise<unknown>;

// The dispatcher surface ws-server needs: kick it after an arm, read its status.
// Kept as a local interface so ws-server does not hard-import the Dispatcher.
interface DispatcherLike {
  kick(): void;
  status(): Record<string, unknown>;
  setHeadless(headless: boolean): void;
}

export class WsServer {
  private wss: WebSocketServer | null = null;
  private httpServer: HttpServer | null = null;
  private httpsServer: HttpsServer | null = null;
  private manager = new ConnectionManager();
  private handlers = new Map<string, MessageHandler>();
  private port: number | null = null;
  private httpsPort: number | null = null;
  private distDir: string;
  private stateDir: string;
  private lastPromptPoll: number = 0;
  private lastMcpActivity: number = 0;
  private watchSessionActive: boolean = false;
  private watchStore: WatchStateStore | null = null;
  private dispatcher: DispatcherLike | null = null;
  // Single-use human consent for disarming. Lazily created so tests can point it
  // at a temp dir via JUSTIFY_STATE_DIR.
  private consent: DisarmConsentStore = new DisarmConsentStore();
  // Consent to ENABLE headless dispatch. A separate token file from the disarm
  // consent above, so neither grant can be replayed as the other.
  private modeConsent: ConsentStore = new ConsentStore(modeConsentPath());

  constructor() {
    const serverDir = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url));
    this.distDir = join(serverDir, '..');
    // Data files (prompts.json, responses.json) live at the install root
    // (dist/..). JUSTIFY_STATE_DIR overrides this so a test daemon can isolate
    // its queue from the live one.
    this.stateDir = process.env.JUSTIFY_STATE_DIR || join(this.distDir, '..');
  }

  // Wire the daemon-owned watch (state store + dispatcher) into the HTTP layer.
  // Called once at boot by index.ts. Tests that `new WsServer()` without this
  // keep the legacy session-active watch-status behavior.
  attachWatch(store: WatchStateStore, dispatcher: DispatcherLike): void {
    this.watchStore = store;
    this.dispatcher = dispatcher;
  }

  private dataFile(name: string): string {
    return join(this.stateDir, name);
  }

  // Temp + rename, matching Dispatcher.writePrompts. prompts.json carries claim
  // ownership and the live queue; a torn write here loses the user's changes.
  // Returns false on failure so the caller can fall back to serving what it read
  // rather than reporting a stamp that never landed.
  private writeJsonAtomic(path: string, value: unknown): boolean {
    try {
      const tmp = `${path}.tmp.${process.pid}.${Date.now()}`;
      writeFileSync(tmp, JSON.stringify(value));
      renameSync(tmp, path);
      return true;
    } catch (err) {
      process.stderr.write(`[justify] atomic write failed for ${path}: ${err instanceof Error ? err.message : err}\n`);
      return false;
    }
  }

  // Disarm the daemon watch from a non-HTTP caller (the justify_end_watch MCP
  // tool's "stop watching" path). Reports whether a store was attached and
  // whether the disarm durably persisted, so the caller does not claim success on
  // a persist failure.
  //
  // This path is reachable by an AGENT (an MCP tool call), so it is consent-gated
  // exactly like POST /watch/disarm: it must present a live single-use token that
  // only a human at a TTY can mint. Without one it refuses and the watch keeps
  // running. Before 2026-07-09 this called disarm() unguarded, which is how an
  // agent turned Jonah's watch off without asking.
  disarmWatch(by: string, consentToken?: string | null): {
    available: boolean;
    persisted: boolean;
    refused?: boolean;
    reason?: string;
  } {
    if (!this.watchStore) return { available: false, persisted: false };

    const verdict = this.consent.verifyAndConsume(consentToken);
    if (!verdict.ok) {
      process.stderr.write(`[justify] REFUSED disarmWatch by "${by}" (${verdict.reason}). The watch stays armed.\n`);
      return { available: true, persisted: false, refused: true, reason: verdict.reason };
    }

    const state = this.watchStore.disarm(by, { granted: true });
    if (state.refused) return { available: true, persisted: false, refused: true, reason: state.reason };
    return { available: true, persisted: state.persisted, refused: false };
  }

  isWatchArmed(): boolean {
    return this.watchStore ? this.watchStore.isArmed() : false;
  }

  // Has a legacy HTTP owner - a curl listen loop polling GET /prompts - been alive
  // in the last `withinMs`?
  //
  // This exists because GET /prompts is a PEEK, not a claim: it never writes
  // `claimedBy`. So an owner that polls, gets prompt P, and starts applying it has
  // taken no durable lock, and a headless dispatcher would happily claim P and
  // apply it a SECOND time. The claim path (POST /prompts/claim) is the real mutex
  // and the SKILL mandates it, but a legacy loop that skips it must not be able to
  // cause a double-apply of the user's source.
  //
  // The browser core does NOT poll this endpoint (checked: only a curl owner
  // does), so on the unattended machine that headless mode exists for, this is
  // always false and dispatch proceeds immediately.
  httpOwnerActive(withinMs: number): boolean {
    if (!this.lastPromptPoll) return false;
    return Date.now() - this.lastPromptPoll < withinMs;
  }

  async start(preferredPort: number): Promise<number> {
    // Step by 2: a successful bind claims `candidate` for http AND `candidate+1`
    // for https. Scanning by 1 made the fallback collide with our OWN https
    // listener (EADDRINUSE on the second attempt).
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = preferredPort + attempt * 2;
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

      // `ws` attaches its own 'error' listener to the http server and RE-EMITS the
      // error on the WebSocketServer. An EventEmitter with no 'error' listener
      // throws, so a plain EADDRINUSE during the port scan became an UNCAUGHT
      // EXCEPTION instead of a handled rejection - which is why the fallback
      // never ran. Absorb it here; the authoritative handler is onError below.
      wss.on('error', () => {});

      const onListening = () => {
        httpServer.removeListener('error', onError);
        this.httpServer = httpServer;
        this.wss = wss;
        this.attachConnectionHandler();
        resolve(port);
      };

      const onError = (err: Error) => {
        httpServer.removeListener('listening', onListening);
        // Tear the half-built listener down, or every failed port attempt leaks a
        // WebSocketServer. Two sharp edges here:
        //   - a bare close() on a server that never listened emits ANOTHER
        //     'error' (ERR_SERVER_NOT_RUNNING). Our once('error') is already
        //     spent, so that second event became an UNCAUGHT EXCEPTION and killed
        //     the port scan. Pass a callback: close(cb) delivers the error to cb
        //     instead of emitting it.
        //   - keep a no-op 'error' listener on the dead server for the same
        //     reason: nothing else is listening for it now.
        httpServer.on('error', () => {});
        try {
          wss.close();
        } catch {
          /* already dead */
        }
        httpServer.close(() => {});
        reject(err);
      };

      httpServer.once('listening', onListening);
      httpServer.once('error', onError);

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
        try {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(this.readResponses()));
        } catch { res.end('[]'); }
        return;
      }
      if (req.method === 'POST' && req.url === '/responses') {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          const respFile = this.dataFile('responses.json');
          // Filter through the tombstones before writing. A client that lost its
          // clear-write and then posts a stale full array cannot re-add a cleared
          // entry, which is the resurrection Jonah reported on 2026-07-31.
          try {
            const parsed = JSON.parse(body);
            const arr = Array.isArray(parsed) ? this.dropCleared(parsed) : parsed;
            writeFileSync(respFile, JSON.stringify(arr));
          } catch {
            try { writeFileSync(respFile, body); } catch {}
          }
          res.end('ok');
        });
        return;
      }
      // Clear is a SERVER-AUTHORITATIVE tombstone, not a client read-modify-write.
      // The client used to clear by posting the survivors, so if that write was
      // lost - and a completed task reloads the page 1200ms later, which discards
      // any request still in flight - the next GET served the stale file and every
      // cleared task came back. Tombstones make that impossible: an id recorded
      // here can never be served or appended again, whatever a later write says.
      if (req.method === 'POST' && req.url === '/responses/clear') {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body || '{}');
            const ids: string[] = Array.isArray(parsed?.ids) ? parsed.ids.map(String) : [];
            this.addTombstones(ids);
            const kept = this.dropCleared(this.readResponsesRaw());
            writeFileSync(this.dataFile('responses.json'), JSON.stringify(kept));
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, cleared: ids.length, remaining: kept.length }));
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
          }
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
            // Build + broadcast + headless-persist + respondedAt stamp all live in
            // the shared emitResponse helper now, so this HTTP path and the
            // justify_respond MCP tool cannot drift apart.
            this.emitResponse(data);
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
        const promptFile = this.dataFile('prompts.json');
        try {
          if (existsSync(promptFile)) {
            const content = readFileSync(promptFile, 'utf-8');
            // THIS POLL BROADCASTS NOTHING. A GET IS A READ, NOT A CLAIM.
            //
            // It used to fire `justify_working` for every pending prompt, which
            // drove the browser pill "Sending to Claude." -> "Working". That was a
            // lie, and once the bar gained a real `queued` state it became an
            // actively harmful one: ANY read of this endpoint - a heartbeat, a
            // second owner, a human running `curl :9223/prompts` to look at the
            // queue - announced that work had started on a prompt that is still
            // sitting UNCLAIMED. An owner that polls and then dies before claiming
            // left the bar parked on "Working" forever, describing a worker that
            // does not exist.
            //
            // The honest trigger for "Working" is the owner TAKING the work, which
            // is POST /prompts/claim (it broadcasts there now), or the dispatcher
            // spawning a worker, or an explicit POST /working. All three are real
            // events. A peek is not. Flagged by an adversarial Codex review,
            // 2026-07-12, against exactly the compat shim I had left in place here.
            //
            // The same "a poll is not a claim" truth is why servedToOwnerAt exists
            // below: reading a prompt takes no lock, so headless must be told that
            // an HTTP owner is probably applying it, or it would double-apply.
            let served = content;
            try {
              const parsed = JSON.parse(content);
              if (Array.isArray(parsed) && parsed.length > 0) {
                let changed = false;

                // The per-task diff baseline is captured at prompt CREATION
                // (mcp-tools push_prompt -> captureCurrentDiffBase), not here: that
                // is the earliest pre-edit point and the one every processing path
                // shares, so no baseline capture is needed on this hot poll path.

                // Stamp what we just handed to an HTTP owner, so the dispatcher can
                // SEE that someone is (probably) applying it and stand down. A poll
                // is not a claim, so without this the prompt still looks claimable
                // and headless would apply it a second time - writing the same edit
                // into the user's source twice.
                //
                // ONLY in headless mode. In owner mode the dispatcher never claims
                // anything, so there is nothing to protect against, and this stamp
                // stays byte-for-byte what it has always been - no new writes on the
                // hot poll path that the interactive flow depends on.
                //
                // The stamp goes STALE (dispatcher.isClaimable honors claimTtlMs),
                // so an owner that polls once and dies does not wedge the queue
                // forever: the prompt becomes claimable again and is re-dispatched.
                // That is the same recovery contract a dead worker's claim gets.
                if (this.dispatcher?.status().headless === true) {
                  const now = Date.now();
                  for (const p of parsed) {
                    // Do not rewrite the file on every 2s poll; refresh at most
                    // every 5s. Still far tighter than any claim TTL.
                    if (!p.servedToOwnerAt || now - p.servedToOwnerAt > 5000) {
                      p.servedToOwnerAt = now;
                      changed = true;
                    }
                  }
                }

                if (changed && this.writeJsonAtomic(promptFile, parsed)) {
                  served = JSON.stringify(parsed);
                }
              }
            } catch {}
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(served);
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
        const promptFile = this.dataFile('prompts.json');
        let pendingCount = 0;
        // How many of those pending prompts an owner has actually CLAIMED.
        //
        // The browser needs this to tell "waiting for an owner to pick it up"
        // (Queued for Claude) from "an owner has it and is applying it" (Working)
        // after a reload - and it must not learn it from GET /prompts. That
        // endpoint stamps lastPromptPoll, which httpOwnerActive() reads to decide
        // an HTTP owner is attached; a browser polling it would make the headless
        // dispatcher stand down forever, believing a curl owner was on the job.
        // The browser core deliberately never touches /prompts. So the count comes
        // out on the status endpoint it already polls.
        let claimedCount = 0;
        try {
          if (existsSync(promptFile)) {
            const parsed = JSON.parse(readFileSync(promptFile, 'utf-8'));
            pendingCount = parsed.length;
            claimedCount = parsed.filter(
              (p: Record<string, unknown>) => typeof p.claimedBy === 'string',
            ).length;
          }
        } catch {}
        // TRUTHFUL UI: the watch is ARMED on the daemon, independent of any
        // session. `active` is true whenever the daemon watch is armed - that is
        // what "Claude is connected" now means (the daemon is watching and will
        // dispatch a worker), even with zero live sessions. The legacy
        // session-active heuristic (recent /prompts polling) is kept as a
        // fallback for an un-armed daemon so an interactive listen loop still
        // reads as connected.
        const hasWatchStore = this.watchStore !== null;
        const armed = hasWatchStore ? this.watchStore!.isArmed() : false;
        // When this daemon OWNS the watch (store attached), `active` tracks the
        // armed state EXACTLY - armed = connected, disarmed = off, immediately.
        //
        // The legacy (un-owned daemon) path used to AND this with a 30-second
        // "recent MCP activity" window, so a session that had been quietly
        // waiting for 31 seconds was reported as not watching. That is a clock
        // turning the watch off, which is precisely what is forbidden: a watcher
        // that is waiting IS watching, and it may wait for hours. The session
        // flag alone is the truth, and it is cleared by an explicit end-watch.
        const active = hasWatchStore ? armed : this.watchSessionActive;
        // `workerRunning` exists so the browser can tell "nobody heard me" from
        // "the daemon is working on it". A `claude -p` worker routinely takes
        // MINUTES (it boots a full MCP stack), while the claudebar used to give up
        // after 60 seconds and show "Retry Send" over a perfectly healthy apply.
        // Hitting Retry then double-queues the same change. 2026-07-09, Jonah.
        const dispatch = this.dispatcher ? this.dispatcher.status() : null;
        const workerRunning = dispatch ? dispatch.workerRunning === true : false;
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({
          active,
          armed,
          session: this.watchSessionActive,
          lastActivity: this.lastMcpActivity,
          pendingCount,
          claimedCount,
          workerRunning,
          // True when the daemon has the user's work in hand. The browser must not
          // offer "Retry Send" while this is true.
          busy: armed && (workerRunning || pendingCount > 0),
        }));
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
          const promptFile = this.dataFile('prompts.json');
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

      // ---- Daemon-owned watch: arm / disarm / state -------------------------
      // Arming records the project root the daemon dispatches workers against
      // and persists armed=true so a daemon restart resumes armed. Disarm is the
      // ONLY thing (besides another explicit user disarm) that stops dispatch.
      if (req.method === 'POST' && req.url === '/watch/arm') {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          if (!this.watchStore) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'watch not available on this daemon' }));
            return;
          }
          let projectRoot: string | null = null;
          let by: string | null = null;
          try {
            if (body.trim()) {
              const parsed = JSON.parse(body);
              if (typeof parsed?.projectRoot === 'string') projectRoot = parsed.projectRoot;
              if (typeof parsed?.by === 'string') by = parsed.by;
            }
          } catch {}
          const state = this.watchStore.arm(projectRoot, by);
          if (!state.persisted) {
            // Fail LOUD: an arm that did not durably persist must not report OK
            // (it would silently disarm on the next daemon restart).
            res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ ok: false, error: 'watch-state persist failed', ...state }));
            return;
          }
          // Kick the dispatcher so any already-queued batch dispatches now.
          if (this.dispatcher) { try { this.dispatcher.kick(); } catch {} }
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ ok: true, ...state }));
        });
        return;
      }

      // NOTE: there is deliberately NO mint endpoint for headless consent.
      //
      // The first cut of this had a POST /watch/mode/consent that handed a token
      // to any caller, which made the whole gate theater: a hostile page could
      // mint a token with a CORS simple request, read it, and immediately spend it
      // on /watch/mode. A gate whose key is available at the gate is not a gate.
      // (Caught in adversarial review, 2026-07-12.)
      //
      // Instead, `justify-serve --headless` WRITES the consent token to
      // mode-consent.json (0600) in the state dir after a human types ENABLE at a
      // TTY, and then presents it here. The grant therefore requires WRITE ACCESS
      // TO THE STATE DIRECTORY, which a web page can never have. A local process
      // running as the user could forge it - but that process could already edit
      // watch-state.json or run `claude` itself, so it is not a boundary we are
      // pretending to hold. The boundary that matters (the browser) is closed.

      // Set the dispatch mode: who APPLIES a queued batch.
      //   {"headless": true}  -> the daemon spawns justify-worker.sh itself
      //   {"headless": false} -> OWNER mode (default): the batch waits, unclaimed,
      //                          for the attached owner to claim and apply
      //
      // The mode persists to watch-state.json, so it survives the daemon restarts
      // that `justify-serve --restart` performs - the difference between a switch
      // that works and the env-only JUSTIFY_HEADLESS that could never hold.
      //
      // ASYMMETRIC GATE (2026-07-12, from an adversarial review of this endpoint):
      // ENABLING headless is consent-gated; DISABLING is not. Turning headless ON
      // grants the daemon autonomous execution - it will spawn `claude -p
      // --permission-mode bypassPermissions` in the armed project root with no
      // human attached. An unauthenticated localhost POST is reachable from any
      // local process, and from a web page using a CORS "simple request"
      // (text/plain body, no preflight), so leaving the ON direction open would
      // let a hostile page turn a passive daemon into one that writes code. That
      // is a different risk class from /watch/arm, and it gets the same TTY-human
      // consent that /watch/disarm requires. Turning headless OFF returns the
      // daemon to the safe default and never needs a token - a caller must always
      // be able to reach for the brake.
      if (req.method === 'POST' && req.url === '/watch/mode') {
        // NOT A BROWSER ENDPOINT. handleHttpRequest sets
        // Access-Control-Allow-Origin: * globally (the browser core needs it for
        // the other routes), which means a hostile page can reach this one too. A
        // page cannot ENABLE headless - that needs the on-disk token it can never
        // read - but it could POST {"headless":false} and shove an unattended
        // headless daemon back into owner mode, where nothing gets applied and the
        // queue silently piles up. That is a denial of the tool.
        //
        // Only a real browser attaches an Origin header. curl and the CLI do not.
        // So: any request carrying an Origin is a page, and pages have no business
        // changing the dispatch mode, in either direction.
        if (req.headers.origin) {
          process.stderr.write(
            `[justify] REFUSED /watch/mode from a browser origin (${req.headers.origin}). Mode unchanged.\n`,
          );
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            ok: false,
            refused: true,
            error: 'the dispatch mode cannot be changed from a browser; use justify-serve --headless/--owner',
          }));
          return;
        }
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          if (!this.watchStore || !this.dispatcher) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'watch not available on this daemon' }));
            return;
          }
          let headless: boolean | null = null;
          let consentToken: string | null = null;
          try {
            if (body.trim()) {
              const parsed = JSON.parse(body);
              if (typeof parsed?.headless === 'boolean') headless = parsed.headless;
              if (typeof parsed?.consentToken === 'string') consentToken = parsed.consentToken;
            }
          } catch {}
          if (headless === null) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'body must be {"headless": true|false}' }));
            return;
          }

          if (headless === true) {
            const verdict = this.modeConsent.verifyAndConsume(consentToken);
            if (!verdict.ok) {
              process.stderr.write(
                `[justify] REFUSED enabling HEADLESS dispatch (${verdict.reason}) - no human consent. Mode unchanged.\n`,
              );
              res.writeHead(403, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                ok: false,
                refused: true,
                reason: verdict.reason,
                error: 'enabling headless dispatch requires human consent: run `justify-serve --headless` at a TTY',
              }));
              return;
            }
          }

          const state = this.watchStore.setHeadless(headless);
          if (!state.persisted) {
            // Fail LOUD, same as /watch/arm: a mode that did not durably persist
            // must not report OK - it would silently revert on the next restart.
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'watch-state persist failed', ...state }));
            return;
          }
          // Apply to the LIVE dispatcher too, so the mode takes effect now rather
          // than only after the next daemon restart.
          try { this.dispatcher.setHeadless(headless); this.dispatcher.kick(); } catch {}
          process.stderr.write(`[justify] dispatch mode set to ${headless ? 'HEADLESS' : 'OWNER'}\n`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, ...state }));
        });
        return;
      }

      // Mint a single-use disarm consent token. Called ONLY by
      // `justify-watch-disarm` after a human, at a TTY, types the confirmation
      // phrase. Issuing a token does not disarm anything on its own; it is
      // worthless without the immediately-following POST /watch/disarm, expires
      // in ~2 minutes, and is destroyed on first use.
      if (req.method === 'POST' && req.url === '/watch/consent') {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          let by: string | null = null;
          try {
            if (body.trim()) {
              const parsed = JSON.parse(body);
              if (typeof parsed?.by === 'string') by = parsed.by;
            }
          } catch {}
          const issued = this.consent.issue(by);
          process.stderr.write(`[justify] disarm consent issued to "${by ?? 'unknown'}" (expires in ${Math.round((issued.expiresAt - issued.issuedAt) / 1000)}s)\n`);
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ ok: true, token: issued.token, expiresAt: issued.expiresAt }));
        });
        return;
      }

      if (req.method === 'POST' && req.url === '/watch/disarm') {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          if (!this.watchStore) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'watch not available on this daemon' }));
            return;
          }
          let by: string | null = null;
          let consentToken: string | null = null;
          try {
            if (body.trim()) {
              const parsed = JSON.parse(body);
              if (typeof parsed?.by === 'string') by = parsed.by;
              if (typeof parsed?.consentToken === 'string') consentToken = parsed.consentToken;
            }
          } catch {}

          // Turning the watch off is the one action that makes Justify silently
          // stop receiving the user's changes. It requires a live, single-use
          // token that only a human at a TTY can mint (justify-watch-disarm).
          const verdict = this.consent.verifyAndConsume(consentToken);
          if (!verdict.ok) {
            process.stderr.write(
              `[justify] REFUSED /watch/disarm by "${by ?? 'unknown'}" (${verdict.reason}). The watch stays armed.\n`,
            );
            res.writeHead(403, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({
              ok: false,
              error: verdict.reason,
              armed: this.watchStore.isArmed(),
              how: 'A human must run `justify-watch-disarm` in a terminal and confirm. Agents cannot disarm the watch.',
            }));
            return;
          }

          const state = this.watchStore.disarm(by, { granted: true });
          if (state.refused) {
            res.writeHead(403, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ ok: false, error: state.reason, ...state }));
            return;
          }
          if (!state.persisted) {
            res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ ok: false, error: 'watch-state persist failed', ...state }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ ok: true, ...state }));
        });
        return;
      }

      if (req.method === 'GET' && req.url === '/watch/state') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        if (!this.watchStore) {
          res.end(JSON.stringify({ armed: false, available: false }));
          return;
        }
        const state = this.watchStore.get();
        const dispatch = this.dispatcher ? this.dispatcher.status() : null;
        res.end(JSON.stringify({ available: true, ...state, dispatch }));
        return;
      }

      // Atomic claim: assign every unclaimed-or-stale prompt to `by` so an
      // interactive session and the daemon dispatcher never double-apply the same
      // batch. Returns the prompts claimed by this call. A claim goes stale after
      // ttlMs (default 120s) and becomes reclaimable.
      if (req.method === 'POST' && req.url === '/prompts/claim') {
        this.lastMcpActivity = Date.now();
        this.watchSessionActive = true;
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          let by = 'interactive';
          // Server-side staleness floor: a claim is only stealable once it is
          // older than JUSTIFY_CLAIM_TTL_MS (default 30 min, chosen to EXCEED the
          // worker's max lifetime). A caller may only ask for a LONGER hold, never
          // a shorter one - otherwise an interactive claim with a tiny ttl could
          // steal a still-running daemon worker's fresh claim (double-apply).
          const floorTtlMs = Number(process.env.JUSTIFY_CLAIM_TTL_MS) || 1800000;
          let ttlMs = floorTtlMs;
          try {
            if (body.trim()) {
              const parsed = JSON.parse(body);
              if (typeof parsed?.by === 'string' && parsed.by.trim()) by = parsed.by.trim();
              if (Number.isFinite(parsed?.ttlMs) && parsed.ttlMs > floorTtlMs) ttlMs = Math.floor(parsed.ttlMs);
            }
          } catch {}
          const now = Date.now();
          const prompts = this.readPromptsFile();
          const claimed: Array<Record<string, unknown>> = [];
          for (const p of prompts) {
            const cb = p.claimedBy as string | undefined;
            const ca = p.claimedAt as number | undefined;
            const claimable = !cb || !ca || (now - ca > ttlMs);
            if (claimable) {
              (p as Record<string, unknown>).claimedBy = by;
              (p as Record<string, unknown>).claimedAt = now;
              claimed.push(p);
            }
          }
          // Atomic write + fail-report: a caller must never believe it claimed
          // prompts that did not durably land on disk (it could then process a
          // prompt the daemon also dispatches).
          let wrote = false;
          try {
            const pf = this.dataFile('prompts.json');
            const tmp = `${pf}.tmp.${process.pid}.${Date.now()}`;
            writeFileSync(tmp, JSON.stringify(prompts));
            renameSync(tmp, pf);
            wrote = true;
          } catch {}
          if (!wrote) {
            res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ ok: false, error: 'claim write failed', claimed: [] }));
            return;
          }
          // A CLAIM IS THE OWNER TAKING THE WORK. That is the honest trigger for
          // "Working" in owner mode, and it does not depend on the owner
          // REMEMBERING to also POST /working - which the justify SKILL never told
          // it to do, and which is why the bar's forward motion was unreliable
          // whenever the daemon was not the one applying the batch.
          //
          // Only fires when a claim actually landed on disk (wrote === true, above)
          // and something was really claimed - never on a no-op claim of an empty
          // queue, which would flash "Working" at a user with nothing in flight.
          //
          // GATED (`justify_working`), NOT forced. A broadcast reaches EVERY client,
          // and the forced variant moves a bar out of ANY state. A second tab that
          // is sitting on "Review Changes" (or showing nothing at all) has no work
          // in flight, and must not be dragged into "Working" because a batch sent
          // from another tab got claimed. The gated event advances only a client
          // that is actually waiting - 'sending' or 'queued' - and is a no-op
          // everywhere else. A browser that reconnected mid-flight is restored to
          // 'queued' by _loadClaudeState, so it is still reachable by this event
          // and does not need the force. POST /working stays ungated on purpose:
          // that one is an operator explicitly overriding the bar.
          if (claimed.length > 0) {
            this.broadcastToClients('justify_working', { timestamp: Date.now() });
          }
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ ok: true, claimed }));
        });
        return;
      }

      if (req.method === 'GET' && req.url === '/status') {
        // `watchArmed` alone is not the truth: armed-but-not-dispatching, or
        // armed-with-a-stalled-queue, both mean the user's changes are NOT being
        // received. Surface those so no caller can render a green light over a
        // dead watch.
        const dispatch = this.dispatcher ? this.dispatcher.status() : null;
        const armed = this.watchStore ? this.watchStore.isArmed() : false;
        const dispatcherRunning = dispatch ? dispatch.dispatcherRunning === true : false;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          server: 'justify',
          port: this.port,
          connections: this.manager.size(),
          watchArmed: armed,
          projectRoot: this.watchStore ? this.watchStore.projectRoot() : null,
          dispatcherRunning,
          // True only when the watch is armed AND the loop that acts on it is
          // alive. This is the field a UI should trust.
          watching: armed && dispatcherRunning,
          pendingCount: dispatch ? dispatch.pendingCount : 0,
          stalled: dispatch ? dispatch.stalled === true : false,
          // WHICH MODE. Without this, `watching:true` reads identically whether
          // the daemon will apply a queued batch itself or will never touch it -
          // and a caller cannot tell a working watch from one that is silently
          // waiting for an owner who does not exist. `autoApply` is the question
          // every caller is actually asking: will this batch get applied if no
          // session is attached?
          headless: dispatch ? dispatch.headless === true : false,
          autoApply: armed && dispatcherRunning && (dispatch ? dispatch.headless === true : false),
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

        // RE-ASSERT current status to THIS client the instant it connects -
        // fresh tab, or a reconnect after a dropped socket. Without this, a
        // browser that (re)connects while a prompt is pending had no way to
        // learn that except the 5s /watch-status poll or the one-shot,
        // watch-gated _loadClaudeState() fetch chain - both client-side pulls
        // with a real delay window during which the bar reads "Connected" for
        // a request that is not dead, just not yet reflected. This makes the
        // daemon the one to PUSH the truth, on receipt of the connection, with
        // no polling delay and no dependency on any client timer. See
        // reassertStatusToClient below.
        this.reassertStatusToClient(connectionId);

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

  // Same wire shape as broadcastToClients, but targeted at exactly one
  // connection - used for the on-connect status re-assert below, so a fresh
  // connection gets the current truth without re-notifying every already-synced
  // client.
  sendToClient(connectionId: string, method: string, params?: Record<string, unknown>): void {
    const conn = this.manager.get(connectionId);
    if (!conn) return;
    try {
      conn.send({ jsonrpc: '2.0', id: 0, method, params });
    } catch {}
  }

  // Tell a just-(re)connected client what the daemon actually knows RIGHT NOW,
  // instead of leaving it to discover that on the next poll. `prompts.json` is
  // the daemon's own durable truth (not a client-reported label), so this can
  // never assert something the daemon has not itself observed:
  //   - no pending prompts at all -> say nothing; 'connected'/'none' is correct.
  //   - a pending, UNCLAIMED prompt -> justify_queued (durable, no owner yet).
  //   - a pending, CLAIMED prompt -> justify_working, upgraded to
  //     justify_validating if the browser's own last-reported label (persisted
  //     via POST /claude-state) says validating - the daemon has no first-class
  //     "validating" flag on the prompt record itself, only claimedBy/claimedAt,
  //     so this is a best-effort refinement, not the source of truth.
  // The client-side handlers for all three events are advance-only (see
  // core/index.ts _claudeStateBehind / justify_validating), so this can never
  // drag a client that is already ahead (mid-review, etc.) backwards.
  private reassertStatusToClient(connectionId: string): void {
    const pending = this.readPromptsFile();
    if (pending.length === 0) return;

    const claimed = pending.some((p) => typeof (p as Record<string, unknown>).claimedBy === 'string');
    const promptId = pending[0].id;

    if (!claimed) {
      this.sendToClient(connectionId, 'justify_queued', { promptId, timestamp: Date.now() });
      return;
    }

    let method = 'justify_working';
    try {
      const statePath = join(this.distDir, 'claude-state.json');
      if (existsSync(statePath)) {
        const raw = JSON.parse(readFileSync(statePath, 'utf-8'));
        if (raw?.state === 'validating') method = 'justify_validating';
      }
    } catch {}
    this.sendToClient(connectionId, method, { promptId, timestamp: Date.now() });
  }

  getConnections() {
    return this.manager.getAll();
  }

  // Prompt queue lives at <install-root>/prompts.json (same file the MCP layer
  // writes via push_prompt). Tolerant read for the id-aware clear and the
  // /respond -> targetSelectors join.
  private readPromptsFile(): Array<{ id: string; selectors?: string[]; [k: string]: unknown }> {
    const promptFile = this.dataFile('prompts.json');
    try {
      if (!existsSync(promptFile)) return [];
      const parsed = JSON.parse(readFileSync(promptFile, 'utf-8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  // Per-task diff baseline (Jonah 2026-08-22, "snapshot before each change").
  // Capture the working tree as a commit object WITHOUT touching the tree or index
  // (`git stash create` returns a commit sha for the current WIP; empty when the
  // tree is clean, in which case HEAD is the baseline). Taken when a prompt is first
  // handed to a processor - i.e. BEFORE the edit - so a later `git diff <base>`
  // isolates exactly this task's change even in a repo whose whole app sits
  // uncommitted on a bare initial commit. Returns null when the root is not a git
  // repo, so capture silently no-ops rather than throwing on the serve path.
  private captureDiffBase(root: string): string | null {
    try {
      const wip = execFileSync('git', ['-C', root, 'stash', 'create'], {
        encoding: 'utf-8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      if (wip) return wip;
      // Clean tree: diff against HEAD instead.
      return execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {
        encoding: 'utf-8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'],
      }).trim() || null;
    } catch {
      return null;
    }
  }

  // Public: snapshot the armed project's working tree NOW as a per-task baseline.
  // Called at prompt CREATION (mcp-tools push_prompt) - the earliest pre-edit moment,
  // and the ONE point every processing path (owner GET/claim, MCP get_prompts, the
  // headless dispatcher) funnels through, so the baseline is present no matter who
  // works the prompt. Returns null when no project is armed or it is not a git repo.
  captureCurrentDiffBase(): string | null {
    const root = this.watchStore?.projectRoot() || null;
    return root ? this.captureDiffBase(root) : null;
  }

  // Diff the current working tree against a captured baseline, scoped to the task's
  // files, and parse into the panel's hunk shape. Scoping to `files` keeps other
  // pending edits out; an empty/failed diff yields [] (the panel then just shows the
  // filename, as before). Never throws.
  private computeTaskDiff(root: string, base: string, files: string[]): FileDiff[] {
    try {
      const args = ['-C', root, 'diff', base, '--'];
      for (const f of files) if (typeof f === 'string' && f) args.push(f);
      if (args.length === 4) return []; // no valid files to scope to
      const out = execFileSync('git', args, {
        encoding: 'utf-8', timeout: 8000, maxBuffer: 8 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      return parseGitDiff(out);
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
    const respFile = this.dataFile('responses.json');
    try {
      // dropCleared on the BASE array, not just the appended entry: this path
      // reads whatever is on disk and writes it back, so without the filter a
      // single append re-persists every stale entry sitting in the file.
      const arr = this.dropCleared(this.readResponsesRaw());
      if (!this.isCleared(response)) arr.push(response);
      writeFileSync(respFile, JSON.stringify(arr));
    } catch {}
  }

  // The ONE place a Justify result is turned into a wire message, persisted for a
  // reconnecting tab, and stamped onto its originating prompt. Both respond paths
  // (POST /respond and the justify_respond MCP tool) route through here so the MCP
  // path is as durable and complete as the HTTP path: headless persist when no
  // client is connected, targetSelectors joined from the original prompt, and the
  // respondedAt stamp that lets a sweep tell a finished task from a still-open one.
  emitResponse(input: {
    promptId: string;
    summary?: string;
    filesChanged?: string[];
    changes?: unknown[];
    diffs?: unknown[];
    targetSelectors?: string[];
    pageUrl?: string;
    status?: 'completed' | 'needsInfo' | 'failed';
    question?: string;
  }): void {
    // A result must always be visually locatable. The submit payload records which
    // DOM element(s) the prompt was about; join the original prompt by promptId and
    // carry its selectors onto the response so clicking the Changes entry can scroll
    // to + select the target even for diff-only responses with no per-change
    // selectors. An explicit targetSelectors on the input wins if given.
    let targetSelectors: string[] = Array.isArray(input.targetSelectors) ? input.targetSelectors : [];
    // Cross-page highlight (Jonah 2026-08-20): carry the prompt's authoring page onto
    // the response so the Review entry can navigate-then-highlight on click. An
    // explicit input.pageUrl wins; otherwise join it from the original prompt by id
    // - the SAME lookup that joins targetSelectors, so both come from one read.
    let pageUrl = typeof input.pageUrl === 'string' ? input.pageUrl : '';
    // Resolve the originating prompt ONCE: it carries selectors, pageUrl, and the
    // per-task diff baseline (captured when the prompt was served, before the edit).
    const orig = input.promptId
      ? this.readPromptsFile().find((p) => p.id === input.promptId)
      : undefined;
    if (orig) {
      if (targetSelectors.length === 0 && Array.isArray((orig as { selectors?: string[] }).selectors)) {
        targetSelectors = (orig as { selectors?: string[] }).selectors as string[];
      }
      if (!pageUrl && typeof (orig as { pageUrl?: string }).pageUrl === 'string') {
        pageUrl = (orig as { pageUrl?: string }).pageUrl as string;
      }
    }

    // Diffs: an explicit array on the input wins (justify-done may pass a pre-parsed
    // diff, or JUSTIFY_DIFF was set). Otherwise compute one NOW from the prompt's
    // captured baseline + the reported files, so a real line-by-line diff reaches the
    // panel GUARANTEED by the daemon - not dependent on the agent remembering to pass
    // it. Empty when there is no baseline/files/root, in which case the panel shows
    // just the filename as before. (Jonah 2026-08-22, "snapshot before each change".)
    let diffs: unknown[] = Array.isArray(input.diffs) ? input.diffs : [];
    if (diffs.length === 0) {
      const diffRoot = this.watchStore?.projectRoot() || null;
      const base = orig && typeof (orig as { diffBase?: string }).diffBase === 'string'
        ? ((orig as { diffBase?: string }).diffBase as string) : '';
      const files = Array.isArray(input.filesChanged)
        ? input.filesChanged.filter((f): f is string => typeof f === 'string' && f.length > 0)
        : [];
      if (diffRoot && base && files.length > 0) {
        diffs = this.computeTaskDiff(diffRoot, base, files);
      }
    }
    const responseObj = {
      promptId: input.promptId + '-' + Date.now(),
      summary: input.summary,
      // Coerce array fields at the ingest boundary. The HTTP POST /respond path is
      // not schema-validated (unlike the justify_respond MCP tool), so a caller can
      // land a non-array here - e.g. a prose STRING in `changes` ("No change made -
      // deferred."). `x || []` only rescues null/undefined; a truthy string passes
      // through, persists, and later throws on `.map` in the browser panel, blanking
      // it. Array.isArray is the guard that actually holds. (Jonah 2026-08-22)
      filesChanged: Array.isArray(input.filesChanged) ? input.filesChanged : [],
      changes: Array.isArray(input.changes) ? input.changes : [],
      diffs,
      targetSelectors,
      pageUrl,
      status: input.status || 'completed',
      question: input.question,
      timestamp: Date.now(),
    };
    // A cleared task stays cleared even against a fresh re-emission. A clear
    // tombstones the TASK, and a re-answer (retry / reconnect / an in-flight
    // answer that lands after the clear) carries a new epoch, so isCleared still
    // matches it by base id. Suppress it at the SERVER - both the broadcast and
    // the headless persist - because a client that did the clear in another tab,
    // or in a session before a hot-refresh reload, has no in-memory record of it
    // (_clearedBaseIds is per-session) and would otherwise re-render the cleared
    // task. respondedAt is still stamped below so the prompt lifecycle/sweep sees
    // the task as finished. (Server-authoritative broadcast; both reviewers,
    // 2026-08-08.)
    if (!this.isCleared(responseObj)) {
      this.broadcastToClients('justify_response', responseObj);
      // Headless durability: if no browser is connected right now, the broadcast
      // lands nowhere and the result would be lost. The connected client is what
      // normally persists history to responses.json; with zero clients, persist
      // it here so the result surfaces in the Changes panel the moment a tab
      // (re)connects. When a client IS connected it owns the write, so we skip to
      // avoid double-appends.
      if (this.manager.size() === 0) {
        this.appendResponseFile({ ...responseObj, reviewed: false });
      }
    }
    this.stampResponded(input.promptId);
  }

  // Mark the ORIGINAL prompt (bare id) as responded so the sweep + status can tell
  // a still-open task from a finished one. tmp+rename like the claim path. Stamps
  // once (respondedAt is set only if currently null) and never throws into the
  // caller - a failed stamp must not sink a response that already broadcast.
  private stampResponded(promptId: string): void {
    try {
      const prompts = this.readPromptsFile();
      let changed = false;
      for (const p of prompts) {
        if (p.id === promptId && (p as Record<string, unknown>).respondedAt == null) {
          (p as Record<string, unknown>).respondedAt = Date.now();
          changed = true;
        }
      }
      if (!changed) return;
      const pf = this.dataFile('prompts.json');
      const tmp = `${pf}.tmp.${process.pid}.${Date.now()}`;
      writeFileSync(tmp, JSON.stringify(prompts));
      renameSync(tmp, pf);
    } catch {}
  }

  // ---- Cleared-entry tombstones -------------------------------------------
  // A cleared entry is matched at two levels:
  //   - PRECISE key  = promptId + '|' + timestamp   (one exact response entry)
  //   - TASK base id = the original prompt id, i.e. the response promptId with
  //                    its emission stamp stripped.
  //
  // Why the base id exists: emitResponse mints a response promptId as
  // `${originalPromptId}-${Date.now()}` and a SEPARATE `timestamp: Date.now()`.
  // So the SAME task answered more than once - a retry, a reconnect re-emit, or
  // an in-flight answer that lands AFTER a clear - produces a DIFFERENT precise
  // key every time. Keying the tombstone on the precise key alone therefore
  // leaks: a clear tombstones only the emission that was on screen, and the next
  // emission of that same task slips past with a fresh key, so the "cleared" task
  // reappears. That was the live resurrection Jonah reported on 2026-08-08 -
  // prompt-115 cleared at one epoch was sitting in responses.json under another.
  // A clear now tombstones the TASK: any response whose base id was cleared stays
  // gone, whatever epoch it carries. The precise key is still honored for
  // back-compat and for callers that pass raw ids.
  private entryKey(e: unknown): string {
    const r = (e || {}) as Record<string, unknown>;
    return `${String(r.promptId ?? r.id ?? '')}|${String(r.timestamp ?? '')}`;
  }

  // Strip a trailing `-<epoch>` (10+ digits) emission stamp so every answer to
  // the same original prompt collapses to one stable id. Original ids are
  // `prompt-<seq>` (a small integer), so a real prompt id is never touched.
  private baseId(promptId: string): string {
    return promptId.replace(/-\d{10,}$/, '');
  }

  private entryBaseId(e: unknown): string {
    const r = (e || {}) as Record<string, unknown>;
    return this.baseId(String(r.promptId ?? r.id ?? ''));
  }

  private readTombstones(): Set<string> {
    const f = this.dataFile('responses-cleared.json');
    try {
      if (!existsSync(f)) return new Set();
      const parsed = JSON.parse(readFileSync(f, 'utf-8'));
      return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
    } catch { return new Set(); }
  }

  // The stored tombstones PLUS the task base ids they imply. Deriving base ids at
  // read time means an install whose tombstone file predates this fix (only
  // precise keys on disk) still gets task-level protection - a stored
  // `prompt-115-<epoch>|<epoch>` implies base `prompt-115`, which then filters any
  // later `prompt-115-<other-epoch>`. `keys` is the raw stored set (used for the
  // exact-match back-compat path); `bases` is the derived task set.
  private clearedSets(): { keys: Set<string>; bases: Set<string> } {
    const keys = this.readTombstones();
    const bases = new Set<string>();
    for (const k of keys) {
      const b = this.baseId(k.split('|')[0]);
      if (b) bases.add(b); // never match on an empty base (malformed `|<ts>` id)
    }
    return { keys, bases };
  }

  private addTombstones(ids: string[]): void {
    const f = this.dataFile('responses-cleared.json');
    try {
      // Two kinds of stored tombstone: precise keys (`promptId|timestamp`) and
      // task base ids (no '|'). Precise keys can accumulate without bound on a
      // long-lived install (many emissions per task, plus stale-array reposts),
      // so they are tail-bounded. Base ids are ONE per cleared task and are the
      // durable task-level protection, so they are kept in full - bounding them
      // alongside precise keys (the earlier behavior) could evict a base while a
      // newer precise key for a DIFFERENT task survived, leaving the earliest
      // cleared tasks resurrectable after ~2500 clears. (Codex, 2026-08-08.)
      // The empty-string guard (`if (b)`) keeps a malformed `|<ts>` id from
      // tombstoning the empty base and over-clearing id-less entries.
      const bases = new Set<string>();
      const precise = new Set<string>();
      const ingest = (raw: string): void => {
        const s = String(raw);
        const b = this.baseId(s.split('|')[0]);
        if (b) bases.add(b);
        if (s.includes('|')) precise.add(s);
      };
      for (const e of this.readTombstones()) ingest(e);
      for (const id of ids) ingest(id);
      const boundedPrecise = [...precise].slice(-5000);
      writeFileSync(f, JSON.stringify([...bases, ...boundedPrecise]));
    } catch {}
  }

  private isCleared(e: unknown): boolean {
    const { keys, bases } = this.clearedSets();
    if (keys.size === 0) return false;
    return keys.has(this.entryKey(e)) || bases.has(this.entryBaseId(e));
  }

  private dropCleared(arr: unknown[]): unknown[] {
    const { keys, bases } = this.clearedSets();
    if (keys.size === 0) return arr;
    return arr.filter((e) => !keys.has(this.entryKey(e)) && !bases.has(this.entryBaseId(e)));
  }

  private readResponsesRaw(): unknown[] {
    const respFile = this.dataFile('responses.json');
    try {
      if (!existsSync(respFile)) return [];
      const parsed = JSON.parse(readFileSync(respFile, 'utf-8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  private readResponses(): unknown[] {
    return this.dropCleared(this.readResponsesRaw());
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

  // Close BOTH listeners. The https server on port+1 used to be left open here,
  // so a restarted daemon could not rebind :9224 and silently fell back to
  // http-only - which breaks the core on every https site (the https core is the
  // only one that works there). Also clears the handles so a later start() does
  // not reuse a dead server.
  stop(): Promise<void> {
    const closeServer = (srv: HttpServer | HttpsServer | null): Promise<void> =>
      new Promise((resolve) => {
        if (!srv) return resolve();
        srv.close(() => resolve());
      });

    this.wss?.close();
    const done = Promise.all([closeServer(this.httpServer), closeServer(this.httpsServer)]).then(() => undefined);
    this.wss = null;
    this.httpServer = null;
    this.httpsServer = null;
    this.port = null;
    this.httpsPort = null;
    return done;
  }
}
