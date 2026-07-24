---
name: Autonomous wave 1 dispatched - 4 teammates on backlog + unstarted plan stages
description: Jonah pushed everything and handed over autonomous execution of the remaining backlog, started-not-finished items, and unstarted plan stages. Wave 1 = stage1-mine (top-ranked Stage 1a/1b + the 2 open probes), groundb (finish 4a Ground B), distrib (finish distributability), simplify-audit (verify + plan the two untouched mission-primary gaps). Disjoint file ownership; wave 2 queued.
type: project
relates_to: [session_2026-07-24_beats-consolidated-and-session-committed.md, session_2026-07-23_borrow-list-reconciliation.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: dispatch only - state confirmed clean (0 ahead of origin, 0 uncommitted, HEAD e378a632) before fan-out; teammate results pending
confidence: high
---

Collaborator: Jonah. 2026-07-24. Everything from the prior session is PUSHED (confirmed: 0 ahead of origin, clean tree, HEAD `e378a632`). Jonah handed over autonomous execution: finish the backlog, the started-not-finished items, and the unstarted plan stages, fanning out agents as needed.

## Wave 1 (4 teammates, disjoint file ownership)
1. **stage1-mine** - Stage 1a (`eval/provider-sample.mjs`, key-gated Claude/gpt-5.4/Gemini adapters over held-out briefs) + Stage 1b (`eval/defect-distribution.mjs` running the SHIPPING scanner, fail-closed inconclusive excluded from denominators). PLUS the two open measurement questions the lead flagged and never answered: the POWER question blocking 1d (what N distinguishes a prose-ablation delta from noise - and "infeasible at any affordable N" is an acceptable finding), and OUR OWN concept sameness (we only ever measured the rival's; it decides whether 2c earns its effort). Owns `eval/` NEW files only.
2. **groundb** - finish 4a's Ground B, which ships calibrated + tested but INERT because nothing supplies a committed family on the live path. The load-bearing constraint given: Ground B must stay SILENT when no committed family is known - a false brand-mismatch on every project without a DESIGN.md would be worse than leaving it inert. Must not retune the frozen 0.25 threshold and must reproduce the certified A5a result. Owns project-context / run-validator / audit-rendered / rendered-checks.
3. **distrib** - the distributability remainder after `71e7902d`: plugin manifest, package.json metadata + `files` allowlist, and the absolute paths still in `src/dogfood-*.ts` and some tests. Told to OMIT rather than invent unknown manifest values, and to FLAG (not perform) any package rename. Owns package.json / manifest / dogfood / those tests.
4. **simplify-audit** - READ-ONLY. The two mission-primary gaps nobody has touched (maintainability/complexity, workflow simplicity). Instructed to VERIFY the 2026-06-23 claims first (6+ routing impls, triplicated classifier, ~138 files/~40k SLOC, 4 vocabularies) because the engine was rebuilt registry=engine since, then write a risk-sequenced CONSOLIDATION plan with runnable verify clauses and a QUANTIFIED prize per step. Vocabulary collapse is presented as costed OPTIONS because it is a product decision for Jonah, not an agent's unilateral call.

## Coordination decisions
- **Same tree, disjoint ownership** rather than worktrees: sidecoach's `node_modules` and tracked `dist/` make per-worktree isolation expensive, so each teammate got an explicit owns/do-not-touch list instead. Each was warned others are live and told to re-run once if a test fails like a concurrent-build artifact.
- simplify-audit is forbidden from running `npm test`/`npm run build` at all, precisely so it cannot race the three code agents.
- Every teammate: independent review via the DETERMINISTIC `codex-review.py` wrapper, never the codex-rescue agent (it can silently downgrade to a same-model self-review).
- Every teammate: beats to the CANONICAL repo-root `.claude/memory/`, explicitly told not to recreate the nested sidecoach beats dir just consolidated away.

## Wave 2 (queued, blocked on wave-1 file ownership clearing)
Stage 3b (real hook path) + 3c (registry consolidation); Stage 4b/4c/4d (type extremes, structural, motion+honest exclusions); Stage 2a-2d (palette recipe, pre-render authorship, outside-ranking roll, exclusion-safe deck); execution of whatever simplify-audit's plan recommends; the 337 unindexed beats; darwin-only A5a containment porting.

## Files touched
- this beat + MEMORY.md index. No code changed by the lead - 4 teammates executing.
