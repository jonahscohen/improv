---
name: Improv dispatch Unit 12 - sprint1-integration fixture repoint off test-site-1 (removal BLOCKED by out-of-scope refs)
description: Relocated landing.css off test-site-1 into sidecoach/fixtures/sprint1/, repointed src+dist sprint1-integration tests (green), cleared install.sh area-name mention; git rm -r test-site-1 STOPPED because the gate grep still hits two files outside U12 ownership
type: project
relates_to: [session_2026-07-14_parallel-dispatch-plan.md, session_2026-07-14_u2-untrack-justify-core.md, session_2026-07-15_plan-consistency-lint-hook.md]
author_human: Jonah Cohen
author_model: claude-opus-4-8
machine: Yes-JCohen
source: session
verified: tests
confidence: high
---

# Unit 12: test-site-1 fixture repoint + removal (Wave 2)

Executed as an isolated execution-layer unit in worktree `/Users/spare3/Documents/Github/improv-wt/u12`, branch `w2-u12`, base `a54cb63b` (the post-Wave-1 merge commit; the plan's original stamp `7eb21eca` had advanced, so line-number claims were re-verified live per team rule 10 - install.sh mention is now line 307, not the plan's ~203).

OWN scope: `sidecoach/src/__tests__/sprint1-integration.test.ts`, `sidecoach/dist/__tests__/sprint1-integration.test.js`, its `.js.map`, a new fixtures dir, `test-site-1/`, and the single `test-site-1` task-list mention in `install.sh`.

## What was done (in-scope, verified green)

- **Fixture relocated:** copied `test-site-1/landing.css` -> `sidecoach/fixtures/sprint1/landing.css`, byte-identical (both `shasum` = `3a0860840846e62f23dd12c3ec0472b5ab867852`, `cmp` exit 0). The CSS itself contains zero `test-site-1` strings, so it reintroduces no ref.
- **Both tests repointed:** `path.resolve(__dirname, '../../../test-site-1/landing.css')` -> `path.resolve(__dirname, '../../fixtures/sprint1/landing.css')` in BOTH the src `.ts` (line 34) and dist `.js` (line 66).
- **install.sh:307** area-name list `(sidecoach, justify, marketing-site, test-site-1, dotfiles)` -> `(sidecoach, justify, marketing-site, dotfiles)`. `bash -n install.sh` OK.
- **.js.map needed NO change:** the plan/Codex claim that `sprint1-integration.test.js.map` snags the removal gate is STALE at this commit. The map has no `sourcesContent` (only `sources: ['../../src/__tests__/sprint1-integration.test.ts']`), so it never contained `test-site-1` (`grep -c` = 0 before and after). The identical one-line string edit in both `.ts` and `.js` preserves the map's token structure, so the map stays valid.

## Fixture-placement decision (chose convention over the spec's literal example)

**Why:** the spec said "e.g. `sidecoach/src/__tests__/fixtures/`" but that breaks src/dist path symmetry. `test-site-1/` sat at repo root, so `../../../test-site-1/landing.css` resolved identically from `src/__tests__` and `dist/__tests__`. A fixture under `src/__tests__/fixtures/` forces the dist test to reach `../../src/__tests__/fixtures/` - a path `tsc` would NOT emit from the `.ts`, so the committed dist `.js` would diverge from a clean build and break on the next `tsc`.

**How:** followed the repo's existing fixture convention (`validator-fixtures-e2e.test`, both src+dist, uses `const SC = path.resolve(__dirname, '..', '..')` = sidecoach root). Placed the fixture at `sidecoach/fixtures/sprint1/landing.css` (new categorized subdir under the established committed `sidecoach/fixtures/` root) and referenced it via `path.resolve(__dirname, '../../fixtures/sprint1/landing.css')`, which resolves to the same absolute path from src and dist. Build-stable (`.ts` and `.js` share the identical expression), DRY (single fixture), convention-matched. "e.g." in the spec signaled the exact dir was illustrative, not load-bearing.

## Verification

