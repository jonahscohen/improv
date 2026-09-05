# spawn-split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a bb plugin whose agent tool `spawn_split` spawns child threads (agents) and auto-opens each as a true split pane in getbb.app.

**Architecture:** One bb plugin package. The backend registers an agent tool that spawns a child thread parented to the caller (environment chosen per call) and publishes a realtime signal. An always-mounted frontend overlay listens for that signal and opens the child thread's `ThreadChat` as a split pane via `experimental_useAppPanel().openFixedTab`, falling back to the thread panel or a toast when no split surface is available.

**Tech Stack:** TypeScript, `@get-bb/plugin-sdk` (backend `server.ts`) and `@get-bb/plugin-sdk/app` (frontend `app.tsx`), zod 4, React (host-shimmed), the bb plugin CLI (`bb plugin new|build|types|install`).

**Spec:** `docs/superpowers/specs/2026-09-05-spawn-split-plugin-design.md`

## Global Constraints

- No emdashes or endashes anywhere (CLAUDE.md content-guard blocks them). Use hyphens.
- No AI attribution in commits or comments. Git author is Jonah.
- Plugin package lives at repo top level `spawn-split/`.
- React and the SDK are never bundled; `bb plugin build` shims them. The bundle only runs inside bb.
- Every new public SDK surface the plugin consumes is experimental-prefixed as the SDK declares it (for example `experimental_useAppPanel`, `experimental_appOverlay`). Use the names the installed SDK exports, confirmed in Task 1.
- Agent tool `name` must be unique across all plugins and match `[a-zA-Z0-9_-]+`.
- Tool output must be bounded (return short text plus the spawned ids).
- Tool-set changes apply on the NEXT provider session start, not mid-session; plan the live check accordingly.

---

### Task 1: Scaffold the plugin and pin the live SDK contracts

**Files:**
- Create: `spawn-split/` (scaffold output: `package.json`, manifest/`bb.app`, `server.ts`, `app.tsx`)
- Create: `spawn-split/CONTRACTS.md` (records the confirmed signatures the later tasks consume)

**Interfaces:**
- Produces: a buildable scaffold, plus `CONTRACTS.md` recording the four confirmed literals used downstream:
  1. `WORKTREE_ENV`: the exact `bb.sdk.threads.spawn` `environment` argument for a fresh managed worktree (candidate `{ type: "worktree" }`; confirm exact discriminant).
  2. `SHARED_ENV(environmentId)`: confirmed as `{ type: "environment", environmentId }`.
  3. `PANE_PRIMITIVE`: whether `bb.sdk.threads.paneAction` opens a thread pane from the backend. Record `"backend-paneAction"` if yes, else `"frontend-openFixedTab"`.
  4. `OPEN_FIXED_TAB_TAB`: the exact `tab` object shape `experimental_useAppPanel().openFixedTab({ surface, tab })` expects for hosting a `ThreadChat`.

- [ ] **Step 1: Scaffold the package**

Run: `bb plugin new spawn-split`
Expected: a `spawn-split/` directory with frontend files included.

- [ ] **Step 2: Build the untouched scaffold to confirm the toolchain**

Run: `cd spawn-split && bb plugin build`
Expected: build succeeds with no errors.

- [ ] **Step 3: Dump the live SDK types**

Run: `cd spawn-split && bb plugin types`
Expected: type declarations printed or written. Read them for: the `spawn` `environment` union (worktree variant), `bb.sdk.threads.paneAction` signature, `experimental_useAppPanel().openFixedTab` argument type, and `ThreadChat` props.

- [ ] **Step 4: Record the four literals in CONTRACTS.md**

Write `spawn-split/CONTRACTS.md` with the confirmed `WORKTREE_ENV`, `SHARED_ENV`, `PANE_PRIMITIVE`, and `OPEN_FIXED_TAB_TAB` values copied verbatim from the type output. This file is the source of truth Tasks 2 through 4 read.

