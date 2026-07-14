---
name: Parallel-dispatch plan authored (Codex-gated waves) + beats cutover decided B (Codex moved me off A)
description: Jonah wants every open problem burned down via parallel agents, gated by Codex review at each step. Authored docs/plans/2026-07-14-parallel-dispatch-plan.md - a file-ownership collision model (3 chokepoints, one owner each) with 6 parallel Wave-1 units, 1 serialized Wave-2 unit, and 3 Wave-3 units (cmux + sidecoach-mcp are research-and-propose per Jonah; beats cutover B is a workstream blocked by Unit 3). Cutover chosen = B after Codex pressure-test found A swaps a weaker benchmark proxy for the never-collected usage evidence.
type: decision
relates_to: [session_2026-07-14_structural-briefing-and-hook-deps.md, session_2026-07-13_state-of-the-union.md, feedback_memory_first_zero_failure_execution.md]
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: none
confidence: high
---

Collaborator: Jonah Cohen. 2026-07-14. Continuation of the structural-briefing session (see relates_to). Jonah: "have a plan for each problem so we can actually move forward with a plan we can feed to a bunch of agents in parallel."

## Beats cutover decision: B (was leaning A)
Real Codex (via codex-review.py, 36.4s, genuine cross-model - not a downgrade) pressure-tested the cutover recommendation and moved me from A to B.
- A = cut over now on the 48-query benchmark as the gate. Codex's crux: the benchmark is a WEAKER PROXY, not the same evidence. The plan's gate was over USAGE misses (the full workflow: does the session issue the right search, phrase it well, read enough results); the benchmark only tests the retrieval engine in isolation. Swapping benchmark misses for usage misses silently lowers the standard. The parallel run failed on ADOPTION (search never invoked), and A stops measuring adoption instead of fixing it.
- B = restart a compressed window but make a HOOK auto-run search on every recall prompt and auto-log misses (mechanical, not diligence), then cut over on real data. B fixes the actual failure and is more faithful to the zero-failure/mechanical-gate mandate than A.
- Codex's biggest unnamed risk in A: silent behavioral regression from workflow mismatch (benchmark green while real sessions stop surfacing memory, unnoticed until decisions drift).
- Codex precondition (both agreed): the index must be mechanically fresh, fail-CLOSED, before any session trusts it. This becomes a hard gate: cutover (Unit 10) is blocked by the fail-closed compile-on-drift fix (Unit 3).
- Jonah ratified B.

