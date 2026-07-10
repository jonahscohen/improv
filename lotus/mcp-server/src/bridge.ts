import http from 'node:http';

const TIMEOUT_MS = 30_000;
const PROMPT_TIMEOUT_MS = 180_000; // 3 min for AI-driven prompts

interface PendingRequest {
  resolve: (data: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface QueuedMessage {
  requestId: string;
  message: Record<string, unknown>;
}

/**
 * HTTP bridge between MCP server and Lotus UI iframe.
 *
 * Architecture:
 *   MCP Client (stdio) -> MCP Server -> HTTP -> UI Iframe -> postMessage -> Plugin Sandbox
 *
 * Endpoints:
 *   GET  /poll    - Plugin fetches pending tool-call messages (long-poll, returns immediately if queue non-empty)
 *   POST /respond - Plugin sends tool-call results back
 *   GET  /status  - Health check (used by plugin to verify connection)
 *
 * The UI iframe polls /poll via fetch(). When the MCP server queues a tool call,
 * the next poll picks it up. The plugin executes it and POSTs the result to /respond.
 */
export class FigmaBridge {
  private server: http.Server;
  private pending = new Map<string, PendingRequest>();
  private queue: QueuedMessage[] = [];
  private requestCounter = 0;
  private _isConnected = false;
  private lastPollTime = 0;
  private connectionCheckInterval: ReturnType<typeof setInterval> | undefined;
  private readonly port: number;
  // 'owner' = this process bound the port and serves the plugin directly.
  // 'proxy' = the port was already taken, so forward tool calls to the owner.
  private mode: 'owner' | 'proxy' = 'owner';
  // Guards against overlapping re-bind attempts when reclaiming a freed port.
  private reacquiring = false;
  // Set by close(); prevents a post-shutdown bind from reviving the server.
  private closed = false;

  constructor(port: number) {
    this.port = port;
    const handler = (req: http.IncomingMessage, res: http.ServerResponse) => {
      // CORS headers for Figma iframe
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      // Chromium Private Network Access: Figma's https iframe -> localhost is a
      // private-network request. Without this header the preflight is rejected
      // and the plugin's fetch never reaches the bridge (curl is unaffected).
      res.setHeader('Access-Control-Allow-Private-Network', 'true');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method === 'GET' && req.url === '/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', pending: this.queue.length }));
        return;
      }

      if (req.method === 'GET' && req.url === '/poll') {
        this.handlePoll(res);
        return;
      }

      if (req.method === 'POST' && req.url === '/respond') {
        this.handleRespond(req, res);
        return;
      }

      // Test endpoint: queue a raw plugin message and return the result
      if (req.method === 'POST' && req.url === '/exec') {
        this.handleExec(req, res);
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    };

    this.server = http.createServer(handler);

    // The bridge is constructed synchronously at MCP-server startup, so an
    // unhandled 'error' event here (e.g. EADDRINUSE when the port is already
    // held) would crash the whole process and take the stdio MCP transport down
    // with it - the server then shows up as "disconnected" in the client. Never
    // let that happen: handle the bind failure instead of crashing. On
    // EADDRINUSE another lotus bridge already owns the port (a stale orphan from
    // a previous session, or a concurrently-running Claude session), so fall
    // back to PROXY mode and forward tool calls to that bridge. The handler is
    // permanent and idempotent so it also covers re-bind attempts (reacquire()).
    this.server.on('error', (err: NodeJS.ErrnoException) => {
      this.reacquiring = false;
      if (err.code === 'EADDRINUSE') {
        this.enterProxyMode();
      } else {
        console.error('[lotus-mcp] HTTP bridge error:', err);
      }
    });

    // ONE persistent success handler, attached here rather than passed to
    // listen(). listen(port, cb) re-registers cb as a 'listening' listener on
    // every call - including the failed initial bind, whose callback lingers
    // (no 'listening' fires on EADDRINUSE) and would then double-fire on a later
    // successful reacquire. Attaching a single listener avoids that accumulation.
    this.server.on('listening', () => {
      // A bind that completes after close() (e.g. an in-flight reacquire) must
      // not revive the server or restart the watchdog - tear it back down.
      if (this.closed) { this.server.close(); return; }
      this.mode = 'owner';
      this.reacquiring = false;
      this.startConnectionCheck();
      console.error(`[lotus-mcp] HTTP bridge listening on port ${this.port}`);
    });

