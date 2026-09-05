# spawn-split: agent-driven split panes for bb

**Commit stamp:** `cfa303d4` (run `git rev-parse --short HEAD`; if HEAD has moved, re-verify the current-state claims below before executing.)
**Author:** Jonah Cohen
**Date:** 2026-09-05
**Status:** Design, awaiting review

## Overview

A bb plugin that lets the *agent* open its own split panes, each hosting a
freshly spawned child thread (agent). The running agent calls a registered
tool mid-turn; the plugin spawns a child thread parented to the caller and, on
any connected browser, opens that child's chat as a true split pane beside the
current view.

This is the "let you create your own splits to spawn agents in" request,
resolved to: agent tool, then child thread, then true split pane, auto-opened,
with the caller choosing the environment.

## Goals

- An agent-callable tool (`spawn_split`) that spawns one or more child threads
  from inside a turn, parented to the calling thread.
- Each spawned thread is surfaced as a true split pane (not the thread
  right-panel) in getbb.app, opened automatically.
- The caller chooses the execution environment per call: a fresh worktree
  (default, isolation) or the current thread's shared environment.
- The tool returns the spawned thread IDs so the agent can address them later
  (send follow-ups, wait, read output).

## Non-goals

- No human-facing "split" button in this version (agent-driven only; a
  frontend action can be added later on the same plumbing).
- No orchestration or coordination layer beyond spawn plus return IDs.
  Waiting on results, fan-in, and teardown are the caller's job via existing
  SDK/CLI.
- No cross-machine spawning; children run on the parent's machine.

## Decisions (locked with the user 2026-09-05)

| Decision | Choice |
|---|---|
| UI surface | True split pane via `experimental_useAppPanel().openFixedTab` |
| Environment | Tool argument, caller chooses: `worktree` (default) or `shared` |
| Open timing | Auto-open on spawn |

## Architecture

Two halves in one plugin package:

### 1. Backend, the agent tool (`server.ts`)

Register with `bb.agents.registerTool`:

- **name:** `spawn_split`
- **parameters (zod):**
  - `prompt: string` (min 1), the child agent's initial task.
  - `title?: string`, child thread title (falls back to a truncated prompt).
  - `provider?: string`, `model?: string`, optional overrides.
  - `env?: "worktree" | "shared"`, default `"worktree"`.
  - `count?: number` (1 to 8, default 1), fan-out; each gets its own pane and,
    when `worktree`, its own worktree. Same `prompt` for all in v1 (keep it
    simple; distinct prompts are separate tool calls).
- **execute:** for each of `count`:
  1. `bb.sdk.threads.spawn({ projectId, parentThreadId: ctx.threadId, prompt,
     title, provider?, model?, environment: <resolved> })`.
     - `env: "shared"` resolves the caller's environment id from `ctx.threadId`
       and passes `{ type: "environment", environmentId }`.
     - `env: "worktree"` passes the SDK's new-managed-worktree environment
       shape (CLI-proven equivalent: `--new-environment worktree`). The exact
       SDK discriminant must be confirmed via `bb plugin types` at
       implementation time; the reference shows `{ type: "project-default" }`
       and `{ type: "environment", environmentId }`, and the worktree variant
       is the one live-SDK unknown.
  2. Publish `bb.realtime.publish("spawn-split", { threadId, title })`.
  3. Collect the id.
  - Return bounded text such as "Spawned N split(s): id1, id2" including the
    ids so the agent can reuse them.
- **presentation:** pending "Spawning split", completed "Spawned split".

The child thread is authoritative: it exists whether or not any browser is
connected. The realtime publish is a best-effort UI nudge.

### 2. Frontend, the pane opener (`app.tsx`)

A persistent, always-mounted registration (a top-level content-script style
registration, not tied to a route) that:

