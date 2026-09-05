---
name: spawn-split Task 3 - spawn_split agent tool
description: Registered spawn_split agent tool (backend-only, threads.spawn + threads.open) with 11 passing vitest tests and a clean bb plugin build
type: project
relates_to: [session_2026-09-05_spawn-split-task2-env-resolver.md, decision_2026-09-05_spawn-split-plugin.md]
author_human: Jonah Cohen
source: session
verified: tests
confidence: high
---

Implemented Task 3 of the spawn-split plugin build in
bb-plugin-spawn-split/: registered the `spawn_split` bb.agents tool that
spawns 1-8 child threads from the calling thread and opens each as a split
pane, entirely from the backend.

- Added `buildSpawnPlan(args)` (pure, exported) - expands `count` into N
  plan entries, derives a fallback title (prompt.slice(0,60)) when absent,
  carries provider/model/env/split through each entry.
- Added `runSpawnSplit(bb, args, ctx)` (exported, standalone) so the tool's
  execute logic is testable with an injected mock `bb` - no live daemon
  needed. `registerTool`'s `execute` just forwards to it.
- For `env: "shared"`, calls `bb.sdk.threads.get({ threadId: ctx.threadId })`
  and reads `.environmentId` (confirmed field name straight off
  `threadResponseSchema` in bb-plugin-sdk.d.ts line 11832 - nullable string,
  matches the brief's guess, no correction needed there).
- Field-name correction found while reading `createThreadRequestSchema`
  (bb-plugin-sdk.d.ts ~line 10475): the brief's tool param is called
  `provider`, but the real spawn-args field is **`providerId`**, not
  `provider`. Server code sends `providerId: entry.provider` when the tool's
  `provider` param is set, spreads `model` as-is (already correctly named).
  Getting this wrong would have failed the build or silently dropped the
  arg, so this was worth pinning explicitly.
- Per each plan entry: `resolveEnvironment` (Task 2, unmodified) resolves
  the environment literal, then `threads.spawn(...)` then
  `threads.open({ threadId: child.id, split: entry.split, file: null })`.
  Per-entry try/catch collects spawned ids and failure messages
  independently so one bad entry doesn't sink the batch.
- Return shape: bounded text "Spawned N split(s): id1, id2" plus an
  optional "Failed K: msg1; msg2" line; `isError` true only when zero
  entries spawned.
- Tool params (zod): prompt (min 1), title?, provider?, model?, env
  (worktree|shared, default worktree), count (1-8, default 1), split
  (down|left|replace|right|top, default right).

Why: this is the core deliverable of the spawn-split plugin - the whole
point is a single tool call that fans work out into parallel split panes
without any frontend surface, matching the Task 1 headless pivot recorded
in decision_2026-09-05_spawn-split-plugin.md.

How: TDD per the task brief - wrote server.test.ts first (11 cases: 4 on
buildSpawnPlan, 4 on runSpawnSplit covering worktree/shared/partial-failure/
all-fail-no-caller-env), ran `npx vitest run server.test.ts` and confirmed
FAIL (`runSpawnSplit is not a function`, 8/8 red), then implemented
server.ts, reran and got 11/11 green (server.test.ts + env.test.ts
together). `bb plugin build` then emitted dist/server.js cleanly (headless
- no app.js, matching Task 1's pivot).

Cleanups folded in from the deferred Task 1 minors:
- Removed `skills/example-todos/` (and the now-empty `skills/` dir) -
  irrelevant scaffold example.
- `package.json` `bb.branding.icon` changed `ListTodo` -> `Columns2`.
- Checked package-lock.json for `better-sqlite3` residue: the 4 hits are
  all inside `@get-bb/plugin-sdk`'s own `peerDependenciesMeta` (all marked
  `optional: true`), never our own dependency - ran `npm install` to
  confirm resync, lockfile came back byte-identical (git diff empty), so no
  actual cleanup was needed there; the earlier concern was unfounded once
  inspected directly.

Files touched: bb-plugin-spawn-split/server.ts,
bb-plugin-spawn-split/server.test.ts (new),
bb-plugin-spawn-split/package.json, bb-plugin-spawn-split/skills/ (removed),
.superpowers/sdd/2026-09-05-spawn-split/task-3-report.md (task report,
written after this beat, documenting the same work in full detail).
