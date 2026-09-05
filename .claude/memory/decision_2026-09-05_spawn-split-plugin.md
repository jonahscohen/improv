---
name: spawn-split plugin design
description: bb plugin giving the agent a tool to spawn child threads into auto-opened true split panes
type: decision
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: none
confidence: high
---

Design locked (not yet built) for a bb plugin `spawn-split`: an agent-callable
tool (`spawn_split`) that spawns child threads parented to the caller and opens
each as a true split pane in getbb.app. Spec at
docs/superpowers/specs/2026-09-05-spawn-split-plugin-design.md (stamped cfa303d4).

**Three choices made with Jonah:**
- **UI surface:** true split pane via frontend `experimental_useAppPanel().openFixedTab`, NOT the thread right-panel (`openThreadPanel`) and NOT a CLI-only fan-out.
  - Alternatives rejected: right-panel (a side panel, not a real split); CLI/skill wrapper around `bb thread spawn` (no UI split); frontend-only human button (user asked for agent-driven).
- **Environment:** tool argument `env: "worktree" | "shared"`, default `worktree` (isolation for parallel agents). Rejected: always-shared (edit collisions) and always-worktree (no flexibility).
- **Open timing:** auto-open on spawn. Rejected: toast-plus-button (extra click).

**Mechanism:** backend `bb.agents.registerTool` execute calls `bb.sdk.threads.spawn({ parentThreadId: ctx.threadId, environment })` then `bb.realtime.publish("spawn-split", {threadId})`; frontend `useRealtime` handler calls `openFixedTab(ThreadChat[threadId])`. Child thread is authoritative; the pane is best-effort UI.

**Why:** spawn is server-side during a turn, pane-open is client-side, so a backend->frontend bridge is required; realtime publish + mounted useRealtime listener is the documented proven path.

**Revisit when:** verify at build time via `bb plugin types` whether `bb.sdk.threads.paneAction` (+ `PluginSidebarSplitPane`) can open a thread pane directly from the backend - if so, prefer it and the frontend half shrinks to a fallback. Also unknown: exact SDK worktree env discriminant and `ThreadChat` prop shape.

Plugin lives at repo top-level `spawn-split/` (matches justify/, lotus/, tilt-lab/). Spec approved by Jonah; implementation plan written at docs/superpowers/plans/2026-09-05-spawn-split.md (5 tasks: scaffold+pin-contracts, env resolver, spawn_split tool, frontend overlay opener, live verify). Not yet executed.
