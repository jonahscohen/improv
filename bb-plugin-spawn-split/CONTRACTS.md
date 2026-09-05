# spawn-split: pinned SDK contracts

Source of truth for the four literals Tasks 2-4 consume. Everything below was
read directly out of the synced `@get-bb/plugin-sdk` (version 0.4.47)
declaration files under `node_modules/@get-bb/plugin-sdk/bundled-types/`
after running `bb plugin types` in this package. No value here is invented -
each has a file path + line range + verbatim snippet as evidence.

Deviation flagged up front: the task brief guessed two of these candidates
(`{ type: "worktree" }` for a fresh managed worktree, and
`{ type: "environment", environmentId }` for reuse). Neither guess matches
the live schema. The real discriminants are recorded below.

---

## 1. WORKTREE_ENV - fresh managed worktree environment for `threads.spawn`

`bb.sdk.threads.spawn(args: ThreadSpawnArgs)` takes `environment` as part of
`CreateThreadRequest` (via `ThreadSpawnBaseArgs extends Omit<CreateThreadRequest, ...>`).
`environment` is a discriminated union on `type` with three members:
`"reuse"`, `"host"`, `"project-default"`. A fresh managed worktree is the
`"host"` branch with `workspace.type === "managed-worktree"` - there is no
top-level `"worktree"` discriminant.

Confirmed shape:

```ts
{
  type: "host";
  hostId?: string; // OPTIONAL IN THE TYPE, REQUIRED AT RUNTIME - see below
  workspace: {
    type: "managed-worktree";
    baseBranch:
      | { kind: "named"; name: string }
      | { kind: "default" };
  };
}
```

**Runtime correction (found live, 2026-09-05, fix wave 2):** the type marks
`hostId` optional, but the daemon does NOT default it for a
`managed-worktree` workspace. Omitting it makes `bb.sdk.threads.spawn`
reject with `HTTP 400: hostId is required unless workspace.type is
personal`. The "omit to use bb's default host" note above was wrong - there
is no server-side default host for this workspace type. `hostId` must be
resolved by the caller before spawning.

Resolution strategy this plugin uses (`env.ts` + `server.ts`
`runSpawnSplit`):
1. Fetch the calling thread once (`bb.sdk.threads.get({ threadId })`) to
   get its `environmentId`.
2. If the caller has an environment, look it up
   (`bb.sdk.environments.get({ environmentId })`) and read its `hostId`
   (`Environment.hostId: string`, confirmed at
   `bb-plugin-sdk.d.ts` line 285, `environmentSchema`) - this puts the new
   worktree on the SAME host as the caller.
3. If the caller has no environment (or its host lookup comes back empty),
   fall back to the primary connected host:
   `bb.sdk.hosts.list()` (`HostsArea.list`, `HostListResult = Host[]`,
   `bb-plugin-sdk.d.ts` lines 15594/15600-15607) and pick the first entry
   with `status === "connected"` (`Host.status: "connected" | "disconnected"`,
   `hostSchema` line 331), falling back to `hosts[0]` if none report
   connected. **Note the field name on `Host` is `id`, not `hostId`** -
   `hostSchema` (line 320-340) has `id: string` and no `hostId` field at
   all; only `Environment` has a field literally named `hostId`. Reading a
   `Host` entry's `hostId` instead of its `id` would silently produce
   `undefined`.
4. If still unresolved, `resolveEnvironment` throws
   `"spawn_split: cannot resolve a host for env=worktree"`, which the
   per-entry try/catch in `runSpawnSplit` turns into a bounded `isError`
   failure rather than an HTTP 400 surfacing from the daemon.

Minimal literal shape to use for "fresh managed worktree off the default
branch, on host `hostId`":

```ts
const WORKTREE_ENV = (hostId: string) => ({
  type: "host",
  hostId,
  workspace: {
    type: "managed-worktree",
    baseBranch: { kind: "default" },
  },
} as const);
```

