// bb-plugin-spawn-split - a BB plugin backend entry. This plugin is
// HEADLESS (bb.app removed from package.json; no app.tsx/components/hooks/
// lib) - bb.sdk.threads.open({ threadId, split }) opens a spawned thread's
// pane straight from server code, so no frontend surface is needed.
//
// The default export is a factory that receives the plugin API. BB supplies
// the tiny defineRpcContract runtime helper; the API type remains type-only.
//
// The example is a todo list, kept as scaffold reference for the backend
// surfaces this plugin will grow into (settings, storage, CLI command,
// skill). One store in bb.storage.kv (no sqlite - the example never used
// better-sqlite3, and that unused devDependency was removed along with the
// frontend it shipped alongside) serves two surfaces: the RPC contract
// below (kept as reference; nothing calls it without a frontend) and the
// `bb spawn-split` CLI command (below), documented for agents in
// skills/example-todos/SKILL.md. A write publishes a realtime signal, which
// is a no-op with no page subscribed.
import { randomUUID } from "node:crypto";
import { defineRpcContract, type BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";
import { resolveEnvironment, type SpawnEnvironment } from "./env";

// spawn_split - the core tool. Spawns one or more child threads from the
// calling thread and opens each as a split pane, entirely from the backend
// (bb.sdk.threads.spawn + bb.sdk.threads.open; see CONTRACTS.md section 3).
// No frontend/realtime publish is involved - the pane is opened server-side.

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
  signal: AbortSignal;
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
    const caller = await bb.sdk.threads.get({ threadId: ctx.threadId });
    callerEnvironmentId = caller?.environmentId ?? null;
  }

  const spawned: string[] = [];
  const failed: string[] = [];
  for (const entry of plan) {
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
      spawned.push(child.id);
      await bb.sdk.threads.open({ threadId: child.id, split: entry.split, file: null });
    } catch (err) {
      failed.push(err instanceof Error ? err.message : String(err));
    }
  }

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

const todoSchema = z.object({
  id: z.string(),
  title: z.string(),
  done: z.boolean(),
  createdAt: z.string(),
});
export type Todo = z.infer<typeof todoSchema>;

// Both schemas run at the wire boundary. Kept as reference for a future
// frontend; no page imports this contract now that the plugin is headless.
export const rpcContract = defineRpcContract({
  todos_list: {
    input: z.null(),
    output: z.object({ todos: z.array(todoSchema) }),
  },
  todos_add: {
    input: z.object({ title: z.string().trim().min(1).max(200) }),
    output: todoSchema,
  },
  todos_set_done: {
    input: z.object({ id: z.string(), done: z.boolean() }),
    output: todoSchema,
  },
  todos_remove: {
    input: z.object({ id: z.string() }),
    output: z.object({ removed: z.boolean() }),
  },
});

