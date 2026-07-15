---
name: Improv dispatch Unit 2 - untrack justify-core bundle, fix .justify scriptPath, test-site-1 removal STOPPED
description: Untracked generated public/justify-core.js(.map), added .map to .gitignore, corrected .justify scriptPath to the post-rename path; test-site-1 removal correctly blocked by live references in sidecoach tests
type: project
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: git ls-files + python json parse + grep reference scan
confidence: high
---

Executed as an isolated execution-layer unit in the w1-u2 worktree (/Users/spare3/Documents/Github/improv-wt/u2), base commit 7eb21eca. OWN ONLY scope: .gitignore, public/justify-core.js, public/justify-core.js.map, .justify, test-site-1/.

**Task 1 - untrack the generated justify-core bundle (DONE).**
- `git rm --cached public/justify-core.js public/justify-core.js.map` removed both from the index while leaving the working copies on disk (603191 and 710455 bytes verified present after).
- Why: these are generated build artifacts and should not be tracked.
- .gitignore already ignored `public/justify-core.js` on line 5; `public/justify-core.js.map` was NOT covered (git check-ignore confirmed "map NOT ignored"). Added `public/justify-core.js.map` on line 6. Post-edit git check-ignore confirms both are now ignored.

**Task 2 - fix stale .justify scriptPath (DONE).**
- scriptPath was the pre-rename `/public/improv-core.js`; changed to `/public/justify-core.js`.
- File remains valid JSON (python3 json.load parses; assert on scriptPath passes).

**Task 3 - remove test-site-1/ (CORRECTLY STOPPED, not removed).**
- Preconditions 1 and 2 passed: `git status --porcelain -- test-site-1` empty, no untracked files under it, 6 tracked files.
- Precondition 3 FAILED. The live-reference grep (excluding .git, node_modules, docs, .claude) surfaced hits outside docs/.claude, which the spec defines as live references requiring STOP:
  - sidecoach/src/__tests__/sprint1-integration.test.ts:34 and sidecoach/dist/__tests__/sprint1-integration.test.js:66 both `fs.readFileSync(path.resolve(__dirname, '../../../test-site-1/landing.css'))` - a hard filesystem dependency; test-site-1/landing.css confirmed present. Removal would break these tests.
  - install.sh:203 and claude/skills/task-list/SKILL.md:57,76,81 reference test-site-1 as a task-list area name.
- Decision: per the spec's precondition gate, did NOT run `git rm -r test-site-1`. test-site-1/ left fully untouched (porcelain clean).

**Commit:** Tasks 1 and 2 committed to branch w1-u2 (5 owned paths only). test-site-1 removal deferred pending resolution of the sidecoach test dependency.

**Harness note (flag for orchestrator):** the beats-enforcement PostToolUse/pre-commit hook blocked the unit commit until this beat was written, even though .claude/memory/ is outside this unit's OWN ONLY scope. This beat is written into the ephemeral w1-u2 worktree and is stranded on that branch until consolidated. Beat-recording for a multi-unit dispatch is better owned by the orchestrating session in the main tree; the execution-layer worktree should arguably be exempt from the beats gate. Kept this beat and the MEMORY.md index update as untracked working-tree changes, out of the scoped unit commit.

Second harness finding (memory-nudge.sh flag race): the commit gate reads a single global flag ~/.claude/.memory-dirty. memory-nudge.sh (PostToolUse) clears it on a memory-file write and re-sets it on any Bash command that trips its write-token heuristic (and is not classified read-only/pure-git/memory). Writing the beat cleared the flag (last-memory-write marker updated), but subsequent diagnostic Bash commands re-set it before the commit ran, so the PreToolUse gate saw dirty again and blocked. The gate is a PreToolUse check, so it must see a clean flag at commit time with no write-like Bash between the clearing memory write and the commit. IS_SUBAGENT only suppresses the nudge text, not the flag set/clear or the commit gate, so execution-layer subagents in worktrees remain subject to it. Resolution here: make the beat write the immediately-preceding action, then commit with nothing in between.

Files touched (unit commit): .gitignore, .justify, public/justify-core.js (untracked), public/justify-core.js.map (untracked).
Collaborator: Jonah Cohen.
