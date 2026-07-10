import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Outbox } from '../../core/outbox.js';

// Jonah, 2026-07-09: "justify is ON at ALL TIMES WATCHING until THE USER stands
// it down. Not you. Not a fucking timeout. Not a timer."
//
// The outbox is where that law is enforced for OUTBOUND work. A prompt handed to
// it must reach the daemon eventually, no matter how long the daemon is away and
// no matter how many sends fail on the way. Nothing here may ever drop an entry
// or surface a failure to the caller.

class FakeTransport {
  connected = true;
  sent: Array<{ method: string; params: Record<string, unknown> }> = [];
  failuresRemaining = 0;

  isConnected() {
    return this.connected;
  }

  async request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (this.failuresRemaining > 0) {
      this.failuresRemaining--;
      throw new Error('Request timeout: push_prompt');
    }
    this.sent.push({ method, params: params ?? {} });
    return { accepted: 1 };
  }
}

class MemStorage {
  private map = new Map<string, string>();
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
  key() { return null; }
  get length() { return this.map.size; }
}

const flush = async () => {
  // let the drain loop's awaits settle
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe('Outbox - a prompt is never dropped and never declared failed', () => {
  let transport: FakeTransport;
  let storage: MemStorage;

  beforeEach(() => {
    vi.useFakeTimers();
    transport = new FakeTransport();
    storage = new MemStorage();
  });

  it('delivers immediately when connected, and clears only on ack', async () => {
    const box = new Outbox(transport, { storage: storage as unknown as Storage });
    box.enqueue('push_prompt', { prompt: 'make it lime' });
    await flush();

    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0].params.prompt).toBe('make it lime');
    expect(box.pending()).toBe(0);
  });

  it('attaches a stable clientId so the daemon can dedupe a retry', async () => {
    const box = new Outbox(transport, { storage: storage as unknown as Storage });
    const entry = box.enqueue('push_prompt', { prompt: 'x' });
    await flush();
    expect(transport.sent[0].params.clientId).toBe(entry.clientId);
    expect(typeof entry.clientId).toBe('string');
    expect(entry.clientId.length).toBeGreaterThan(8);
  });

  it('HOLDS the prompt while disconnected instead of rejecting', async () => {
    transport.connected = false;
    const box = new Outbox(transport, { storage: storage as unknown as Storage });
    box.enqueue('push_prompt', { prompt: 'queued in the dark' });
    await flush();

    expect(transport.sent).toHaveLength(0);
    expect(box.pending()).toBe(1); // still ours, still safe
  });

  it('delivers the held prompt the moment the socket comes back', async () => {
    transport.connected = false;
    const box = new Outbox(transport, { storage: storage as unknown as Storage });
    box.enqueue('push_prompt', { prompt: 'survived the blip' });
    await flush();
    expect(box.pending()).toBe(1);

    transport.connected = true;
    box.onConnected();
    await flush();

    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0].params.prompt).toBe('survived the blip');
    expect(box.pending()).toBe(0);
  });

  it('retries forever - 50 consecutive failures still leave the prompt queued', async () => {
    transport.failuresRemaining = 50;
    const box = new Outbox(transport, { storage: storage as unknown as Storage });
    box.enqueue('push_prompt', { prompt: 'stubborn' });

    for (let i = 0; i < 50; i++) {
      await flush();
      await vi.advanceTimersByTimeAsync(20000); // past any backoff ceiling
    }
    await flush();

    // The 51st attempt succeeds. Nothing gave up; nothing was dropped.
    expect(transport.failuresRemaining).toBe(0);
    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0].params.prompt).toBe('stubborn');
    expect(box.pending()).toBe(0);
  });

  it('never rejects to the caller - enqueue is fire-and-forget', async () => {
    transport.failuresRemaining = 3;
    const box = new Outbox(transport, { storage: storage as unknown as Storage });
    // If enqueue returned a rejecting promise this would produce an unhandled
    // rejection; it returns a plain entry by design.
    const entry = box.enqueue('push_prompt', { prompt: 'no exceptions' });
    expect(entry.clientId).toBeTruthy();
    await flush();
    expect(box.pending()).toBe(1);
  });

  it('survives a page reload - the queue is rehydrated from storage', async () => {
    transport.connected = false;
    const box1 = new Outbox(transport, { storage: storage as unknown as Storage });
    box1.enqueue('push_prompt', { prompt: 'outlives the tab' });
    await flush();
    expect(box1.pending()).toBe(1);

    // New page, new Outbox, same localStorage.
    transport.connected = true;
    const box2 = new Outbox(transport, { storage: storage as unknown as Storage });
    expect(box2.pending()).toBe(1);
    expect(box2.peek()[0].params.prompt).toBe('outlives the tab');

    await box2.drain();
    await flush();
    expect(transport.sent).toHaveLength(1);
    expect(box2.pending()).toBe(0);
  });

  it('preserves order across a failure - the head is not skipped', async () => {
    transport.connected = false;
    const box = new Outbox(transport, { storage: storage as unknown as Storage });
    box.enqueue('push_prompt', { prompt: 'first' });
    box.enqueue('push_prompt', { prompt: 'second' });
    await flush();

    transport.connected = true;
    transport.failuresRemaining = 1; // the FIRST attempt on 'first' fails
    box.onConnected();
    await flush();
    await vi.advanceTimersByTimeAsync(20000);
    await flush();

    expect(transport.sent.map((s) => s.params.prompt)).toEqual(['first', 'second']);
    expect(box.pending()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Regressions folded in from the Codex cross-model review, 2026-07-09.
// ---------------------------------------------------------------------------

describe('Outbox - findings from the Codex review', () => {
  let transport: FakeTransport;
  let storage: MemStorage;

  beforeEach(() => {
    vi.useFakeTimers();
    transport = new FakeTransport();
    storage = new MemStorage();
  });

  it('re-sending with the ORIGINAL clientId does not mint a new one (Retry must not double-queue)', async () => {
    const box = new Outbox(transport, { storage: storage as unknown as Storage });
    const first = box.enqueue('push_prompt', { prompt: 'make it lime' });
    await flush();
    expect(transport.sent).toHaveLength(1);

    // The user clicks Retry. The core re-sends with the same id.
    box.enqueue('push_prompt', { prompt: 'make it lime' }, first.clientId);
    await flush();

    expect(transport.sent).toHaveLength(2);
    expect(transport.sent[1].params.clientId).toBe(first.clientId); // daemon dedupes it
  });

  it('does NOT clobber another tab\'s queued prompt when it persists', async () => {
    // Tab A loads (empty), enqueues P1 while disconnected.
    transport.connected = false;
    const tabA = new Outbox(transport, { storage: storage as unknown as Storage });
    tabA.enqueue('push_prompt', { prompt: 'from tab A' });
    await flush();

    // Tab B loaded BEFORE P1 existed, so its in-memory queue does not contain it.
    // (Simulated by constructing from a storage snapshot taken earlier.)
    const emptySnapshot = new MemStorage();
    const tabB = new Outbox(transport, { storage: emptySnapshot as unknown as Storage });
    // Now point tab B at the shared storage and let it enqueue its own prompt.
    (tabB as unknown as { storage: Storage }).storage = storage as unknown as Storage;
    tabB.enqueue('push_prompt', { prompt: 'from tab B' });
    await flush();

    const stored: Array<{ params: { prompt: string } }> = JSON.parse(
      storage.getItem('justify.outbox.v1') as string,
    );
    const prompts = stored.map((e) => e.params.prompt).sort();
    expect(prompts).toEqual(['from tab A', 'from tab B']); // neither was erased
  });

  it('an entry left in storage by a previous page load is adopted and drained', async () => {
    // Simulate what a reload sees: a persisted, never-acked prompt.
    storage.setItem(
      'justify.outbox.v1',
      JSON.stringify([
        { clientId: 'cid-survivor', method: 'push_prompt', params: { prompt: 'from before the reload' }, enqueuedAt: 1, attempts: 2 },
      ]),
    );

    const fresh = new Outbox(transport, { storage: storage as unknown as Storage });
    expect(fresh.pending()).toBe(1);

    fresh.onConnected(); // what Transport now calls on every (re)connect
    await flush();

    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0].params.clientId).toBe('cid-survivor');
    expect(fresh.pending()).toBe(0);
    expect(JSON.parse(storage.getItem('justify.outbox.v1') as string)).toEqual([]);
  });

  it('a storage that throws on write never loses the in-memory queue', async () => {
    const hostile = {
      getItem: () => null,
      setItem: () => { throw new Error('QuotaExceededError'); },
      removeItem: () => {}, clear: () => {}, key: () => null, length: 0,
    };
    transport.connected = false;
    const box = new Outbox(transport, { storage: hostile as unknown as Storage });
    box.enqueue('push_prompt', { prompt: 'quota is full' });
    await flush();

    expect(box.pending()).toBe(1); // still held
    transport.connected = true;
    box.onConnected();
    await flush();
    expect(transport.sent).toHaveLength(1); // and still delivered
  });
});
