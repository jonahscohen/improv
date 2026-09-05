---
name: spawn-split Task 1 - scaffold plugin + pin SDK contracts
description: bb-plugin-spawn-split scaffolded and building; CONTRACTS.md records the real (not guessed) environment/pane/openFixedTab/ThreadChat contracts
type: project
relates_to: [session_2026-09-05_spawn-split-execution.md]
author_human: Jonah Cohen
author_model: claude-sonnet-5
source: session
verified: tests
confidence: high
---

Executed Task 1 of the spawn-split SDD plan on branch `spawn-split-plugin`, as an implementer subagent.

- Ran `bb plugin new spawn-split` -> scaffolded into `bb-plugin-spawn-split/` (confirmed the brief's path correction).
- `npm install --include=dev` failed native-building `better-sqlite3` (broken system python3.14 plistlib/pyexpat, unrelated to this repo); worked around with `npm install --include=dev --ignore-scripts` since better-sqlite3 is only used by the scaffold's example todo storage and isn't needed for `bb plugin build` to typecheck/bundle.
- `bb plugin build` succeeds clean (dist/server.js, dist/app.js, dist/app.css + meta/maps).
- Ran `bb plugin types`, read the synced `.d.ts` under `node_modules/@get-bb/plugin-sdk/bundled-types/` and wrote `bb-plugin-spawn-split/CONTRACTS.md` with the 4 pinned contracts.
- Key finding: two of the brief's candidate literals were wrong, not just unconfirmed. `environment` for `threads.spawn` is a 3-way discriminated union on `type`: `"reuse"` (`{type:"reuse", environmentId}` - not `{type:"environment", environmentId}` as guessed), `"host"` (fresh managed worktree = `{type:"host", workspace:{type:"managed-worktree", baseBranch:{kind:"default"}}}` - not `{type:"worktree"}`), and `"project-default"`.
- Second key finding: `bb.sdk.threads.paneAction` is backend-callable but does NOT open a new pane - its action enum is only pane-state ops on an already-open pane (`clear-spotlight|maximize|restore|spotlight|toggle`). The real backend primitive for "spawn a thread, open it as a split" is a different method on the same `ThreadsArea` interface: `threads.open({ threadId, split: "down"|"left"|"replace"|"right"|"top", file })`. Recorded `PANE_PRIMITIVE = "backend-open"`, not either of the brief's two options - flagged this clearly in CONTRACTS.md since it changes what Task 3 should call.
- `experimental_useAppPanel().openFixedTab({ surface, tab })` and `ThreadChat` props confirmed and recorded verbatim with file+line evidence, for the case a later task still wants an in-panel `ThreadChat` view alongside the split-pane open.
- Committed only `bb-plugin-spawn-split/` (scaffold + CONTRACTS.md); left the other untracked repo files (AGENTS.md, docs/superpowers/*, memory files) alone per task scope.

Self-analysis: the brief's PANE_PRIMITIVE question was framed as a binary (`backend-paneAction` vs `frontend-openFixedTab`) but the live SDK had a third, better answer (`threads.open` with `split`) that neither option named. Reading the actual method list on `ThreadsArea` instead of just the method the brief pointed at (`paneAction`) is what surfaced it - worth doing that scan-the-interface step on every future "confirm this SDK contract" task rather than trusting the brief's framing to be exhaustive.

Files touched:
- bb-plugin-spawn-split/ (new: package.json, server.ts, app.tsx, components/, hooks/, lib/, skills/, README.md, PLUGIN_OVERVIEW.md, components.json, tsconfig.json, package-lock.json, .gitignore, CONTRACTS.md)
