# Justify Closure-Contract (server-side) Implementation Plan

> Authored against commit **a2e768d5**. Before executing, run `git rev-parse --short HEAD`; if HEAD has moved, re-verify the current-state claims below (file line ranges, helper names, the two respond paths) before acting.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Justify daemon structurally guarantee that a task claimed from the browser always reaches a terminal, user-readable outcome - so a review can never sit on "Working" forever, even if the watcher agent dies.

**Architecture:** Route both respond paths (HTTP `POST /respond` and the MCP `justify_respond` tool) through one shared `emitResponse` helper that enriches, broadcasts, persists-when-headless, AND stamps the originating prompt as responded. A short daemon sweep then auto-returns any claimed-but-unresponded prompt whose claim has aged past a short timeout, flipping the browser out of "Working" with a "worker stopped, please retry" message. `GET /status` gains an `inFlight` list so a stuck task is detectable server-side.

**Tech Stack:** TypeScript (Node), vitest. Server code in `justify/server/`. Tests in `justify/__tests__/server/`. All commands run from `justify/`.

## Global Constraints

- Verified current state (a2e768d5): BOTH respond paths already broadcast `justify_response`. The real gap is the MCP path is impoverished - no headless persistence, no `targetSelectors` join, no `diffs`. Do NOT "make it flip" (it flips); make it as durable/complete as the HTTP path.
- `claim` is NON-destructive and already atomic+durable: `POST /prompts/claim` stamps `claimedBy`/`claimedAt` and writes the whole prompts array via tmp+rename (`ws-server.ts:1116-1122`), and a claim is re-claimable after `JUSTIFY_CLAIM_TTL_MS` (default 1800000 = 30 min). Do NOT add an "atomic claim" - it exists. The gap is that 30 min is far too long and recovery is passive, never a user-facing return.
- No emojis. No emdashes (use hyphens or rewrite). No AI attribution in commits/comments/beats; the human collaborator (Jonah) is named, you are invisible.
- Do NOT commit unless the lead approves. Do NOT run `deploy.sh` / redeploy the live daemon; build + test only.
- Test command: `npx vitest run` (single file: `npx vitest run __tests__/server/<file>.test.ts`).
- Match the existing vitest patterns in `__tests__/server/ws-server.test.ts` and `dispatcher-broadcasts-working.test.ts`.
- SCOPE: this plan is Challenge 1 (the closure contract) only. Challenge 2 (interruptible background watcher, progress heartbeat, disarm-owes-closure) is a SEPARATE follow-on plan against the skill + CLI, not this one.

## File Structure

- `justify/server/ws-server.ts` (modify) - owns prompts.json/responses.json IO, `broadcastToClients`, `appendResponseFile`, the `POST /respond`, `POST /prompts/claim`, `GET /status` handlers. All three tasks touch this file; it is the single owner of the respond/prompt state, so tasks are SEQUENTIAL here (one worker at a time on this file).
- `justify/server/mcp-tools.ts` (modify, Task 1 only) - the `justify_respond` tool; re-point it at the shared helper.
- `justify/__tests__/server/respond-parity.test.ts` (create, Task 1)
- `justify/__tests__/server/inflight-autoreturn.test.ts` (create, Task 2)
- `justify/__tests__/server/status-inflight.test.ts` (create, Task 3)

Interfaces added:
- `WsServer.emitResponse(input: EmitResponseInput): void` - public (Task 1). Consumed by the HTTP `/respond` handler, the MCP tool (Task 1), and the auto-return sweep (Task 2).
- `EmitResponseInput = { promptId: string; summary?: string; filesChanged?: string[]; changes?: unknown[]; diffs?: unknown[]; targetSelectors?: string[]; status?: 'completed'|'needsInfo'|'failed'; question?: string }`
- Prompt objects in prompts.json gain an optional `respondedAt?: number` stamp (written by `emitResponse`, read by Task 2 sweep and Task 3 status).

---

### Task 1: Shared `emitResponse` helper - durable, complete, and prompt-stamping; both paths route through it

**Files:**
- Modify: `justify/server/ws-server.ts` (extract from the `POST /respond` handler at `460-504`; add public `emitResponse`; add a private `stampResponded(promptId)`)
- Modify: `justify/server/mcp-tools.ts:586-596` (call `ws.emitResponse(...)` instead of the bare `ws.broadcastToClients('justify_response', ...)`)
- Test: `justify/__tests__/server/respond-parity.test.ts`

