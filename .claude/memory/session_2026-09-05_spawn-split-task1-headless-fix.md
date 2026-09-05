---
name: spawn-split Task 1 fix round 1 - go headless
description: Removed the frontend from bb-plugin-spawn-split per coordinator direction; backend-only build confirmed; CONTRACTS.md PANE_PRIMITIVE expanded with the exact threads.open signature
type: project
relates_to: [session_2026-09-05_spawn-split-task1-scaffold.md]
author_human: Jonah Cohen
author_model: claude-sonnet-5
source: session
verified: tests
confidence: high
---

Coordinator adopted the Task 1 finding that `bb.sdk.threads.open({ threadId, split })` opens a pane from the backend, and directed making the plugin headless.

- Deleted `app.tsx`, `components/` (all shadcn-vendored ui files), `hooks/useBrowserDimmingModal.ts`, `lib/portal-scope.ts`, `lib/utils.ts`, `components.json`. Confirmed first (grep) that nothing outside those files imported any of them - all frontend-only.
- Removed `bb.app` from `package.json`; removed frontend-only deps (`@hugeicons/*`, all `@radix-ui/react-*`, `class-variance-authority`, `clsx`, `sonner`, `tailwind-merge`, `vaul`, `@pierre/diffs`, `@types/react`, `@types/react-dom`) and `better-sqlite3`/`@types/better-sqlite3` (unused - `server.ts` only ever used `bb.storage.kv`, never imported better-sqlite3 directly; it was an unused devDependency from the scaffold template that also happened to be the thing breaking `npm install` on this machine's broken python3.14/libexpat).
- Trimmed `tsconfig.json` (`jsx`/`DOM` lib, `@/*` path alias, and the app/components/hooks/lib includes all removed - `include` is now just `server.ts`).
- Updated stale doc references to the now-deleted UI page in `server.ts` comments, `README.md`, and `PLUGIN_OVERVIEW.md`.
- `rm -rf node_modules package-lock.json dist && npm install --include=dev` now succeeds with NO native build step (better-sqlite3 gone) - 8 packages instead of 163.
- `bb plugin build` now emits only `dist/server.js` + `.js.map` + `server.meta.json` - confirmed no `app.js`/`app.css`/`app.meta.json`, i.e. genuinely backend-only.
- Expanded CONTRACTS.md's PANE_PRIMITIVE section with the exact `threads.open(args: ThreadOpenArgs)` signature and the full `split` enum (`"down"|"left"|"replace"|"right"|"top"`) up front, and noted the headless decision inline.

Self-analysis: none needed for this round - straightforward mechanical removal following the coordinator's explicit, well-scoped instructions and the plugin-authoring skill's own documented headless recipe (which the README scaffold text already described almost verbatim).

Files touched: bb-plugin-spawn-split/{package.json,package-lock.json,tsconfig.json,server.ts,README.md,PLUGIN_OVERVIEW.md,CONTRACTS.md} modified; app.tsx, components.json, components/, hooks/, lib/ deleted.
