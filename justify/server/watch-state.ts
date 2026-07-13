import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

// The daemon-owned watch state. This is the SINGLE SOURCE OF TRUTH for whether
// Justify is watching - it lives on the persistent :9223 daemon, not on any
// Claude session. Persisted to disk so a daemon restart RESUMES armed (the watch
// never silently ends). Nothing else - not a session ending, not a worker error,
// not a daemon crash - may disarm.
//
// disarm() is CONSENT-GATED (2026-07-09, after an agent disarmed Jonah's watch
// mid-session to "unblock" itself and the tool silently stopped receiving his
// changes). The prior version of this comment asserted that only "explicit user
// action" could disarm, but nothing enforced it: the CLI and the MCP tool both
// called disarm() directly. The invariant is now executable, not aspirational.

export interface WatchState {
  armed: boolean;
  projectRoot: string | null;
  armedAt: number | null;
  armedBy: string | null;
  disarmedAt: number | null;
  disarmedBy: string | null;
  /**
   * Dispatch mode. false (default) = OWNER mode: the daemon owns the queue but
   * an attached owner does the work. true = HEADLESS: the daemon spawns
   * justify-worker.sh itself, for an unattended machine.
   *
   * This is PERSISTED, not env-only, and that is the whole point. The daemon is
   * a long-lived background process that gets restarted by `justify-serve
   * --restart` from arbitrary shells and hooks. An env-var-only opt-in
   * evaporates on the next restart, so `JUSTIFY_HEADLESS=1` was a switch that
   * could be documented but never actually held (2026-07-12). Armed state
   * already persists for exactly this reason; the dispatch mode has to persist
   * with it or "the daemon applies my batches" silently stops being true the
   * next time anything bounces the daemon.
   */
  headless: boolean;
}

const DEFAULT_STATE: WatchState = {
  armed: false,
  projectRoot: null,
  armedAt: null,
  armedBy: null,
  disarmedAt: null,
  disarmedBy: null,
  headless: false,
};

function defaultStatePath(): string {
  const base = process.env.JUSTIFY_STATE_DIR || join(homedir(), '.claude', 'justify');
  return join(base, 'watch-state.json');
}

export class WatchStateStore {
  private path: string;
  private state: WatchState;

  constructor(path?: string) {
    this.path = path || defaultStatePath();
    this.state = this.load();
  }

  private load(): WatchState {
    try {
      if (existsSync(this.path)) {
        const parsed = JSON.parse(readFileSync(this.path, 'utf-8')) as Partial<WatchState>;
        // armed is coerced to a strict boolean so a malformed file can never
        // leave the watch in an ambiguous "truthy" armed state. headless gets the
        // same treatment, and a state file written before headless existed simply
        // loads as false - owner mode, the safe default.
        return {
          ...DEFAULT_STATE,
          ...parsed,
          armed: parsed.armed === true,
          headless: parsed.headless === true,
        };
      }
    } catch {
      // Corrupt/unreadable state file -> start disarmed (safe default). The next
      // arm() rewrites it clean.
    }
    return { ...DEFAULT_STATE };
  }

  // Atomic write (temp file + rename) so a crash mid-write can never leave a
  // half-written state file that would silently load as disarmed on restart.
  // Returns false on failure so callers (arm/disarm) can fail LOUD rather than
  // report a success that did not durably persist.
  private persist(): boolean {
    try {
      mkdirSync(dirname(this.path), { recursive: true });
      const tmp = `${this.path}.tmp.${process.pid}.${Date.now()}`;
      writeFileSync(tmp, JSON.stringify(this.state, null, 2));
      renameSync(tmp, this.path);
      return true;
    } catch (err) {
      process.stderr.write(`[justify] watch-state persist FAILED (kept in memory): ${err instanceof Error ? err.message : err}\n`);
      return false;
    }
  }

  get(): WatchState {
    return { ...this.state };
  }