- runs `useRealtime("spawn-split", ({ threadId, title }) => ...)`
- on signal, calls `experimental_useAppPanel().openFixedTab({ surface: { kind:
  "current" }, tab: <ThreadChat for threadId> })` to open the spawned thread's
  chat as a split pane. `ThreadChat` is a host-provided frontend component
  addressed by `threadId` (confirm prop shape against `frontend-components` at
  build time).
- `openFixedTab`/`openPanel` return a boolean; a `false` (no split surface
  available, for example compact/mobile) falls back to
  `useBbNavigate().openThreadPanel(threadId)` or a toast with a manual open
  action. A decline is a return value, never a throw.

**Preferred alternative to verify first:** the SDK exposes
`bb.sdk.threads.paneAction` and a `PluginSidebarSplitPane` type. If
`paneAction` can open a thread in a pane directly from the backend, prefer it
over the realtime-plus-frontend bridge (fewer moving parts, no dependency on a
mounted listener). Verify its contract via `bb plugin types` in step 1 of
implementation; if it does the job, the frontend half shrinks to a fallback or
disappears. The realtime bridge is the documented, proven path and is the
fallback if `paneAction` does not cover backend-initiated pane opens.

## Data flow

```
agent turn
  -> calls spawn_split { prompt, env, count }
       -> backend execute:
            - threads.spawn(parent=caller, environment=resolved)  [authoritative]
            - realtime.publish("spawn-split", { threadId, title })
            - return spawned ids to the model
                 -> (browser, if connected) useRealtime handler
                      -> openFixedTab(ThreadChat[threadId])  [split pane opens]
```

## Error handling

- Bad model args: zod validation turns them into a tool error, not a crash.
- `env: "shared"` but caller env unresolvable: tool error with a clear message.
- Worktree creation failure for one of `count`: spawn the rest, report which
  succeeded/failed in the returned text; never leave a half-created worktree
  (rely on bb's own env lifecycle; do not hand-roll cleanup).
- `openFixedTab` returns `false`: fall back to thread panel or toast; the
  thread still exists.
- Children are visible by default (they are meant to be seen in panes), so the
  hidden-worker cleanup discipline does not apply; they are user-managed
  threads once spawned.

## File layout

Scaffold with `bb plugin new spawn-split`, placed at repo top level
`spawn-split/` (matches the repo's `justify/`, `lotus/`, `tilt-lab/`
convention). Keep the frontend files (the scaffold includes them since we need
`app.tsx`).

```
spawn-split/
  package.json         # declares @get-bb/plugin-sdk + zod deps
  bb.app / manifest    # plugin id, name, contributes
  server.ts            # registerTool + realtime publish
  app.tsx              # useRealtime -> openFixedTab
  server.test.ts       # tool contract + env resolution
```

## Testing

- **Backend contract:** unit test `spawn_split` execute with a mocked
  `bb.sdk.threads.spawn`, asserting parent id equals caller, environment
  resolved correctly for `worktree` vs `shared`, `count` fan-out, bounded
  output, realtime publish fired per child, and error paths (bad env, partial
  failure).
- **Build:** `bb plugin build` clean; `bb plugin types` to pin the live SDK
  discriminants used (worktree env shape, `paneAction`, `openFixedTab`,
  `ThreadChat` props).
- **Live check:** install/reload, call the tool from a real thread, confirm a
  split pane opens with the child's chat, confirm `env: worktree` gives an
  isolated worktree and `env: shared` reuses the caller's, confirm `count > 1`
  opens multiple panes. Verify the `false`-return fallback on a compact layout.

## Open questions to resolve at implementation time (via `bb plugin types`)

1. Exact SDK environment discriminant for a fresh managed worktree.
2. Whether `bb.sdk.threads.paneAction` opens a thread in a pane from the
   backend (would simplify or replace the frontend half).
3. `ThreadChat` component prop shape for rendering an arbitrary `threadId`.
4. The exact always-mounted frontend registration slot for the listener.

These are contract lookups, not design unknowns: the design holds regardless
of which primitive wins; only the wiring shifts.