    this.startListening();
  }

  /** Attempt to bind the port. On success the 'listening' handler promotes us to
   *  owner; on EADDRINUSE the 'error' handler flips us to proxy mode instead of
   *  crashing. Idempotent: a no-op if we are already listening. */
  private startListening(): void {
    if (this.server.listening) { this.reacquiring = false; return; }
    this.server.listen(this.port);
  }

  /** Drop to proxy mode: forward tool calls to whoever owns the port. */
  private enterProxyMode(): void {
    this.mode = 'proxy';
    this._isConnected = false;
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = undefined;
    }
    console.error(
      `[lotus-mcp] Port ${this.port} already in use - running in PROXY mode ` +
      `(forwarding tool calls to the existing lotus bridge on ${this.port}).`
    );
  }

  /** Start the "plugin disconnected if no poll in 5s" watchdog (owner mode only). */
  private startConnectionCheck(): void {
    if (this.connectionCheckInterval) return;
    this.connectionCheckInterval = setInterval(() => {
      const wasConnected = this._isConnected;
      this._isConnected = Date.now() - this.lastPollTime < 5000;
      if (wasConnected && !this._isConnected) {
        console.error('[lotus-mcp] Figma plugin disconnected (poll timeout)');
        // Reject all pending requests
        for (const [, req] of this.pending) {
          clearTimeout(req.timer);
          req.reject(new Error('Figma plugin disconnected'));
        }
        this.pending.clear();
        this.queue = [];
      }
    }, 2000);
  }

  /** In proxy mode, if the owner has gone away (connection refused/reset), try to
   *  reclaim the now-free port so future tool calls are served locally instead of
   *  dead-ending in proxy mode forever. The listen callback promotes us to owner;
   *  the 'error' handler keeps us in proxy mode if someone else grabbed it first. */
  private reacquire(): void {
    if (this.closed || this.mode === 'owner' || this.reacquiring || this.server.listening) return;
    this.reacquiring = true;
    console.error(`[lotus-mcp] Owner on port ${this.port} unreachable - attempting to reclaim it.`);
    this.startListening();
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * Queue a plugin message and wait for a response from the plugin.
   */
  async request(message: Record<string, unknown>): Promise<unknown> {
    if (this.mode === 'proxy') {
      return this.forwardToOwner(message);
    }

    if (!this._isConnected) {
      throw new Error(
        'Figma plugin is not connected. Open Lotus in Figma and enable MCP Bridge in Settings.'
      );
    }

    const requestId = `mcp-${++this.requestCounter}`;
    message.requestId = requestId;

    const timeout = message.type === 'send-prompt' ? PROMPT_TIMEOUT_MS : TIMEOUT_MS;

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        this.queue = this.queue.filter(q => q.requestId !== requestId);
        reject(new Error(`Request timed out after ${timeout}ms: ${message.type}`));
      }, timeout);

      this.pending.set(requestId, { resolve, reject, timer });
      this.queue.push({ requestId, message });
    });
  }

  /**
   * Proxy mode: this process does not own the HTTP bridge (another lotus process
   * already holds the port), so forward the plugin message to that bridge's
   * /exec endpoint and relay the result. Keeps tool calls working across
   * concurrent Claude sessions and stale-orphan situations instead of
   * dead-ending them with a "not connected" error.
   */
  private forwardToOwner(message: Record<string, unknown>): Promise<unknown> {
    const body = JSON.stringify(message);
    const timeout = message.type === 'send-prompt' ? PROMPT_TIMEOUT_MS : TIMEOUT_MS;

    return new Promise<unknown>((resolve, reject) => {
      const req = http.request(
        {
          host: '127.0.0.1',
          port: this.port,
          path: '/exec',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
          timeout,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          res.on('end', () => {
            // The owner's /exec returns 200 {success:true,data} on success and
            // 500 {success:false,error} for application errors (e.g. plugin not
            // connected), so validate the BODY SHAPE rather than gating on status
            // - that preserves the real error message while still rejecting a
            // non-Lotus service that happens to occupy the port.
            let parsed: { success?: unknown; data?: unknown; error?: unknown };
            try {
              parsed = JSON.parse(data);
            } catch {
              reject(new Error(`Invalid (non-JSON) response from lotus bridge on port ${this.port} (HTTP ${res.statusCode}) - is another service using this port?`));
              return;
            }
            if (parsed && typeof parsed === 'object' && typeof parsed.success === 'boolean') {
              if (parsed.success) {
                resolve(parsed.data);
              } else {
                reject(new Error(typeof parsed.error === 'string' ? parsed.error : 'Lotus bridge request failed'));
              }
            } else {
              reject(new Error(`Unexpected response from lotus bridge on port ${this.port} (HTTP ${res.statusCode}) - is another service using this port?`));
            }
          });
        }
      );

      req.on('error', (err: NodeJS.ErrnoException) => {
        // Owner likely exited - try to take over the freed port for next time.
        if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
          this.reacquire();
        }
        reject(new Error(`Could not reach lotus bridge on port ${this.port}: ${err.message}`));
      });
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Proxy request timed out after ${timeout}ms: ${String(message.type)}`));
      });

      req.write(body);
      req.end();
    });
  }

  private handlePoll(res: http.ServerResponse): void {
    const wasConnected = this._isConnected;
    this.lastPollTime = Date.now();
    this._isConnected = true;

    if (!wasConnected) {
      console.error('[lotus-mcp] Figma plugin connected');
    }

    if (this.queue.length > 0) {
      const item = this.queue.shift()!;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(item.message));
    } else {
      // Nothing pending - return empty
      res.writeHead(204);
      res.end();
    }
  }

  private handleRespond(req: http.IncomingMessage, res: http.ServerResponse): void {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const msg = JSON.parse(body);
        const requestId = msg.requestId as string;
        if (!requestId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing requestId' }));
          return;
        }

        const pending = this.pending.get(requestId);
        if (!pending) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No pending request with that ID' }));
          return;
        }

        clearTimeout(pending.timer);
        this.pending.delete(requestId);

        if (msg.success) {
          pending.resolve(msg.data);
        } else {
          pending.reject(new Error((msg.error as string) || 'Plugin request failed'));
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  }

  private handleExec(req: http.IncomingMessage, res: http.ServerResponse): void {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const message = JSON.parse(body);
        const result = await this.request(message);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: result }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }));
      }
    });
  }

  close(): void {
    this.closed = true;
    this.reacquiring = false;
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = undefined;
    }
    for (const [, req] of this.pending) {
      clearTimeout(req.timer);
      req.reject(new Error('Bridge shutting down'));
    }
    this.pending.clear();
    // Always close the server. Even in proxy mode an in-flight reacquire() may be
    // mid-bind; closing unconditionally (plus the 'closed' guard in the
    // 'listening' handler) stops a post-shutdown bind from leaking a live server
    // and watchdog. close() on a never-listening server is a safe no-op.
    this.server.close();
  }
}