  isArmed(): boolean {
    return this.state.armed === true;
  }

  projectRoot(): string | null {
    return this.state.projectRoot;
  }

  isHeadless(): boolean {
    return this.state.headless === true;
  }

  // Set the dispatch mode. Unlike disarm() this is NOT consent-gated: it never
  // stops Justify from receiving changes, it only decides WHO applies them.
  // Fail-closed on the disk write, same as arm(): if the mode does not durably
  // land, keep the prior state so memory == disk == truth and let the caller
  // report the failure rather than a false OK.
  setHeadless(headless: boolean): WatchState & { persisted: boolean } {
    const prev = { ...this.state };
    this.state.headless = headless === true;
    const persisted = this.persist();
    if (!persisted) this.state = prev;
    return { ...this.get(), persisted };
  }

  // Arm the watch. Requires a projectRoot (where the daemon dispatches workers);
  // if an empty root is passed the previous root is kept so a re-arm from a path
  // -less caller does not blank a good root. `persisted` is false if the on-disk
  // write failed - the endpoint surfaces that as an error rather than a false OK.
  arm(projectRoot: string | null, by: string | null): WatchState & { persisted: boolean } {
    // Fail-CLOSED: mutate a copy and only commit it to memory if the disk write
    // succeeds. Otherwise the in-memory `armed` would diverge from disk - the
    // dispatcher would run armed while /watch/arm reported 500 and a restart would
    // load the old state. On persist failure we keep the PRIOR state so memory ==
    // disk == truth, and the caller (endpoint 500) knows the arm did not take.
    const prev = { ...this.state };
    this.state.armed = true;
    if (projectRoot && projectRoot.trim()) this.state.projectRoot = projectRoot.trim();
    this.state.armedAt = Date.now();
    this.state.armedBy = by || null;
    const persisted = this.persist();
    if (!persisted) this.state = prev;
    return { ...this.get(), persisted };
  }

  // Disarming is the ONE operation that silently turns Justify off, so it is
  // gated at the store itself - not only at the HTTP route. Callers must present
  // `{ granted: true }`, which the daemon only produces after consuming a live,
  // single-use human consent token (see consent.ts). A caller that omits it gets
  // `refused: true` and the watch KEEPS RUNNING.
  //
  // Enforcing here rather than only in ws-server means a future route, MCP tool,
  // or internal helper cannot reintroduce the hole by forgetting the check.
  disarm(by: string | null, consent?: { granted?: boolean }): WatchState & {
    persisted: boolean;
    refused: boolean;
    reason?: 'consent_required';
  } {
    if (consent?.granted !== true) {
      process.stderr.write(
        `[justify] REFUSED disarm by "${by ?? 'unknown'}" - no human consent. The watch stays armed.\n`,
      );
      return { ...this.get(), persisted: false, refused: true, reason: 'consent_required' };
    }

    const prev = { ...this.state };
    this.state.armed = false;
    this.state.disarmedAt = Date.now();
    this.state.disarmedBy = by || null;
    const persisted = this.persist();
    if (!persisted) this.state = prev;
    return { ...this.get(), persisted, refused: false };
  }

  statePath(): string {
    return this.path;
  }
}

/**
 * Resolve the dispatch mode the daemon should boot in. This is the ONE place that
 * decides it, so index.ts cannot drift from what the tests assert (an earlier
 * version of this logic was inlined in index.ts, which meant a test could only
 * re-implement it and would have kept passing if the daemon stopped honoring the
 * persisted mode entirely).
 *
 * Precedence: an explicit JUSTIFY_HEADLESS=1 in the environment wins, for one-off
 * and test runs. Otherwise the PERSISTED mode, which is what `justify-serve
 * --headless` sets and what survives a daemon restart. Default: false (owner).
 */
export function resolveHeadless(store: WatchStateStore, env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.JUSTIFY_HEADLESS === '1') return true;
  return store.isHeadless();
}
