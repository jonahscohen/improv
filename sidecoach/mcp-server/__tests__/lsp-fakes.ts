// T-0026: in-process fakes for LSP tests. NOT a *.test.ts file, so the runner
// does not auto-execute it; it is imported by the LSP suites.
//
// FakeTransport implements RawTransport without a subprocess. The test drives
// the "server side" by calling emit()/crash()/fail(); the client side writes
// land in `writes` (and are decoded so an autoResponder can reply).

import { encodeMessage, LspFramer } from '../src/lsp/framing';
import type { RawTransport } from '../src/lsp/client';

export class FakeTransport implements RawTransport {
  private dataCb?: (chunk: Buffer) => void;
  private exitCb?: (code: number | null, signal: NodeJS.Signals | null) => void;
  private errorCb?: (err: Error) => void;
  private readonly framer = new LspFramer();

  public readonly clientMessages: unknown[] = [];
  public killSignals: Array<NodeJS.Signals | undefined> = [];
  /** Optional hook invoked for each decoded client->server message. */
  public onClientMessage?: (msg: any, self: FakeTransport) => void;

  // RawTransport surface (client side talks to these).
  public write(data: Buffer): void {
    for (const frame of this.framer.push(data)) {
      if (frame.message !== undefined) {
        this.clientMessages.push(frame.message);
        if (this.onClientMessage) this.onClientMessage(frame.message, this);
      }
    }
  }
  public onData(cb: (chunk: Buffer) => void): void {
    this.dataCb = cb;
  }
  public onExit(cb: (code: number | null, signal: NodeJS.Signals | null) => void): void {
    this.exitCb = cb;
  }
  public onError(cb: (err: Error) => void): void {
    this.errorCb = cb;
  }
  public kill(signal?: NodeJS.Signals): void {
    this.killSignals.push(signal);
  }

  // Test-side controls (server side).
  public emit(msg: unknown): void {
    this.dataCb?.(encodeMessage(msg));
  }
  public emitRaw(buf: Buffer): void {
    this.dataCb?.(buf);
  }
  public crash(code: number | null = 1, signal: NodeJS.Signals | null = null): void {
    this.exitCb?.(code, signal);
  }
  public fail(err: Error): void {
    this.errorCb?.(err);
  }

  /** Convenience: most recent client request matching a method. */
  public lastRequest(method: string): any | undefined {
    for (let i = this.clientMessages.length - 1; i >= 0; i--) {
      const m = this.clientMessages[i] as any;
      if (m && m.method === method) return m;
    }
    return undefined;
  }
}

/**
 * Wire a FakeTransport so it auto-responds to requests. `responders` maps an
 * LSP method to a function producing the `result`. `initialize` and `shutdown`
 * get default null-ish responses unless overridden. Notifications (no id) are
 * ignored.
 */
export function autoRespond(
  transport: FakeTransport,
  responders: Record<string, (params: any) => unknown> = {},
): void {
  const defaults: Record<string, (params: any) => unknown> = {
    initialize: () => ({ capabilities: {} }),
    shutdown: () => null,
  };
  const all = { ...defaults, ...responders };
  transport.onClientMessage = (msg) => {
    if (!msg || typeof msg !== 'object') return;
    if (typeof msg.id !== 'number' || typeof msg.method !== 'string') return; // notification
    const fn = all[msg.method];
    if (fn) {
      transport.emit({ jsonrpc: '2.0', id: msg.id, result: fn(msg.params) });
    }
  };
}
