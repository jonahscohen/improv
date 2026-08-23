import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFileSync } from 'child_process';
import { WsServer } from '../../server/ws-server.js';
import { WatchStateStore } from '../../server/watch-state.js';

// A throwaway git repo with one committed file; returns its root and the HEAD sha
// (the baseline a prompt would carry, captured before the edit).
function makeGitRepo(): { root: string; base: string } {
  const root = mkdtempSync(join(tmpdir(), 'justify-diff-repo-'));
  const git = (...a: string[]) => execFileSync('git', ['-C', root, ...a], { encoding: 'utf-8' });
  git('init', '-q');
  git('config', 'user.email', 't@t.t');
  git('config', 'user.name', 't');
  writeFileSync(join(root, 'style.css'), '.dot { color: white; }\n');
  git('add', 'style.css');
  git('commit', '-qm', 'init');
  return { root, base: git('rev-parse', 'HEAD').trim() };
}

function armAt(s: WsServer & { __dir: string }, root: string): void {
  const store = new WatchStateStore(join(s.__dir, 'watch-state.json'));
  store.arm(root, 'test');
  s.attachWatch(store, { kick() {}, status() { return { headless: false }; }, setHeadless() {} });
}

// ws-server.test.ts constructs a WsServer directly over a data dir (JUSTIFY_STATE_DIR)
// and exercises it with zero connected clients. There is no exported
// makeTestServer/seedPrompt/readResponses/readPrompts helper, so - per the brief -
// we build the equivalent inline the same way: a WsServer pointed at a fresh temp
// dataDir with no sockets opened (start() is never called, so manager.size() is 0),
// plus small file readers/writers against that same dir.

type TestServer = WsServer & { __dir: string };

function makeTestServer(_opts: { clients: number } = { clients: 0 }): TestServer {
  const dir = mkdtempSync(join(tmpdir(), 'justify-respond-parity-'));
  // stateDir is captured in the WsServer constructor, so set the env before `new`.
  process.env.JUSTIFY_STATE_DIR = dir;
  const s = new WsServer() as TestServer;
  s.__dir = dir;
  return s;
}

function seedPrompt(
  s: TestServer,
  prompt: { id: string; selectors?: string[]; [k: string]: unknown },
): void {
  const file = join(s.__dir, 'prompts.json');
  const existing = existsSync(file) ? JSON.parse(readFileSync(file, 'utf-8')) : [];
  existing.push(prompt);
  writeFileSync(file, JSON.stringify(existing));
}

function readResponses(s: TestServer): any[] {
  const file = join(s.__dir, 'responses.json');
  if (!existsSync(file)) return [];
  return JSON.parse(readFileSync(file, 'utf-8'));
}

function readPrompts(s: TestServer): any[] {
  const file = join(s.__dir, 'prompts.json');
  if (!existsSync(file)) return [];
  return JSON.parse(readFileSync(file, 'utf-8'));
}

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

  // Cross-page highlight (Jonah 2026-08-20): the response carries the page the
  // prompt was authored on so the Review entry can navigate-then-highlight.
  it('joins pageUrl from the original prompt onto the response', async () => {
    const s = makeTestServer({ clients: 0 });
    seedPrompt(s, { id: 'p1', selectors: ['#hero'], pageUrl: 'https://app.test/dashboard' });
    s.emitResponse({ promptId: 'p1', summary: 'did it', status: 'completed' });
    const resp = readResponses(s);
    expect(resp[0].pageUrl).toBe('https://app.test/dashboard');
    // still joins selectors from the same read
    expect(resp[0].targetSelectors).toEqual(['#hero']);
  });

  it('an explicit input.pageUrl wins over the prompt pageUrl', async () => {
    const s = makeTestServer({ clients: 0 });
    seedPrompt(s, { id: 'p1', pageUrl: 'https://app.test/from-prompt' });
    s.emitResponse({ promptId: 'p1', pageUrl: 'https://app.test/explicit', summary: 'x', status: 'completed' });
    expect(readResponses(s)[0].pageUrl).toBe('https://app.test/explicit');
  });

  it('pageUrl is empty when neither the input nor the prompt carries one (back-compat)', async () => {
    const s = makeTestServer({ clients: 0 });
    seedPrompt(s, { id: 'p1', selectors: ['#hero'] });
    s.emitResponse({ promptId: 'p1', summary: 'x', status: 'completed' });
    expect(readResponses(s)[0].pageUrl).toBe('');
  });

  // Blank-panel regression (Jonah 2026-08-22): the unvalidated /respond path let a
  // prose STRING land in `changes`, which persisted and later threw on `.map` in the
  // browser, blanking the whole Review panel. emitResponse must coerce array fields.
  it('coerces a non-array changes (a prose string) to [] before persisting', async () => {
    const s = makeTestServer({ clients: 0 });
    seedPrompt(s, { id: 'p1' });
    s.emitResponse({
      promptId: 'p1',
      summary: 'deferred',
      changes: 'No change made - deferred, unverifiable in automation.' as unknown as unknown[],
      status: 'completed',
    });
    const resp = readResponses(s)[0];
    expect(Array.isArray(resp.changes)).toBe(true);
    expect(resp.changes).toEqual([]);
  });

  it('coerces non-array filesChanged and diffs to [] as well', async () => {
    const s = makeTestServer({ clients: 0 });
    seedPrompt(s, { id: 'p1' });
    s.emitResponse({
      promptId: 'p1',
      summary: 'x',
      filesChanged: 'a.css' as unknown as string[],
      diffs: 'nope' as unknown as unknown[],
      status: 'completed',
    });
    const resp = readResponses(s)[0];
    expect(resp.filesChanged).toEqual([]);
    expect(resp.diffs).toEqual([]);
  });
});

