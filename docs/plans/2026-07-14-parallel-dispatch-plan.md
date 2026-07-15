# Improv Debt Burndown - Parallel Dispatch Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development to implement each unit. Each unit below is self-contained and owns a disjoint set of files. Steps use checkbox (`- [ ]`) syntax.

**Stamped against:** `7eb21eca` (2026-07-14). Before executing, run `git rev-parse --short HEAD`; if it has moved, re-verify each unit's file:line claims (they were verified live at this commit).

**Goal:** Burn down the dispatched repo-local findings (9 of the 11 dependency-audit findings; finding 6 is deliberate and finding 7 lives in the separate improv-site repo) plus the harness/process debt, dispatched to parallel agents, without agents colliding on shared files.

**Architecture (the parallelization model):** Agents collide only where they share a file. This repo has exactly three shared chokepoints: `install.sh`, `claude/settings.json`, and `CLAUDE.md` + the beats index. Each gets a single owner in a separate wave. Everything in Wave 1 owns a disjoint file set and runs concurrently. Do NOT rely on the Agent-tool `isolation` param to make unsafe concurrency safe (it proved a no-op, 2026-05-28); rely on the disjoint file-ownership map plus real git worktrees (below).

**Review workflow (Jonah, 2026-07-14):**
1. Codex reviews THIS plan before any dispatch. Revise to Codex approval first. (Round 1 done; this is the revised plan.)
2. Run Wave 0 (unit 6) as a barrier at the stamped commit and record the baseline.
3. Then dispatch Wave 1 (units 1-5) in parallel. Codex reviews each unit's diff (`git diff <base> | ~/.claude/hooks/codex-review.py "<prompt>" -C <repo>`) before the unit is accepted and integrated.
4. After all of Wave 1 is accepted, run Wave 2 (unit 7).
5. Then Wave 3 in two sub-steps: **Wave 3a** dispatches U8/U9 research in parallel (each writes only its named beat, never `MEMORY.md`); the lead integrates those beats and recompiles the index serially; Jonah rules. **Wave 3b** then runs U10 (the cutover workstream) against the post-integration index.
6. The "Not dispatched" items are discussed after Wave 2.

---

## Dispatch discipline (how agents avoid shared-state races)

- **Real git worktrees, one per unit.** Each Wave-1 unit runs in its own `git worktree add` worktree, not the Agent-tool `isolation` param (a no-op here since 2026-05-28). A private worktree gives each agent a private git index, so `git add`/`git rm` never races another agent's staging. Disjoint file ownership means integration back to `main` is conflict-free.
- **Agents do not commit or push.** Each agent modifies only its owned files, runs its own tests, and reports its working-tree diff. Codex reviews the diff; the lead integrates accepted units serially and commits. This keeps the shared `.git/index` and any git-staging (`git rm --cached`, `git rm -r`) off the concurrent path.
- **Beat writes are serialized at integration.** Units that write a beat (U8, U9) use a named unique path and run in their own worktree; the lead integrates their beats and recompiles the index once, serially, so the index chokepoint is never written concurrently.

## File-ownership map (the collision guard)

| Unit | Wave | Owns (no other concurrent unit touches these) |
|---|---|---|
| 6 test-suite baseline | 0 | nothing (runs tests read-only, at the stamped commit, before any edits) |
| 1 install.sh hygiene | 1 | `install.sh` |
| 2 repo/git hygiene | 1 | `.gitignore`, `public/justify-core.js(.map)`, `.justify`, `test-site-1/` |
| 3 hook-logic fixes | 1 | `claude/hooks/verify-before-done.sh`, `memory-nudge.sh`, `beats-staleness-guard.sh` + their tests |
| 4 sidecoach portability | 1 | `claude/hooks/sidecoach-sessionstart.sh` |
| 5 dogfood + reference | 1 | `sidecoach/src/dogfood-*.ts`, `TASKS.md`, `reference/serve.py` |
| 7 harness guardrails | 2 | `claude/settings.json`, `fable-orchestrator-guard.sh`, `team-reaper.sh` + new hooks (relay-stop, push-ahead) |
| 7b harness false-positives | 2 | `claude/hooks/memory-nudge.sh`, `verify-before-done.sh`, `bash-guard.sh` + tests |
| 12 test-site-1 repoint | 2 | sprint1-integration tests (src+dist) + `.js.map`, new fixtures dir, `test-site-1/`, the install.sh:203 mention |
| 11 dependency-map correction | 2 (LAST, after U12) | `docs/dependency-map/index.html`, `docs/dependency-map/serve.py` |
| 8 cmux research | 3 | `.claude/memory/decision_cmux_hardening_proposal.md` only |
| 9 sidecoach-mcp research | 3 | `.claude/memory/decision_sidecoach_mcpserver_fate.md` only |
| 10 beats cutover B | 3 | `CLAUDE.md`, `MEMORY.md`/index, beats hooks |

The only files touched by more than one unit are the three chokepoints, and their owners live in different waves, so no two concurrent agents ever share a file. U8/U9 write only their one named beat each; the lead integrates those before U10 touches the index.

---

# WAVE 0 - barrier, runs before any edits

## Unit 6: test-suite baseline

**Owns:** nothing - runs existing suites read-only, at commit `7eb21eca`, before any Wave-1 worktree is created (so the baseline is uncontaminated by concurrent edits). This is the reason U6 is a barrier and not a parallel unit.

