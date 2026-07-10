import { readFileSync, writeFileSync, existsSync, renameSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { spawn, type ChildProcess } from 'child_process';
import type { WatchStateStore } from './watch-state.js';

// The daemon-owned dispatcher. While the watch is armed it polls the prompt
// queue and, when a Send-All batch arrives, CLAIMS it and spawns a headless
// worker (a `claude -p` run, via justify-worker.sh) that applies the changes to
// source and posts results back. This is what makes the watch survive every
// session: the daemon outlives sessions, and the worker is a short-lived child
// the daemon owns - not a session-owned poller.
//
// Invariants:
//   - Only arm()/disarm() (user action) change armed state. A worker error NEVER
//     disarms; it backs off and retries.
//   - Claim semantics prevent an interactive session and the daemon from
//     double-applying the same batch. A stale claim (dead worker / abandoned
//     interactive claim) expires and is re-dispatched.
//   - One worker at a time; success is the OBSERVED EFFECT (claimed prompt ids
//     cleared from the queue by justify-done), not the child exit code alone.

interface QueuePrompt {
  id: string;
  context?: string;
  prompt?: string;
  elementCount?: number;
  timestamp?: number;
  selectors?: string[];
  claimedBy?: string;
  claimedAt?: number;
}

export interface DispatcherOptions {
  port: number;
  stateDir?: string;
  workerScript?: string;
  tickMs?: number;
  claimTtlMs?: number;
  maxBackoffMs?: number;
  /**
   * Spawn a detached, headless `claude -p` worker when a batch arrives.
   *
   * OFF by default. Jonah, 2026-07-09: "I also don't want a silent worker
   * clanging away in private. I want the session that I called the watch from to
   * own the thread and the process [...] I want to be able to see the work
   * getting done."
   *
   * A headless worker is spawned `detached: true, stdio: 'ignore'` and writes to
   * a private log nobody reads. The work happens; the user cannot see it happen.
   * That is indistinguishable from a dropped prompt, and it is what made Justify
   * feel broken all day even though every prompt landed.
   *
   * With this off the daemon still OWNS THE QUEUE - prompts are durable, survive
   * restarts, and are never dropped - but the WORK belongs to the attached owner:
   * the session or named agent that armed the watch. It claims via
   * POST /prompts/claim, drives the pill with POST /working and /validating, and
   * finishes with justify-done, which is what raises "Review Changes".
   *
   * Opt in with JUSTIFY_HEADLESS=1 for an unattended machine.
   */
  headless?: boolean;
  /**
   * Tell the browser something happened. Without this the claudebar sits on
   * "Sending to Claude." for the ENTIRE apply - minutes - because the only code
   * that ever broadcast `justify_working` lived in the MCP tools, which the
   * daemon no longer uses. The user sees no acknowledgement of their prompt and
   * reasonably concludes it was never received. (Jonah, 2026-07-09.)
   */
  broadcast?: (event: string, payload?: Record<string, unknown>) => void;
}

export class Dispatcher {
  private watch: WatchStateStore;
  private port: number;
  private promptFile: string;
  private workerScript: string | null;
  private tickMs: number;
  private claimTtlMs: number;
  private maxBackoffMs: number;
  private broadcast: (event: string, payload?: Record<string, unknown>) => void;
  private headless: boolean;

  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;
  private worker: ChildProcess | null = null;
  private workerRunId: string | null = null;
  private workerClaimedIds: string[] = [];
  private workerStartedAt = 0;
  private consecutiveFailures = 0;
  private backoffUntil = 0;

  constructor(watch: WatchStateStore, opts: DispatcherOptions) {
    this.watch = watch;
    this.port = opts.port;
    const base = opts.stateDir || process.env.JUSTIFY_STATE_DIR || join(homedir(), '.claude', 'justify');
    this.promptFile = join(base, 'prompts.json');
    this.workerScript = opts.workerScript || process.env.JUSTIFY_WORKER_SCRIPT || null;
    this.tickMs = opts.tickMs ?? (Number(process.env.JUSTIFY_TICK_MS) || 2000);
    // Claim staleness TTL. MUST STRICTLY EXCEED the worker's max lifetime so a
    // still-running worker's claim is never treated as stale and reclaimed (that
    // would double-apply). The worker can run to JUSTIFY_WORKER_TIMEOUT_SECS
    // (default 1800s) PLUS its TERM->grace kill window, so the default here is
    // 2400s (40min) - a clear margin over 1800s. Keep it > the worker timeout if
    // you tune either via env.
    this.claimTtlMs = opts.claimTtlMs ?? (Number(process.env.JUSTIFY_CLAIM_TTL_MS) || 2400000);
    this.maxBackoffMs = opts.maxBackoffMs ?? (Number(process.env.JUSTIFY_MAX_BACKOFF_MS) || 60000);
    this.broadcast = opts.broadcast ?? (() => {});
    this.headless = opts.headless ?? process.env.JUSTIFY_HEADLESS === '1';
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), this.tickMs);
    // Do not hold the event loop open on the dispatcher timer alone; the HTTP
    // server keeps the process alive.
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  // Called right after an arm so a queued batch dispatches immediately instead of
  // waiting for the next tick.
  kick(): void {
    this.tick();
  }

  workerRunning(): boolean {
    return this.worker !== null;
  }

  // Is the dispatch LOOP alive? Armed-but-not-running is the silent failure mode
  // that makes Justify look like it is watching when nothing will ever be
  // dispatched. index.ts watchdogs on this.
  running(): boolean {
    return this.timer !== null;
  }

  // A batch is queued, the watch is armed, no worker is running, and we are past
  // any backoff - yet nothing is happening. That is a STALL, and callers (the
  // /status endpoint, the browser toolbar) must be able to see it rather than
  // show a reassuring green light.
  // NOTE: `stalled` keeps its original meaning in BOTH modes - armed, work
  // queued, nothing holding it. In owner mode that is exactly the condition the
  // user must see: no owner has claimed the prompt, so nobody is going to do it.
  // An attached owner claims within one poll, so this is transient while it is
  // alive and sticky the moment it dies. I briefly special-cased owner mode here
  // to keep a new test green, which would have silently disabled the guarantee
  // that `watch-guards.test.ts` exists to protect. Do not do that.
  stalled(now: number = Date.now()): boolean {
    if (!this.watch.isArmed()) return false;
    if (this.worker !== null) return false;
    if (!this.running()) return this.readPrompts().length > 0;
    if (now < this.backoffUntil) return false;
    return this.readPrompts().some((p) => this.isClaimable(p, now));
  }

  pendingCount(): number {
    return this.readPrompts().length;
  }

  status(): Record<string, unknown> {
    return {
      headless: this.headless,
      dispatcherRunning: this.running(),
      workerRunning: this.worker !== null,
      workerRunId: this.workerRunId,
      workerClaimedIds: this.workerClaimedIds,
      workerStartedAt: this.workerStartedAt || null,
      consecutiveFailures: this.consecutiveFailures,
      backoffUntil: this.backoffUntil || null,
      pendingCount: this.pendingCount(),
      stalled: this.stalled(),
    };
  }

  private readPrompts(): QueuePrompt[] {
    try {
      if (!existsSync(this.promptFile)) return [];
      const parsed = JSON.parse(readFileSync(this.promptFile, 'utf-8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  // Atomic write (temp + rename) so a crash mid-write cannot corrupt/truncate
  // prompts.json (which holds claim ownership and the live queue).
  private writePrompts(prompts: QueuePrompt[]): boolean {
    try {
      const tmp = `${this.promptFile}.tmp.${process.pid}.${Date.now()}`;
      writeFileSync(tmp, JSON.stringify(prompts));
      renameSync(tmp, this.promptFile);
      return true;
    } catch (err) {
      process.stderr.write(`[justify] dispatcher writePrompts failed: ${err instanceof Error ? err.message : err}\n`);
      return false;
    }
  }

  private isClaimable(p: QueuePrompt, now: number): boolean {
    if (!p.claimedBy) return true;
    if (!p.claimedAt) return true;
    return now - p.claimedAt > this.claimTtlMs;
  }

  private tick(): void {
    if (this.ticking) return;
    this.ticking = true;
    try {
      if (this.worker) return; // one worker at a time
      if (!this.watch.isArmed()) return;
      const now = Date.now();
      if (now < this.backoffUntil) return;
      const root = this.watch.projectRoot();
      if (!root) return;

      const prompts = this.readPrompts();
      if (prompts.length === 0) return;
      const claimable = prompts.filter((p) => this.isClaimable(p, now));
      if (claimable.length === 0) return;

      // OWNER MODE (the default). The queue is the daemon's; the work is not.
      // Leave the batch unclaimed for the attached owner - the session or named
      // agent that armed the watch - to claim, apply, and narrate. Spawning a
      // silent detached worker here is what hid the work from the user.
      if (!this.headless) return;

      const runId = `daemon-worker:${now}:${Math.random().toString(36).slice(2, 8)}`;
      const claimedIds = claimable.map((p) => p.id);
      for (const p of prompts) {
        if (claimedIds.includes(p.id)) {
          p.claimedBy = runId;
          p.claimedAt = now;
        }
      }
      // Fail CLOSED: if the claim did not durably land on disk, do NOT spawn a
      // worker on prompts that are still unclaimed (another consumer could grab
      // or clear them -> double-apply / lost work). Back off and retry.
      if (!this.writePrompts(prompts)) {
        process.stderr.write(`[justify] dispatcher: claim write failed for ${runId}; NOT spawning (fail-closed)\n`);
        this.registerFailure();
        return;
      }
      this.spawnWorker(root, runId, claimedIds, claimable);
    } catch (err) {
      process.stderr.write(`[justify] dispatcher tick error (non-fatal): ${err instanceof Error ? err.message : err}\n`);
    } finally {
      this.ticking = false;
    }
  }

  private spawnWorker(root: string, runId: string, claimedIds: string[], batch: QueuePrompt[]): void {
    const batchJson = JSON.stringify(
      batch.map((p) => ({ id: p.id, prompt: p.prompt || '', context: p.context || '', selectors: p.selectors || [] })),
    );
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      JUSTIFY_PROJECT_ROOT: root,
      JUSTIFY_PORT: String(this.port),
      JUSTIFY_CLAIM_IDS: claimedIds.join(','),
      JUSTIFY_BATCH: batchJson,
      JUSTIFY_RUN_ID: runId,
    };

    let child: ChildProcess;
    const overrideCmd = process.env.JUSTIFY_WORKER_CMD;
    try {
      if (overrideCmd) {
        // Test / override path (mirrors beats-reflect BEATS_REFLECT_CMD): run the
        // injected command in place of the real claude worker.
        child = spawn('bash', ['-c', overrideCmd], { env, cwd: root, detached: true, stdio: 'ignore' });
      } else {
        const script = this.workerScript;
        if (!script || !existsSync(script)) {
          process.stderr.write(`[justify] dispatcher: worker script not found (${script ?? 'unset'}); releasing claim ${runId}\n`);
          this.releaseClaim(runId, claimedIds);
          this.registerFailure();
          return;
        }
        // detached so the worker survives a daemon blip and leads its own process
        // group (the worker script's watchdog can then group-kill claude's tree).
        child = spawn('bash', [script], { env, cwd: root, detached: true, stdio: 'ignore' });
      }
    } catch (err) {
      process.stderr.write(`[justify] dispatcher spawn failed: ${err instanceof Error ? err.message : err}\n`);
      this.releaseClaim(runId, claimedIds);
      this.registerFailure();
      return;
    }

    this.worker = child;
    this.workerRunId = runId;
    this.workerClaimedIds = claimedIds;
    this.workerStartedAt = Date.now();
    process.stderr.write(`[justify] dispatcher spawned worker ${runId} for ${claimedIds.length} prompt(s) in ${root}\n`);

    // The browser has been showing "Sending to Claude." since the user hit Send.
    // Tell it the daemon has the work and is applying it. One broadcast per
    // claimed prompt, matching what the MCP tools used to emit.
    for (const id of claimedIds) {
      this.broadcast('justify_working', { promptId: id, timestamp: Date.now() });
    }

    child.on('exit', (code) => this.onWorkerExit(runId, claimedIds, code));
    child.on('error', (err) => {
      process.stderr.write(`[justify] worker ${runId} error: ${err.message}\n`);
      this.onWorkerExit(runId, claimedIds, -1);
    });
  }

  // The observed-effect gate: after the worker exits, success is measured by
  // whether the claimed prompt ids were cleared from the queue (justify-done does
  // an id-scoped clear per answered prompt). Exit code alone is not trusted.
  private onWorkerExit(runId: string, claimedIds: string[], code: number | null): void {
    if (this.workerRunId !== runId) return; // stale callback
    this.worker = null;
    this.workerRunId = null;
    this.workerClaimedIds = [];

    const remaining = this.readPrompts();
    const stillPending = claimedIds.filter((id) => remaining.some((p) => p.id === id));

    if (stillPending.length === 0) {
      this.consecutiveFailures = 0;
      this.backoffUntil = 0;
      process.stderr.write(`[justify] worker ${runId} succeeded (all ${claimedIds.length} prompt(s) answered, exit=${code})\n`);
      // A batch that arrived while this worker ran may now be dispatchable.
      this.tick();
      return;
    }

    // Some claimed prompts were not answered. Release OUR claim on the unanswered
    // ones so they are re-dispatchable, then back off. NEVER disarm.
    this.releaseClaim(runId, stillPending);
    this.registerFailure();
    process.stderr.write(
      `[justify] worker ${runId} incomplete (exit=${code}); ${stillPending.length} prompt(s) unanswered, backing off ${Math.round((this.backoffUntil - Date.now()) / 1000)}s\n`,
    );
  }

  private releaseClaim(runId: string, ids: string[]): void {
    const prompts = this.readPrompts();
    let changed = false;
    for (const p of prompts) {
      if (ids.includes(p.id) && p.claimedBy === runId) {
        delete p.claimedBy;
        delete p.claimedAt;
        changed = true;
      }
    }
    if (changed) this.writePrompts(prompts);
  }

  private registerFailure(): void {
    this.consecutiveFailures++;
    const delay = Math.min(2 ** this.consecutiveFailures * 1000, this.maxBackoffMs);
    this.backoffUntil = Date.now() + delay;
  }
}
