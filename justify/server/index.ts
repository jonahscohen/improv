import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { existsSync } from 'fs';
import { get as httpGet } from 'http';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { WsServer } from './ws-server.js';
import { registerTools } from './mcp-tools.js';
import { WatchStateStore, resolveHeadless } from './watch-state.js';
import { Dispatcher } from './dispatcher.js';

// Port is overridable via JUSTIFY_WS_PORT so a test daemon can run off the live
// :9223 without fighting it for the port.
const DEFAULT_WS_PORT = Number(process.env.JUSTIFY_WS_PORT) || 9223;

process.on('uncaughtException', (err) => {
  process.stderr.write(`[justify] uncaughtException (kept alive): ${err?.message ?? err}\n`);
});
process.on('unhandledRejection', (reason) => {
  process.stderr.write(`[justify] unhandledRejection (kept alive): ${reason}\n`);
});

// Is a WATCH-CAPABLE justify daemon already answering on this port? If so, THIS
// instance (e.g. a per-session MCP spawn) must NOT kill it and replace it with a
// session-owned process - that would reintroduce the exact "watch dies with the
// session" failure this whole change removes; it defers instead.
//
// The probe checks /watch/state (available:true), NOT just /status server:justify:
// deferring to an OLD daemon that lacks the watch/dispatcher would leave the
// daemon-owned watch permanently ABSENT (the old daemon can't dispatch). A new
// node process must therefore REPLACE an old non-watch daemon, and only defer to
// a genuinely watch-capable one.
function probeWatchCapableDaemon(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = httpGet({ host: 'localhost', port, path: '/watch/state', timeout: 1500 }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)?.available === true); } catch { resolve(false); }
      });
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function killStaleProcess(port: number): Promise<void> {
  const { execFileSync } = await import('child_process');
  try {
    const result = execFileSync('lsof', ['-ti', `:${port}`], { encoding: 'utf-8' }).trim();
    if (result) {
      const pids = result.split('\n').filter(Boolean);
      for (const pid of pids) {
        if (parseInt(pid) !== process.pid) {
          try { process.kill(parseInt(pid), 'SIGTERM'); } catch {}
        }
      }
      await new Promise(r => setTimeout(r, 500));
    }
  } catch {}
}

// Resolve the worker script (justify-worker.sh) the dispatcher spawns. Installed
// layout keeps it at ~/.claude/justify/justify-worker.sh; the repo layout keeps
// it under justify/cli/. Env override wins for tests / bespoke installs.
function resolveWorkerScript(): string | undefined {
  const serverDir = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url));
  const base = join(serverDir, '..', '..'); // dist/server -> install/repo root of justify
  const candidates = [
    process.env.JUSTIFY_WORKER_SCRIPT,
    join(base, 'justify-worker.sh'),
    join(base, 'cli', 'justify-worker.sh'),
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return undefined;
}

async function main(): Promise<void> {
  // Defer to a healthy incumbent daemon rather than killing it (P0: a per-session
  // MCP spawn must never terminate the persistent :9223 daemon and replace it
  // with a session-owned process - that is the disease this whole change removes).
  const incumbent = await probeWatchCapableDaemon(DEFAULT_WS_PORT);
  const wsServer = new WsServer();
  let dispatcher: Dispatcher | null = null;

  if (incumbent) {
    // A healthy daemon already owns :9223 and runs the watch/dispatcher. This
    // instance does NOT bind the port and does NOT run a dispatcher - it provides
    // MCP stdio only, so it can never steal the port or double-dispatch, and it
    // dies harmlessly with its session while the incumbent keeps watching.
    process.stderr.write(
      `[justify] a healthy daemon already owns :${DEFAULT_WS_PORT} - deferring watch ownership (MCP stdio only; no HTTP server, no dispatcher).\n`,
    );
  } else {
    await killStaleProcess(DEFAULT_WS_PORT);
    const port = await wsServer.start(DEFAULT_WS_PORT);
    process.stderr.write(`Justify WebSocket server listening on port ${port}\n`);
    // Daemon-owned watch: state persisted to disk (resumes armed across
    // restarts). The daemon always owns the QUEUE. Whether it also does the WORK
    // depends on the dispatch mode: in OWNER mode (default) a batch waits
    // unclaimed for the attached owner; only in HEADLESS mode does the daemon
    // spawn justify-worker.sh itself. See dispatcher.ts.
    const watchStore = new WatchStateStore();
    // Dispatch mode, resolved ONCE and passed EXPLICITLY rather than left to the
    // Dispatcher's env fallback. An env var read deep inside the constructor is
    // invisible at the wiring layer and cannot survive a daemon restart, which is
    // how `JUSTIFY_HEADLESS=1` ended up documented-but-unreachable: nothing on the
    // supported launch path (justify-serve) ever set it. resolveHeadless() is the
    // single source of that decision, and it is directly under test.
    const headless = resolveHeadless(watchStore);
    dispatcher = new Dispatcher(watchStore, {
      port,
      workerScript: resolveWorkerScript(),
      headless,
      // Never take the work out from under an attached HTTP owner: a GET /prompts
      // poll is not a claim, so an owner mid-apply is invisible in the queue and
      // dispatching would double-apply it. See Dispatcher.ownerActive.
      ownerActive: (withinMs) => wsServer.httpOwnerActive(withinMs),
      // So a spawned worker immediately flips the browser pill off "Sending".
      broadcast: (event, payload) => wsServer.broadcastToClients(event, payload),
    });
    wsServer.attachWatch(watchStore, dispatcher);
    dispatcher.start();
    const st = watchStore.get();
    // Say WHICH MODE, not just "dispatcher live". The old line reported a live
    // dispatcher in both modes, so an owner-mode daemon that will never apply a
    // batch by itself looked identical to a headless one that will. That is the
    // reassuring green light that cost days of misdiagnosis (2026-07-12).
    const mode = headless
      ? 'HEADLESS - the daemon applies batches itself'
      : 'OWNER - batches WAIT for an attached owner to claim; the daemon will NOT apply them';
    process.stderr.write(
      `[justify] watch state: ${st.armed ? `ARMED (root=${st.projectRoot ?? 'none'}) - dispatcher live, mode=${mode}` : 'disarmed'}\n`,
    );

    // WATCHDOG: armed must mean watching. If the dispatch loop is ever not
    // running while the watch is armed - a thrown timer, a stray stop(), a future
    // refactor - restart it and say so. "Armed but not dispatching" is the exact
    // silent failure where the user believes Justify is receiving their changes
    // and it is not. Cheap to check; never allowed to persist.
    const watchdog = setInterval(() => {
      if (!dispatcher) return;
      if (watchStore.isArmed() && !dispatcher.running()) {
        process.stderr.write('[justify] WATCHDOG: watch is armed but the dispatcher stopped. Restarting it.\n');
        dispatcher.start();
        dispatcher.kick();
      }
    }, Number(process.env.JUSTIFY_WATCHDOG_MS) || 5000);
    if (typeof watchdog.unref === 'function') watchdog.unref();
  }

  const mcpServer = new McpServer({
    name: 'justify',
    version: '0.1.0',
  });

  registerTools(mcpServer, wsServer);

  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);

  process.on('SIGINT', async () => {
    if (dispatcher) dispatcher.stop();
    await wsServer.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  process.stderr.write(`Justify server error: ${err}\n`);
  process.exit(1);
});