**Problem:** the justify vitest suite and several hook suites shipped in `cca3aba3` were committed but never executed as a gate. Establishing that they pass IS the verification baseline (team rule 9) the rest of the work stands on.

**Steps:**
- [ ] Confirm `git rev-parse --short HEAD` is `7eb21eca` (or record the actual base).
- [ ] Run the justify vitest suite: `cd justify && npx vitest run` (freeze-animations, claudebar-state-preservation, claudebar-queued-state, dispatch-mode-reachable).
- [ ] Run each hook suite: `bash claude/hooks/test-bash-guard-commit.sh`, `test-chrome-tabgroup.sh`, `test-cmux-close-guard.sh`, `test-install-hook-deploy.sh`, `test-justify-watch-standing-by.sh`, `test-multiple-choice-enforce.sh`, and `bash claude/cmux/test-node-shim.sh`.
- [ ] Report a pass/fail line per suite. Any red result is triaged BEFORE Wave 1 dispatches - a broken baseline is finding #1.

**Verify:** every suite exits 0, or failures are reported with output.

**Done:** a green/red baseline report exists at the stamped commit; reds are triaged, not swallowed; only then does Wave 1 dispatch.

**Dispatch prompt:** "In /Users/spare3/Documents/Github/improv at commit 7eb21eca, run (do not edit) the suites shipped in cca3aba3: `cd justify && npx vitest run`, plus hook suites `test-bash-guard-commit.sh`, `test-chrome-tabgroup.sh`, `test-cmux-close-guard.sh`, `test-install-hook-deploy.sh`, `test-justify-watch-standing-by.sh`, `test-multiple-choice-enforce.sh`, and `claude/cmux/test-node-shim.sh`. Report one pass/fail line per suite with output for any failure. Do not fix anything; establish and report the baseline only."

---

# WAVE 1 - parallel, dispatch together after Wave 0 is green (each in its own worktree)

## Unit 1: install.sh hygiene

**Owns:** `install.sh`

**Problems (verified at `7eb21eca`):**
- Finding 1: `install.sh:364` sets a persistent-sync target `"$REPO_DIR/ghostty/shaders"`, but the real shaders live at top-level `shaders/` (confirmed to exist). The TUI "open shaders directory" action silently fails.
- Finding 4: install only ever adds symlinks and never prunes, so rename orphans (e.g. `~/.claude/skills/improv/SKILL.md`) linger forever.
- Island: the `cmux/settings.json` legacy symlink (100% commented-out since 2026-04-11) is still symlinked by install.