Evidence: `node_modules/@get-bb/plugin-sdk/bundled-types/bb-plugin-sdk.d.ts`,
`createThreadRequestSchema`, lines 10339-10369:

```
declare const createThreadRequestSchema: z$1.ZodObject<{
    environment: z$1.ZodDiscriminatedUnion<[z$1.ZodObject<{
        environmentId: z$1.ZodString;
        type: z$1.ZodLiteral<"reuse">;
    }, z$1.core.$strip>, z$1.ZodObject<{
        hostId: z$1.ZodOptional<z$1.ZodString>;
        type: z$1.ZodLiteral<"host">;
        workspace: z$1.ZodDiscriminatedUnion<[z$1.ZodObject<{
            branch: z$1.ZodOptional<z$1.ZodDiscriminatedUnion<[z$1.ZodObject<{
                kind: z$1.ZodLiteral<"existing">;
                name: z$1.ZodString;
            }, z$1.core.$strict>, z$1.ZodObject<{
                baseBranch: z$1.ZodString;
                kind: z$1.ZodLiteral<"new">;
            }, z$1.core.$strict>], "kind">>;
            path: z$1.ZodNullable<z$1.ZodString>;
            type: z$1.ZodLiteral<"unmanaged">;
        }, z$1.core.$strip>, z$1.ZodObject<{
            baseBranch: z$1.ZodDiscriminatedUnion<[z$1.ZodObject<{
                kind: z$1.ZodLiteral<"named">;
                name: z$1.ZodString;
            }, z$1.core.$strip>, z$1.ZodObject<{
                kind: z$1.ZodLiteral<"default">;
            }, z$1.core.$strip>], "kind">;
            type: z$1.ZodLiteral<"managed-worktree">;
        }, z$1.core.$strip>, z$1.ZodObject<{
            type: z$1.ZodLiteral<"personal">;
        }, z$1.core.$strip>], "type">;
    }, z$1.core.$strip>, z$1.ZodObject<{
        type: z$1.ZodLiteral<"project-default">;
    }, z$1.core.$strip>], "type">;
    ...
}, z$1.core.$strip>;
type CreateThreadRequest = z$1.infer<typeof createThreadRequestSchema>;
```

and `ThreadSpawnArgs` wiring, same file, lines 16378-16389:

```
interface ThreadSpawnBaseArgs extends Omit<CreateThreadRequest, "input" | "origin" | "originKind" | "startedOnBehalfOf"> {
    origin?: CreateThreadRequest["origin"];
    originKind?: CreateThreadRequest["originKind"];
    startedOnBehalfOf?: CreateThreadRequest["startedOnBehalfOf"];
}
type ThreadSpawnArgs = ThreadSpawnBaseArgs & ({
    input: CreateThreadRequest["input"];
    prompt?: never;
} | {
    input?: never;
    prompt: string;
});
```

and the method itself, same file, line 16637: `spawn(args: ThreadSpawnArgs): Promise<ThreadSpawnResult>;` on the
`ThreadsArea` interface (line 16597), which is `bb.sdk.threads` (see
`BbSdk`/`BbPluginApi`, lines 16678 and 18231: `threads: ThreadsArea;` /
`readonly sdk: BbSdk;`).

## 2. SHARED_ENV(environmentId) - reuse an existing environment

The brief's guessed shape `{ type: "environment", environmentId }` does not
exist in the schema. The correct discriminant literal is `"reuse"`:

```ts
const SHARED_ENV = (environmentId: string) =>
  ({ type: "reuse", environmentId }) as const;
```

Evidence: same `environment` discriminated union quoted above, first member:

```
z$1.ZodObject<{
    environmentId: z$1.ZodString;
    type: z$1.ZodLiteral<"reuse">;
}, z$1.core.$strip>
```

Third member for completeness (project default environment, no id needed):

```ts
const PROJECT_DEFAULT_ENV = { type: "project-default" } as const;
```
(same union, third member: `z$1.ZodObject<{ type: z$1.ZodLiteral<"project-default">; }, z$1.core.$strip>`.)

