---
name: spawn-split Task 3 fix wave 2 - live hostId bug
description: Fixed a live HTTP 400 (managed-worktree spawn rejected without hostId) by resolving hostId at runtime via caller env or primary connected host
type: project
relates_to: [session_2026-09-05_spawn-split-task3-fixwave.md, session_2026-09-05_spawn-split-task2-env-resolver.md]
author_human: Jonah Cohen
source: session
verified: tests
confidence: high
---

Coordinator-directed fix wave 2 on bb-plugin-spawn-split/ (branch
spawn-split-plugin), triggered by a LIVE runtime bug the type-check missed:
`bb.sdk.threads.spawn` was rejecting our `env=worktree` environment with
`HTTP 400: hostId is required unless workspace.type is personal`. The
`WORKTREE_ENV` shape omitted `hostId` on the assumption (recorded in
CONTRACTS.md, now corrected) that the server defaults to bb's default host
when it's absent - it does not, for a `managed-worktree` workspace.

- `env.ts`: `resolveEnvironment` gained a third positional param, `hostId:
  string | null`. For `env="worktree"` it now returns
  `{ type: "host", hostId, workspace: {...} }` and throws
  `"spawn_split: cannot resolve a host for env=worktree"` when `hostId` is
  null/empty. `SpawnEnvironment`'s host member now requires `hostId:
  string`. `env=shared` behavior is unchanged.
- `server.ts` `runSpawnSplit`: a single pre-loop resolution phase (wrapped
  in one try/catch that returns a bounded `isError` result on any
  exception, never throwing out of the function) now does: fetch the
  caller thread once for `callerEnvironmentId`; if `env=worktree`, look up
  the caller's own environment's `hostId` via `bb.sdk.environments.get`
  when it has one, else fall back to `bb.sdk.hosts.list()` and pick the
  first `status === "connected"` host (or `hosts[0]` if none report
  connected). `SpawnSplitBb`'s typed interface grew `sdk.environments.get`
  and `sdk.hosts.list` so mocks can inject them.
- **Field-name correction found while reading the SDK types**: `Host`
  (`hostSchema`, bb-plugin-sdk.d.ts line 320-340) has an `id` field, NOT
  `hostId` - only `Environment` (`environmentSchema`, line 280-309) has a
  field literally named `hostId` (line 285, confirmed `z.ZodString`,
  required). The coordinator's fix-wave spec assumed a host list entry
  might expose `hostId`; the real field is `id`. Reading `host.hostId`
  instead of `host.id` would have silently produced `undefined` for every
  fallback-path resolution, which is exactly the kind of bug this whole fix
  wave exists to catch (a type-check-invisible runtime failure). Also
  confirmed `Host.status: "connected" | "disconnected"` (not a boolean
  `connected` flag) - `hosts.find((h) => h.status === "connected")`.
- CONTRACTS.md section 1 rewritten: corrected the "omit to use bb's default
  host" claim (there is no such default for `managed-worktree`), documented
  the HTTP 400 the daemon actually returns, and recorded the resolution
  strategy plus both confirmed field names (`Environment.hostId`,
  `Host.id`/`Host.status`) with their line numbers.

Why: the original Task 2/3 work type-checked and unit-tested clean but
never exercised the live daemon's actual validation rule for
`managed-worktree` environments - a gap between "the zod schema marks
hostId optional" and "the server-side handler enforces it unless workspace
is personal." This is the canonical shape of a bug unit tests with mocked
SDK calls cannot catch on their own; it surfaced only when spawn_split
actually ran against a live bb daemon.

How: TDD - extended env.test.ts (worktree now requires a hostId arg, added
a throws-on-null-hostId case) and server.test.ts (7 runSpawnSplit tests,
up from 4: worktree via caller-env host, worktree via hosts.list fallback,
shared unchanged, partial failure, shared-no-caller-env failure, new
worktree-no-host-available failure, open-throws, abort, get-rejects -
17 total across both test files), ran `npx vitest run` (17/17 pass), then
`bb plugin build` (clean, no unused-import/type errors).

Files touched: bb-plugin-spawn-split/env.ts, bb-plugin-spawn-split/env.test.ts,
bb-plugin-spawn-split/server.ts, bb-plugin-spawn-split/server.test.ts,
bb-plugin-spawn-split/CONTRACTS.md,
.superpowers/sdd/2026-09-05-spawn-split/task-3-report.md (fix wave 2
section appended, commit hash 53a30f6a recorded).

Committed as 53a30f6a on branch spawn-split-plugin ("resolve worktree
hostId at runtime (fix HTTP 400 on managed-worktree spawn)").