// "Snapshot before each change" (Jonah 2026-08-22): the daemon captures a per-task
// baseline when a prompt is served, then diffs the working tree against it at report
// time - so a real line-by-line diff reaches the panel without depending on the agent
// to pass one. This was the missing capture half; render + parse already existed.
describe('per-task diff: emitResponse computes a diff from the prompt baseline', () => {
  it('computes a diff from the prompt baseline when the input carries none', () => {
    const { root, base } = makeGitRepo();
    // the uncommitted edit, as it exists at report time
    writeFileSync(join(root, 'style.css'), '.dot { color: yellow; }\n');

    const s = makeTestServer({ clients: 0 });
    armAt(s, root);
    seedPrompt(s, { id: 'p1', diffBase: base }); // baseline captured at serve time
    s.emitResponse({ promptId: 'p1', summary: 'yellow', filesChanged: ['style.css'], status: 'completed' });

    const resp = readResponses(s)[0];
    expect(Array.isArray(resp.diffs)).toBe(true);
    expect(resp.diffs).toHaveLength(1);
    expect(resp.diffs[0].file).toBe('style.css');
    const texts = resp.diffs[0].hunks[0].lines.map((l: any) => l.t + l.text);
    expect(texts).toContain('-.dot { color: white; }');
    expect(texts).toContain('+.dot { color: yellow; }');
  });

  it('an explicit input.diffs wins over baseline computation', () => {
    const { root, base } = makeGitRepo();
    writeFileSync(join(root, 'style.css'), '.dot { color: yellow; }\n');
    const s = makeTestServer({ clients: 0 });
    armAt(s, root);
    seedPrompt(s, { id: 'p1', diffBase: base });
    const explicit = [{ file: 'given.css', hunks: [{ oldStart: 1, newStart: 1, header: '', lines: [] }] }];
    s.emitResponse({ promptId: 'p1', filesChanged: ['style.css'], diffs: explicit, status: 'completed' });
    expect(readResponses(s)[0].diffs).toEqual(explicit);
  });

  it('no baseline on the prompt -> diffs stays [] (unchanged behavior, panel shows the filename)', () => {
    const { root } = makeGitRepo();
    writeFileSync(join(root, 'style.css'), '.dot { color: yellow; }\n');
    const s = makeTestServer({ clients: 0 });
    armAt(s, root);
    seedPrompt(s, { id: 'p1' }); // no diffBase captured
    s.emitResponse({ promptId: 'p1', filesChanged: ['style.css'], status: 'completed' });
    expect(readResponses(s)[0].diffs).toEqual([]);
  });

  it('scopes to the reported files: an edit to an UNreported file is not diffed', () => {
    const { root, base } = makeGitRepo();
    writeFileSync(join(root, 'other.css'), '.x{}\n'); // untracked, unreported
    writeFileSync(join(root, 'style.css'), '.dot { color: yellow; }\n');
    const s = makeTestServer({ clients: 0 });
    armAt(s, root);
    seedPrompt(s, { id: 'p1', diffBase: base });
    s.emitResponse({ promptId: 'p1', filesChanged: ['style.css'], status: 'completed' });
    const resp = readResponses(s)[0];
    expect(resp.diffs.map((d: any) => d.file)).toEqual(['style.css']);
  });
});
