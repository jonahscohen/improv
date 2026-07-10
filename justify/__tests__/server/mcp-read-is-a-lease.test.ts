import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Codex review, 2026-07-09: `justify_watch` and `justify_get_prompts` REMOVED the
// unclaimed prompts they read. If the reading session then died - crashed, was
// killed, hit an error before justify_respond - the user's prompt was gone with no
// trace and nothing would ever re-dispatch it.
//
// A read that deletes work is a dropped prompt with extra steps. They now LEASE:
// the prompt stays queued, marked claimedBy, so justify-done clears it on success
// and an abandoned claim goes stale and is re-dispatched by the daemon.

const dir = mkdtempSync(join(tmpdir(), 'jf-lease-'));
process.env.JUSTIFY_STATE_DIR = dir;

const { registerTools } = await import('../../server/mcp-tools.js');

const PROMPT_FILE = join(dir, 'prompts.json');
const readQueue = () => JSON.parse(readFileSync(PROMPT_FILE, 'utf-8'));

type Tool = (args: Record<string, unknown>) => Promise<{ content: Array<{ text: string }> }>;

function harness() {
  const tools = new Map<string, Tool>();
  const mcp = {
    // mcp.tool(name, desc, schema, handler)
    tool: (name: string, _d: string, _s: unknown, handler: Tool) => tools.set(name, handler),
  };
  const ws = {
    onMessage: () => {}, recordMcpActivity: () => {}, getConnections: () => [],
    getPort: () => 9223, broadcastToClients: () => {}, onClientMessage: () => {},
    setWatchSession: () => {},
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerTools(mcp as any, ws as any);
  return tools;
}

describe('an MCP prompt read is a lease, not a delete', () => {
  let tools: Map<string, Tool>;

  beforeEach(() => {
    writeFileSync(PROMPT_FILE, JSON.stringify([
      { id: 'prompt-1', prompt: 'make the hero lime', context: '', elementCount: 0, timestamp: Date.now() },
    ]));
    writeFileSync(join(dir, 'prompt-seq.json'), JSON.stringify({ next: 2 }));
    writeFileSync(join(dir, 'responses.json'), '[]');
    tools = harness();
  });

  it('justify_get_prompts leaves the prompt QUEUED and CLAIMED, not deleted', async () => {
    const out = await tools.get('justify_get_prompts')!({});
    expect(out.content[0].text).toContain('make the hero lime'); // the caller got it

    const q = readQueue();
    expect(q).toHaveLength(1); // and it is STILL THERE
    expect(q[0].id).toBe('prompt-1');
    expect(q[0].claimedBy).toMatch(/^interactive:/);
    expect(typeof q[0].claimedAt).toBe('number');
  });

  it('a second read does not hand the same leased prompt to another reader', async () => {
    await tools.get('justify_get_prompts')!({});
    const second = await tools.get('justify_get_prompts')!({});
    expect(second.content[0].text).toContain('No unclaimed prompts');
    expect(readQueue()).toHaveLength(1);
  });

  it('the prompt survives a reader that dies without answering', async () => {
    await tools.get('justify_get_prompts')!({});
    // The session vanishes here. Nothing clears the prompt.
    const q = readQueue();
    expect(q).toHaveLength(1);
    expect(q[0].prompt).toBe('make the hero lime');
    // The dispatcher's claim TTL will re-dispatch it; the work is not lost.
  });

  it('justify_watch also leases rather than deletes', async () => {
    const out = await tools.get('justify_watch')!({ timeout: 1 });
    expect(out.content[0].text).toContain('make the hero lime');
    const q = readQueue();
    expect(q).toHaveLength(1);
    expect(q[0].claimedBy).toMatch(/^interactive:/);
  });
});
