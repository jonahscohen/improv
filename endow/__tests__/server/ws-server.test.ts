import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import WebSocket from 'ws';
import { WsServer } from '../../server/ws-server.js';

const BASE_PORT = 49200;

function connectAndHandshake(port: number, params: Record<string, unknown> = {}): Promise<{ ws: WebSocket; connectionId: string }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);

    ws.once('open', () => {
      const handshake = {
        jsonrpc: '2.0',
        id: 1,
        method: 'handshake',
        params: { tabUrl: 'https://example.com', tabTitle: 'Example', ...params },
      };
      ws.send(JSON.stringify(handshake));
    });

    ws.once('message', (data) => {
      const msg = JSON.parse(data.toString());
      const connectionId = msg.result?.connectionId as string;
      resolve({ ws, connectionId });
    });

    ws.once('error', reject);
  });
}

describe('WsServer', () => {
  let server: WsServer;

  beforeEach(() => {
    server = new WsServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  it('accepts connections with valid handshake', async () => {
    const port = await server.start(BASE_PORT);
    const { ws, connectionId } = await connectAndHandshake(port);

    expect(connectionId).toMatch(/^conn-\d+$/);
    expect(server.getConnections()).toHaveLength(1);

    ws.close();
  });

  it('disconnects clients that do not handshake within 5 seconds', async () => {
    const port = await server.start(BASE_PORT + 10);

    const closeCode = await new Promise<number>((resolve) => {
      const ws = new WebSocket(`ws://localhost:${port}`);
      ws.once('close', (code) => resolve(code));
    });

    expect(closeCode).toBe(4001);
  }, 10000);

  it('rejects non-handshake first messages', async () => {
    const port = await server.start(BASE_PORT + 20);

    const closeCode = await new Promise<number>((resolve) => {
      const ws = new WebSocket(`ws://localhost:${port}`);
      ws.once('open', () => {
        ws.send(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping', params: {} }));
      });
      ws.once('close', (code) => resolve(code));
    });

    expect(closeCode).toBe(4002);
  });

  it('routes messages to registered handlers', async () => {
    const port = await server.start(BASE_PORT + 30);

    let receivedConnectionId: string | undefined;
    let receivedParams: Record<string, unknown> | undefined;

    server.onMessage('echo', (connectionId, params) => {
      receivedConnectionId = connectionId;
      receivedParams = params;
      return { echoed: params };
    });

    const { ws, connectionId } = await connectAndHandshake(port);

    const response = await new Promise<Record<string, unknown>>((resolve) => {
      ws.once('message', (data) => resolve(JSON.parse(data.toString())));
      ws.send(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'echo', params: { value: 'hello' } }));
    });

    expect(receivedConnectionId).toBe(connectionId);
    expect(receivedParams).toEqual({ value: 'hello' });
    expect(response.result).toEqual({ echoed: { value: 'hello' } });

    ws.close();
  });

  it('tries next port when first is occupied', async () => {
    const server1 = new WsServer();
    const port1 = await server1.start(BASE_PORT + 40);

    try {
      const port2 = await server.start(BASE_PORT + 40);
      expect(port2).toBe(port1 + 1);
    } finally {
      await server1.stop();
    }
  });
});
