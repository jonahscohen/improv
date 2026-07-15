---
name: Wave 1 merged+pushed to main; Wave 2 dispatched (overnight autonomous run)
description: Jonah "merge and let's continue, resolved by morning." Wave 1 (wave1-debt-burndown) merged to main a54cb63b and pushed to origin; Wave 1 worktrees/branches torn down. Wave 2 dispatched - U7 (harness guardrails), U7b (harness false-positives), U12 (test-site-1 repoint) as parallel background executors; U11 (dep-map) follows after U12 (state-coupled). Honest overnight scope inside.
type: project
relates_to: [session_2026-07-14_parallel-dispatch-plan.md, feedback_self_review_before_codex.md]
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: tests
confidence: high
---

Collaborator: Jonah Cohen. 2026-07-15. Jonah: "merge and let's continue, i want this all resolved by morning."

## Wave 1 LANDED
- Merged wave1-debt-burndown -> main as `a54cb63b` (octopus of u1-u5 + orchestration + api-drift fix + plan-consistency lint hook + Codex-approved Wave 2 plan). Zero conflicts. Pushed to origin (7eb21eca..a54cb63b). Sanity green (shaders path fixed, justify-core untracked, lint hook registered in claude/settings.json).
- Wave 1 worktrees (improv-wt/u1..u5) removed, branches w1-u1..u5 deleted (all merged).

## Wave 2 DISPATCHED (from main a54cb63b, per the Codex-approved base-from-merge-commit rule)
3 opus-executor background agents, each in its own worktree from main:
- U7 harness guardrails (improv-wt/u7, w2-u7): Fable carve-out for .claude/memory writes, teammate-relay Stop hook, push-ahead drift check, team-dir orphan lazy-init. Owns EXACTLY settings.json + fable-orchestrator-guard.sh + team-reaper.sh + named new hooks.
- U7b harness false-positives (improv-wt/u7b, w2-u7b): memory-nudge `install`-substring; memory-dirty commit-gate (recognize Bash beat-writes clear it, read-only never re-dirties) with the 4-part don't-weaken-the-gate invariant; verify-before-done repo-source exemption. Owns memory-nudge.sh, verify-before-done.sh, bash-guard.sh.
- U12 test-site-1 repoint (improv-wt/u12, w2-u12): relocate landing.css into the tests' fixtures, repoint functional readFileSync (src+dist), fix the cosmetic .js.map + install.sh:203 refs, then git rm test-site-1 after the grep returns nothing.
- U11 dep-map correction: NOT yet dispatched - runs after U12 integrates (state-coupled per Codex Wave-2 round 1; it must document test-site-1 as retired).

## Honest overnight scope (what "resolved by morning" can and cannot mean)
- WILL land: Wave 2 (U7/U7b/U12 gated per-unit by self-review + Codex, integrated to main; then U11). 
- NEEDS JONAH'S MORNING RULING (I will NOT decide these): U8 cmux hardening approach + the cmux/settings.json disposition, and U9 sidecoach/mcp-server retire-vs-wire. Wave 3a produces the decision beats/proposals; the choice is Jonah's.
- CANNOT complete overnight by design: U10 beats cutover B is a 1-2 week MECHANICAL window (auto-search hook accrues real usage, THEN the atomic cutover commit). I can prep P0a (index trim) + build the P1 auto-search-and-log hook, but the cutover itself awaits Jonah's go + the window.

## Discipline this run
Applying self-review-FIRST then Codex-verify per feedback_self_review_before_codex.md (I run my own review pass before invoking Codex, not using Codex as first-line QA). The plan-consistency lint hook is committed but NOT live yet (registered in claude/settings.json; needs ~/.claude/settings.json sync + a session restart).

## U12 (test-site-1 repoint) - Codex-ACCEPTED, integrating (2026-07-15)
w2-u12 dbe67f78: fixture relocated to sidecoach/fixtures/sprint1/landing.css (byte-identical, SHA-verified), both src+dist readFileSync repointed, install.sh cosmetic area-name drop (at line 307 - the plan's ~203 had drifted post-merge; the agent re-verified live per the stamp rule). The .js.map never referenced test-site-1 (the plan/Codex claim it snags the gate was STALE). Fixture-location call (sidecoach/fixtures/ vs the spec's e.g. src/__tests__/fixtures/) is sound per sidecoach/tsconfig.json rootDir/outDir - Codex confirmed. My self-review + Codex both clean; functional dependency fully cleared.
REMOVAL (lead step): git rm test-site-1 was blocked only by COSMETIC refs outside U12's lane - claude/skills/task-list/SKILL.md (a test-site-1 area NAME) and claude/hooks/test-plan-consistency-lint.sh (the lint hook I built embeds plan text incl. "test-site-1" as intentional test FIXTURES). LEARNING: the plan's removal gate ("grep returns nothing") is too strict - it cannot distinguish a functional fs ref from an intentional fixture string. The correct semantic gate is "no functional readFileSync/require/import ref" (which IS met). Lead action: drop the stale task-list area name (cosmetic-safe), LEAVE the lint fixtures (intentional test content, not scrubbed to satisfy a grep), then git rm test-site-1.

## Files touched
- .claude/memory/session_2026-07-15_wave2-execution.md (this beat) + MEMORY.md
- (integration) main merge of w2-u12 + task-list SKILL.md area-name drop + test-site-1 removal + harvested u12 beat
