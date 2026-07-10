// Outbox - a prompt handed to Justify is NEVER lost and NEVER surrendered.
//
// Jonah, 2026-07-09: "justify is ON at ALL TIMES WATCHING until THE USER stands
// it down. Not you. Not a fucking timeout. Not a timer."
//
// The rule this file implements: **no clock may cause a prompt to be dropped or
// declared failed.** Before this, a Send-All went straight through
// `transport.request('push_prompt', ...)`, which rejects in two time-caused ways:
//
//   1. instantly, if the WebSocket happens to be mid-reconnect (`Not connected`)
//   2. after a flat 10s, via its own `Request timeout` stopwatch
//
// Every caller answered a rejection by calling `_claudeToRetry()` - a dead-end
// pill that needs a human click. So a one-second network blip during a Send-All
// silently threw the user's work away and blamed them for it.
//
// The outbox instead:
//   - assigns each prompt a stable `clientId` at enqueue time
//   - persists the queue to localStorage, so a reload cannot lose it
//   - drains forever: retries with capped backoff while disconnected or failing,
//     with NO attempt limit and NO deadline
//   - only ever removes an entry when the server has ACKED that exact clientId
//
// Retrying forever is only safe because the server is idempotent on `clientId`
// (see server/mcp-tools.ts `push_prompt`): re-sending a prompt the daemon already
// queued acks it instead of enqueueing a second copy. That closes the
// double-queue hazard that made the old "Retry Send" button destructive.
//
// The backoff timer here is the ONLY kind of timer the law permits: it can make
// the next attempt happen SOONER or LATER, but it can never stop the attempts.

export interface OutboxEntry {
  clientId: string;
  method: string;
  params: Record<string, unknown>;
  enqueuedAt: number;
  attempts: number;
}

interface OutboxTransport {
  isConnected(): boolean;
  request(method: string, params?: Record<string, unknown>): Promise<unknown>;
}

const STORAGE_KEY = 'justify.outbox.v1';
const BACKOFF_MIN_MS = 500;
const BACKOFF_MAX_MS = 15000;

const newClientId = (): string => {
  try {
    const c = (globalThis as { crypto?: Crypto }).crypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  } catch {
    /* fall through */
  }
  return `cid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export class Outbox {
  private transport: OutboxTransport;
  private queue: OutboxEntry[] = [];
  private draining = false;
  private backoffMs = BACKOFF_MIN_MS;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private storage: Storage | null;
  private onChange: (pending: number) => void;
  // clientIds this Outbox instance is responsible for. Everything else in the
  // shared localStorage key belongs to another TAB, and must survive our writes.
  private owned = new Set<string>();

  constructor(
    transport: OutboxTransport,
    opts: { storage?: Storage | null; onChange?: (pending: number) => void } = {},
  ) {
    this.transport = transport;
    this.storage =
      opts.storage !== undefined ? opts.storage : safeStorage();
    this.onChange = opts.onChange ?? (() => {});
    this.queue = this.load();
    // Adopt whatever was left behind by a previous page load in this tab. If a
    // second tab adopts the same entry, both will send it - and the daemon's
    // clientId dedupe makes that harmless. Double-SENDING is safe; double-APPLYING
    // is not, and only the latter would be a bug.
    for (const e of this.queue) this.owned.add(e.clientId);
  }

  /** Number of prompts the outbox is still holding for the daemon. */
  pending(): number {
    return this.queue.length;
  }

  /** Snapshot, for tests and diagnostics. */
  peek(): OutboxEntry[] {
    return this.queue.map((e) => ({ ...e }));
  }

  /**
   * Hand a prompt to the outbox. Resolves immediately - delivery is the outbox's
   * problem from here, and it will not stop trying. This NEVER rejects, because
   * there is no failure a caller could meaningfully act on: the prompt is safe.
   */
  enqueue(method: string, params: Record<string, unknown>, clientId?: string): OutboxEntry {
    const entry: OutboxEntry = {
      // A caller-supplied id RE-sends the same logical prompt (the Retry pill).
      // The daemon dedupes on it, so a re-send of work that already landed acks
      // instead of queueing a second copy.
      clientId: clientId ?? newClientId(),
      method,
      params: { ...params },
      enqueuedAt: Date.now(),
      attempts: 0,
    };
    this.owned.add(entry.clientId);
    this.queue.push(entry);
    this.persist();
    void this.drain();
    return entry;
  }

  /**
   * Attempt delivery of everything queued, oldest first. Re-entrant-safe. On any
   * failure it schedules another drain and returns - it never throws, never
   * clears an unacked entry, and never gives up.
   */
  async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.queue.length > 0) {
        if (!this.transport.isConnected()) {
          // Not a failure. The socket reconnects on its own schedule; come back.
          this.scheduleRetry();
          return;
        }
        const entry = this.queue[0];
        entry.attempts++;
        try {
          await this.transport.request(entry.method, {
            ...entry.params,
            clientId: entry.clientId,
          });
        } catch (err) {
          // Disconnect, 10s transport stopwatch, or a server error. All of them
          // mean "not yet", none of them mean "never". Keep the entry.
          this.persist();
          this.scheduleRetry();
          if (typeof console !== 'undefined') {
            console.warn(
              `[Justify] outbox: ${entry.method} attempt ${entry.attempts} did not land, retrying in ${this.backoffMs}ms`,
              err,
            );
          }
          return;
        }
        // ACKed by the daemon. This is the ONLY path that removes an entry.
        this.queue.shift();
        this.backoffMs = BACKOFF_MIN_MS;
        this.persist();
      }
    } finally {
      this.draining = false;
    }
  }

  /** Called by the core when the transport reconnects. */
  onConnected(): void {
    this.backoffMs = BACKOFF_MIN_MS;
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    void this.drain();
  }

  private scheduleRetry(): void {
    if (this.retryTimer !== null) return;
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 2, BACKOFF_MAX_MS);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.drain();
    }, delay);
    // Never hold a page (or a test runner) open on this timer.
    const t = this.retryTimer as unknown as { unref?: () => void };
    if (typeof t.unref === 'function') t.unref();
  }

  // Read-modify-write against the SHARED key. A blind `setItem(queue)` let two
  // tabs clobber each other: tab B, which loaded before tab A enqueued anything,
  // would overwrite A's queued prompt with its own snapshot. Entries we do not
  // own belong to another tab and are preserved verbatim.
  private persist(): void {
    this.onChange(this.queue.length);
    if (!this.storage) return;
    try {
      const others = this.readRaw().filter((e) => !this.owned.has(e.clientId));
      this.storage.setItem(STORAGE_KEY, JSON.stringify([...others, ...this.queue]));
    } catch (err) {
      // The in-memory queue is still authoritative and still draining, so this is
      // survivable - but it means a reload could lose the prompt. Say so.
      if (typeof console !== 'undefined') {
        console.warn('[Justify] outbox: could not persist the queue; a reload may lose queued prompts', err);
      }
    }
  }

  private readRaw(): OutboxEntry[] {
    if (!this.storage) return [];
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as OutboxEntry[]) : [];
    } catch {
      return [];
    }
  }

  private load(): OutboxEntry[] {
    if (!this.storage) return [];
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (e): e is OutboxEntry =>
          !!e &&
          typeof (e as OutboxEntry).clientId === 'string' &&
          typeof (e as OutboxEntry).method === 'string' &&
          typeof (e as OutboxEntry).params === 'object',
      );
    } catch {
      return [];
    }
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}