**Interfaces:**
- Produces: `emitResponse(input)` (public) and the `respondedAt` stamp on prompts.json. Tasks 2 and 3 consume both.

- [ ] **Step 1: Write the failing test** (`respond-parity.test.ts`)

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { makeTestServer, seedPrompt, readResponses, readPrompts } from './helpers'; // reuse existing test harness in ws-server.test.ts; if none is exported, construct the WsServer the same way ws-server.test.ts does with a temp dataDir and zero connected clients.

describe('respond parity: MCP path is as durable/complete as HTTP', () => {
  it('MCP respond persists to responses.json when no client is connected', async () => {
    const s = makeTestServer({ clients: 0 });
    seedPrompt(s, { id: 'p1', selectors: ['#hero'] });
    s.emitResponse({ promptId: 'p1', summary: 'did it', status: 'completed' });
    const resp = readResponses(s);
    expect(resp.length).toBe(1);
    expect(resp[0].summary).toBe('did it');
    // selectors joined from the original prompt even though caller omitted them
    expect(resp[0].targetSelectors).toEqual(['#hero']);
  });

  it('emitResponse stamps respondedAt on the originating prompt', async () => {
    const s = makeTestServer({ clients: 0 });
    seedPrompt(s, { id: 'p1' });
    s.emitResponse({ promptId: 'p1', summary: 'x', status: 'completed' });
    const p = readPrompts(s).find((p: any) => p.id === 'p1');
    expect(typeof p.respondedAt).toBe('number');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/server/respond-parity.test.ts`
Expected: FAIL - `s.emitResponse is not a function`.

- [ ] **Step 3: Implement `emitResponse` + `stampResponded`, and route both callers through it**

In `ws-server.ts`, extract the body of the `POST /respond` handler (`460-504`) into a public method. The enrichment (targetSelectors join from the original prompt by promptId at `477-482`, the `promptId + '-' + Date.now()` response id at `484`, the `manager.size() === 0` persist at `502-503`) moves verbatim into the helper:

```ts
// public
emitResponse(input: {
  promptId: string; summary?: string; filesChanged?: string[]; changes?: unknown[];
  diffs?: unknown[]; targetSelectors?: string[];
  status?: 'completed' | 'needsInfo' | 'failed'; question?: string;
}): void {
  let targetSelectors: string[] = Array.isArray(input.targetSelectors) ? input.targetSelectors : [];
  if (targetSelectors.length === 0 && input.promptId) {
    const orig = this.readPromptsFile().find((p) => p.id === input.promptId);
    if (orig && Array.isArray((orig as { selectors?: string[] }).selectors)) {
      targetSelectors = (orig as { selectors?: string[] }).selectors as string[];
    }
  }
  const responseObj = {
    promptId: input.promptId + '-' + Date.now(),
    summary: input.summary,
    filesChanged: input.filesChanged || [],
    changes: input.changes || [],
    diffs: input.diffs || [],
    targetSelectors,
    status: input.status || 'completed',
    question: input.question,
    timestamp: Date.now(),
  };
  this.broadcastToClients('justify_response', responseObj);
  if (this.manager.size() === 0) {
    this.appendResponseFile({ ...responseObj, reviewed: false });
  }
  this.stampResponded(input.promptId);
}

// private - mark the ORIGINAL prompt (bare id) as responded so the sweep + status
// can tell a still-open task from a finished one. tmp+rename like the claim path.
private stampResponded(promptId: string): void {
  try {
    const prompts = this.readPromptsFile();
    let changed = false;
    for (const p of prompts) {
      if (p.id === promptId && (p as Record<string, unknown>).respondedAt == null) {
        (p as Record<string, unknown>).respondedAt = Date.now();
        changed = true;
      }
    }
    if (!changed) return;
    const pf = this.dataFile('prompts.json');
    const tmp = `${pf}.tmp.${process.pid}.${Date.now()}`;
    writeFileSync(tmp, JSON.stringify(prompts));
    renameSync(tmp, pf);
  } catch {}
}
```

Then replace the inside of the `POST /respond` `req.on('end')` handler's build+broadcast+persist block (`483-504`) with a single call: `this.emitResponse(data);` (keep the surrounding `JSON.parse(body)` and error handling). In `mcp-tools.ts:587-596`, replace the `ws.broadcastToClients('justify_response', {...})` with:

```ts
ws.recordMcpActivity();
ws.emitResponse({ promptId, summary, filesChanged, changes, status, question });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/server/respond-parity.test.ts`
Expected: PASS (both cases).

- [ ] **Step 5: Full suite - no regression**

Run: `npx vitest run`
Expected: all green (the existing `ws-server.test.ts` respond cases still pass, now exercising the extracted helper).

- [ ] **Step 6: Commit**

```bash
git add justify/server/ws-server.ts justify/server/mcp-tools.ts justify/__tests__/server/respond-parity.test.ts
git commit -m "Route both Justify respond paths through one durable emitResponse helper"
```

---

### Task 2: Daemon auto-return sweep - a dead/silent watcher can never strand the user

**Files:**
- Modify: `justify/server/ws-server.ts` (add a sweep started alongside the server; env `JUSTIFY_INFLIGHT_TIMEOUT_MS`)
- Test: `justify/__tests__/server/inflight-autoreturn.test.ts`

**Interfaces:**
- Consumes: `emitResponse` + the `respondedAt`/`claimedAt` stamps from Task 1 and the claim path.
- Produces: an auto-return that flips the browser out of Working and marks the prompt responded (so it is returned at most once).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { makeTestServer, seedPrompt, readResponses } from './helpers';

describe('in-flight auto-return', () => {
  it('returns a claimed-but-unresponded prompt to the user once its claim ages past the timeout', () => {
    const s = makeTestServer({ clients: 0, inflightTimeoutMs: 1000 });
    // claimed 2s ago, never responded
    seedPrompt(s, { id: 'p1', claimedBy: 'watcher', claimedAt: Date.now() - 2000 });
    s.sweepInFlight(); // the method the interval calls; call it directly in the test
    const resp = readResponses(s);
    expect(resp.length).toBe(1);
    expect(resp[0].status).toBe('failed');
    expect(String(resp[0].summary)).toMatch(/stopped|timed out|retry/i);
  });

  it('does NOT return a prompt that was already responded, nor a fresh claim', () => {
    const s = makeTestServer({ clients: 0, inflightTimeoutMs: 1000 });
    seedPrompt(s, { id: 'done', claimedBy: 'w', claimedAt: Date.now() - 2000, respondedAt: Date.now() - 1000 });
    seedPrompt(s, { id: 'fresh', claimedBy: 'w', claimedAt: Date.now() });
    s.sweepInFlight();
    expect(readResponses(s).length).toBe(0);
  });

  it('returns each stranded prompt at most once across two sweeps', () => {
    const s = makeTestServer({ clients: 0, inflightTimeoutMs: 1000 });
    seedPrompt(s, { id: 'p1', claimedBy: 'w', claimedAt: Date.now() - 2000 });
    s.sweepInFlight();
    s.sweepInFlight();
    expect(readResponses(s).length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/server/inflight-autoreturn.test.ts`
Expected: FAIL - `s.sweepInFlight is not a function`.

- [ ] **Step 3: Implement the sweep**

Add to `ws-server.ts`. Timeout floor is SHORT and must sit well under the 30-min claim TTL so a real handoff is never pre-empted; default 90000 (90s):

```ts
private inflightTimeoutMs = Number(process.env.JUSTIFY_INFLIGHT_TIMEOUT_MS) || 90000;
private inflightTimer: ReturnType<typeof setInterval> | null = null;

// A claimed prompt that is neither responded nor cleared and whose claim has aged
// past the timeout means the worker went silent. The contract says the user still
// gets closure, so the DAEMON (which outlives the worker) returns it.
sweepInFlight(now: number = Date.now()): void {
  const prompts = this.readPromptsFile();
  for (const p of prompts) {
    const claimedAt = (p as Record<string, unknown>).claimedAt as number | undefined;
    const respondedAt = (p as Record<string, unknown>).respondedAt as number | undefined;
    if (claimedAt && !respondedAt && now - claimedAt > this.inflightTimeoutMs) {
      this.emitResponse({
        promptId: p.id,
        summary: 'The worker handling this change stopped responding, so it was returned. Please retry.',
        status: 'failed',
      });
      // emitResponse stamps respondedAt, so the next sweep skips it (return-once).
    }
  }
}

private startInFlightSweep(): void {
  if (this.inflightTimer) return;
  this.inflightTimer = setInterval(() => { try { this.sweepInFlight(); } catch {} }, Math.min(this.inflightTimeoutMs, 30000));
  if (typeof this.inflightTimer.unref === 'function') this.inflightTimer.unref();
}
```

Call `this.startInFlightSweep()` where the server starts listening (next to where the HTTP server / dispatcher is started). Clear `inflightTimer` in the server's stop/close path next to the other timers.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/server/inflight-autoreturn.test.ts`
Expected: PASS (all three cases).

- [ ] **Step 5: Full suite - no regression**

Run: `npx vitest run`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add justify/server/ws-server.ts justify/__tests__/server/inflight-autoreturn.test.ts
git commit -m "Auto-return a claimed-but-unresponded Justify prompt after a short timeout"
```

---

### Task 3: `GET /status` exposes in-flight tasks - a stuck review is detectable server-side

**Files:**
- Modify: `justify/server/ws-server.ts:1157-1187` (the `/status` handler)
- Test: `justify/__tests__/server/status-inflight.test.ts`

**Interfaces:**
- Consumes: the `claimedAt`/`respondedAt` stamps.
- Produces: `status.inFlight: Array<{ promptId: string; claimedBy: string|null; claimedAt: number }>`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { makeTestServer, seedPrompt, getStatus } from './helpers';

describe('status inFlight', () => {
  it('lists claimed-but-unresponded prompts and omits responded ones', async () => {
    const s = makeTestServer({ clients: 0 });
    seedPrompt(s, { id: 'open', claimedBy: 'w', claimedAt: 111 });
    seedPrompt(s, { id: 'done', claimedBy: 'w', claimedAt: 100, respondedAt: 200 });
    seedPrompt(s, { id: 'unclaimed' });
    const st = await getStatus(s); // GET /status
    expect(st.inFlight).toEqual([{ promptId: 'open', claimedBy: 'w', claimedAt: 111 }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/server/status-inflight.test.ts`
Expected: FAIL - `inFlight` is `undefined`.

- [ ] **Step 3: Add `inFlight` to the `/status` payload**

In the `/status` handler, before `res.end(JSON.stringify({...}))`, compute and add:

```ts
const inFlight = this.readPromptsFile()
  .filter((p) => (p as Record<string, unknown>).claimedAt != null && (p as Record<string, unknown>).respondedAt == null)
  .map((p) => ({
    promptId: p.id,
    claimedBy: ((p as Record<string, unknown>).claimedBy as string) ?? null,
    claimedAt: (p as Record<string, unknown>).claimedAt as number,
  }));
```

Add `inFlight,` to the response object (alongside `pendingCount`, `stalled`, `headless`, `autoApply`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/server/status-inflight.test.ts`
Expected: PASS.

- [ ] **Step 5: Full suite - no regression**

Run: `npx vitest run`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add justify/server/ws-server.ts justify/__tests__/server/status-inflight.test.ts
git commit -m "Expose in-flight (claimed-but-unresponded) Justify prompts in /status"
```

---

## Verification gate (after all three tasks)

- `cd justify && npx vitest run` fully green.
- `npm run build:server` (tsc) clean - the new public method + fields must typecheck.
- Independent cross-model review of the full diff (Codex if it runs on these files; else a fresh non-producer Claude reviewer). Fold findings.
- Do NOT redeploy the live daemon; report the diff to the lead for the deploy decision.

## Self-review (author)

- Spec coverage: prereq #1 (durable/complete respond) -> Task 1; prereq #2 (daemon guarantees closure when the agent dies) -> Task 2 built on Task 1's `respondedAt` stamp; F3/R3 (status in-flight visibility) -> Task 3. Prereq #3 (atomic claim) intentionally NOT a task - verified already done. Challenge 2 (interruptible watcher / progress / disarm-closure) intentionally deferred to a second plan (different subsystem).
- Type consistency: `emitResponse` input shape and the `respondedAt`/`claimedAt` reads are identical across Tasks 1-3; the sweep and status both key off `claimedAt != null && respondedAt == null`.
- Placeholder scan: test helpers (`makeTestServer`/`seedPrompt`/`readResponses`/`getStatus`) are assumed from the existing `ws-server.test.ts` harness; if that file does not export them, the first task's Step 1 builds them the same way `ws-server.test.ts` constructs a server over a temp dataDir - this is the one place the executor must read the existing test file first.
