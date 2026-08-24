---
name: sidecoach full npm test has 3 PRE-EXISTING red suites (not the taste work)
description: npm test exits 1 - task8-list-command-taxonomy, product-rule-registry, and migration-harness/scanner-snapshot fail at HEAD AND at the pre-taste baseline (cdb530f2^); Phase 1/2 touched no non-test src/ and did not cause them
type: project
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: tests (ran the 3 suites at HEAD and at cdb530f2^ in a throwaway worktree; both red)
confidence: high
relates_to: [session_2026-08-24_phase1-2-review-outcome.md]
---

DISCOVERED during the Phase 1+2 review: `cd sidecoach && npm test` exits 1. The full suite was NOT green - I had only probed the per-unit gates this session (component-browser 147/0, taste-promote 90/0, etc., all green), not the whole suite. Self-analysis: I violated verification-baseline-first (should probe the full runnable baseline at session start); the per-unit greens let me assume the whole was green.

THE 3 FAILING SUITES (all pre-existing, confirmed):
- src/__tests__/task8-list-command-taxonomy.test.ts - "FAIL T2: list renders every verb in VERB_REGISTRY (21/22, missing: new-work)". The `new-work` verb was added to VERB_REGISTRY on 2026-07-29 (verb-command-registry.ts:633) but the list-command rendering was never updated to include it. A month-old drift, unrelated to taste.
- src/__tests__/product-rule-registry.test.ts - exit 1 (registry test; Phase 1/2 changed no src/ registry code).
- eval/migration-harness/scanner-snapshot.mjs - exit 1 at HEAD / exit 2 at baseline (snapshot harness; failing both).

PROOF IT IS PRE-EXISTING (not caused by Phases 1+2):
- git diff --name-only cdb530f2^..HEAD shows NO non-test src/ files changed (all taste code is in bin/ + hooks/, no src/ touch).
- The failing test FILES existed at cdb530f2^.
- Ran all 3 at cdb530f2^ (c199f9c5) in a throwaway worktree after a clean build: all 3 RED there too (exit 1/1/2).

IMPLICATION: the taste work Phases 1+2 has its OWN green gates and is provable-safe on its own suites; these 3 reds are separate, pre-existing tech debt in unrelated code. They do NOT block the shore-up, but a healthy green baseline is worth restoring before Phase 3 stacks a build-blocking enforcer on this repo. Surfaced to Jonah as a separate fix decision.

Files: none (diagnostic only).
