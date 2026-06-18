import type { JsonRpcRequest, JsonRpcResponse } from './types';

type EventCallback = (data: unknown) => void;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class Transport {
  private port: number;
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<number | string, PendingRequest>();
  private listeners = new Map<string, Set<EventCallback>>();
  private connectionId: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  // Quiet, capped backoff for reconnects. Starts small so a momentary daemon
  // blip recovers fast, then doubles up to a ceiling so a daemon that stays
  // down does not produce a steady stream of console errors. Reset to the floor
  // on every successful (re)connect.
  private reconnectDelay = 1000;
  private static readonly RECONNECT_MIN = 1000;
  private static readonly RECONNECT_MAX = 30000;

  constructor(port = 9223) {
    this.port = port;
  }

  async connect(): Promise<void> {
    // Connect to the EXACT port the daemon serves on. The port is derived
    // deterministically from the <script src> the core was loaded from (see
    // detectJustifyUrl in core/index.ts): the page loaded the bundle from the
    // daemon, so the daemon's ws port is that same port. There is no need to
    // probe a range of candidate ports - the old base..9232 scan opened a
    // socket per port and logged one ERR_CONNECTION_REFUSED to the browser
    // console for every dead port on every page load. One socket, one known
    // port, no visual retries.
    try {
      await this.openSocket(this.port);
      this.reconnectDelay = Transport.RECONNECT_MIN;
    } catch (err) {
      // Daemon not up yet. Retry quietly in the background with capped backoff
      // (a single socket per attempt, not a port sweep). Re-throw so the
      // caller's existing try/catch - which renders the toolbar in a
      // disconnected state - still runs.
      this.scheduleReconnect();
      throw err;
    }
  }

  private openSocket(port: number): Promise<void> {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      let ws: WebSocket;
      try {
        ws = new WebSocket(`${protocol}://localhost:${port}`);
      } catch (err) {
        reject(err instanceof Error ? err : new Error('WebSocket construction failed'));
        return;
      }

      ws.onopen = () => {
        if (settled) return;
        settled = true;
        this.ws = ws;
        this.handshake().then(resolve).catch(reject);
      };

      ws.onmessage = (event: MessageEvent) => {
        this.handleMessage(event.data as string);
      };

      ws.onclose = () => {
        if (this.ws === ws) {
          this.ws = null;
          this.emit('disconnected', null);
          this.scheduleReconnect();
        }
        if (!settled) {
          settled = true;
          reject(new Error(`Justify daemon not reachable on port ${port}`));
        }
      };

      ws.onerror = () => {
        if (!settled) {
          settled = true;
          reject(new Error(`Justify daemon not reachable on port ${port}`));
        }
      };
    });
  }

  private async handshake(): Promise<void> {
    await this.request('handshake', {
      client: 'justify-browser',
      tabUrl: window.location.href,
      tabTitle: document.title,
    });
  }

  request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected'));
        return;
      }

      const id = this.nextId++;
      const msg: JsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, 10000);

      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify(msg));
    });
  }

  private handleMessage(raw: string): void {
    let msg: JsonRpcResponse & { method?: string; params?: unknown };
    try {
      msg = JSON.parse(raw) as typeof msg;
    } catch {
      return;
    }

    if (msg.id !== undefined && this.pending.has(msg.id)) {
      const entry = this.pending.get(msg.id)!;
      clearTimeout(entry.timer);
      this.pending.delete(msg.id);
      if (msg.error) {
        entry.reject(new Error(msg.error.message));
      } else {
        entry.resolve(msg.result);
      }
    } else if (msg.method) {
      this.emit(msg.method, msg.params ?? null);
    }
  }

  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach((cb) => cb(data));
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;
    const delay = this.reconnectDelay;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        // Single-socket reconnect to the known port (NOT connect(), which would
        // re-arm a second backoff timer on failure and double the cadence).
        await this.openSocket(this.port);
        // Recovered: reset the backoff floor and re-light any connection-aware
        // UI (the toolbar listens for 'connected').
        this.reconnectDelay = Transport.RECONNECT_MIN;
        this.emit('connected', null);
      } catch {
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, Transport.RECONNECT_MAX);
        this.scheduleReconnect();
      }
    }, delay);
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  getConnectionId(): string | null {
    return this.connectionId;
  }

  disconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      const ws = this.ws;
      this.ws = null;
      ws.close();
    }
  }
}