- [ ] **Step 5: Commit**

```bash
git add spawn-split
git commit -m "scaffold spawn-split plugin and pin SDK contracts"
```

---

### Task 2: Environment resolver (pure function, unit tested)

**Files:**
- Create: `spawn-split/env.ts`
- Test: `spawn-split/env.test.ts`

**Interfaces:**
- Consumes: `WORKTREE_ENV` literal from Task 1 `CONTRACTS.md`.
- Produces: `resolveEnvironment(env, callerEnvironmentId)` returning the `environment` argument type of `bb.sdk.threads.spawn`. `env` is `"worktree" | "shared"`; `callerEnvironmentId` is `string | null`. Throws `Error("spawn_split: cannot resolve caller environment for env=shared")` when `env === "shared"` and `callerEnvironmentId` is null.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { resolveEnvironment } from "./env";

describe("resolveEnvironment", () => {
  it("returns the worktree env for env=worktree, ignoring caller env", () => {
    expect(resolveEnvironment("worktree", "env_abc")).toEqual({ type: "worktree" });
  });
  it("returns the caller environment for env=shared", () => {
    expect(resolveEnvironment("shared", "env_abc")).toEqual({
      type: "environment",
      environmentId: "env_abc",
    });
  });
  it("throws for env=shared with no caller environment", () => {
    expect(() => resolveEnvironment("shared", null)).toThrow(/cannot resolve caller environment/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd spawn-split && npx vitest run env.test.ts`
Expected: FAIL (`resolveEnvironment` not defined).

- [ ] **Step 3: Write minimal implementation**

```ts
// Replace the worktree literal with the exact value pinned in CONTRACTS.md (Task 1) if it differs.
export type SpawnEnvironment =
  | { type: "worktree" }
  | { type: "environment"; environmentId: string };

export function resolveEnvironment(
  env: "worktree" | "shared",
  callerEnvironmentId: string | null,
): SpawnEnvironment {
  if (env === "worktree") return { type: "worktree" };
  if (!callerEnvironmentId) {
    throw new Error("spawn_split: cannot resolve caller environment for env=shared");
  }
  return { type: "environment", environmentId: callerEnvironmentId };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd spawn-split && npx vitest run env.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add spawn-split/env.ts spawn-split/env.test.ts
git commit -m "add spawn-split environment resolver"
```

---

### Task 3: The `spawn_split` agent tool (backend, unit tested)

**Files:**
- Modify: `spawn-split/server.ts`
- Test: `spawn-split/server.test.ts`

**Interfaces:**
- Consumes: `resolveEnvironment` (Task 2); `bb.agents.registerTool`, `bb.sdk.threads.spawn`, `bb.sdk.threads.get`, `bb.realtime.publish` from the SDK.
- Produces: a registered tool `spawn_split` with parameters `{ prompt: string; title?: string; provider?: string; model?: string; env?: "worktree" | "shared"; count?: number }` (defaults `env="worktree"`, `count=1`). Publishes `{ threadId, title }` on realtime channel `"spawn-split"` per spawned child. Returns bounded text listing spawned ids.
- Produces: an exported pure `buildSpawnPlan(args)` helper so the spawn loop is unit-testable without the live daemon. It expands `count` and derives a fallback title from a truncated prompt.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { buildSpawnPlan } from "./server";

describe("buildSpawnPlan", () => {
  it("expands count into one entry per split", () => {
    const plan = buildSpawnPlan({ prompt: "do x", env: "worktree", count: 3 });
    expect(plan).toHaveLength(3);
    expect(plan.every((p) => p.env === "worktree")).toBe(true);
  });
  it("derives a fallback title from a truncated prompt when title is absent", () => {
    const long = "a".repeat(120);
    const [entry] = buildSpawnPlan({ prompt: long, env: "shared", count: 1 });
    expect(entry.title.length).toBeLessThanOrEqual(60);
    expect(entry.env).toBe("shared");
  });
  it("keeps an explicit title", () => {
    const [entry] = buildSpawnPlan({ prompt: "x", title: "Review", env: "worktree", count: 1 });
    expect(entry.title).toBe("Review");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd spawn-split && npx vitest run server.test.ts`
Expected: FAIL (`buildSpawnPlan` not defined).

- [ ] **Step 3: Write minimal implementation**

Add to `spawn-split/server.ts` (registration wiring plus the exported helper):

```ts
import { z } from "zod";
import { resolveEnvironment } from "./env";

export type SplitPlanEntry = {
  prompt: string;
  title: string;
  provider?: string;
  model?: string;
  env: "worktree" | "shared";
};

export function buildSpawnPlan(args: {
  prompt: string;
  title?: string;
  provider?: string;
  model?: string;
  env: "worktree" | "shared";
  count: number;
}): SplitPlanEntry[] {
  const title = args.title ?? args.prompt.slice(0, 60);
  return Array.from({ length: args.count }, () => ({
    prompt: args.prompt,
    title,
    provider: args.provider,
    model: args.model,
    env: args.env,
  }));
}

export default function register(bb: any) {
  bb.agents.registerTool({
    name: "spawn_split",
    description:
      "Spawn one or more child agents from this thread, each opened as a split pane. Use env=worktree (default) for isolated parallel work, env=shared to reuse this thread's environment.",
    presentation: { label: { pending: "Spawning split", completed: "Spawned split" } },
    parameters: z.object({
      prompt: z.string().min(1),
      title: z.string().optional(),
      provider: z.string().optional(),
      model: z.string().optional(),
      env: z.enum(["worktree", "shared"]).default("worktree"),
      count: z.number().int().min(1).max(8).default(1),
    }),
    async execute(args: any, ctx: any) {
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
            ...(entry.provider ? { provider: entry.provider } : {}),
            ...(entry.model ? { model: entry.model } : {}),
            environment,
          });
          spawned.push(child.id);
          bb.realtime.publish("spawn-split", { threadId: child.id, title: entry.title });
        } catch (err) {
          failed.push(err instanceof Error ? err.message : String(err));
        }
      }
      const lines = [
        spawned.length ? `Spawned ${spawned.length} split(s): ${spawned.join(", ")}` : "Spawned 0 splits",
        ...(failed.length ? [`Failed ${failed.length}: ${failed.join("; ")}`] : []),
      ];
      return { content: [{ type: "text", text: lines.join("\n") }], isError: spawned.length === 0 };
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd spawn-split && npx vitest run server.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Build to confirm the registration type-checks against the live SDK**

Run: `cd spawn-split && bb plugin build`
Expected: build succeeds. If `bb.sdk.threads.spawn` rejects the `environment` literal, replace it with the Task 1 `WORKTREE_ENV` value and rebuild.

- [ ] **Step 6: Commit**

```bash
git add spawn-split/server.ts spawn-split/server.test.ts
git commit -m "add spawn_split agent tool"
```

---

### Task 4: Frontend overlay that opens the split pane

**Files:**
- Modify: `spawn-split/app.tsx`

**Interfaces:**
- Consumes: `definePluginApp`, `useRealtime`, `useBbNavigate`, `experimental_useAppPanel`, `ThreadChat`, `toast` from `@get-bb/plugin-sdk/app`; realtime channel `"spawn-split"` payload `{ threadId, title }` (Task 3); `OPEN_FIXED_TAB_TAB` shape (Task 1).
- Produces: an `experimental_appOverlay` slot (always mounted) that opens each spawned thread as a split pane, with a thread-panel or toast fallback.

- [ ] **Step 1: Implement the overlay listener**

Replace the scaffold body of `spawn-split/app.tsx` with:

```tsx
import {
  definePluginApp,
  useRealtime,
  useBbNavigate,
  experimental_useAppPanel,
  ThreadChat,
} from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";

function SplitOpener() {
  const panel = experimental_useAppPanel();
  const nav = useBbNavigate();
  useRealtime("spawn-split", ({ threadId, title }: { threadId: string; title: string }) => {
    // Shape of `tab` confirmed in Task 1 CONTRACTS.md (OPEN_FIXED_TAB_TAB).
    const opened = panel.openFixedTab({
      surface: { kind: "current" },
      tab: {
        id: `spawn-split:${threadId}`,
        title: title || "Agent",
        component: () => <ThreadChat threadId={threadId} variant="full" layout="document" />,
      },
    });
    if (!opened) {
      const shown = nav.openThreadPanel?.(threadId);
      if (!shown) toast(`Spawned agent ${title || threadId} (open it from the sidebar)`);
    }
  });
  return null;
}

export default definePluginApp((app) => {
  app.slots.experimental_appOverlay({ id: "spawn-split-opener", component: SplitOpener });
});
```

- [ ] **Step 2: Build the bundle**

Run: `cd spawn-split && bb plugin build`
Expected: build succeeds. If `openFixedTab`'s `tab` type rejects this object, adjust to the `OPEN_FIXED_TAB_TAB` shape recorded in Task 1 and rebuild. If Task 1 recorded `PANE_PRIMITIVE = "backend-paneAction"`, additionally move the pane-open into `server.ts` via `bb.sdk.threads.paneAction` and keep this overlay as the fallback-only path.

- [ ] **Step 3: Commit**

```bash
git add spawn-split/app.tsx
git commit -m "open spawned threads as split panes"
```

---

### Task 5: Live end-to-end verification and install

**Files:**
- None (verification only; may touch `spawn-split/README.md`)

**Interfaces:**
- Consumes: the built plugin from Tasks 1 through 4.

- [ ] **Step 1: Install (or reload) the plugin**

Run: `cd /Users/spare3/Documents/Github/improv && bb plugin install ./spawn-split` (or the reload command `bb plugin` reports for an already-installed build).
Expected: `bb plugin list` shows `spawn-split` running with no error detail.

- [ ] **Step 2: Start a fresh provider session so the tool is offered**

Because tool-set changes apply on the next session start, spawn or restart a thread after install. Run: `bb thread spawn --project proj_j7jr75x4gd --prompt "call the spawn_split tool with prompt='say hello' env=worktree" --parent-self`
Expected: the child agent calls `spawn_split`; `bb thread show <id>` shows the tool row "Spawned split".

- [ ] **Step 3: Verify env=worktree isolation**

Run: `bb thread list --parent-thread <the caller id> --json` and inspect each child's environment id. Expected: an `env=worktree` child has a different environment id from the caller; an `env=shared` child matches the caller's.

- [ ] **Step 4: Verify the split pane opens (browser)**

In getbb.app with the caller thread open, trigger `spawn_split` again with `count=2`. Expected: two new split panes appear, each rendering the child's chat. If no split surface is available (compact/mobile), confirm the thread-panel or toast fallback fires instead. Capture what you observe.

- [ ] **Step 5: Commit any README/notes and finish**

```bash
git add spawn-split
git commit -m "document spawn-split usage"
```

---

## Self-Review

- **Spec coverage:** agent tool (Task 3), true split pane (Task 4), caller-chosen env with worktree default (Tasks 2 and 3), auto-open (Task 4), returned ids (Task 3), fan-out count (Task 3), error/partial-failure and fallback handling (Tasks 3 and 4), testing and live check (all tasks, Task 5). The spec's four open questions are resolved in Task 1 and consumed by name downstream.
- **Placeholder scan:** no TBD/TODO. The three live-SDK-dependent literals are concrete defaults gated by a Task 1 confirmation, not open placeholders.
- **Type consistency:** `resolveEnvironment` (Task 2) is consumed with the same signature in Task 3; realtime channel `"spawn-split"` and payload `{ threadId, title }` match between Task 3 (publish) and Task 4 (subscribe); `buildSpawnPlan` shape is consistent between its test and use.