## 3. PANE_PRIMITIVE - opening a spawned thread into a split pane

**PANE_PRIMITIVE = "backend-open"**, exact signature Task 3 calls verbatim:

```ts
threads.open(args: ThreadOpenArgs): Promise<ThreadOpenResult>

interface ThreadOpenArgs {
  threadId: string;
  split?: "down" | "left" | "replace" | "right" | "top"; // ThreadOpenSplit enum; omit to open without a new split
  file: ThreadOpenFile | null; // { path: string; source: "workspace" | "thread-storage"; lineNumber: number | null } | null
}
```

This is what the fix-round-1 headless decision is built on: this call
alone (paired with `threads.spawn`) is the entire mechanism, which is why
`bb-plugin-spawn-split` needs no frontend (`app.tsx` and its
components/hooks/lib were removed; `bb.app` was removed from
`package.json`).

Neither of the brief's two candidates (`"backend-paneAction"` /
`"frontend-openFixedTab"`) is exactly right. Findings:

- `bb.sdk.threads.paneAction` is backend-callable (`ThreadsArea.paneAction`,
  line 16622: `paneAction(args: ThreadPaneActionArgs): Promise<ThreadPaneActionResult>;`)
  but it does **not** open a new pane for a thread. Its `action` argument is
  a closed enum over pane *state* on an already-open thread pane:
  `"clear-spotlight" | "maximize" | "restore" | "spotlight" | "toggle"`
  (`threadPaneActionSchema`, lines 12432-12438). There is no "open" or
  "split" member. Recording `"backend-paneAction"` per the brief's literal
  choices would be misleading for what Task 1 was asked to confirm (opening
  a NEW thread as a split pane).

