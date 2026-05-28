import type WebSocket from 'ws';
import type { BrowserConnection, JsonRpcMessage } from './types.js';

interface StoredConnection {
  ws: WebSocket;
  connection: BrowserConnection;
}

export class ConnectionManager {
  private connections = new Map<string, StoredConnection>();
  private counter = 0;

  add(ws: WebSocket, tabUrl: string, tabTitle: string): string {
    this.counter++;
    const id = `conn-${this.counter}`;

    const connection: BrowserConnection = {
      id,
      tabUrl,
      tabTitle,
      connectedAt: Date.now(),
      send(message: JsonRpcMessage): void {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify(message));
        }
      },
    };

    this.connections.set(id, { ws, connection });
    return id;
  }

  remove(id: string): void {
    this.connections.delete(id);
  }

  get(id: string): BrowserConnection | undefined {
    return this.connections.get(id)?.connection;
  }

  getAll(): BrowserConnection[] {
    return Array.from(this.connections.values()).map((s) => s.connection);
  }

  findByWs(ws: WebSocket): string | undefined {
    for (const [id, stored] of this.connections) {
      if (stored.ws === ws) return id;
    }
    return undefined;
  }

  broadcast(message: JsonRpcMessage): void {
    for (const stored of this.connections.values()) {
      try { stored.connection.send(message); } catch {}
    }
  }

  size(): number {
    return this.connections.size;
  }
}
