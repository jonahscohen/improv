---
name: spawn-split Task 3 final-review fix wave
description: Fixed open-failure double-counting, honored ctx.signal abort, wrapped shared-env lookup in try/catch, and deleted the leftover todo scaffold entirely from bb-plugin-spawn-split/server.ts
type: project
relates_to: [session_2026-09-05_spawn-split-task3-tool.md]
author_human: Jonah Cohen
source: session
verified: tests
confidence: high
---

Coordinator-directed whole-branch review fix wave on bb-plugin-spawn-split/
(branch spawn-split-plugin), applied after Task 3's initial spawn_split
implementation.

- Open-failure double-count fixed: `spawned.push(child.id)` now runs only
  AFTER `threads.open()` resolves, not before. If open() throws, the entry
  goes into `failed` (never also into `spawned`) with a message that
  preserves the created thread id: `` `${childId} spawned but split open
  failed: <err>` `` - so the user still learns the orphaned thread exists.
  `isError = spawned.length === 0` is unchanged, but now actually means
  "no pane opened" rather than "no spawn call succeeded".
- `ctx.signal?.aborted` checked at the top of each loop iteration; on abort
  the loop breaks (no throw) and the bounded partial result is returned.
  `SpawnSplitCtx.signal` was widened to optional to keep the interface
  test-friendly (a plain `{ aborted: true }` object satisfies it without
  needing a real AbortController for that one case).
- The `env=shared` caller-environment lookup
  (`bb.sdk.threads.get({ threadId: ctx.threadId })`) is now inside its own
  try/catch. A rejection returns a bounded `isError: true` result
  ("failed to resolve caller environment: <err>") instead of throwing out
  of `runSpawnSplit` - a single lookup failure no longer blows up the whole
  tool call.
- Deleted the entire todo-list scaffold: `todoSchema`, `rpcContract`
  (defineRpcContract import removed), `TODOS_CHANGED` +
  `bb.realtime.publish(...)`, `readTodos`/`writeTodos`/`listTodos`/
  `addTodo`/`setTodoDone`/`removeTodo`, `bb.settings.define({ showDone })`,
  `bb.rpc.register(...)`, and the `bb.cli.register({ name: "spawn-split",
  ... })` todo CLI command (list/add/done/undo/remove). `randomUUID` import
  dropped along with it (no longer used). server.ts is now exactly what the
  fix-wave spec called for: imports (zod, resolveEnvironment), the tool
  schema/plan/context types, `runSpawnSplit`, and a plugin factory that
  only registers `spawn_split` and an `onDispose` log line. Zero
  `bb.realtime.publish` calls remain anywhere in the file - the plugin is
  genuinely headless end to end now, not just missing a frontend.

Why: the tool's whole purpose is opening a pane - counting a thread as
"spawned" when its pane never opened was a correctness bug that would have
silently under-reported failures to the calling agent. Aborting mid-batch
without honoring the signal would waste child threads a cancelled call no
longer wants. A rejected environment lookup throwing out of the tool
entirely (rather than returning bounded text) breaks the "always return
bounded text, isError only signals failure" contract the tool promises.
The todo scaffold was dead weight risking confusion about what this plugin
actually does.

How: TDD - added 3 new tests to server.test.ts (open()-throws path,
signal-aborted-before-loop, threads.get-rejects-for-shared) alongside the
existing 8, ran `npx vitest run` (14/14 pass: 11 in server.test.ts + 3 in
env.test.ts), then `bb plugin build` (clean, dist/server.js only, no
unused-import/type errors from the scaffold deletion).

Files touched: bb-plugin-spawn-split/server.ts (rewritten, scaffold
removed), bb-plugin-spawn-split/server.test.ts (3 tests added),
.superpowers/sdd/2026-09-05-spawn-split/task-3-report.md (fix-wave section
appended, commit hash e4597c22 recorded).

Committed as e4597c22 on branch spawn-split-plugin ("harden spawn_split:
fix open-failure counting, honor abort, remove todo scaffold").