## The dispatch workflow (Jonah's spec)
Comprehensive plan doc (everything, not just wave 1) -> Codex reviews the PLAN -> revise to approval -> dispatch Wave 1 in parallel (Codex reviews each agent's diff) -> Wave 2 -> Wave 3 -> then discuss the "Not dispatched" items.

## The plan: docs/plans/2026-07-14-parallel-dispatch-plan.md (stamped 7eb21eca)
Organizing principle = FILE-OWNERSHIP collision model. Agents collide only on shared files; this repo has exactly 3 chokepoints (install.sh, claude/settings.json, CLAUDE.md+index), each given one owner in a separate wave. Do NOT rely on worktree isolation (proven unreliable 2026-05-28); rely on disjoint ownership.
- Wave 1 (parallel, disjoint files): U1 install.sh hygiene (findings 1,4 + cmux/settings.json island), U2 repo/git hygiene (findings 2,3 + test-site-1 island), U3 hook-logic fixes (verify re-arm + memory-nudge misclassification + beats stale-on-pull fail-closed), U4 sidecoach portability (finding 8, highest-ROI quick win), U5 dogfood+reference (findings 9,11), U6 test-suite baseline (runs cca3aba3's never-run suites; reports first).
- Wave 2 (serialized on settings.json): U7 harness guardrails (orchestrator carve-out for .claude/memory writes, teammate-relay Stop hook, push-ahead drift check, team-dir orphan fix).
- Wave 3: U8 cmux hardening (RESEARCH-and-propose per Jonah - no code), U9 sidecoach/mcp-server fate (RESEARCH-and-propose per Jonah - no code), U10 beats cutover B (workstream, BLOCKED BY U3).
- Not dispatched (discuss later): finding 7 marketing-site :9223 (separate improv-site repo), teammate-pane workspace bug (operational), finding 6 beats/mcp-server (deliberate).

All 11 findings + harness debt + islands + suites-not-run are mapped to a unit. Every unit has a self-contained dispatch prompt in the doc (directly feedable). All file:line claims verified live at 7eb21eca.

## Status: plan Codex-APPROVED (GO), nothing dispatched yet
Codex reviewed the plan in 3 real rounds via codex-review.py (exit 0 each):
- Round 1 (66.8s): 7 findings, all legitimate (verified each per receiving-code-review, not performative). U6 must be a serialized Wave 0 not a parallel unit; U8/U9 write decision beats so they are NOT read-only and collide with U10's index; U1 prune mutates ~/.claude (too destructive unattended); U10 "blocked by U3" vs "proceed immediately" contradiction; compile-on-drift needs lock/atomic-move/fail-closed; `git rm -r test-site-1` needs clean-state + docs-excluding-ref preconditions; goal overclaimed "all 11". ALL 7 folded (rewrote the doc: Wave 0 barrier, worktree+serial-integration discipline, fixture-only home prune, precondition-guarded rm, etc.).
- Round 2 (33.4s): all 7 confirmed resolved; 4 wording tightenings (Wave 3a/3b split; U8/U9 forbidden from editing MEMORY.md; U10 P0a runs after U8/U9 beat integration; U10 edits staleness-guard only post-U3). ALL 4 folded.
- Round 3 (13.1s): GO, no remaining blockers.
Plan is dispatch-ready. NEXT: run Wave 0 baseline (U6), then dispatch Wave 1 - but the dispatch SURFACE must be settled first given the 2026-07-13 teammate-pane-wrong-workspace bug (spawning cmux teammates risks invisible panes unless the lead was relaunched from the improv workspace). Recommending background Agent subagents (real per-unit worktrees, report diffs, Codex-review each, lead integrates serially) to sidestep that bug.

## Wave 0 result (2026-07-14): GREEN
All 7 hook suites (test-bash-guard-commit, test-chrome-tabgroup, test-cmux-close-guard, test-install-hook-deploy, test-justify-watch-standing-by, test-multiple-choice-enforce, cmux/test-node-shim) PASS + justify vitest PASS at 7eb21eca. Verification baseline solid; Wave 1 cleared to dispatch pending the surface decision. (Ran directly as the lead barrier. The memory-nudge misclassification false-fired again on the /tmp log redirects - the exact bug U3 fixes.)

## Wave 1 DISPATCHED (2026-07-14) - background Agent subagents (Jonah's chosen surface)
5 opus-executor background agents launched, one per real git worktree (improv-wt/u1..u5, branches w1-u1..u5), all from clean 7eb21eca. Each: works only in its worktree, TDDs its unit, commits to its branch, reports a diff; does NOT touch main or other worktrees, does NOT push. Integration flow: as each agent reports, the lead runs codex-review.py on its branch diff (w1-uN vs 7eb21eca), folds findings, then merges accepted branches serially into main (disjoint files -> conflict-free) and removes the worktree. Then Wave 2 (U7), then Wave 3a research (U8/U9), then 3b cutover-B. Awaiting completions. Note: api-drift-detector.sh false-fired on the successful Agent launches (drift handled, false positive - FIXED durably, see reference_api_drift_agent_success_skip.md); memory-nudge misfired again on the worktree setup redirects (the U3 bug).

## Wave 1 execution log (2026-07-14, live) - each unit lead-reviewed via codex-review.py (real Codex)
- **U4 sidecoach portability**: Codex REJECTED v1 - unescaped SIDECOACH_ROOT written to a sourced state file breaks on a space-in-path checkout (the portability fix itself surfaced the latent bug). Agent fixed with printf %q for all 5 state values + a spaces test WITH a control. Codex ACCEPTED. Commits b9f3811b + 01edba12.
- **U2 repo/git hygiene**: ACCEPTED. Untracked justify-core.js(.map) + fixed .justify path. Task 3 (remove test-site-1) CORRECTLY STOPPED - precondition found LIVE refs: sidecoach sprint1-integration tests read test-site-1/landing.css. Dependency-map's "test-site-1 = dead island" was WRONG. Commit 01b8fd9f.
- **U5 dogfood+reference**: ACCEPTED. Source fail-loud guards (replacing mkdirSync) + port 4831; follow-up commit hand-patched the 2 TRACKED compiled dist/*.js that still had the footgun (verified by running the compiled artifacts). Codex's narrow "reject" was only the stale dependency-map (out of lane -> follow-up). Commits 45c6a47d + 51ecc053.
- **U1 install.sh hygiene**: Tasks 1 (shaders path install.sh:461 ghostty/shaders->shaders) + 2 (dry-run-default skills prune + 13-assertion test) done. Task 3 (remove cmux/settings.json symlink) CORRECTLY STOPPED - install.sh:2181 is LIVE uncommented (git blame 2026-05-01), cmux/settings.json is a real 6120-byte file, cmux component keys active-detection off it. Dependency-map's "cmux/settings.json = commented-out legacy island" was WRONG. Codex took 3 rounds on the DESTRUCTIVE prune (justified for rm on home-dir): v1 rejected (lexical fallback can prune an outside-repo target; global --dry-run misses the prune-apply path), v2 rejected (multi-hop broken-symlink edge), v3 ACCEPTED (fail-safe skip on any unprovable target, dry-run override, `[ -L $tgt_abs ]` multi-hop guard; 16 test cases). Commits 65b492a9 -> a92fcfce -> abbb38ab.
- **U3 hook-logic fixes**: (a) verify-before-done re-arm + (b) memory-nudge /dev/null both Codex-ACCEPTED. (c) fail-closed compile-on-drift Codex REJECTED - real concurrency bugs: stale-lock-steal TOCTOU allowing two concurrent compilers; a concurrent-stale path that proceeded without a fail-closed warning; timeout bounding only the parent pid; non-atomic two-file index pair. Redesign sent: mkdir-only acquire, NO stealing, fail-closed-warn when locked (closes both High findings), process-group kill, db-last commit-point documented. Then Codex found a CROSS-HOOK race: beats-rebuild.sh (separate PostToolUse compiler) used a different lock + non-atomic install, so two compilers could run and a stale rebuild could land after the guard's FRESH. Granted U3 beats-rebuild.sh; unified both onto ONE shared mkdir lock + atomic install in both + a drain (guard hands a lock-deferred .dirty write to a background rebuild so it is not stranded). Codex ACCEPTED. 3 substantive rounds (guard concurrency -> cross-hook race -> drain). Final commit 423fe736 (7 files). The memory-nudge "install"-substring false-positive (U1 surfaced it, distinct from /dev/null) remains a residual follow-up.

## Wave 1 COMPLETE (2026-07-14) - all 5 Codex-accepted
Final branches/commits (each TDD'd, no attribution lines, nothing pushed, base 7eb21eca):
- w1-u1 abbb38ab - install.sh shaders path + safe dry-run-default skills prune (3 prune-safety rounds). Task 3 STOPPED: cmux/settings.json is LIVE (install.sh:2181 uncommented, real 6120B file, cmux active-detection keys off it), NOT the "dead island" the map claimed.
- w1-u2 01b8fd9f - untrack justify-core.js(.map) + .justify path fix. test-site-1 STOPPED: LIVE test fixtures (sidecoach sprint1-integration reads its landing.css), NOT dead.
- w1-u3 423fe736 - verify-before-done re-arm + memory-nudge /dev/null + fail-closed compile subsystem (unified lock guard+rebuild, atomic install both, drain).
- w1-u4 01edba12 - sidecoach-sessionstart root derivation + space-safe printf %q state write.
- w1-u5 51ecc053 - dogfood fail-loud guards + reference port 4831 + compiled-dist parity.
Codex caught REAL bugs on 4 of 5 (only U2 clean first pass): space-unsafe writes, half-fixed compiled artifacts, prune-safety holes, compile concurrency + cross-hook race. The per-unit gate earned its keep decisively. TWO of the map's "dead islands" (test-site-1, cmux/settings.json) were LIVE - the audit's island calls are unreliable.
Stranded: each unit wrote a beat in its worktree (U1's committed in-branch; U2-U5 untracked); harvest + add MEMORY.md pointers at integration.
Follow-ups queued: stale dependency-map (Codex flagged 3x); test-site-1 test-repoint before removal; cmux/settings.json retire-investigation; memory-nudge "install"-substring FP; verify-before-done worktree-path exemption FP (fires on hook-source edits under a worktree's claude/hooks/ since it only exempts .claude/hooks/).
NEXT: integration decision (Jonah's - don't-commit-to-default-without-a-check rule applies), then Wave 2 (U7), Wave 3.

## Integration (2026-07-14) - branch `wave1-debt-burndown`, for Jonah's review
Jonah chose "integration branch for review" (not commit-to-main). Assembling `wave1-debt-burndown` off 7eb21eca: (1) orchestration committed - 92b08182 (api-drift fix) + 804eae09 (plan doc + session beats); (2) octopus-merged w1-u1..u5 -> a060bcb6, ZERO conflicts, all spot-checks pass (shaders path fixed, justify-core untracked, .justify path corrected, beats-rebuild shared lock present, sidecoach hardcode gone, reference port 4831); (3) harvested the u2/u3/u4 untracked worktree beats (u1/u5 beats rode in with the merge). Remaining: full suites on the merged tree, then present the combined diff. main UNTOUCHED. The pre-existing claude/settings.json.pre-standingby-unregister.bak was deliberately NOT committed (not mine). Note: the bash-guard memory-dirty commit gate false-blocked the harvest commit (a Bash `cp` to .claude/memory sets dirty but is not recognized as a beat-write clear) - the known subagent-affecting gate bug, cleared by this beat write. Unit beats are NOT individually pointered into the saturated MEMORY.md - the plan beat's execution log is the wave's index entry and beats.py search finds the unit files by content.

**KEY PATTERN**: TWO of the dependency-map's "dead islands" (test-site-1, cmux/settings.json) are NOT dead - both have live edges the audit missed. The safety preconditions added per Codex's round-1 plan review caught both before a breaking deletion. The map is unreliable on islands and needs correction.

**Follow-ups queued**: (a) update the stale docs/dependency-map (Codex flagged 3x: .justify path, justify-core.js "tracked", test-site-1 "dead", cmux/settings.json "dead", reference port, mkdirSync); (b) repoint the sprint1-integration tests off test-site-1/landing.css before test-site-1 can be removed; (c) investigate whether cmux/settings.json is truly retireable (needs the cmux component's detection updated too); (d) harness: memory-nudge's write-token list contains the literal "install" so every "install.sh" bash command false-sets memory-dirty (blocked U1's commit 3x) - fold into U3; the bash-guard memory commit-gate also false-blocks subagents generally (hit U2/U4/U5) -> U7. Stranded unit beats live in each worktree; harvest at integration + add MEMORY.md pointers.

## Files touched
- docs/plans/2026-07-14-parallel-dispatch-plan.md (the plan)
- .claude/memory/session_2026-07-14_parallel-dispatch-plan.md (this beat)
- .claude/memory/MEMORY.md (index pointer)