**Steps:**
- [ ] Fix `install.sh:364` to point at `$REPO_DIR/shaders`. Grep the file for any other `ghostty/shaders` references and correct them consistently.
- [ ] Add a prune function that removes ONLY broken symlinks under `~/.claude/skills/` whose resolved target is inside this repo and now missing (never touch a link whose target still exists, and never touch anything outside this repo's own deploy footprint). It defaults to a dry-run that prints what it would remove.
- [ ] Gate the real (non-dry-run) prune of the user's home directory behind explicit human approval (the existing TUI confirm or an explicit flag). An unattended agent run must NOT mutate `~/.claude`; it exercises the prune only against a temp `$HOME` fixture.
- [ ] Remove the `cmux/settings.json` symlink creation from install (verify it is the legacy commented-out one first).

**Verify:** `bash claude/hooks/test-install-hook-deploy.sh` passes; a new test drives the prune against a temp `$HOME` fixture and asserts it removes a repo-sourced broken link (including a planted `skills/improv` orphan) and leaves live links and non-repo links untouched; a dry-run install prints the shaders path resolving to `shaders/`.

**Done:** install.sh references only real paths; a tested, fixture-verified, dry-run-default prune exists and only ever removes repo-sourced missing-target symlinks; the real home prune requires human approval; the legacy cmux/settings.json link is gone.

**Dispatch prompt:** "In your worktree of /Users/spare3/Documents/Github/improv, own `install.sh` only. (1) Fix line 364 `$REPO_DIR/ghostty/shaders` to `$REPO_DIR/shaders`. (2) Add a dry-run-default prune that removes ONLY broken symlinks under `~/.claude/skills/` whose resolved target is inside this repo and missing; never touch live or non-repo links; test it against a TEMP `$HOME` fixture, not the real home. (3) Real home-dir prune is gated behind explicit human approval - an unattended run must not mutate `~/.claude`. (4) Remove the legacy commented-out `cmux/settings.json` symlink creation. TDD against `test-install-hook-deploy.sh`. Do not commit; report your diff."

## Unit 2: repo and git hygiene

**Owns:** `.gitignore`, `public/justify-core.js`, `public/justify-core.js.map`, `.justify`, `test-site-1/`

**Problems (verified):**
- Finding 3: `public/justify-core.js` and `.map` are tracked despite `.gitignore:5` (committed before the rule).
- Finding 2: `.justify` holds `"scriptPath":"/public/improv-core.js"` - the pre-rename path. Should be `/public/justify-core.js`.
- Island: `test-site-1/` is dead since 2026-05-25.

**Steps:**
- [ ] `git rm --cached public/justify-core.js public/justify-core.js.map`. Ensure both are ignored.
- [ ] Edit `.justify` so `scriptPath` reads `/public/justify-core.js`. Keep valid JSON.
- [ ] Safe removal of `test-site-1/`, with preconditions ALL required before removing:
  - `git status --porcelain -- test-site-1` is empty (no modified/staged changes).
  - No untracked files under `test-site-1/` (`git status --porcelain --ignored -- test-site-1` inspected).
  - Live-reference check excluding docs and beats: `grep -rn "test-site-1" . --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=docs --exclude-dir=.claude`. Hits inside `docs/` or `.claude/memory/` are documentation, not live refs; any hit OUTSIDE those is a live ref and STOPS the removal.
  - Only if all clean: `git rm -r test-site-1`.

**Verify:** `git ls-files public/justify-core.js public/justify-core.js.map` returns nothing; `.justify` parses as JSON with the justify path; the precondition checks pass and `test-site-1/` is gone, or the removal was correctly stopped with the offending live ref reported.

**Done:** the two artifacts untracked, the marker names the current path, test-site-1 removed only under clean-state + no-live-ref preconditions.

**Dispatch prompt:** "In your worktree of /Users/spare3/Documents/Github/improv, own only `.gitignore`, `public/justify-core.js(.map)`, `.justify`, `test-site-1/`. (1) `git rm --cached` the two `public/justify-core.js*` files; ensure ignored. (2) Fix `.justify` scriptPath `/public/improv-core.js` -> `/public/justify-core.js`, valid JSON. (3) Before removing `test-site-1/`: require `git status --porcelain -- test-site-1` empty, no untracked files under it, and a live-ref grep that EXCLUDES `docs/` and `.claude/` (those are documentation). Any live ref outside docs/beats STOPS removal. Only if clean, `git rm -r test-site-1`. Do not commit; report your diff."

## Unit 3: hook-logic fixes

**Owns:** `claude/hooks/verify-before-done.sh`, `claude/hooks/memory-nudge.sh`, `claude/hooks/beats-staleness-guard.sh` and their test suites.

**Problems (from the 2026-07-13 state-of-the-union + confirmed live this session):**
- `verify-before-done.sh` re-arm bug: the flag-SET (arm) side lacks the file-type filter the commit-gate side has, so a `.md` beat write re-arms `.needs-verification` AFTER a browser verification cleared it. Apply the same file-type filter to the arm side.
- `memory-nudge.sh` redirect misclassification: a read-only command with a redirect (`... > /dev/null`) or a bare `grep` is classified as a project-file write, falsely setting `.memory-dirty`. Fix the classifier to exclude read-only commands and redirects-to-devnull. (Fired again live this session on a pure grep.)
- `beats-staleness-guard.sh` stale-on-pull: it detects a stale index at SessionStart but only warns. Make it fail-CLOSED by compiling on drift, so a machine that pulled a beat self-heals before any session trusts the index. (Codex's hard precondition; unit 10 is blocked on it.)

**Compile-on-drift safety rules (required, per Codex round 1):**
- Guard the compile with a lock so two concurrent session starts cannot compile at once.
- Compile to a temp output then atomically move into place; never leave a half-written index.
- If compile FAILS, do NOT trust the stale index: exit in a state that blocks/​warns loudly rather than silently serving stale results.
- Detect a dirty worktree and refuse to auto-mutate tracked index files in that state (warn instead).

**Steps (TDD each, in its own test-*.sh):**
- [ ] Failing test: a `.md` write does NOT re-arm the verify flag after a clear. Fix the arm side to reuse the commit side's file-type filter. Pass.
- [ ] Failing test in `test-memory-nudge.sh`: a `> /dev/null` command and a bare `grep` do NOT set `.memory-dirty`. Fix the classifier. Pass.
- [ ] Failing tests in `test-beats-hooks.sh`: (a) on a stale index the guard compiles (fail-closed); (b) a simulated compile FAILURE leaves the guard blocking/warning, not trusting stale; (c) a dirty worktree is refused with a warning. Implement compile-on-drift with the lock + atomic-move + fail-closed rules. Pass.

**Verify:** `bash claude/hooks/test-memory-nudge.sh`, the verify-before-done suite, and `bash beats/_tests/test-beats-hooks.sh` all exit 0; manual repro of each false-fire cleared; a forced compile-failure does not yield a trusted stale index.

**Done:** beat `.md` writes no longer re-arm verify; read-only/redirect commands no longer set memory-dirty; a stale index self-heals safely at session start, and a failed compile fails closed.

**Dispatch prompt:** "In your worktree of /Users/spare3/Documents/Github/improv, own only `claude/hooks/verify-before-done.sh`, `memory-nudge.sh`, `beats-staleness-guard.sh` + their test suites. Fix three false-fire/warn-only bugs (docs/plans/2026-07-14-parallel-dispatch-plan.md Unit 3), TDD each. The staleness-guard compile-on-drift MUST be safe: lock, temp-then-atomic-move, fail-CLOSED on compile error (never trust a stale index), and refuse in a dirty worktree. This unblocks the cutover (U10). Do not commit; report your diff."

## Unit 4: sidecoach portability (highest-ROI quick win)

**Owns:** `claude/hooks/sidecoach-sessionstart.sh`

**Problem (verified):** line 4 is `SIDECOACH_ROOT="/Users/spare3/Documents/Github/improv/sidecoach"`. It is the one hook that breaks on any other machine. The beats hooks already derive their root from the script location.

**Steps:**
- [ ] Copy a beats hook's root-derivation pattern (e.g. `claude/hooks/beats-staleness-guard.sh`): resolve the script's real path through the deploy symlink, walk to repo root, set `SIDECOACH_ROOT="$REPO_ROOT/sidecoach"`.
- [ ] Remove the absolute `/Users/spare3` literal entirely.

**Verify:** `grep -n "/Users/spare3" claude/hooks/sidecoach-sessionstart.sh` returns nothing; running the hook under a different `$HOME` resolves `SIDECOACH_ROOT` correctly and finds `dist/sidecoach-orchestrator.js`.

**Done:** no absolute machine path; resolves on any clone.

**Dispatch prompt:** "In your worktree of /Users/spare3/Documents/Github/improv, own only `claude/hooks/sidecoach-sessionstart.sh`. Replace the hard-coded `SIDECOACH_ROOT` (line 4) with root derivation copied from the beats hooks' pattern (resolve script real path through the deploy symlink, walk to repo root, append `/sidecoach`). No `/Users/spare3` literal may remain; verify it resolves under a different `$HOME`. Do not commit; report your diff."

## Unit 5: dogfood scripts and reference server

**Owns:** `sidecoach/src/dogfood-teach-step1.ts`, `sidecoach/src/dogfood-craft-step2.ts`, `TASKS.md`, `reference/serve.py`

**Problems (verified):**
- Finding 11: `dogfood-teach-step1.ts:15` calls `fs.mkdirSync(projectPath, {recursive:true})` where `projectPath` (line 8) is the departed `/Users/spare3/Documents/Github/improv/marketing-site`; running it silently recreates an empty `marketing-site/` inside improv. `dogfood-craft-step2.ts:10` hard-codes the same path. `TASKS.md` still heads a marketing-site area.
- Finding 9: `reference/serve.py:12` defaults `PORT` to 4830, same as the marketing server; reference should be 4831.

**Steps:**
- [ ] `dogfood-teach-step1.ts`: remove the `mkdirSync`; throw a clear error if the path is missing, naming `~/Documents/Github/improv-site`. Repoint or guard the line-8 path.
- [ ] `dogfood-craft-step2.ts`: same fail-loud guard on the line-10 path.
- [ ] `TASKS.md`: update the marketing-site area to note the move to `~/Documents/Github/improv-site` (or remove it) so it no longer points into this repo.
- [ ] `reference/serve.py:12`: change default `PORT` from 4830 to 4831.

**Verify:** running `dogfood-teach-step1` with the path absent throws and creates no directory (`ls marketing-site` still absent); `grep -rn "improv/marketing-site" sidecoach/src` shows only guarded refs; `reference/serve.py` with no args binds 4831.

**Done:** no silent `mkdirSync`; no ghost directory; reference defaults to 4831.

**Dispatch prompt:** "In your worktree of /Users/spare3/Documents/Github/improv, own only `sidecoach/src/dogfood-teach-step1.ts`, `dogfood-craft-step2.ts`, `TASKS.md`, `reference/serve.py`. (1) Replace the `mkdirSync` (dogfood-teach-step1.ts:15) with a fail-loud missing-path error naming `~/Documents/Github/improv-site`; guard the hard-coded paths (teach:8, craft:10). (2) Update the TASKS.md marketing-site area to reflect the move out. (3) reference/serve.py default PORT (line 12) 4830 -> 4831. Verify no ghost dir is created. Do not commit; report your diff."

---

# WAVE 2 - after Wave 1 is MERGED (base worktrees from the merge commit, NOT 7eb21eca)

U7 (guardrails), U7b (harness false-positives), and U12 (test-site-1 repoint) own disjoint files and run in parallel, each in its own worktree created from the post-Wave-1 merge commit (Wave 2 builds on Wave 1's merged state, so dispatching from the original stamped commit is a hazard). **U11 (dependency-map correction) runs LAST, after U12 is integrated** - U11 and U12 are file-disjoint but STATE-COUPLED (U11 must document the final post-Wave-2 reality: test-site-1 retired and its fixture relocated by U12, cmux/settings.json live with disposition pending U8), so they cannot run concurrently. Only U7 touches `settings.json`; its hook-registration changes need a session restart to take effect.

## Unit 7: harness guardrails

**Owns (explicit - no loose "any hook"):** `claude/settings.json`, `claude/hooks/fable-orchestrator-guard.sh`, `claude/hooks/team-reaper.sh` (the team-dir orphan fix is confined here, not to resume-guard.sh / agent-teams-guard.sh), plus NEW hook files it creates (the teammate-relay Stop hook and the push-ahead drift check) and their tests. It edits no other existing hook. One unit because every item registers in or edits `settings.json`.

**Problems (from the state-of-the-union):**
- Orchestrator-mode has no beat-write path: `fable-orchestrator-guard.sh` blocks all Write/Edit on Fable, including MANDATED `.claude/memory` beat writes, and in-process delegated scribes inherit the block (proven this session). Add a carve-out.
- Teammate relay failures recur: teammates print reports to the terminal instead of `SendMessage`. Add a Stop-time hook that blocks a teammate going idle with an unsent report when the dispatch demanded SendMessage.
- Silent commit drift: committed-but-unpushed work is invisible. Surface a push-ahead count at session start or pre-stop.
- Team-dir orphan: resumed sessions get an uninitialized `teamId`; add lazy-init or a reaper.

**Steps (TDD each; keep settings.json valid JSON throughout):**
- [ ] Carve-out in `fable-orchestrator-guard.sh`: allow Write/Edit whose target is under `.claude/memory/` or `~/.claude/projects/*/memory/` even on Fable, while still blocking other writes. Test: a memory-path write is allowed and a src-path write is still blocked on Fable.
- [ ] Relay Stop hook: new hook + Stop registration that blocks idle-with-unsent-report when the dispatch demanded SendMessage. Test.
- [ ] Push-ahead check: surface an ahead-count in a SessionStart (or pre-stop) hook. Test.
- [ ] Team-dir orphan: lazy-init or reaper for an uninitialized `teamId` on resume. Test.

**Verify:** all new/updated hook tests exit 0; `python3 -c "import json;json.load(open('claude/settings.json'))"` succeeds; on Fable, a `.claude/memory` write is allowed while a `src/` write is still blocked.

**Done:** beat writes work on Fable; relay hook fires on an unsent report; push-ahead surfaced; team-dir orphan handled.

**Dispatch prompt:** "In your worktree of /Users/spare3/Documents/Github/improv (based on the post-Wave-1 merge commit), own EXACTLY these and no other existing hook: `claude/settings.json`, `claude/hooks/fable-orchestrator-guard.sh`, `claude/hooks/team-reaper.sh` (the team-dir orphan fix is confined here), plus the NEW hook files you create for the teammate-relay Stop hook and the push-ahead drift check, and their tests. Implement four guardrails (docs/plans/2026-07-14-parallel-dispatch-plan.md Unit 7): Fable carve-out for `.claude/memory` writes, teammate-relay Stop hook, push-ahead drift check, team-dir orphan lazy-init in team-reaper.sh. Do NOT edit resume-guard.sh, agent-teams-guard.sh, or any other existing hook. TDD each; keep settings.json valid JSON. Flag that a session restart is required for hook-registration changes. Do not commit; report your diff."

## Unit 7b: harness false-positives (surfaced by Wave 1)

**Owns:** `claude/hooks/memory-nudge.sh`, `claude/hooks/verify-before-done.sh`, `claude/hooks/bash-guard.sh` and their test suites. Disjoint from U7 (which owns settings.json + fable-orchestrator-guard.sh + new hooks). Note: Wave 1's U3 already landed the `/dev/null` and re-arm fixes in memory-nudge.sh / verify-before-done.sh; this unit builds on that merged state.

**Problems (each observed live during Wave 1 execution):**
- memory-nudge `install`-substring: the write-token list contains the literal `install`, so every Bash command that merely names `install.sh` is misclassified as a project-file write and sets `.memory-dirty` (blocked U1's commit three times). Match actual file-writing verbs, not the substring `install`.
- memory commit-gate false-blocks worktree executors + re-dirty race: the `bash-guard` memory-dirty commit gate forced a beat write on U2/U4/U5 (and the lead at integration) even when the unit's owned files were outside `.claude/memory`, and a later read-only/diagnostic Bash command re-set `.memory-dirty` AFTER a beat was already written. A Bash write of a beat (e.g. `cp` into `.claude/memory/`) is not recognized as a beat-write that clears the flag, only a Write/Edit-tool write is.
- verify-before-done repo-source exemption: the hook fires "CODE FILE CHANGED" on edits to a worktree's `claude/hooks/*.sh` because `EXEMPT_PATHS` only lists `.claude/hooks/` (the dotfiles install dir), not `claude/hooks/` (the repo source dir) or worktree variants. Editing hook SOURCE should not demand browser verification.

**Steps (TDD each):**
- [ ] memory-nudge: remove/scope the `install` write-token so a read-only command naming `install.sh` does not set `.memory-dirty`; a real file write still does. Test both.
- [ ] memory-dirty clear-on-beat-write: make a Bash write into `.claude/memory/` (matched by path) clear/not-set `.memory-dirty`, so committing harvested beats is not falsely blocked; and stop a read-only/diagnostic command from re-dirtying after a beat write. Test the cp-a-beat-then-commit path.
- [ ] verify-before-done: extend the exemption to cover the repo-source hook dir `claude/hooks/` (and worktree paths ending in `claude/hooks/`), so a hook-source edit does not arm. Test.

**Invariant (do NOT weaken the gate - the fix is narrow, per Codex's Wave-2 review):** a REAL project write still dirties memory; a recognized Bash write INTO `.claude/memory/` (matched by path) clears the flag; a read-only / diagnostic command NEVER re-dirties after a beat write; a real `git commit` while genuinely dirty STILL blocks. The fix removes false positives only - it must not make it possible to commit real project changes without a beat. Add an explicit test asserting all four behaviors.

**Verify:** `bash claude/hooks/test-memory-nudge.sh` and the verify-before-done suite exit 0 with the new cases; the four-part invariant test passes; manually, a `cp` of a beat followed by a commit is not blocked, an `install.sh`-naming read-only command leaves `.memory-dirty` unset, and a real source-file edit still requires a beat before commit.

**Done:** the three Wave-1 harness false-positives are closed with the gate's real purpose intact.

**Dispatch prompt:** "In your worktree of /Users/spare3/Documents/Github/improv, own only `claude/hooks/memory-nudge.sh`, `verify-before-done.sh`, `bash-guard.sh` and their tests. Close three harness false-positives observed during Wave 1 (details in docs/plans/2026-07-14-parallel-dispatch-plan.md Unit 7b): the memory-nudge `install`-substring write-token, the memory-dirty commit-gate not recognizing a Bash beat-write (cp into .claude/memory) plus the re-dirty race, and the verify-before-done exemption missing the repo-source `claude/hooks/` dir. TDD each. Do not commit; report your diff."

## Unit 11: dependency-map correction (surfaced by Wave 1)

**Owns:** `docs/dependency-map/index.html`, `docs/dependency-map/serve.py`. Runs LAST in Wave 2, AFTER U12 is integrated, so the page reflects the FINAL post-Wave-2 state (test-site-1 already retired by U12).

**Problem:** Codex flagged the `:4832` dependency-map page as stale three times during Wave 1. It still states, falsely: `.justify` references `/public/improv-core.js` (now `/public/justify-core.js`), `public/justify-core.js` is tracked (now untracked), `reference/serve.py` defaults to 4830 (now 4831), and `dogfood-teach-step1.ts` silently `mkdirSync`s (now fail-loud). It also classifies `test-site-1` and `cmux/settings.json` as dead islands, which was WRONG - both had live edges. By the time U11 runs, U12 has RETIRED test-site-1 (relocated its fixture, removed the dir), so the map must DROP test-site-1 as a node (not reclassify it live). `cmux/settings.json` is LIVE (install.sh:2181 symlink + cmux active-detection) with disposition pending U8's research, so the map must reclassify it from dead island to a live node marked disposition-pending-U8.

**Steps:**
- [ ] Update the findings and node states to the final post-Wave-2 reality (`.justify` path, justify-core untracked, reference port 4831, mkdirSync guarded).
- [ ] REMOVE `test-site-1` from the map entirely (retired by U12); if the map tracked its edge, show the relocated test fixture instead.
- [ ] Reclassify `cmux/settings.json` from dead island to a LIVE node with its real edges (install symlink + cmux detection), marked "disposition pending U8".
- [ ] Fix the `docs/dependency-map/serve.py` stale 4830 note if present.

**Verify:** the page asserts no now-false finding; `test-site-1` is gone from the map; `cmux/settings.json` shows as live/disposition-pending-U8; render the page and confirm.

**Done:** the dependency map reflects the final post-Wave-2 reality.

**Dispatch prompt:** "In your worktree of /Users/spare3/Documents/Github/improv, based on the branch AFTER U12 is integrated (final post-Wave-2 state), own only `docs/dependency-map/index.html` and `docs/dependency-map/serve.py`. Correct the now-false findings (details in docs/plans/2026-07-14-parallel-dispatch-plan.md Unit 11): .justify path, justify-core untracked, reference port 4831, mkdirSync guarded. REMOVE test-site-1 from the map (U12 retired it). Reclassify cmux/settings.json from dead island to a LIVE node marked disposition-pending-U8. Render to verify test-site-1 is gone and cmux/settings.json is live. Do not commit; report your diff."

## Unit 12: test-site-1 fixture repoint + removal (surfaced by Wave 1)

**Owns:** `sidecoach/src/__tests__/sprint1-integration.test.ts`, `sidecoach/dist/__tests__/sprint1-integration.test.js`, `sidecoach/dist/__tests__/sprint1-integration.test.js.map`, a new fixtures dir under the tests (e.g. `sidecoach/src/__tests__/fixtures/`), `test-site-1/`, and `install.sh` (ONLY the single `test-site-1` task-list mention at ~line 203 - no other Wave-2 unit touches install.sh). Depends on Wave 1 merged (test-site-1 still present; U2 correctly did not remove it).

**Problem:** U2 could not retire `test-site-1/` because the sprint1-integration tests read `test-site-1/landing.css` via `fs.readFileSync`. Codex's Wave-2 review confirmed the removal gate ALSO snags on two more `test-site-1` references: the compiled test's source map (`sprint1-integration.test.js.map`) and a `test-site-1` task-list area name in `install.sh:203`. Distinguish FUNCTIONAL refs (a `readFileSync` that breaks if the dir is gone) from COSMETIC refs (source maps, task-list area names) and clear both classes before removal.

**Steps:**
- [ ] Copy the `landing.css` the tests need into a fixtures dir the tests own (e.g. `sidecoach/src/__tests__/fixtures/landing.css`).
- [ ] Repoint the FUNCTIONAL `fs.readFileSync(... test-site-1/landing.css ...)` paths in both the src and dist test files to the new fixture. Regenerate or hand-update the dist source map so it no longer references `test-site-1`.
- [ ] Handle the COSMETIC `install.sh:203` mention: it is a task-list area NAME, not a filesystem dependency - update it so it no longer names `test-site-1` (or, if it must stay, state explicitly that it does not block removal since it is not a functional ref).
- [ ] Run the sprint1-integration tests; confirm green against the relocated fixture.
- [ ] Re-run U2's precondition (clean state + no live refs outside docs/.claude), then `git rm -r test-site-1`.

**Verify:** the sprint1-integration tests pass against the new fixture; `grep -rn "test-site-1" . --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=docs --exclude-dir=.claude` returns NOTHING (functional and cosmetic refs both cleared, including the `.js.map` and `install.sh:203`); `test-site-1/` removed.

**Done:** test-site-1 retired without breaking any test.

**Dispatch prompt:** "In your worktree of /Users/spare3/Documents/Github/improv (based on the post-Wave-1 merge commit), own: the sprint1-integration test files `sidecoach/src/__tests__/sprint1-integration.test.ts` and `sidecoach/dist/__tests__/sprint1-integration.test.js`, its source map `sidecoach/dist/__tests__/sprint1-integration.test.js.map`, a new fixtures dir (e.g. `sidecoach/src/__tests__/fixtures/`), `test-site-1/`, and the single `test-site-1` task-list mention in `install.sh` (~line 203). Relocate the `landing.css` the tests read into the fixtures dir and repoint both readFileSync paths (FUNCTIONAL refs). Update the dist `.js.map` and the `install.sh:203` task-list area name (COSMETIC refs) so neither still names test-site-1. Confirm the sprint1-integration tests pass against the relocated fixture. Then `git rm -r test-site-1` only after `grep -rn \"test-site-1\" . --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=docs --exclude-dir=.claude` returns NOTHING. Do not commit; report your diff, the grep output, and the test results."

---

# WAVE 3 - after Wave 2

**Wave 3a:** dispatch U8 and U9 research in parallel (each writes only its named beat, never the index); the lead integrates both beats and recompiles the index serially; Jonah rules on each proposal.
**Wave 3b:** run U10 (cutover) against the post-integration index, only after U3 is accepted.

## Unit 8 (research): cmux hardening

**Owns:** `.claude/memory/decision_cmux_hardening_proposal.md` only. Changes NO code. Does NOT edit `MEMORY.md` or any generated index - writes only the named beat file; the lead adds the index pointer at integration. Runs in its own worktree; the lead integrates the beat and recompiles the index serially (not concurrent with U9 or U10).

**Task:** cmux is the highest structural risk (finding 10): an unpinned external binary with 6 hooks that exist only for it. Map the exact coupling of each of the 6 (`cmux-close-guard.sh`, `cmux-teammate-shim-heal.sh`, `node-shim-heal.sh`, `team-reaper.sh`, `resume-guard.sh`, `agent-teams-guard.sh`) plus the soft surface-detection deps (`claude-surface.sh`, `surface-visual-gate.sh`), with file:line evidence, classifying each as CLI-exec / internal-file / env. Propose three options with tradeoffs: (a) fail-soft guards per hook, (b) pin the cmux version + drift detection, (c) vendor. Recommend one. ALSO cover the `cmux/settings.json` question Wave 1's U1 surfaced: the plan's original "retire the legacy commented-out symlink" premise was FALSE - `install.sh:2181` live-symlinks it and the cmux component keys active-detection (`[ -L "$HOME/.config/cmux/settings.json" ]`) and deactivation off it, and the file is real (6120 bytes). Determine whether the config is truly retireable (and what the cmux component's detection would need to change) or should stay, and fold that into the recommendation.

**Verify:** the proposal covers all 6 hooks with evidence, the cmux/settings.json question, and lands a recommendation.

**Done:** a `decision`-type beat at the named path that Jonah and Codex can rule from. No code changed.

**Dispatch prompt:** "In your worktree of /Users/spare3/Documents/Github/improv, change only `.claude/memory/decision_cmux_hardening_proposal.md`. Do NOT edit `MEMORY.md` or any index - write only that one beat file. Investigate the cmux coupling (6 cmux-only hooks + 2 soft surface-detection hooks; list in docs/plans/2026-07-14-parallel-dispatch-plan.md Unit 8). Cite file:line and classify each coupling (runs cmux CLI / couples to cmux internal file / reads CMUX env). Propose fail-soft-guards vs pin+drift-detect vs vendor with tradeoffs, and recommend. Change no code; do not commit; report."

## Unit 9 (research): sidecoach/mcp-server fate

**Owns:** `.claude/memory/decision_sidecoach_mcpserver_fate.md` only. Changes NO code. Does NOT edit `MEMORY.md` or any generated index - writes only the named beat file; the lead adds the index pointer at integration. Runs in its own worktree; the lead integrates the beat serially (not concurrent with U8 or U10).

**Task:** finding 5 says `sidecoach/mcp-server` is built and wired to nothing, held alive only by the parity contract in `sidecoach_lanes.py`. Confirm it is genuinely dead (grep every caller), map the full parity-contract chain, and determine exactly what breaks if the server is deleted. Propose retire-with-exact-removal-steps vs wire-it-up, and recommend.

**Verify:** the proposal shows the full dependency chain and a safe removal sequence if retire is recommended.

**Done:** a `decision`-type beat at the named path. No code changed.

**Dispatch prompt:** "In your worktree of /Users/spare3/Documents/Github/improv, change only `.claude/memory/decision_sidecoach_mcpserver_fate.md`. Do NOT edit `MEMORY.md` or any index - write only that one beat file. Confirm whether `sidecoach/mcp-server` is truly dead (grep every caller), map the parity contract in `sidecoach_lanes.py` and what it binds to, and identify exactly what breaks if removed. Propose retire (exact ordered removal steps) vs wire-up, and recommend. Change no code; do not commit; report."

## Unit 10 (workstream, BLOCKED BY Unit 3): beats cutover, option B

**Owns:** new auto-search hook + tests, `beats-staleness-guard.sh` (mandate removal at cutover), `CLAUDE.md`, `MEMORY.md`/index, the benchmark. A multi-step workstream. It owns the index, so it runs only AFTER U8/U9 beats are integrated and the index recompiled. It modifies `beats-staleness-guard.sh` only against the POST-U3 version (after U3 is accepted and integrated), never a pre-U3 copy.

**Blocking rule (resolves the round-1 contradiction):** all of U10 except P0a is BLOCKED until Unit 3 (fail-closed compile-on-drift) is accepted. P0a is U3-independent, but "early" only relative to U3 - because P0a edits the index, it still runs AFTER U8/U9 beat integration, never before. No part of U10 touches the index before U8/U9 beats have landed and the index has been recompiled.

**Phases:**
- [ ] P0a (U3-independent, but after U8/U9 beat integration): trim/unpin the saturated index for headroom (it is at 22,983/23,000; same procedure as the 2026-07-02 hardening). Not gated on U3, but still follows U8/U9 integration since it edits the index.
- [ ] P0b (blocked by U3): confirm Unit 3's compile-on-drift is accepted and live, then re-run the 48-query benchmark as the LIVE gate (`python3 beats/beats.py` scorer), recording the current number. Cutover requires this to be current, not a two-week-old number.
- [ ] P1 (blocked by U3): build the auto-search-and-log hook - a UserPromptSubmit hook that runs `beats.py search` on recall-shaped prompts and appends any miss to a benchmark-candidate log, MECHANICALLY (not model diligence). TDD it.
- [ ] P2 (blocked by U3): run one genuinely mechanical week; the hook accrues real miss data; every logged miss becomes a benchmark case.
- [ ] P3 (blocked by U3): the atomic cutover commit - flip CLAUDE.md startup to "MEMORY.md index + ACTIVE beats + `beats.py search` as the mandated retrieval path", retire the read-everything mandate, retire the hand-edited index (which removes the saturation bug by construction), and remove the spent parallel-run injection from the staleness guard - all in ONE commit, no half-migrated state.

**Verify:** benchmark scorer >= 45/48 at P0b; the auto-search hook logs misses in P1 tests; after P3 a fresh session loads via index + search (not full read) with no pointer eviction and suites green.

**Done:** cutover committed on real mechanical-usage evidence; parallel-run injection removed; hand-edited index retired.

---

# Not dispatched (discuss after Wave 2)

- **Finding 7 - marketing-site :9223 daemon dependency.** The 7 pages that hard-code `localhost:9223/justify-core.js` live in the separate `~/Documents/Github/improv-site` repo now. Out of scope for this repo's dispatch unless we add a cross-repo unit. Owner/decision: Jonah, as part of the improv-site workstream.
- **Teammate panes in the wrong workspace.** Operational, not code: the lead's env carries `CMUX_WORKSPACE_ID` bound to another workspace. Cure is relaunching the lead from the improv workspace.
- **Finding 6 - beats/mcp-server inert.** Deliberate (install hint). No action; recorded so nobody "fixes" it.

---

# Self-review (author checklist, updated after Codex round 1)

- **Spec coverage:** all 11 findings dispositioned (1->U1, 2 and 3->U2, 4->U1, 5->U9, 6->not-dispatched/deliberate, 7->not-dispatched/separate-repo, 8->U4, 9 and 11->U5, 10->U8); harness findings (verify re-arm, memory-nudge, orchestrator carve-out, relay, push-ahead, team-dir)->U3/U7; suites-not-run->U6; beats cutover->U10.
- **Islands turned out LIVE (Wave-1 finding):** test-site-1 and cmux/settings.json were BOTH found live, not dead. test-site-1 was NOT retired by U2 (live test fixture) - retirement moved to U12 (repoint-then-remove); cmux/settings.json is live (install.sh:2181 symlink + cmux active-detection) - NOT retired by U1, disposition folded into U8's research; U11 reclassifies both as live on the dependency map.
- **Wave-1 follow-ups (added after execution):** harness false-positives (memory-nudge `install`-token, memory commit-gate + re-dirty race, verify-before-done repo-source exemption)->U7b; stale dependency map->U11; test-site-1 repoint+removal->U12; cmux/settings.json disposition->U8.
- **Collision guard:** three chokepoints (install.sh, settings.json, CLAUDE.md/index) each have one owner in separate waves; U8/U9 own only their one named beat each; real per-unit git worktrees isolate the git index; agents never commit concurrently.
- **Sequencing:** U6 is a Wave-0 barrier (baseline uncontaminated). U10 is fully blocked by U3 except P0a. U8/U9 integrate before U10 touches the index.
- **Safety:** U1 prune is fixture-tested and home-mutation is human-gated; U2 `git rm -r` is precondition-guarded with a docs-excluding live-ref check; U3 compile-on-drift is locked, atomic, and fail-closed.
- **Line-number claims** verified live at 7eb21eca: install.sh:364, sidecoach-sessionstart.sh:4, .gitignore:5, dogfood-teach-step1.ts:8/:15, dogfood-craft-step2.ts:10, reference/serve.py:12, .justify scriptPath.

## Files
- docs/plans/2026-07-14-parallel-dispatch-plan.md (this plan)
