import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { WsServer } from './ws-server.js';
import type { StyleChange, Annotation, LayoutPlacement, EnvironmentInfo } from './types.js';
import { formatEnvironmentLines, normalizeEnvironment, environmentsEqual } from './environment.js';
import { readFileSync, writeFileSync, renameSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

function text(content: string) {
  return { content: [{ type: 'text' as const, text: content }] };
}

export function registerTools(mcp: McpServer, ws: WsServer): void {
  const pendingChanges: StyleChange[] = [];
  // The browser environment of the most recent push_changes batch, documented in
  // justify_apply_changes so Claude knows the viewport/DPR/browser/OS the
  // manipulation was authored at when translating it to source.
  let pendingChangesEnv: EnvironmentInfo | null = null;
  const annotations: Annotation[] = [];
  // Honor JUSTIFY_STATE_DIR so the browser's push_prompt writes to the SAME
  // prompts.json the daemon dispatcher reads (production: ~/.claude/justify).
  const STATE_DIR = process.env.JUSTIFY_STATE_DIR || join(homedir(), '.claude', 'justify');
  const PROMPT_FILE = join(STATE_DIR, 'prompts.json');
  const SEQ_FILE = join(STATE_DIR, 'prompt-seq.json');
  const RESP_FILE = join(STATE_DIR, 'responses.json');
  const CLEARED_FILE = join(STATE_DIR, 'responses-cleared.json');
  const CLIENT_FILE = join(STATE_DIR, 'served-clients.json');

  // Highest prompt-<N> ever RESPONDED to (responses.json ids are
  // "prompt-<N>-<ts>"). This is a high-water mark that survives a lost/corrupt
  // prompt-seq.json AND a cleared queue, so ids can never recycle back down.
  function maxRespondedSeq(): number {
    try {
      const arr = JSON.parse(readFileSync(RESP_FILE, 'utf-8'));
      if (!Array.isArray(arr)) return 0;
      let max = 0;
      for (const r of arr) {
        const m = /^prompt-(\d+)(?:-|$)/.exec(String(r?.promptId ?? ''));
        if (m) { const n = parseInt(m[1], 10); if (Number.isFinite(n) && n > max) max = n; }
      }
      return max;
    } catch { return 0; }
  }

  // Highest prompt-<N> present in the cleared TOMBSTONES (responses-cleared.json
  // holds base ids "prompt-<N>" and precise keys "prompt-<N>-<ts>|<ts>"). A clear
  // now tombstones the TASK (base id), and that tombstone OUTLIVES the response
  // it removed from responses.json. If prompt-seq.json were lost/corrupt, the
  // responses-only high-water could reissue a prompt-<N> whose stale base
  // tombstone would then wrongly drop the new task's answer. Including the
  // tombstones in the high-water closes that reuse hazard. (Codex, 2026-08-08.)
  function maxClearedSeq(): number {
    try {
      const arr = JSON.parse(readFileSync(CLEARED_FILE, 'utf-8'));
      if (!Array.isArray(arr)) return 0;
      let max = 0;
      for (const t of arr) {
        const m = /^prompt-(\d+)(?:-|\||$)/.exec(String(t ?? ''));
        if (m) { const n = parseInt(m[1], 10); if (Number.isFinite(n) && n > max) max = n; }
      }
      return max;
    } catch { return 0; }
  }

  type QueuePrompt = { id: string; context: string; prompt: string; elementCount: number; timestamp: number; selectors?: string[]; claimedBy?: string; claimedAt?: number; clientId?: string };

  // Ledger of clientIds already accepted, so the browser outbox's forever-retry
  // can never enqueue the same prompt twice. Capped at CLIENT_LEDGER_MAX entries,
  // oldest evicted first - a SIZE bound, never an age bound.
  const CLIENT_LEDGER_MAX = 500;

  function readServedClientIds(): Array<[string, string]> {
    try {
      const arr = JSON.parse(readFileSync(CLIENT_FILE, 'utf-8'));
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }

  function lookupServedClientId(clientId: string): string | null {
    const hit = readServedClientIds().find(([cid]) => cid === clientId);
    return hit ? hit[1] : null;
  }

  // Best-effort, and deliberately so. This runs AFTER the prompt is durably
  // queued. Throwing here would deny the ack, which forces the browser to retry a
  // prompt that is already safely queued - and if the worker clears it before that
  // retry lands, the retry double-applies. That is the exact failure the ledger
  // exists to prevent. So: a ledger write failure is loud, but it still acks.
  function recordServedClientId(clientId: string, promptId: string): void {
    const entries = readServedClientIds().filter(([cid]) => cid !== clientId);
    entries.push([clientId, promptId]);

    // Evict oldest-first. There is deliberately NO "don't evict a still-queued id"
    // special case: a still-queued prompt is deduped by the QUEUE lookup in
    // push_prompt, which runs before the ledger is ever consulted. Such a guard
    // would protect only entries that need no protection, while implying coverage
    // it does not provide. (I wrote that guard. The test I wrote for it passed
    // with the guard deleted - it was measuring the queue lookup, not the guard.)
    //
    // The ledger's real job is the window between "the worker applied and CLEARED
    // the prompt" and "the browser finally receives an ack". The outbox retries
    // every <=15s, so that window is bounded by ack latency, not by prompt volume;
    // 500 entries is a wide margin over it. The tests pin the exact boundary.
    while (entries.length > CLIENT_LEDGER_MAX) entries.shift();

    const tmp = `${CLIENT_FILE}.tmp`;
    try {
      writeFileSync(tmp, JSON.stringify(entries));
      renameSync(tmp, CLIENT_FILE);
    } catch (err) {
      process.stderr.write(
        `[justify] WARNING: could not record served clientId ${clientId} -> ${promptId}: ` +
        `${err instanceof Error ? err.message : String(err)}. ` +
        `The prompt IS queued; a lost ack could now double-apply it.\n`,
      );
    }
  }

  function readPrompts(): QueuePrompt[] {
    try { return JSON.parse(readFileSync(PROMPT_FILE, 'utf-8')); } catch { return []; }
  }

  // THROWS on failure, and writes atomically. It used to swallow the error, so
  // `push_prompt` would answer `{accepted: 1}` for a prompt that never reached
  // prompts.json - and the browser outbox, seeing an ack, would delete its only
  // copy. An ack is a promise that the work is durable. Never lie about it.
  function writePrompts(prompts: QueuePrompt[]): void {
    const tmp = `${PROMPT_FILE}.tmp`;
    writeFileSync(tmp, JSON.stringify(prompts));
    renameSync(tmp, PROMPT_FILE);
  }

  // Server-assigned MONOTONIC prompt id. The old scheme (max currently-queued id
  // + 1) RECYCLED ids back to prompt-1 whenever the queue emptied after a clear,
  // so a fresh request could reuse an id an in-flight clear then consumed -
  // cross-clearing data loss (observed live 2026-07-08: 13 responses all keyed
  // "prompt-1"; a fresh scrub was cleared unapplied by a clear aimed at an
  // earlier prompt-1). The counter is persisted and NEVER resets, so every prompt
  // gets a globally-unique id and a clear-by-id can only ever remove the exact
  // request it answered.
  function nextPromptId(): string {
    let persistedNext = 0;
    try {
      const raw = JSON.parse(readFileSync(SEQ_FILE, 'utf-8'));
      if (Number.isFinite(raw?.next)) persistedNext = Math.floor(raw.next);
    } catch {
      // no counter yet -> seed from the queue below
    }
    // Never collide with an id already in the queue (pre-counter installs, or an
    // out-of-band write).
    const maxQueued = readPrompts().reduce((max, p) => {
      const n = parseInt(String(p.id).replace('prompt-', ''), 10);
      return Number.isFinite(n) && n > max ? n : max;
    }, 0);
    // Seed from the max of the persisted counter, the queue, the responded
    // high-water mark, AND the cleared-tombstone high-water. Even if
    // prompt-seq.json is lost/corrupt and the queue is empty, the responses
    // history and the tombstones keep ids strictly increasing (no recycle, and
    // no reissue of an id a task tombstone would still drop).
    const seq = Math.max(
      persistedNext,
      maxQueued + 1,
      maxRespondedSeq() + 1,
      maxClearedSeq() + 1,
      1,
    );
    try {
      const tmp = `${SEQ_FILE}.tmp.${process.pid}.${Date.now()}`;
      writeFileSync(tmp, JSON.stringify({ next: seq + 1 }));
      renameSync(tmp, SEQ_FILE);
    } catch (err) {
      process.stderr.write(`[justify] prompt-seq persist failed (recycle guarded by responses high-water mark): ${err instanceof Error ? err.message : err}\n`);
    }
    return 'prompt-' + seq;
  }
  let layoutPlacements: LayoutPlacement[] = [];

  // WebSocket push handlers - browser pushes data into these buffers
  ws.onMessage('push_changes', (_connectionId, params) => {
    const changes = (params?.changes ?? []) as StyleChange[];
    const wasEmpty = pendingChanges.length === 0;
    pendingChanges.push(...changes);
    // Keep the documented env honest across accumulated batches. Show it only
    // when every batch since the last apply/clear agrees; the moment two batches
    // (e.g. two tabs at different viewports) disagree, or a batch arrives with no
    // usable env, drop to null so apply omits it rather than attributing one
    // batch's viewport/DPR/browser to another's changes. Untrusted input is
    // normalized first so a malformed payload cannot crash the render path.
    const incoming = normalizeEnvironment(params?.environment);
    if (wasEmpty) {
      pendingChangesEnv = incoming;
    } else if (!environmentsEqual(incoming, pendingChangesEnv)) {
      pendingChangesEnv = null;
    }
    return { accepted: changes.length };
  });

  ws.onMessage('push_annotations', (_connectionId, params) => {
    const incoming = (params?.annotations ?? []) as Annotation[];
    // Sanitize the untrusted per-annotation environment to the documented shape
    // (or drop it) so get_annotations never forwards an oversized or
    // instruction-bearing userAgent/field verbatim into Claude's context.
    for (const a of incoming) {
      const env = normalizeEnvironment(a.environment);
      if (env) a.environment = env;
      else delete a.environment;
    }
    annotations.push(...incoming);
    return { accepted: incoming.length };
  });

  // Idempotent on `clientId`. The browser outbox (core/outbox.ts) retries a
  // push_prompt FOREVER - no deadline, no attempt cap - because no clock is
  // allowed to drop a user's prompt. That is only safe if a retry cannot enqueue
  // a second copy of work the daemon already has (or already finished, and has
  // since cleared from the queue). So an acked clientId is remembered in a ledger
  // that outlives the queue entry, and a repeat is ACKED rather than enqueued.
  //
  // The ledger is capped by SIZE, not by age. An age cap would be a clock
  // deciding when a duplicate is allowed to become a double-apply.
  ws.onMessage('push_prompt', (_connectionId, params) => {
    const clientId = typeof params?.clientId === 'string' ? params.clientId : null;

    if (clientId) {
      // Already queued under this clientId? (ack lost before the browser saw it)
      const queued = readPrompts().find((p) => p.clientId === clientId);
      if (queued) {
        // The prompt is still in the queue - re-announce its CURRENT state, or a
        // browser that missed the first broadcast would sit on "Sending" forever
        // for a prompt that is safely on disk. The re-send is a duplicate; the
        // STATE is not.
        //
        // But announce what is actually TRUE of it now. A prompt an owner has
        // already CLAIMED is being worked on, not waiting: its `justify_working`
        // went out at claim time, and a retry that arrives afterwards (a lost ack,
        // a reconnect) must not walk the bar BACKWARDS into "Queued for Claude" -
        // it would strand there, because the claim event that would have moved it
        // on has already been and gone. Caught by an adversarial Codex review,
        // 2026-07-12.
        const isClaimed = typeof (queued as Record<string, unknown>).claimedBy === 'string';
        ws.broadcastToClients(isClaimed ? 'justify_working' : 'justify_queued', {
          promptId: queued.id,
          timestamp: Date.now(),
        });
        return { accepted: 0, promptId: queued.id, duplicate: true };
      }
      // Already served and cleared? (worker applied it, then the ack was lost)
      const servedId = lookupServedClientId(clientId);
      if (servedId) return { accepted: 0, promptId: servedId, duplicate: true };
    }

    const id = nextPromptId();
    const prompt: QueuePrompt = {
      id,
      context: (params?.context ?? '') as string,
      prompt: (params?.prompt ?? '') as string,
      elementCount: (params?.elementCount ?? 0) as number,
      // Issue #1: structured target selectors of the element(s) the prompt was
      // about, so the daemon can join them onto the response and the Changes
      // panel can scroll to + select the target on click.
      selectors: (Array.isArray(params?.selectors) ? params?.selectors : []) as string[],
      timestamp: Date.now(),
      ...(clientId ? { clientId } : {}),
    };
    // If this write fails it THROWS, the ws layer returns an error, and the
    // browser outbox keeps its copy and retries. Never ack an undurable prompt.
    const prompts = readPrompts(); prompts.push(prompt); writePrompts(prompts);
    if (clientId) recordServedClientId(clientId, id);

    // THE PROMPT IS NOW DURABLE. Say so, immediately.
    //
    // This broadcast is the fix for the Claudebar sitting on "Sending to Claude."
    // forever (Jonah, repeatedly; measured 2026-07-12). The browser had no state
    // for "accepted and queued, waiting for an owner", so its ONLY exit from
    // 'sending' was `justify_working` - which the daemon fires from the GET
    // /prompts poll and from the dispatcher spawning a worker.
    //
    // In HEADLESS mode that was invisible: the dispatcher claimed the batch about
    // a tick after it landed, so "Sending" -> "Working" took ~a second and nobody
    // noticed the missing state. In OWNER mode (the default since 2026-07-09) the
    // batch legitimately WAITS, unclaimed, until a live owner gets around to
    // polling - which can be minutes, or never. For that entire gap the bar said
    // "Sending to Claude.", which is FALSE (the send finished, was acked, and is
    // on disk) and is indistinguishable from a lost send. That is why the bug kept
    // getting re-reported as "my batch vanished."
    //
    // Fired on the ACK path, so it cannot lie: it is emitted only after
    // writePrompts() durably landed the prompt.
    ws.broadcastToClients('justify_queued', { promptId: id, timestamp: Date.now() });
    return { accepted: 1, promptId: id };
  });

  ws.onMessage('push_layout', (_connectionId, params) => {
    const placements = (params?.placements ?? []) as LayoutPlacement[];
    layoutPlacements = placements;
    return { accepted: placements.length };
  });

  // Tool: justify_activate
  mcp.tool(
    'justify_activate',
    'Activate the Justify overlay in the browser. If no browser is connected, returns a script tag to inject.',
    {},
    async () => {
      ws.recordMcpActivity();
      const connections = ws.getConnections();
      const port = ws.getPort();

      if (connections.length > 0) {
        ws.broadcastToClients('activate');
        return text(`Activated. Broadcasting to ${connections.length} connected client(s).`);
      }

      return text(
        `No browser connected. Run \`justify-init\` in the project directory to add the script to the page, ` +
        `or add \`<script src="/justify-core.js"></script>\` to the page's HTML.\n\n` +
        `The MCP server is listening on port ${port} for WebSocket connections.`
      );
    },
  );

  // Tool: justify_status
  mcp.tool(
    'justify_status',
    'Return current connection and buffer status',
    {},
    async () => {
      ws.recordMcpActivity();
      const connections = ws.getConnections().map((c) => ({
        id: c.id,
        tabUrl: c.tabUrl,
        tabTitle: c.tabTitle,
        connectedAt: c.connectedAt,
      }));
      const status = {
        connections,
        pending: {
          changes: pendingChanges.length,
          annotations: annotations.length,
          prompts: readPrompts().length,
          layoutPlacements: layoutPlacements.length,
        },
        wsPort: ws.getPort(),
      };
      return text(JSON.stringify(status, null, 2));
    },
  );

  // Tool: justify_get_selection
  mcp.tool(
    'justify_get_selection',
    'Get the currently selected element from the browser',
    {},
    async () => {
      ws.recordMcpActivity();
      const connections = ws.getConnections();
      if (connections.length === 0) {
        return text('No browser connected');
      }
      return text('Selection capture not yet implemented - use justify_get_annotations for annotated elements');
    },
  );

  // Tool: justify_get_pending_changes
  mcp.tool(
    'justify_get_pending_changes',
    'Return all pending style changes pushed from the browser',
    {},
    async () => {
      ws.recordMcpActivity();
      if (pendingChanges.length === 0) {
        return text('No pending changes');
      }
      return text(JSON.stringify(pendingChanges, null, 2));
    },
  );

  // Tool: justify_apply_changes
  mcp.tool(
    'justify_apply_changes',
    'Format pending style changes as human-readable diffs, clear the buffer, and notify browser',
    {},
    async () => {
      ws.recordMcpActivity();
      if (pendingChanges.length === 0) {
        return text('No pending changes to apply');
      }

      const lines: string[] = [];
      // Document the environment the manipulation was authored in, so Claude has
      // the viewport/DPR/browser/OS context when translating it to source.
      if (pendingChangesEnv) {
        lines.push('Environment:');
        for (const line of formatEnvironmentLines(pendingChangesEnv)) {
          lines.push(`  ${line}`);
        }
        lines.push('');
      }
      for (const change of pendingChanges) {
        lines.push(change.selector);
        lines.push(`  ${change.property}: ${change.oldValue} -> ${change.newValue}`);
      }

      const summary = lines.join('\n');
      const count = pendingChanges.length;

      // Clear buffer
      pendingChanges.length = 0;
      pendingChangesEnv = null;

      // Notify browser
      ws.broadcastToClients('changes_applied', { count });

      return text(`Applied ${count} change(s):\n\n${summary}`);
    },
  );

  // Tool: justify_get_annotations
  mcp.tool(
    'justify_get_annotations',
    'Return pending design annotations from the browser',
    {
      verbosity: z
        .enum(['compact', 'standard', 'detailed', 'forensic'])
        .optional()
        .describe('How much detail to include per annotation'),
    },
    async ({ verbosity = 'standard' }) => {
      ws.recordMcpActivity();
      if (annotations.length === 0) {
        return text('No pending annotations');
      }

      let output: unknown[];

      if (verbosity === 'compact') {
        output = annotations.map((a) => ({
          id: a.id,
          intent: a.intent,
          severity: a.severity,
          comment: a.comment,
          selector: a.elementSelector,
          status: a.status,
        }));
      } else if (verbosity === 'standard') {
        output = annotations.map((a) => ({
          id: a.id,
          intent: a.intent,
          severity: a.severity,
          comment: a.comment,
          selector: a.elementSelector,
          elementPath: a.elementPath,
          boundingBox: a.boundingBox,
          environment: a.environment,
          status: a.status,
          timestamp: a.timestamp,
        }));
      } else if (verbosity === 'detailed') {
        output = annotations.map((a) => ({
          ...a,
          computedStyles: Object.keys(a.computedStyles).length > 0 ? a.computedStyles : undefined,
        }));
      } else {
        // forensic - everything
        output = annotations;
      }

      return text(JSON.stringify(output, null, 2));
    },
  );

  // Tool: justify_watch
  mcp.tool(
    'justify_watch',
    'Block until a prompt arrives from the browser, then return its full content ready for processing. Broadcasts working status to the browser immediately on receipt. Call this in a loop. When it returns prompt data, process it and call justify_respond, then call justify_watch again.',
    {
      timeout: z
        .number()
        .optional()
        .describe('Maximum seconds to wait (default 120)'),
    },
    async ({ timeout = 120 }) => {
      ws.setWatchSession(true);
      ws.recordMcpActivity();
      const deadline = Date.now() + timeout * 1000;

      await new Promise<void>((resolve) => {
        const check = () => {
          ws.recordMcpActivity();
          if (readPrompts().length > 0 || Date.now() >= deadline) {
            resolve();
          } else {
            setTimeout(check, 250);
          }
        };
        check();
      });

      const all = readPrompts();
      const leaseId = `${process.pid}:${Date.now().toString(36)}`;
      // Claim-aware: only take UNCLAIMED prompts. Daemon-claimed prompts belong to
      // a headless worker; consuming them here would double-apply and could fool
      // the dispatcher's observed-effect check. Lease ONLY the ones this call
      // takes, leaving claimed + newly-arrived prompts queued.
      const mine = all.filter((p) => !p.claimedBy);
      if (mine.length === 0) {
        return text(JSON.stringify({ status: 'idle', message: 'No unclaimed prompts (the daemon may be handling the queue). Still watching.' }));
      }
      for (const p of mine) {
        ws.broadcastToClients('justify_working', { promptId: p.id, timestamp: Date.now() });
      }
      const out = mine.map((p) =>
        `[${p.id}] Prompt: ${p.prompt}\nElements: ${p.elementCount}\nContext:\n${p.context}`
      ).join('\n\n---\n\n');
      // LEASE, do not delete. Removing the prompt here means that if this session
      // dies between reading it and answering it, the user's work is gone with no
      // trace - a dropped prompt, which is forbidden. Claiming it instead makes
      // the read a lease: justify-done's id-scoped clear removes it on success,
      // and an abandoned claim goes stale and is re-dispatched by the daemon.
      const takenIds = new Set(mine.map((p) => p.id));
      const claimedAt = Date.now();
      writePrompts(all.map((p) =>
        takenIds.has(p.id) ? { ...p, claimedBy: `interactive:${leaseId}`, claimedAt } : p,
      ));
      return text(out);
    },
  );

  // Tool: justify_acknowledge
  mcp.tool(
    'justify_acknowledge',
    'Mark an annotation as acknowledged/resolved',
    {
      annotationId: z.string().describe('The id of the annotation to acknowledge'),
    },
    async ({ annotationId }) => {
      ws.recordMcpActivity();
      const annotation = annotations.find((a) => a.id === annotationId);
      if (!annotation) {
        return text(`Annotation not found: ${annotationId}`);
      }
      annotation.status = 'acknowledged';
      ws.broadcastToClients('annotation_acknowledged', { annotationId });
      return text(`Acknowledged annotation ${annotationId}`);
    },
  );

  // Tool: justify_get_layout
  mcp.tool(
    'justify_get_layout',
    'Return current layout placements from the browser canvas',
    {},
    async () => {
      ws.recordMcpActivity();
      if (layoutPlacements.length === 0) {
        return text('No layout placements received');
      }
      return text(JSON.stringify(layoutPlacements, null, 2));
    },
  );

  // Tool: justify_get_prompts
  mcp.tool(
    'justify_get_prompts',
    'Return and clear pending prompts from the browser. Each prompt includes an id you must pass back to justify_respond.',
    {},
    async () => {
      ws.recordMcpActivity();
      const all = readPrompts();
      const leaseId = `${process.pid}:${Date.now().toString(36)}`;
      // Claim-aware (see justify_watch): never consume daemon-claimed prompts;
      // lease only the unclaimed ones.
      const mine = all.filter((p) => !p.claimedBy);
      if (mine.length === 0) {
        return text('No unclaimed prompts (the daemon may be handling the queue).');
      }
      for (const p of mine) {
        ws.broadcastToClients('justify_working', { promptId: p.id, timestamp: Date.now() });
      }
      const out = mine.map((p) =>
        `[${p.id}] Prompt: ${p.prompt}\nElements: ${p.elementCount}\nContext:\n${p.context}`
      ).join('\n\n---\n\n');
      // LEASE, do not delete. Removing the prompt here means that if this session
      // dies between reading it and answering it, the user's work is gone with no
      // trace - a dropped prompt, which is forbidden. Claiming it instead makes
      // the read a lease: justify-done's id-scoped clear removes it on success,
      // and an abandoned claim goes stale and is re-dispatched by the daemon.
      const takenIds = new Set(mine.map((p) => p.id));
      const claimedAt = Date.now();
      writePrompts(all.map((p) =>
        takenIds.has(p.id) ? { ...p, claimedBy: `interactive:${leaseId}`, claimedAt } : p,
      ));
      return text(out);
    },
  );

  // Tool: justify_respond
  mcp.tool(
    'justify_respond',
    'Send results back to the browser after processing a prompt. Call this after making code changes to notify the user what changed.',
    {
      promptId: z.string().describe('The prompt id from justify_get_prompts'),
      summary: z.string().describe('Human-readable summary of what changed'),
      filesChanged: z.array(z.string()).describe('List of files that were modified'),
      changes: z.array(z.object({
        selector: z.string().describe('CSS selector of the affected element'),
        property: z.string().describe('CSS property or attribute changed'),
        oldValue: z.string().describe('Previous value'),
        newValue: z.string().describe('New value'),
      })).describe('Individual property changes made'),
      status: z.enum(['completed', 'needsInfo', 'failed']).describe('Result status'),
      question: z.string().optional().describe('Follow-up question if status is needsInfo'),
    },
    async ({ promptId, summary, filesChanged, changes, status, question }) => {
      ws.recordMcpActivity();
      // Route through the shared helper so the MCP path is as durable/complete as
      // the HTTP path: headless persist when no client is connected, targetSelectors
      // joined from the original prompt, diffs, and the respondedAt stamp.
      ws.emitResponse({ promptId, summary, filesChanged, changes, status, question });

      if (status === 'completed') {
        return text(`Response sent to browser: ${summary} (${filesChanged.length} file(s), ${changes.length} change(s))`);
      } else if (status === 'needsInfo') {
        return text(`Question sent to browser: ${question}`);
      } else {
        return text(`Failure reported to browser: ${summary}`);
      }
    },
  );

  // Tool: justify_get_components
  mcp.tool(
    'justify_get_components',
    'Return available components from the project component scanner',
    {},
    async () => {
      ws.recordMcpActivity();
      return text('Component scanner not yet connected');
    },
  );

  // Tool: justify_clear
  mcp.tool(
    'justify_clear',
    'Clear all pending buffers (changes, annotations, layout placements) and notify the browser',
    {},
    async () => {
      ws.recordMcpActivity();
      const counts = {
        changes: pendingChanges.length,
        annotations: annotations.length,
        prompts: readPrompts().length,
        layoutPlacements: layoutPlacements.length,
      };

      pendingChanges.length = 0;
      pendingChangesEnv = null;
      annotations.length = 0;
      writePrompts([]);
      layoutPlacements = [];

      ws.broadcastToClients('cleared');

      return text(
        `Cleared all buffers. Removed: ${counts.changes} change(s), ${counts.annotations} annotation(s), ${counts.layoutPlacements} layout placement(s).`,
      );
    },
  );

  // Tool: justify_end_watch
  mcp.tool(
    'justify_end_watch',
    'Attempt to end the watch. An AGENT CANNOT DISARM THE WATCH: the daemon requires a single-use consent token that only a human can mint by running `justify-watch-disarm` in a terminal and confirming. Calling this tool will refuse and the watch will keep running. Relay the refusal to the user and ask them to run the command themselves.',
    {},
    async () => {
      // Order matters. Disarm FIRST, and only drop the browser-facing "watching"
      // flag if the daemon actually disarmed. The old order cleared the session
      // flag up front, so a refused (or failed) disarm still told the browser
      // Claude had stopped watching - the UI lied while the daemon kept running.
      const r = ws.disarmWatch('mcp:end_watch');

      if (!r.available) {
        ws.setWatchSession(false);
        return text('Watch session ended (no daemon watch state attached to disarm).');
      }

      if (r.refused) {
        return text(
          `REFUSED: the watch is still ARMED and still watching (${r.reason}).\n` +
          'Disarming requires human consent. Tell the user to run this themselves, in their terminal:\n\n' +
          '    justify-watch-disarm\n\n' +
          'It will ask them to confirm. Do not attempt to work around this.',
        );
      }

      if (!r.persisted) {
        return text('WARNING: disarm did NOT persist to disk - the watch may resume armed on restart. Ask the user to run justify-watch-disarm.');
      }

      ws.setWatchSession(false);
      return text('Watch disarmed on the daemon (human consent verified) and session flag cleared.');
    },
  );
}
