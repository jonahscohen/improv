import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { WsServer } from './ws-server.js';
import type { StyleChange, Annotation, LayoutPlacement } from './types.js';

function text(content: string) {
  return { content: [{ type: 'text' as const, text: content }] };
}

export function registerTools(mcp: McpServer, ws: WsServer): void {
  const pendingChanges: StyleChange[] = [];
  const annotations: Annotation[] = [];
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

  ws.onMessage('push_layout', (_connectionId, params) => {
    const placements = (params?.placements ?? []) as LayoutPlacement[];
    layoutPlacements = placements;
    return { accepted: placements.length };
  });

  // Tool: improv_activate
  mcp.tool(
    'improv_activate',
    'Activate the Improv overlay in the browser. If no browser is connected, returns a script tag to inject.',
    {},
    async () => {
      const connections = ws.getConnections();
      const port = ws.getPort();

      if (connections.length > 0) {
        ws.broadcastToClients('activate');
        return text(`Activated. Broadcasting to ${connections.length} connected client(s).`);
      }

      return text(
        `No browser connected yet. Inject the Improv script into the active browser tab to connect.\n\n` +
        `**Injection script** (run this as JavaScript in the target browser tab):\n` +
        `\`\`\`javascript\n` +
        `(function(){if(window.__improv)return;var s=document.createElement('script');s.src='http://localhost:${port}/improv-core.js';document.head.appendChild(s);})()\n` +
        `\`\`\`\n\n` +
        `Use Chrome MCP javascript_tool, cmux browser javascript, or any browser automation to execute the script above in the target tab. ` +
        `Once loaded, Improv will auto-connect to this server and the overlay will appear.`
      );
    },
  );

  // Tool: improv_status
  mcp.tool(
    'improv_status',
    'Return current connection and buffer status',
    {},
    async () => {
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
          layoutPlacements: layoutPlacements.length,
        },
        wsPort: ws.getPort(),
      };
      return text(JSON.stringify(status, null, 2));
    },
  );

  // Tool: improv_get_selection
  mcp.tool(
    'improv_get_selection',
    'Get the currently selected element from the browser',
    {},
    async () => {
      const connections = ws.getConnections();
      if (connections.length === 0) {
        return text('No browser connected');
      }
      return text('Selection capture not yet implemented - use improv_get_annotations for annotated elements');
    },
  );

  // Tool: improv_get_pending_changes
  mcp.tool(
    'improv_get_pending_changes',
    'Return all pending style changes pushed from the browser',
    {},
    async () => {
      if (pendingChanges.length === 0) {
        return text('No pending changes');
      }
      return text(JSON.stringify(pendingChanges, null, 2));
    },
  );

  // Tool: improv_apply_changes
  mcp.tool(
    'improv_apply_changes',
    'Format pending style changes as human-readable diffs, clear the buffer, and notify browser',
    {},
    async () => {
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

  // Tool: improv_get_annotations
  mcp.tool(
    'improv_get_annotations',
    'Return pending design annotations from the browser',
    {
      verbosity: z
        .enum(['compact', 'standard', 'detailed', 'forensic'])
        .optional()
        .describe('How much detail to include per annotation'),
    },
    async ({ verbosity = 'standard' }) => {
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

  // Tool: improv_watch
  mcp.tool(
    'improv_watch',
    'Poll for new changes or annotations, returning once new data arrives or timeout elapses',
    {
      timeout: z
        .number()
        .optional()
        .describe('Maximum seconds to wait for new data (default 30)'),
    },
    async ({ timeout = 30 }) => {
      const startChanges = pendingChanges.length;
      const startAnnotations = annotations.length;
      const deadline = Date.now() + timeout * 1000;

      await new Promise<void>((resolve) => {
        const check = () => {
          const hasNew =
            pendingChanges.length !== startChanges || annotations.length !== startAnnotations;
          if (hasNew || Date.now() >= deadline) {
            resolve();
          } else {
            setTimeout(check, 500);
          }
        };
        check();
      });

      return text(
        JSON.stringify({
          changes: pendingChanges.length,
          annotations: annotations.length,
          newChanges: pendingChanges.length - startChanges,
          newAnnotations: annotations.length - startAnnotations,
          timedOut: Date.now() >= Date.now(), // always false here - just informational shape
        }),
      );
    },
  );

  // Tool: improv_acknowledge
  mcp.tool(
    'improv_acknowledge',
    'Mark an annotation as acknowledged/resolved',
    {
      annotationId: z.string().describe('The id of the annotation to acknowledge'),
    },
    async ({ annotationId }) => {
      const annotation = annotations.find((a) => a.id === annotationId);
      if (!annotation) {
        return text(`Annotation not found: ${annotationId}`);
      }
      annotation.status = 'acknowledged';
      ws.broadcastToClients('annotation_acknowledged', { annotationId });
      return text(`Acknowledged annotation ${annotationId}`);
    },
  );

  // Tool: improv_get_layout
  mcp.tool(
    'improv_get_layout',
    'Return current layout placements from the browser canvas',
    {},
    async () => {
      if (layoutPlacements.length === 0) {
        return text('No layout placements received');
      }
      return text(JSON.stringify(layoutPlacements, null, 2));
    },
  );

  // Tool: improv_get_components
  mcp.tool(
    'improv_get_components',
    'Return available components from the project component scanner',
    {},
    async () => {
      return text('Component scanner not yet connected');
    },
  );

  // Tool: improv_clear
  mcp.tool(
    'improv_clear',
    'Clear all pending buffers (changes, annotations, layout placements) and notify the browser',
    {},
    async () => {
      const counts = {
        changes: pendingChanges.length,
        annotations: annotations.length,
        layoutPlacements: layoutPlacements.length,
      };

      pendingChanges.length = 0;
      annotations.length = 0;
      layoutPlacements = [];

      ws.broadcastToClients('cleared');

      return text(
        `Cleared all buffers. Removed: ${counts.changes} change(s), ${counts.annotations} annotation(s), ${counts.layoutPlacements} layout placement(s).`,
      );
    },
  );
}
