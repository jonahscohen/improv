---
name: Beats evolution STAGE 3 - search + benchmark scorer (dispatched)
description: Stage 3 kickoff - search subcommand (FTS5 bm25, NL query sanitization, query-time supersession resolution, index-file exclusion) + bench scorer (public-CLI scoring, machine stale-set, 90% bar) dispatched to fresh Opus teammate "searcher"; anti-gaming rules explicit; lead holds the gate
type: project
relates_to: [session_2026-07-02_beats-stage2-compiler-impl.md, session_2026-07-02_beats-stage1-recall-benchmark.md]
---

Collaborator: Jonah Cohen. 2026-07-02. Jonah greenlit stage 3 ("proceed with stage 3").

## Dispatched (fresh opus-executor teammate "searcher")
- `beats.py search`: NL query sanitization (global stopword list, OR of tokens), bm25 with name/description-over-body column weights, hardcoded exclusion of the two derived index files (MEMORY.md, MEMORY-archive.md - the ONLY permitted filename logic), and the stage's hard requirement: query-time supersession resolution (chain-head mapping, cycle-guarded, depth-capped; no result may ever carry a non-empty superseded_by). Stale index warns but serves; broken exits 4.
- `beats/bench/score.py`: validates benchmark first, consumes `validate.py --stale-set` per the README contract, requires fresh compile, scores all 48 phrasings through the PUBLIC search CLI, applies mode any/all + satisfaction rank + global stale rule, hard-asserts zero marked-stale beats anywhere in any result page, exit 0 only at >= 90%.
- Anti-gaming rules explicit in the dispatch: no benchmark-specific logic, global-only tuning knobs; if the bar is unreachable with principled lexical ranking, deliver the honest operating point + per-miss analysis and STOP - whether to add an embeddings layer is a lead/Jonah decision.

## Delivery + honest scorecard (lead-verified, 2026-07-02)
Searcher delivered code silently (idle, no relay - pinged for its report). Lead independently verified: both suites green (compile 25/25, search 21/21), search implementation reviewed (clean, principled, zero benchmark-specific logic; layered broken-db checks match verify; supersession resolution + index-file exclusion exactly as specced).

**Scorer (lead-run): 38/48 = 79.2%, UNDER the 90% bar (exit 1). Marked-stale assertion held - zero superseded beats surfaced anywhere (supersession resolution works; the q03 v1 trap did not fire).**

Miss taxonomy (10 misses, two clean classes):
1. **Vocabulary/semantic gaps (6)**: q10[1] ("second model" != codex vocab), q21[0/1] (the unmarked endow trap ranked #1-2 AND "micro-adjustment" tokenizes apart from the rename beat's "microadjustment"), q24[1], q26[1] ("visual-effects workbench" != tilt-lab), q31 (answer beat has pre-rename "improv" vocab). Exactly what the paraphrase anti-leakage design was built to expose; lexical BM25 cannot bridge synonyms/renames.
2. **Topic-crowding + mode-all strictness (4)**: q02, q03[0/1], q29 - the required complementary PAIR cannot both crack top-5 because sibling beats on the same topic crowd the page.

## Lead adjudication: one more PRINCIPLED lexical iteration before the embeddings question goes to Jonah
Two global, benchmark-agnostic mechanisms dispatched back to the searcher:
- **relates_to graph expansion**: blend high-ranked hits' relates_to neighbors (supersession-resolved) into ranking. Justification independent of the benchmark: the corpus's link discipline exists precisely to bind complementary context; retrieval should honor the data model. Targets the crowding/pair class.
- **Compound-bigram query terms**: for adjacent surviving tokens, add their concatenation as an OR term ("micro adjustment" -> "microadjustment"). Global tokenization robustness. Targets hyphen/compound vocabulary gaps.
If the re-measure still lands under 90%, the remaining misses are the genuinely semantic class and the add-an-embeddings-layer decision goes to Jonah (per the dispatch contract).

**Searcher round-1 evidence (interim report, strengthens the ceiling hypothesis):** per-miss rank diagnostics - q02 mandate@14/PLAN@7, q03 v3-plan@30, q29 mandate@11, q10p/q24p refs@7 (just outside), q26p consolidated@17, q21 answer@>40 (endow trap dominates), q31@21 (pre-rename vocab). A GLOBAL column-weight sweep (1,1,1 up to 20,10,1) is FLAT at 79.2% - the ceiling is recall/vocabulary, not tuning. Lead amendment sent: relates_to expansion must be BIDIRECTIONAL (links are written asymmetrically by protocol - newer cites older - so forward-only expansion systematically misses the newer half of every pair).

## Outcome: honest gate-fail at the lexical ceiling; embeddings decision to Jonah
Iteration 2 (bidirectional graph expansion + compound bigrams) is NET-NEUTRAL: 38/48 = 79.2% at every damping in 0.5-0.7, monotonic regression above (0.85->35, 1.0->32); the searcher's graph data REFUTED the lead's link hypothesis (far-second answers are 2 hops away; mode-all pages already full of strong direct hits; damped neighbors cannot outrank direct hits). Bigrams also neutral (no compound-vocab gap among the misses). Lead ruling: RETAIN both mechanisms at conservative defaults (never regress the gate, corpus-native, fixture-covered; reverting = churn without value).

Lead-verified: suites 27/27 + 25/25 green, scorer reproduces 79.2% (exit 1 under bar), stale-leak assertion held on all 48 queries. Lead Codex CERTIFICATION round: PASS, no blocking defects, anti-gaming line certified, two non-blocking notes (corpus supersession hygiene matters because search tolerates dangling/cycles; scorer lacks a subprocess timeout - a CI-wrapper concern later).

Stage 3 ships as the honest under-bar operating point (commit 48c27f90); the >=90% verify clause is NOT met, cutover stays blocked. The close-the-gap decision (local embeddings / API embeddings / defer-and-proceed) goes to Jonah per the dispatch contract.

## Files touched
- .claude/memory/session_2026-07-02_beats-stage3-search.md (this beat)
- .claude/memory/MEMORY.md (index pointer)
