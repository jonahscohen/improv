import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { WsServer } from './ws-server.js';
import type { StyleChange, Annotation, LayoutPlacement } from './types.js';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

function text(content: string) {
  return { content: [{ type: 'text' as const, text: content }] };
}

export function registerTools(mcp: McpServer, ws: WsServer): void {
  const pendingChanges: StyleChange[] = [];
  const annotations: Annotation[] = [];
  const PROMPT_FILE = join(homedir(), '.claude', 'justify', 'prompts.json');

  function readPrompts(): Array<{ id: string; context: string; prompt: string; elementCount: number; timestamp: number; selectors?: string[] }> {
    try { return JSON.parse(readFileSync(PROMPT_FILE, 'utf-8')); } catch { return []; }
  }

  function writePrompts(prompts: Array<{ id: string; context: string; prompt: string; elementCount: number; timestamp: number; selectors?: string[] }>): void {
    try { writeFileSync(PROMPT_FILE, JSON.stringify(prompts)); } catch {}
  }

  function nextPromptId(): string {
    const prompts = readPrompts();
    const maxId = prompts.reduce((max, p) => {
      const n = parseInt(p.id.replace('prompt-', ''));
      return n > max ? n : max;
    }, 0);
    return 'prompt-' + (maxId + 1);
  }
  let layoutPlacements: LayoutPlacement[] = [];

  // WebSocket push handlers - browser pushes data into these buffers
  ws.onMessage('push_changes', (_connectionId, params) => {
    const changes = (params?.changes ?? []) as StyleChange[];
    pendingChanges.push(...changes);
    return { accepted: changes.length };
  });

  ws.onMessage('push_annotations', (_connectionId, params) => {
    const incoming = (params?.annotations ?? []) as Annotation[];
    annotations.push(...incoming);
    return { accepted: incoming.length };
  });

  ws.onMessage('push_prompt', (_connectionId, params) => {
    const id = nextPromptId();
    const prompt = {
      id,
      context: (params?.context ?? '') as string,
      prompt: (params?.prompt ?? '') as string,
      elementCount: (params?.elementCount ?? 0) as number,
      // Issue #1: structured target selectors of the element(s) the prompt was
      // about, so the daemon can join them onto the response and the Changes
      // panel can scroll to + select the target on click.
      selectors: (Array.isArray(params?.selectors) ? params?.selectors : []) as string[],
      timestamp: Date.now(),
    };
    const prompts = readPrompts(); prompts.push(prompt); writePrompts(prompts);
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
      for (const change of pendingChanges) {
        lines.push(change.selector);
        lines.push(`  ${change.property}: ${change.oldValue} -> ${change.newValue}`);
      }

      const summary = lines.join('\n');
      const count = pendingChanges.length;

      // Clear buffer
      pendingChanges.length = 0;

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

      const prompts = readPrompts();
      if (prompts.length === 0) {
        return text(JSON.stringify({ status: 'idle', message: 'No prompts received. Still watching.' }));
      }

      for (const p of prompts) {
        ws.broadcastToClients('justify_working', { promptId: p.id, timestamp: Date.now() });
      }
      const out = prompts.map((p) =>
        `[${p.id}] Prompt: ${p.prompt}\nElements: ${p.elementCount}\nContext:\n${p.context}`
      ).join('\n\n---\n\n');
      writePrompts([]);
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
      ws.recordMcpActivity();
      const prompts = readPrompts();
      if (prompts.length === 0) {
        return text('No pending prompts');
      }
      for (const p of prompts) {
        ws.broadcastToClients('justify_working', { promptId: p.id, timestamp: Date.now() });
      }
      const out = prompts.map((p) =>
        `[${p.id}] Prompt: ${p.prompt}\nElements: ${p.elementCount}\nContext:\n${p.context}`
      ).join('\n\n---\n\n');
      writePrompts([]);
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
      ws.broadcastToClients('justify_response', {
        promptId,
        summary,
        filesChanged,
        changes,
        status,
        question,
        timestamp: Date.now(),
      });

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
    'End the watch session. Call this when the user says "end justify", "stop watching", or similar. Signals the browser that Claude is no longer watching.',
    {},
    async () => {
      ws.setWatchSession(false);
      return text('Watch session ended. Browser will show disconnected state.');
    },
  );
}