Repo has NO vitest (the spec's suggested `npx vitest run` does not apply). `sprint1-integration.test.ts` is NOT in `scripts/run-tests.ts`'s explicit SUITES list either - it is a standalone IIFE test (`process.exit(1)` on failure, logs PASS). Ran it directly BOTH ways, baseline (pre-edit, reading test-site-1) and post-edit (reading the fixture) - identical output both times:
- `node dist/__tests__/sprint1-integration.test.js` -> "sprint1 orchestrator injection test PASS" + 8 drift tokens (4 color, 4 spacing) + "sprint1 e2e drift test PASS", exit 0.
- `npx ts-node --transpile-only src/__tests__/sprint1-integration.test.ts` -> same, exit 0.
The drift assertions (`--c-brand-red-hover`, `--s-10`) depend on exact CSS content, so identical output proves the byte-perfect relocation.

`--transpile-only` was required because the worktree's committed `node_modules` is a partial subset missing `@types/proper-lockfile` etc.; the type errors are pre-existing environment noise in unrelated files, not from this change. The dist-via-node run needs no type-check and is the authoritative runtime proof.

## node_modules is TRACKED in this repo (env gotcha for worktree units)

`sidecoach/node_modules` has **2473 files committed to git** despite `.gitignore:9` `node_modules/` (tracked files predate/override the ignore rule). Consequence: the spec's "symlink node_modules from main as U5 did" (which assumed it was gitignored) is a TRAP here - a wholesale symlink swap makes git report 2473 phantom DELETIONS. The committed subset is also incomplete (missing `playwright`, `playwright-core`, `graceful-fs`, `proper-lockfile`, `retry`, `signal-exit`). Safe fix used: symlinked ONLY those 6 missing packages (all untracked; a new path under `node_modules/` IS covered by the ignore rule, `git check-ignore` confirmed), so `git status` stayed clean (0 lines). Reverted the wholesale-swap experiment immediately.

## BLOCKER: removal STOPPED - gate grep hits 2 files outside U12 ownership

After clearing every owned ref, the spec's gate grep (`grep -rn "test-site-1" . --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=docs --exclude-dir=.claude`) STILL returns 8 hits, none in U12's ownership, none under the grep's excluded dirs (the exclude is `.claude`, NOT `claude`):

- `claude/hooks/test-plan-consistency-lint.sh` (5 hits: lines 92, 93, 95, 301, 303) - a plan-consistency lint hook CREATED 2026-07-15, AFTER the 2026-07-14 plan; it embeds the plan's Unit 12 text (with `test-site-1`) as lint fixtures. Editing it risks breaking the lint, which compares against the plan doc (docs/, still full of `test-site-1`).
- `claude/skills/task-list/SKILL.md` (3 hits: lines 57, 76, 81) - the task-list skill SOURCE, naming `test-site-1` as a task-list area (the same cosmetic area-name `install.sh:307` echoed).

Both are COSMETIC (no filesystem dependency on `test-site-1/`), matching the spec's own "task-list area names" cosmetic class - but they live OUTSIDE U12's granted ownership. U2's own beat already recorded `claude/skills/task-list/SKILL.md:57,76,81` as an area-name ref, yet U12's scope was written to only the install.sh mention; the lint hook is net-new since the plan. This is a plan-vs-reality drift, not a functional break.

Per the spec ("Only after grep returns NOTHING: git rm -r test-site-1" + "If any live ref cannot be cleared, STOP and report rather than force-removing"), the removal was STOPPED. `test-site-1/` left fully intact (porcelain clean). The functional dependency (the readFileSync the tests relied on) IS cleared, which is the hard part U2 could not do - so the removal is now a small follow-up once an owner with scope clears the two `claude/` cosmetic refs (or the orchestrator grants U12 that scope, or narrows the gate to also exclude `claude/`).

## Harness false-positives observed (the U3/U7b bugs, live again)

- `memory-nudge` fired "dirty state / write a beat" on pure read-only `grep`/`file` commands (the `install`-substring + grep misclassification U7b targets).
- `verify-before-done` fired "CODE FILE CHANGED, take a screenshot" on `.ts`/`.js`/`install.sh` edits in a worktree - a non-UI change with no screenshot surface; this is the worktree-path / repo-source exemption gap.

## Commit

Committed the repoint + install.sh (owned files only) to `w2-u12`. `test-site-1/` removal deferred - reported as blocked, NOT force-removed. This beat is stranded in the worktree for harvest at integration (no MEMORY.md edit here, to avoid an index collision).

## Files touched (owned)
- sidecoach/fixtures/sprint1/landing.css (new, byte-identical copy)
- sidecoach/src/__tests__/sprint1-integration.test.ts (readFileSync repoint)
- sidecoach/dist/__tests__/sprint1-integration.test.js (readFileSync repoint)
- install.sh (line 307 area-name mention)
- sidecoach/dist/__tests__/sprint1-integration.test.js.map (verified, no change needed)
