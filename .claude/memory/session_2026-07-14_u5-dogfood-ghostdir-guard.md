---
name: Unit 5 - fail-loud dogfood guards + reference port 4831 (marketing-site move fallout)
description: Removed the mkdirSync ghost-dir footgun in dogfood-teach-step1, added the same fail-loud guard to dogfood-craft-step2, annotated TASKS.md marketing-site area as moved, and changed reference/serve.py default port 4830 -> 4831. Executed in worktree improv-wt/u5 on branch w1-u5.
type: project
relates_to: [session_2026-07-13_marketing-site-move.md, reference_dev_servers_ports.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
machine: spare3
source: session
verified: tests (ts-node run of both dogfood scripts + curl on serve.py) + codex-review
confidence: high
---

Unit 5 of the 2026-07-14 parallel dispatch. Fixes the dead in-repo marketing-site
references that finding 11 of session_2026-07-13_marketing-site-move.md documented but
(deliberately) left unfixed. Marketing site now lives at ~/Documents/Github/improv-site.

## Changes (4 owned files only)

- `sidecoach/src/dogfood-teach-step1.ts`: removed `fs.mkdirSync(projectPath, {recursive:true})`
  which silently RECREATED an empty ghost `marketing-site/` inside improv whenever the path
  was missing. Replaced with a fail-loud `throw new Error(...)` naming ~/Documents/Github/improv-site.
  Kept the hard-coded projectPath (now guarded) - this is the "guard" branch of the spec's
  "repoint or guard" choice, and it keeps the runnable throw verification honest (the path is
  genuinely absent, so the throw fires when the script is run).
- `sidecoach/src/dogfood-craft-step2.ts`: added the identical guard at the TOP of run(), before
  the flow-history clear and before `new FlowExecutionEngine()`, so it throws before any side effect.
- `TASKS.md`: annotated the `## marketing-site` area with a MOVED note pointing at
  ~/Documents/Github/improv-site and tagged T-0038 "(in ~/Documents/Github/improv-site, not this repo)".
  The area no longer targets anything inside improv.
- `reference/serve.py`: default `PORT` 4830 -> 4831 so a no-arg run stops colliding with the
  marketing dev server (which holds 4830).

## Why (the sharp part)

A dead path that THROWS is fine; a dead path that mkdir's itself back into existence is worse than
the disease - it resurrects a ghost of the directory the 2026-07-13 move just removed. The fix is
fail-loud, not repoint, because the spec's verify clause ("running with the path absent THROWS")
and grep clause ("shows only guarded references to improv/marketing-site") both assume the path
string stays and is guarded.

## Verification (real, not asserted)

- Worktree's `sidecoach/node_modules` is a PARTIAL install (missing playwright, proper-lockfile, ...)
  so a plain ts-node run of the dogfood scripts failed at COMPILE time on unrelated missing deps,
  not on the guard. Per the spec's sanctioned path, symlinked the main repo's complete node_modules
  in reversibly (`mv node_modules node_modules.wt-orig; ln -s .../improv/sidecoach/node_modules node_modules`),
  ran, then restored the pristine worktree node_modules. node_modules is gitignored, so none of this
  is in the commit.
- With deps resolved, `ts-node src/dogfood-teach-step1.ts` threw MY error at dogfood-teach-step1.ts:20:11
  (stack-trace confirmed), exit 1, and NO marketing-site directory was created anywhere (worktree root,
  improv root, sidecoach/src all absent before AND after). This is the no-ghost-dir proof.
- `ts-node src/dogfood-craft-step2.ts` threw MY error at dogfood-craft-step2.ts:20:11, exit 1, and the
  guard short-circuited before writing /tmp/sidecoach-craft-output.md (absent after) - no side effects.
- `grep -rn "improv/marketing-site" sidecoach/src` returns exactly the two projectPath const lines,
  both now guarded.
- `python3 reference/serve.py` (no args) bound *:4831 (lsof) and returned HTTP 200 (curl); port 4830
  stayed owned by the pre-existing marketing server (pid 64394). Killed the test server after.

## Codex cross-model review (codex-review.py, exit 0, 91.8s) - 3 findings, all flagged not folded

- HIGH: the tracked COMPILED artifacts `sidecoach/dist/dogfood-teach-step1.js:46` (still calls
  fs.mkdirSync) and `sidecoach/dist/dogfood-craft-step2.js` (no guard) are STALE. Running the compiled
  JS directly still resurrects the ghost dir. NOT folded: dist/*.js are outside Unit 5's 4-file ownership,
  and the correct fix (npm run build / tsc) regenerates many dist files and would collide with the
  parallel dispatch. Orchestrator decision: assign a dist rebuild to a unit/wave, OR grant ownership of
  those two dist files for a surgical hand-patch.
- MEDIUM: guard only checks `!existsSync`, so a pre-existing ghost dir from a prior run would let the
  script proceed against the dead path. NOT folded: this is exactly the spec's contract, no ghost dir
  exists on this machine, and Codex's repoint/marker alternative conflicts with the spec's grep + throw
  verify clauses. Flagged as a spec-aligned residual.
- LOW: `docs/dependency-map/index.html:698,700` still describe the old 4830 default and the mkdirSync as
  current. NOT folded: outside ownership. Orchestrator/dep-map owner should refresh.

## Parallel-dispatch hygiene

- Committed ONLY the 4 owned files to w1-u5. Did NOT push.
- Did NOT update the shared MEMORY.md index from this worktree (it is the central file every unit +
  the orchestrator touches; editing it here guarantees a merge conflict). Orchestrator should add the
  index pointer to this beat when consolidating.

Collaborator: Jonah Cohen.

## Follow-up: compiled dist artifacts patched (orchestrator granted 2 more files)

After the HIGH Codex finding, the orchestrator granted ownership of the two tracked compiled
artifacts and asked for a hand-patch mirroring the source (explicitly NO tsc / npm build, which
would regenerate many dist files and collide with the parallel dispatch).

- `sidecoach/dist/dogfood-teach-step1.js`: removed `fs.mkdirSync(projectPath, {recursive:true})`
  (was ~line 46), replaced with the same fail-loud `throw` naming ~/Documents/Github/improv-site.
- `sidecoach/dist/dogfood-craft-step2.js`: added the identical guard at the top of run(), before
  the flow-history clear.

Verified by running the COMPILED artifacts directly with node (full node_modules symlinked from
main reversibly for the runtime require graph, then restored):
- `node dist/dogfood-teach-step1.js` -> exit 1, threw my error at dist/dogfood-teach-step1.js:51:15,
  no marketing-site dir created (worktree + improv root absent before and after).
- `node dist/dogfood-craft-step2.js` -> exit 1, threw at dist/dogfood-craft-step2.js:52:15, no dir,
  and short-circuited before writing /tmp/sidecoach-craft-output.md.
Committed as a follow-up on w1-u5, only the two dist files (plus this beat, mandated by the gate).
Sourcemaps (.js.map) were intentionally left untouched - not in the grant, and a hand-edit shifts
line numbers slightly; a future tsc rebuild will regenerate them in sync.

## Hook note (memory-dirty false-positive, recorded per Hook Error Response Protocol)

The `git commit` on w1-u5 was blocked by bash-guard's memory-before-commit gate even AFTER
this beat was written. Root cause (traced, not guessed): memory-nudge.sh cleared the
`~/.claude/.memory-dirty` flag when the beat was written (proven by the `.last-memory-write`
marker at 09:43:58 matching the beat mtime), but a later read-mostly diagnostic bash command
re-set the flag at 09:46:52 via memory-nudge.sh's Bash write-token heuristic (a command string
containing `> ` / `rm ` as ordinary text trips `is_write`). The flag was a false re-set: the
beat genuinely postdates all four project-file edits. Cleared legitimately by re-writing this
memory file (memory-nudge's is_memory branch removes the flag on a `.claude/memory/` write),
then committing immediately. Not a code bug in this unit; a known false-positive class the hook's
own comments describe. Durable hardening (exempting a Bash command whose only write token sits in
a quoted/heredoc span, or that is a pure diagnostic) belongs in claude/hooks/memory-nudge.sh,
which is outside Unit 5's ownership - flagged for the orchestrator.

## Files touched
- sidecoach/src/dogfood-teach-step1.ts
- sidecoach/src/dogfood-craft-step2.ts
- TASKS.md
- reference/serve.py
- .claude/memory/session_2026-07-14_u5-dogfood-ghostdir-guard.md (this beat)
