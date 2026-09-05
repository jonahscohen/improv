// bb-plugin-spawn-split - a BB plugin backend entry. This plugin is
// HEADLESS (bb.app removed from package.json; no app.tsx/components/hooks/
// lib) - bb.sdk.threads.open({ threadId, split }) opens a spawned thread's
// pane straight from server code, so no frontend surface is needed.
//
// The default export is a factory that receives the plugin API. Its only
// job is to register the `spawn_split` agent tool: spawn N child threads
// from the calling thread and open each as a split pane, entirely from the
// backend (bb.sdk.threads.spawn + bb.sdk.threads.open; see CONTRACTS.md
// section 3). No frontend, no realtime publish - the pane is opened
// server-side, so there is nothing for a page to subscribe to.
import { type BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";
import { resolveEnvironment, type SpawnEnvironment } from "./env";

const SPLIT_VALUES = ["down", "left", "replace", "right", "top"] as const;
export type SpawnSplitDirection = (typeof SPLIT_VALUES)[number];

export const spawnSplitParameters = z.object({
  prompt: z.string().min(1),
  title: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  env: z.enum(["worktree", "shared"]).default("worktree"),
  count: z.number().int().min(1).max(8).default(1),
  split: z.enum(SPLIT_VALUES).default("right"),
});
export type SpawnSplitArgs = z.infer<typeof spawnSplitParameters>;

export type SplitPlanEntry = {
  prompt: string;
  title: string;
  provider?: string;
  model?: string;
  env: "worktree" | "shared";
  split: SpawnSplitDirection;
};

/** Pure helper: expands `count` into one plan entry per child, deriving a
 * fallback title (<=60 chars of the prompt) when none is given. Unit
 * testable without the live daemon. */
export function buildSpawnPlan(args: {
  prompt: string;
  title?: string;
  provider?: string;
  model?: string;
  env: "worktree" | "shared";
  count: number;
  split: SpawnSplitDirection;
}): SplitPlanEntry[] {
  const title = args.title ?? args.prompt.slice(0, 60);
  return Array.from({ length: args.count }, () => ({
    prompt: args.prompt,
    title,
    provider: args.provider,
    model: args.model,
    env: args.env,
    split: args.split,
  }));
}

/** Minimal surface of the SDK this tool needs, kept small and typed so a
 * fake `bb` can be injected in tests without the live daemon. */
export interface SpawnSplitBb {
  sdk: {
    threads: {
      get(args: { threadId: string }): Promise<{ environmentId?: string | null } | null | undefined>;
      spawn(args: {
        projectId: string;
        parentThreadId: string;
        prompt: string;
        title?: string;
        providerId?: string;
        model?: string;
        environment: SpawnEnvironment;
      }): Promise<{ id: string }>;
      open(args: { threadId: string; split: SpawnSplitDirection; file: null }): Promise<unknown>;
    };
  };
}

export interface SpawnSplitCtx {
  threadId: string;
  projectId: string;
  signal?: AbortSignal;
}

function boundedResult(spawned: string[], failed: string[]): {
  content: [{ type: "text"; text: string }];
  isError: boolean;
} {
  const lines = [
    spawned.length
      ? `Spawned ${spawned.length} split(s): ${spawned.join(", ")}`
      : "Spawned 0 splits",
    ...(failed.length ? [`Failed ${failed.length}: ${failed.join("; ")}`] : []),
  ];
  return {
    content: [{ type: "text", text: lines.join("\n") }],
    isError: spawned.length === 0,
  };
}

/** The tool's execute logic, exported standalone so it can be exercised
 * directly with an injected `bb` (real or mock) - registerTool's execute
 * just forwards to this. */
export async function runSpawnSplit(
  bb: SpawnSplitBb,
  args: SpawnSplitArgs,
  ctx: SpawnSplitCtx,
): Promise<{ content: [{ type: "text"; text: string }]; isError: boolean }> {
  const plan = buildSpawnPlan(args);

  let callerEnvironmentId: string | null = null;
  if (args.env === "shared") {
    try {
      const caller = await bb.sdk.threads.get({ threadId: ctx.threadId });
      callerEnvironmentId = caller?.environmentId ?? null;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return boundedResult([], [`failed to resolve caller environment: ${message}`]);
    }
  }

  const spawned: string[] = [];
  const failed: string[] = [];
  for (const entry of plan) {
    if (ctx.signal?.aborted) break;
    let childId: string | undefined;
    try {
      const environment = resolveEnvironment(entry.env, callerEnvironmentId);
      const child = await bb.sdk.threads.spawn({
        projectId: ctx.projectId,
        parentThreadId: ctx.threadId,
        prompt: entry.prompt,
        title: entry.title,
        ...(entry.provider ? { providerId: entry.provider } : {}),
        ...(entry.model ? { model: entry.model } : {}),
        environment,
      });
      childId = child.id;
      await bb.sdk.threads.open({ threadId: child.id, split: entry.split, file: null });
      spawned.push(child.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failed.push(childId ? `${childId} spawned but split open failed: ${message}` : message);
    }
  }

  return boundedResult(spawned, failed);
}

export default async function plugin(bb: BbPluginApi) {
  bb.log.info("loaded");

  // The core tool: spawn N child threads and open each as a split pane.
  // Registration wiring is thin - the actual logic lives in runSpawnSplit
  // above so it can be exercised directly in tests with an injected bb.
  bb.agents.registerTool({
    name: "spawn_split",
    description:
      "Spawn one or more child agent threads from this thread, each opened as a split pane. Use env=worktree (default) for isolated parallel work in a fresh managed worktree, or env=shared to reuse this thread's own environment.",
    presentation: { label: { pending: "Spawning split", completed: "Spawned split" } },
    parameters: spawnSplitParameters,
    execute: (args, ctx) => runSpawnSplit(bb as unknown as SpawnSplitBb, args, ctx),
  });

  // Cleanup on reload/disable/shutdown; hooks run LIFO. The sanctioned place
  // to clear timers and close connections.
  bb.onDispose(() => {
    bb.log.info("disposed");
  });
}
