---
name: Agent isolation worktree did not isolate - verify or serialize shared-file work
description: The Agent tool's isolation=worktree param did not create separate worktrees; parallel teammates shared the main tree, risking clobbers on shared files
type: feedback
relates_to: [session_2026-05-28_task-queue-team-deploy.md]
---

Collaborator: Jonah. Logged 2026-05-28 during the task-queue-0528 team run.

## What happened
Spawned 4 background teammates with `isolation: "worktree"` on the Agent tool, expecting each to get its own git worktree so two of them (T-0025, T-0026) could edit the SAME sidecoach MCP files in parallel without clobbering. `git worktree list` showed ONLY the main tree - no isolated worktrees were created. All four agents reported working directly in `/Users/spare3/Documents/Github/claude-dotfiles`. T-0006 and T-0014 were disjoint so no harm, but T-0025 and T-0026 were concurrently editing the same files (src/lsp/ already existed when I checked) - a live clobber risk on schemas.ts, tools/index.ts, README.md, DESIGN-EXTENSION.md, SMOKE_TRANSCRIPT.txt.

## Why it went wrong (self-analysis)
I ASSUMED `isolation: worktree` would take effect and designed the whole parallelization around it (told agents to use `// T-NNNN` markers "so I can merge both worktrees"). I never verified the worktrees existed before letting the agents run. The signal I missed: the first two teammates (t0006, t0014) BOTH explicitly reported "no isolated worktree - worked directly in the repo" - that was the early warning that isolation was a no-op, and I should have checked `git worktree list` the moment the first one said it, not after the second. Caught it before corruption only because I paused to check when t0014 reported the same thing.

## How to apply next time
1. Do NOT trust `isolation: "worktree"` to actually isolate. Run `git worktree list` immediately after spawning to confirm separate trees exist BEFORE any agent does conflicting work.
2. If worktrees did not materialize and tasks touch overlapping files, SERIALIZE: designate a first writer, tell the others to build only their own NEW files + pure unit tests and HOLD on shared-file edits + test runs until the first writer finishes. (This is what salvaged the T-0025/T-0026 run.)
3. Disjoint-file tasks (different subsystems entirely) are safe to run concurrently in one shared tree - no isolation needed.
4. Alternative for genuinely-parallel shared-file work: have agents return additive SNIPPETS for the shared files and the lead applies all of them sequentially, rather than agents editing shared files at all.

## Separate minor bug observed
The `~/.claude/.memory-dirty` commit gate (bash-guard.sh) did not clear when I appended to MEMORY.md via Bash `cat >>` (vs the Edit/Write tool). The PostToolUse clear branch keys off Edit/Write tool calls to memory paths; a Bash redirect write does not reliably trigger it. Workaround: write/append memory via the Write or Edit tool, not Bash redirects, so the flag clears. Not filing as a task yet - low impact, easy to avoid.