- The actual backend primitive that does this is a **different** method on
  the same `ThreadsArea` interface: `open`.

  ```
  interface ThreadOpenArgs {
      threadId: string;
      split?: ThreadOpenSplit;
      file: ThreadOpenFile | null;
  }
  ```
  (lines 16481-16484), where:
  ```
  declare const threadOpenSplitSchema: z$1.ZodEnum<{
      down: "down";
      left: "left";
      replace: "replace";
      right: "right";
      top: "top";
  }>;
  type ThreadOpenSplit = z$1.infer<typeof threadOpenSplitSchema>;
  ```
  (lines 12411-12418), and the method: `open(args: ThreadOpenArgs): Promise<ThreadOpenResult>;`
  (line 16621, same `ThreadsArea` interface as `spawn` and `paneAction`, so
  it is backend-callable server-side exactly like `spawn`).

  `file` can be `null` (open the thread's chat itself, no file focused) or
  a `ThreadOpenFile` (`{ path, source: "workspace" | "thread-storage", lineNumber: number | null }`,
  `threadOpenFileSchema`, lines 12419-12427).

**Recorded value:** `PANE_PRIMITIVE = "backend-open"` (not either of the two
brief candidates). Call shape for "spawn a child thread and open it as a
split pane" from backend server code:

```ts
const spawned = await bb.sdk.threads.spawn({ projectId, environment, prompt });
await bb.sdk.threads.open({
  threadId: spawned.id, // ThreadResponse's id field
  split: "right", // or "down" | "left" | "top" | "replace"
  file: null,
});
```

Fix round 1 (coordinator, post-Task-1): adopted this finding and made the
plugin headless - `app.tsx` and its `components/`, `hooks/`, `lib/` support
files are deleted, and `bb.app` is removed from `package.json`. `bb plugin
build` now emits only `dist/server.js` + `server.meta.json` (no
`app.js`/`app.css`/`app.meta.json`). Contracts 4 and 5 below are kept for
the historical record and in case a frontend surface is ever added back,
but Tasks 2-4 build against contract 3 (`threads.spawn` + `threads.open`)
only.

## 4. OPEN_FIXED_TAB_TAB - `experimental_useAppPanel().openFixedTab({ surface, tab })`

From `node_modules/@get-bb/plugin-sdk/bundled-types/bb-plugin-sdk-app.d.ts`.

`experimental_useAppPanel(): ExperimentalAppPanel` (line 2380 in the app-slot
interface, and the standalone export at line 2508):

```
interface ExperimentalAppPanel {
    openFixedTab<Target extends JsonValue = never>(options: ExperimentalOpenFixedTabOptions<Target>): boolean;
}
```
(lines 2311-2314)

`options` shape:

```
type ExperimentalOpenFixedTabOptions<Target extends JsonValue> = {
    surface: ExperimentalAppPanelSurface;
    tab: ExperimentalPluginFixedTabReference<Target>;
    /** Omit to select the tab without replacing its current session target. */
    target?: NoInfer<Target>;
};
```
(lines 2305-2310)

`surface` union - currently a single-member type, not a real union yet:

```
type ExperimentalAppPanelSurface = {
    kind: "current";
};
```
(lines 2292-2294)

`tab` shape (`ExperimentalPluginFixedTabReference<Target>`), required fields
are `panelId` and `id`; `experimental_target` is required only when `Target`
is not `never`:

```
type ExperimentalPluginFixedTabReference<Target extends JsonValue = never> = {
    /** The owning `navPanel` id; validated against the containing registration. */
    readonly panelId: string;
    /** Unique within the owning nav panel; letters, digits, `-`, `_`. */
    readonly id: string;
} & ([Target] extends [never] ? {
    /** An untargeted tab cannot be opened with a target. */
    readonly experimental_target?: never;
} : {
    /** Owner validation required before the host delivers a target. */
    readonly experimental_target: ExperimentalFixedTabTargetContract<Target>;
});
```
(lines 745-756)

So the minimal untargeted call is:

```ts
experimental_useAppPanel().openFixedTab({
  surface: { kind: "current" },
  tab: { panelId: "<your navPanel id>", id: "<fixed tab id>" },
});
```

The fixed tab referenced this way must already be declared in the plugin's
`navPanel` registration via `fixedTabs: PluginFixedTabDeclaration[]`
(`PluginFixedTabRegistration`, lines 758-765: `title`, `icon`, `component`,
optional `layout: "flush" | "padded"`, plus the same `panelId`/`id` pair).

## 5. THREADCHAT_PROPS - `ThreadChat` component props

From the same app declarations file:

```
interface ThreadChatProps {
    threadId: string;
    /**
     * "full" (default) is the page presentation (centered reading width);
     * "compact" is the side-panel presentation; "timeline" renders the
     * transcript without a composer.
     */
    variant?: "compact" | "full" | "timeline";
    /**
     * "contained" (default) fills and scrolls inside a bounded parent;
     * "document" grows with its content and defers scrolling to the page.
     */
    layout?: "contained" | "document";
    /** Bump to focus the composer (ignored by `variant: "timeline"`). */
    focusRequest?: number;
    permissionPolicy?: "editable" | "inherit";
    className?: string;
    leadingContent?: ReactNode;
    messageActions?: readonly ThreadChatMessageAction[];
}
```
(lines 1992-2024). `ThreadChat` itself: `declare const ThreadChat: react.ComponentType<ThreadChatProps>;`
(line 2493), exported from `@get-bb/plugin-sdk` app entry (line 2519).

Required field is only `threadId`; `variant` accepts `"compact" | "full" |
"timeline"`, `layout` accepts `"contained" | "document"`.

---

## File path this was read from

`bb-plugin-spawn-split/node_modules/@get-bb/plugin-sdk/bundled-types/bb-plugin-sdk.d.ts`
(backend/server contracts: `spawn`, `open`, `paneAction`, `environment` union)
and
`bb-plugin-spawn-split/node_modules/@get-bb/plugin-sdk/bundled-types/bb-plugin-sdk-app.d.ts`
(frontend contracts: `experimental_useAppPanel`, `openFixedTab`, `ThreadChat`).
