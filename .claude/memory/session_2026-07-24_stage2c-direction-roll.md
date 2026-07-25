---
name: Stage 2c outside-ranking direction roll SHIPPED (not committed)
description: bin/sidecoach-roll.js + src/direction-deck.ts - anti-sameness roll that draws a design direction from OUTSIDE the model-top, deterministic + exclusion-safe, terminal-only (hard exclusion honored)
type: project
relates_to: [session_2026-07-24_stage2a-palette-recipe.md, session_2026-07-24_stage4cd-structural-motion-classes.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests + codex-review
confidence: high
---

Stage 2c of the sidecoach upgrade plan (docs/superpowers/plans/2026-07-23-sidecoach-upgrades.md) SHIPPED, not committed. The anti-sameness "outside-ranking direction roll": draw a design direction from OUTSIDE the model's own top-ranked concept; re-roll excludes prior draws and never redraws a used id or the model-top; deterministic under a seed.

Files (my unit, all NEW):
- `sidecoach/src/direction-deck.ts` - the curated deck (16 genuine design directions, OUR OWN authorship, no competitor identifiers) + the pure roll logic.
- `sidecoach/bin/sidecoach-roll.js` - thin CLI over `dist/direction-deck` (palette-bin house style).
- `sidecoach/src/__tests__/direction-roll.test.ts` - pure invariants + build-gated e2e.

**Deck shape/size.** 16 directions, each {id, name, axis, premise, moves[3-5], avoid}. One entry (`conventional-saas`, exported as `MODEL_DEFAULT_ID`) is the default-instinct baseline ranked LAST when no `--model-top` is given - it stays a real drawable entry only when a different instinct is named. Small and curated (vs oracle's ~188 worlds), reimplement-and-own.

**Roll mechanism (Why: the three invariants must hold for EVERY seed, not usually).**
How: eligible pool = deck minus {model-top} minus {prior draws}. The random pick indexes an already-filtered pool, so "never the model-top", "never a used id", and "no-repeat over a sweep" are STRUCTURAL (pool-filter) properties, RNG-independent. Determinism: `mulberry32(mixSeed(seed, excluded))` where `mixSeed` folds the SORTED exclusion set, so the draw is a pure function of (seed, model-top, exclude set) and order-independent. Exhaustion (empty pool) is a distinct honest outcome (status:'exhausted', draw:null), never a fallback to a used id or the model-top.

**Exit-code contract (fail-loud, one class per code):** 0 drawn, 2 usage/load (bad args, unknown --model-top or --exclude id, dist not built), 3 exhausted. stdout = result JSON always on a roll; stderr = human summary (--quiet). `--list`/`--help` are query modes (no result JSON).

**HARD EXCLUSION honored (plan Section 6):** terminal/data roll only. Grep of the diff for server/browser/injected-script/variant-surface CODE = zero hits; the only textual matches are two scope comments stating the ABSENCE of those surfaces. No HTTP server, no in-browser variant surface, no injected client script. 2d (deck presentation) is a separate stage, out of my scope.

**Foreground Codex review (gpt-5.4, high effort, blocking) - 3 should-fix findings, all folded + re-verified:**
1. Test's "pure/no-build" claim was false: `testParseArgs` did `require(BIN)` and the bin hard-loaded dist at module scope (process.exit(2) if absent), killing the pure tests before the e2e skip. FOLD: lazy-load dist (`loadDeck()`) so parseArgs/--help need no build. PROVEN: with dist removed, the pure suite (incl. parseArgs) runs green and only e2e skips.
2. `--seed` silently coerced (parser took any int, roll did `| 0`; `--seed 4294967297` echoed seed 1). FOLD: seed contract = unsigned 32-bit [0,4294967295], validated fail-loud (exit 2 out of range), and roll stores `seed >>> 0` so the echoed seed round-trips as re-runnable.
3. Negative seeds got a misleading "needs a value". FOLD: dropped the leading-'-' guard for --seed; `--seed -1` now hits the clear range error (exit 2). Codex confirmed core logic sound: invariants structural, mulberry32 cannot return 1.0 (idx always in-range), exhaustion honest, hard-exclusion clean.

**Verify (all real output captured):** `tsc --noEmit` clean; test suite OK standalone (ts-node) with AND without dist; `--seed 42` byte-identical twice (draws technical-datafirst, model-top conventional-saas); re-roll `--exclude technical-datafirst` -> documentary-photo (!= prior, != model-top); full 15-step binary sweep no-repeat, covers exactly deck-minus-top, exhausts at exit 3; seed-domain e2e (4294967297->2, -1->2, 2147483648 round-trips unsigned).

**INTEGRATION HANDOFF (for the lead):**
- run-tests.ts suite line to add (I did NOT edit run-tests.ts per instruction):
  `{ rel: 'src/__tests__/direction-roll.test.ts', required: true },                     // Stage 2c bin/sidecoach-roll.js: outside-ranking deck roll - determinism, unsigned-seed domain, exclusion re-roll, full-sweep no-repeat + exhaustion`
- dist NOT rebuilt/committed by me. `npm run build` at integration emits `dist/direction-deck.js` (tsconfig include covers src/**); the bin resolves it then. I compiled it locally only to run verifies and removed it.
- Not committed (per instruction).

**Shared-tree note.** The working tree carried a CONCURRENT teammate's Stage 4c/4d structural-motion work (subjective-rendered-scanner.ts, product-rule-registry.ts, rendered-live-scan.ts, rule-authors.json, eval/fixtures/structural-motion/, structural-motion.test.ts + .mjs). NONE of it is mine; I did not touch/stage/revert it. My whole-project `tsc --noEmit` was green, so their in-progress work also compiled at verification time. Lead should integrate the two units independently.
