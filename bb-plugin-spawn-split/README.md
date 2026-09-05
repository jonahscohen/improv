# bb-plugin-spawn-split

A headless BB plugin (backend only, no frontend). It gives an agent a tool,
`spawn_split`, that spawns one or more child threads from the calling thread
and opens each as its own split pane - straight from server code, via
`bb.sdk.threads.spawn` followed by `bb.sdk.threads.open({ threadId, split })`.
No `app.tsx`, `components/`, `hooks/`, or `lib/` are needed: the pane opens
server-side during the tool call, so there is nothing for a frontend to
subscribe to.

- `server.ts` - registers the `spawn_split` agent tool and implements its
  spawn-then-open loop.
- `env.ts` - resolves the `env` argument (`worktree` or `shared`) into the
  concrete SDK environment payload each child thread spawns into.
- `PLUGIN_OVERVIEW.md` - the store listing text shown under `bb.description`
  on the plugin's detail page.

## Install

```
bb plugin install <source>
```

From a local clone, that is:

```
npm install
bb plugin install .
```

After editing sources, reload with `bb plugin reload spawn-split`, or run
`bb plugin dev` to rebuild and reload on every save.

## The `spawn_split` tool

An agent working in a thread calls `spawn_split` to fan out child agents,
each visible in its own split pane next to the parent conversation.

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `prompt` | string (required) | - | The prompt each child thread starts with. |
| `title` | string | first 60 chars of `prompt` | Title shown on the child thread and its pane. |
| `provider` | string | caller's provider | Provider override for the child thread. |
| `model` | string | caller's model | Model override for the child thread. |
| `env` | `"worktree"` \| `"shared"` | `"worktree"` | Which environment each child spawns into (see below). |
| `count` | integer, 1-8 | `1` | Number of child threads to spawn. |
| `split` | `"down"` \| `"left"` \| `"replace"` \| `"right"` \| `"top"` | `"right"` | Which direction to open each new pane relative to the caller's pane. |

## Behavior

- **Parented to the caller.** Every child thread is spawned with
  `parentThreadId` set to the calling thread, so it shows up as a child of
  the thread that ran the tool.
- **`env: "worktree"` (default)** gives each child a fresh, isolated managed
  worktree on the same host as the caller (or the primary connected host, if
  the caller has no environment of its own). Use this for parallel work that
  should not step on the caller's files - each child edits its own checkout.
- **`env: "shared"`** reuses the caller's own environment directly, so the
  child reads and writes the same working tree as the caller. Use this when
  the child genuinely needs to see or extend the caller's in-progress
  changes rather than working in isolation.
- **Bounded output.** The tool returns a short summary - `Spawned N
  split(s): <ids>` plus a `Failed M: <reasons>` line when applicable - never
  the full thread transcripts.
- **Partial-failure handling.** `count` spawns are attempted independently.
  If some succeed and others fail (for example, one pane fails to open after
  its thread spawned), the result reports both the succeeded and failed
  entries and `isError` is only `true` when *none* succeeded. Failures are
  also logged via the plugin logger for observability.
- **Honors abort.** If the calling turn's `AbortSignal` is already aborted
  when `spawn_split` starts, it returns immediately with zero network calls
  (no thread lookups, no spawns). If it is aborted partway through a
  multi-count call, the loop stops before spawning any further children;
  children already spawned are left in place.

## Usage example

An agent asked to review three independent modules might call:

```json
{
  "tool": "spawn_split",
  "arguments": {
    "prompt": "Review src/auth for security issues and report findings.",
    "title": "Review: auth",
    "env": "worktree",
    "count": 1,
    "split": "right"
  }
}
```

To fan out several reviewers at once, each into its own isolated worktree
and pane, raise `count`:

```json
{
  "tool": "spawn_split",
  "arguments": {
    "prompt": "Review this PR's diff for correctness bugs.",
    "env": "worktree",
    "count": 3,
    "split": "right"
  }
}
```

Or, to have a child continue work directly on the caller's own in-progress
changes rather than a fresh worktree:

```json
{
  "tool": "spawn_split",
  "arguments": {
    "prompt": "Finish wiring the new endpoint I started in this thread.",
    "env": "shared",
    "split": "down"
  }
}
```
