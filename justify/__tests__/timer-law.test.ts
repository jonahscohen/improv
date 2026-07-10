import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

// THE TIMER LAW (Jonah, 2026-07-09)
//
//   "i dont want any FUCKING timer on anything inside of justify. i want it to
//    always fucking watch [...] justify is ON at ALL TIMES WATCHING until THE
//    USER stands it down. Not you. Not a fucking timeout. Not a timer. Not
//    Codex. Not your momma. Not anybody but the user."
//
// Operationally: **no state transition may be caused by the passage of time.**
//
// A timer that makes Justify try AGAIN, or try SOONER, is legal - it only ever
// moves toward doing the work (transport reconnect backoff, dispatcher tick,
// outbox retry backoff, claim TTL re-dispatch).
//
// A timer that STOPS, GIVES UP, MARKS FAILED, or DROPS A PROMPT is illegal.
//
// This file is the mechanical gate. It reads the real source and fails if any of
// the removed constructs return. It exists because these regressions are easy to
// reintroduce (they all look like reasonable defensive engineering) and
// impossible to notice from a green UI.

const ROOT = join(__dirname, '..');

/** Strip // and /* *\/ comments so prose describing a ban does not trip it. */
function code(file: string): string {
  const src = readFileSync(file, 'utf-8');
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n');
}

/**
 * Every setTimeout/setInterval call body in `src`, extracted by matching parens.
 *
 * A regex cannot do this. The first version of this file used
 * `/set(?:Timeout|Interval)\(([\s\S]*?)\),\s*\d+\)/` and silently passed a
 * reintroduced `setTimeout(() => { this._claudeToRetry(); }, 60000)`, because
 * that body ends in `}` rather than `)`. A guard that cannot fail is not a guard.
 */
export function timerBodies(src: string): string[] {
  const bodies: string[] = [];
  const re = /\bset(?:Timeout|Interval)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      i++;
    }
    if (depth === 0) bodies.push(src.slice(start, i - 1));
  }
  return bodies;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|js)$/.test(p) && !p.includes('__tests__')) out.push(p);
  }
  return out;
}

const sourceFiles = [...walk(join(ROOT, 'core')), ...walk(join(ROOT, 'server'))];
const rel = (f: string) => relative(ROOT, f);

