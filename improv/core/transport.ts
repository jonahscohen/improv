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

  constructor(port = 9223) {
    this.port = port;
  }

  async connect(): Promise<void> {
    await this.tryConnect(this.port, 9232);
  }

  private tryConnect(port: number, maxPort: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const attempt = (p: number) => {
        if (p > maxPort) {
          reject(new Error(`Could not connect on ports ${this.port}-${maxPort}`));
          return;
        }

        const ws = new WebSocket(`ws://localhost:${p}`);

        ws.onopen = () => {
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
        };

        ws.onerror = () => {
          if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
            attempt(p + 1);
          }
        };
      };

      attempt(port);
    });
  }

  private async handshake(): Promise<void> {
    await this.request('handshake', {
      client: 'improv-browser',
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
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
      } catch {
        // reconnect failed; will retry on next close event
      }
    }, 3000);
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