/** Realtime channel a future page would listen on; the payload is the todo count. */
const TODOS_CHANGED = "todos-changed";

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

  // Declarative settings — rendered in BB's settings UI and editable with
  // `bb plugin config spawn-split`. Add `secret: true` for values like API keys.
  // Settings are read once per load: reload the plugin after changing one.
  const settings = bb.settings.define({
    showDone: {
      type: "boolean",
      label: "Show completed todos",
      default: true,
    },
  });
  const { showDone } = await settings.get();

  // Namespaced key-value storage in bb.db (JSON values, up to 256KB each).
  // For bigger or relational data use bb.storage.database().
  async function readTodos(): Promise<Todo[]> {
    return (await bb.storage.kv.get<Todo[]>("todos")) ?? [];
  }
  async function writeTodos(todos: Todo[]): Promise<void> {
    await bb.storage.kv.set("todos", todos);
    // Ephemeral broadcast to every connected client; nothing is persisted.
    bb.realtime.publish(TODOS_CHANGED, { count: todos.length });
  }

  async function listTodos(): Promise<Todo[]> {
    const todos = await readTodos();
    return showDone ? todos : todos.filter((todo) => !todo.done);
  }
  async function addTodo(title: string): Promise<Todo> {
    const todo: Todo = {
      id: randomUUID().slice(0, 8),
      title,
      done: false,
      createdAt: new Date().toISOString(),
    };
    await writeTodos([...(await readTodos()), todo]);
    return todo;
  }
  async function setTodoDone(id: string, done: boolean): Promise<Todo | null> {
    const todos = await readTodos();
    const todo = todos.find((candidate) => candidate.id === id);
    if (todo === undefined) return null;
    todo.done = done;
    await writeTodos(todos);
    return todo;
  }
  async function removeTodo(id: string): Promise<boolean> {
    const todos = await readTodos();
    const remaining = todos.filter((todo) => todo.id !== id);
    if (remaining.length === todos.length) return false;
    await writeTodos(remaining);
    return true;
  }

  bb.rpc.register(rpcContract, {
    todos_list: async () => ({ todos: await listTodos() }),
    todos_add: ({ title }) => addTodo(title),
    todos_set_done: async ({ id, done }) => {
      const todo = await setTodoDone(id, done);
      if (todo === null) throw new Error(`No todo with id ${id}`);
      return todo;
    },
    todos_remove: async ({ id }) => ({ removed: await removeTodo(id) }),
  });

  // The `bb spawn-split` command: what agents (and you) use from a shell. Parsing
  // argv is plugin-owned; `commands` is metadata BB renders into help and
  // the generated plugin-commands skill without running plugin code.
  const usage = [
    "Usage:",
    "  bb spawn-split list [--json]",
    "  bb spawn-split add <title> [--json]",
    "  bb spawn-split done <todo-id> [--json]",
    "  bb spawn-split undo <todo-id> [--json]",
    "  bb spawn-split remove <todo-id> [--json]",
  ].join("\n");
  function formatTodo(todo: Todo): string {
    return `[${todo.done ? "x" : " "}] ${todo.id}  ${todo.title}`;
  }
  bb.cli.register({
    name: "spawn-split",
    summary: "Manage the Spawn Split plugin's example todo list",
    commands: [
      { name: "list", summary: "List todos", usage: "bb spawn-split list [--json]" },
      {
        name: "add",
        summary: "Add a todo",
        usage: "bb spawn-split add <title> [--json]",
      },
      {
        name: "done",
        summary: "Mark a todo done",
        usage: "bb spawn-split done <todo-id> [--json]",
      },
      {
        name: "undo",
        summary: "Mark a todo not done",
        usage: "bb spawn-split undo <todo-id> [--json]",
      },
      {
        name: "remove",
        summary: "Remove a todo",
        usage: "bb spawn-split remove <todo-id> [--json]",
      },
    ],
    async run(argv) {
      const json = argv.includes("--json");
      const [command, ...args] = argv.filter((arg) => arg !== "--json");
      const reply = (value: unknown, text: string) => ({
        exitCode: 0,
        stdout: json ? JSON.stringify(value) : text,
      });
      const notFound = (missingId: string) => ({
        exitCode: 1,
        stderr: `No todo with id ${missingId}. Run "bb spawn-split list" to see ids.`,
      });
      const todoId = args[0];
      switch (command) {
        case undefined:
        case "help":
        case "--help":
          return { exitCode: 0, stdout: usage };
        case "list": {
          const todos = await listTodos();
          return reply(
            todos,
            todos.length === 0 ? "No todos." : todos.map(formatTodo).join("\n"),
          );
        }
        case "add": {
          const title = args.join(" ").trim();
          if (title === "") break;
          const todo = await addTodo(title);
          return reply(todo, `Added ${formatTodo(todo)}`);
        }
        case "done":
        case "undo": {
          if (todoId === undefined || args.length !== 1) break;
          const todo = await setTodoDone(todoId, command === "done");
          if (todo === null) return notFound(todoId);
          return reply(todo, formatTodo(todo));
        }
        case "remove": {
          if (todoId === undefined || args.length !== 1) break;
          if (!(await removeTodo(todoId))) return notFound(todoId);
          return reply({ removed: true, id: todoId }, `Removed ${todoId}`);
        }
      }
      return { exitCode: 1, stderr: usage };
    },
  });

  // Cleanup on reload/disable/shutdown; hooks run LIFO. The sanctioned place
  // to clear timers and close connections.
  bb.onDispose(() => {
    bb.log.info("disposed");
  });

  // Long-lived background work: starts after load, gets an AbortSignal on
  // reload/disable/shutdown, and restarts with backoff if it crashes. Sleeps
  // must wake on abort — a plain setTimeout sleeps through the stop window
  // and the plugin reports "degraded (service did not stop)" on reload.
  // bb.background.service("worker", {
  //   async start(signal) {
  //     while (!signal.aborted) {
  //       await new Promise((resolve) => {
  //         const timer = setTimeout(resolve, 60_000);
  //         signal.addEventListener(
  //           "abort",
  //           () => { clearTimeout(timer); resolve(undefined); },
  //           { once: true },
  //         );
  //       });
  //     }
  //   },
  // });
}