describe('The Timer Law: no clock may stop Justify', () => {
  it('the 60-second claudebar retry watchdog is gone and stays gone', () => {
    const offenders = sourceFiles.filter((f) =>
      /_claudeTimeout|_armRetryWatchdog|_daemonIsBusy/.test(code(f)),
    );
    expect(offenders.map(rel)).toEqual([]);
  });

  it('no timer callback anywhere transitions the claudebar into its failed state', () => {
    // Any timer body that reaches the retry/failed/disconnected transition, at
    // ANY delay and in ANY body shape (arrow-expression or block).
    const offenders: string[] = [];
    for (const f of sourceFiles) {
      for (const body of timerBodies(code(f))) {
        if (/_claudeToRetry|_showDisconnectedBar|_onWatchDisconnected/.test(body)) {
          offenders.push(`${rel(f)}: ${body.slice(0, 80).replace(/\s+/g, ' ')}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('a prompt is never sent through a rejectable request - only through the outbox', () => {
    // `transport.request('push_prompt', ...)` rejects on `Not connected` and on
    // its own 10s stopwatch. Every prompt must go through `sendPrompt`, which
    // cannot fail. `core/transport.ts` is the one place allowed to name it, in
    // the outbox's own enqueue call.
    const offenders = sourceFiles
      .filter((f) => !f.endsWith(join('core', 'transport.ts')))
      .filter((f) => /transport\s*\.\s*request\s*\(\s*['"]push_prompt['"]/.test(code(f)));
    expect(offenders.map(rel)).toEqual([]);
  });

  it('a failed /watch-status fetch never disconnects the watch (silence is not a disarm)', () => {
    const src = code(join(ROOT, 'core', 'index.ts'));
    const monitor = src.slice(src.indexOf('_startWatchMonitor'));
    const body = monitor.slice(0, monitor.indexOf('_watchPollInterval = window.setInterval'));
    const catchBlock = body.slice(body.lastIndexOf('.catch('));
    expect(catchBlock).not.toMatch(/_onWatchDisconnected|_watchMissCount\s*\+\+/);
  });

  it('the 30-second recent-activity window can no longer turn a waiting watch off', () => {
    const offenders = sourceFiles.filter((f) => /recentActivity/.test(code(f)));
    expect(offenders.map(rel)).toEqual([]);
  });

  it('the dispatcher backoff is capped and has NO attempt limit (it retries forever)', () => {
    const src = code(join(ROOT, 'server', 'dispatcher.ts'));
    // A cap on the DELAY is legal and required.
    expect(src).toMatch(/Math\.min\([\s\S]{0,80}maxBackoffMs\)/);
    // A cap on the number of ATTEMPTS is not. Nothing may compare the failure
    // counter against a ceiling and stop.
    expect(src).not.toMatch(/consecutiveFailures\s*[><]=?\s*\d/);
    expect(src).not.toMatch(/maxAttempts|MAX_ATTEMPTS|giveUp|abandon/i);
  });

  it('a worker that is reaped for hanging releases its claim instead of dropping the prompt', () => {
    const src = code(join(ROOT, 'server', 'dispatcher.ts'));
    const onExit = src.slice(src.indexOf('private onWorkerExit'));
    // Success is measured by observed effect (the prompt left the queue), never
    // by exit code; anything still pending is released for re-dispatch.
    expect(onExit).toMatch(/releaseClaim\(runId,\s*stillPending\)/);
    // And a failing worker must never disarm the watch.
    expect(onExit).not.toMatch(/disarm/i);
  });

  it('the outbox is rehydrated on CONNECT, not merely on the next send', () => {
    // Codex, 2026-07-09: `this.outbox?.onConnected()` silently does nothing when
    // the outbox has not been constructed yet. After a reload, a prompt persisted
    // in localStorage would sit there until the user happened to send another one.
    // Both connect paths must therefore go through getOutbox(), which constructs
    // (and thus loads) it.
    const src = code(join(ROOT, 'core', 'transport.ts'));
    expect(src).not.toMatch(/this\.outbox\?\.onConnected\(\)/);
    expect((src.match(/this\.getOutbox\(\)\.onConnected\(\)/g) ?? []).length).toBe(2);
  });

  it('an ack is never returned for a prompt that was not durably written', () => {
    // writePrompts used to swallow its error while push_prompt still answered
    // {accepted: 1}; the browser outbox deletes its only copy on an ack.
    const src = code(join(ROOT, 'server', 'mcp-tools.ts'));
    const fn = src.slice(src.indexOf('function writePrompts'), src.indexOf('function nextPromptId'));
    expect(fn).not.toMatch(/catch\s*\{\s*\}/); // no silent swallow
    expect(fn).toMatch(/renameSync/); // atomic
  });

  it('reading prompts over MCP LEASES them - it never deletes unapplied work', () => {
    const src = code(join(ROOT, 'server', 'mcp-tools.ts'));
    // The old `writePrompts(all.filter(p => !takenIds.has(p.id)))` dropped the
    // prompt if the reading session then died.
    expect(src).not.toMatch(/writePrompts\(all\.filter\(\(p\) => !takenIds\.has\(p\.id\)\)\)/);
    expect((src.match(/claimedBy: `interactive:\$\{leaseId\}`/g) ?? []).length).toBe(2);
  });

  it('nothing in the daemon disarms the watch except an explicit, consented disarm', () => {
    const offenders: string[] = [];
    for (const f of sourceFiles) {
      for (const body of timerBodies(code(f))) {
        if (/\.disarm\s*\(/.test(body)) offenders.push(rel(f));
      }
    }
    expect(offenders).toEqual([]);
  });
});
