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

## Stage 3b: Jonah chose LOCAL EMBEDDINGS (decision + dispatch, 2026-07-02)
Options presented (AskUserQuestion): local embeddings (recommended) / API embeddings / defer-to-stages-4-5. **Jonah picked local embeddings.** Environment probe found the machine bare (no ollama, no torch/numpy, python 3.14 - torch wheel availability is a trap), which drove the design: ollama-served embedding model (brew install; evaluate qwen3-embedding + embeddinggemma first per the bleeding-edge rule, nomic-embed-text as fallback), all calls via local HTTP with stdlib urllib (beats.py stays pip-free), vectors float32-packed in a new beats_vec table inside the same atomic SQLite artifact (parity extends: vec count == beats count, exit 5), pure-python cosine (no numpy - ~0.7M multiply-adds total at this corpus size), RRF fusion (global k) over lexical+vector candidates BEFORE the unchanged resolution/expansion pipeline. Fail-soft both ends with LOUD warnings (compile lexical-only "VECTORS ABSENT", search lexical-only fallback), never silent. Stub embedder for suites, real-model smoke gated on availability. Dispatched to the searcher (unit extended); same anti-gaming rules, honest re-measure, STOP if still under 90%.

## 3a closure + lead-side hygiene hardening (2026-07-02)
Searcher's Codex gate CLOSED after 4 rounds (R3: 3 mediums folded - bigrams from the pre-dedupe token stream, scorer rejects N>top_n result pages, scorer derives --corpus from the benchmark's own corpus field exactly as validate.py does; R4 confirmation CLEAN). Verified the tree was already at the fully-folded state when 4b804747 was committed and lead-certified (git diff clean under beats/ afterward). The searcher's honest no-gaming discipline held through both iterations.
Escalated item closed LEAD-side (validate.py is spec territory): corpus supersession hygiene is now enforced by validate.py - a dangling superseded_by target or a supersession cycle is an ERROR, because search resolves chains at query time and the scorer's stale-leak assertion assumes every chain reaches an existing unmarked head. Verified: real corpus clean (73 marked-stale, 0 hygiene errors), synthetic dangling and cycle corpora both exit 1 loudly, clean-chain control exits 0.

## 3b interim: hybrid 43/48 = 89.58% - ONE query under the bar (2026-07-02)
qwen3-embedding:0.6b via local ollama (embeddinggemma evaluated, scored 41/48, rejected; nomic not needed). +10.4 points over lexical. All knob sweeps (RRF_K, CAND_K 20-300, damping, FTS weights) plateau at 43/48; CAND_K=100 honest best. Fail-soft verified both ends; suites 35/35 + 26/26 green; searcher STOPPED per mandate without gaming. Remaining 5 misses: q21 x2 (the deliberate unmarked-stale trap - semantic retrieval makes it WORSE, pulling old endow-naming beats above the justify answer), q03 x2 (mode-all 2-hop pair), q10p (token-avoiding paraphrase). Searcher flagged recency as the next lever but correctly deferred it (regression risk on legitimately-old answers; lead adds: mtime is git-unreliable across machines - clone resets it). Decision to Jonah: recency factor / mark the stale naming chain per corpus protocol (truth fix that retires the trap) / accept 89.58% and proceed.

## JONAH RULING: corpus truth wins -> GATE PASSED 45/48 = 93.75% (2026-07-02)
Options presented (AskUserQuestion): fix corpus truth (recommended) / recency factor / accept 89.58%. **Jonah chose corpus truth.** Rationale: a decision beat asserting false current-truth ("final name is endow") with no supersession marker is a protocol violation that misleads ANY reader - the benchmark merely exposed real corpus debt; recency would have papered over it (and mtime is git-unreliable anyway).
Executed per the write-time link protocol, both ends synced: improv_to_offers rename -> superseded_by endow decision; endow decision -> superseded_by justify rename (+ supersedes offers, + description annotated); justify rename -> supersedes endow decision. q21's trap annotation RETIRED honestly in benchmark.json + README (the case now tests marked-supersession collapse; unmarked-stale coverage lives in search test fixtures + future parallel-run misses). This was ruled a truth repair, not an eval bend: the corpus change would be mandatory under the link protocol even if no benchmark existed.
**Measured result: validate green (75 marked-stale, hygiene clean), compile 865 beats + 865 vectors (qwen3-embedding:0.6b dim 1024), scorer 45/48 = 93.75% >= 0.90, exit 0. Both q21 queries flipped via supersession collapse. Residual misses (3, documented): q03[0/1] mode-all 2-hop pair, q10[1] token-avoiding paraphrase - real semantic frontier for parallel-run.**
Pending to close stage 3b: searcher's in-flight Codex round on the 3b diff -> lead certification round -> 3b code commit -> teardown.

## Lead cert round on 3b: FAIL with ONE mandatory fold (2026-07-02)
Searcher closed its own Codex gate (4 rounds, 9 folds, R4 clean; suites 41/41 + 26/26 lead-re-run green). My independent certification round then caught what those 4 rounds missed: degraded/lexical-only mode caps candidates at hits[:CAND_K] BEFORE supersession resolution/expansion, so the legacy 3a lexical path is not preserved exactly (broad queries, --top>100, heavy collapse inside the first 100 diverge). Codex reconfirmed everything else (RRF sign flip correct, cosine/decode sound, fail-soft cannot mask broken-db exit 4, anti-gaming holds). Mandatory fold dispatched to the searcher: full hits stream downstream when vectors unavailable, CAND_K only for hybrid RRF fusion, plus a degraded-mode parity fixture. Lesson the produce-and-verify triangle keeps proving: the producer's own review rounds and the lead's certification find DIFFERENT defects - neither substitutes for the other. Also relayed the 45/48 PASS state to the searcher (its report predated the ruling).

## STAGE 3 CLOSED: fold verified, re-certification PASS (2026-07-02)
Searcher folded the mandatory item exactly: degraded/lexical mode scores -bm25 over the FULL hits stream (consistent negation reproduces 3a ordering incl. the direct-vs-neighbor gap; single-list RRF rejected with reasoning in-code), CAND_K caps only the two RRF fusion inputs; 2 degraded-parity fixtures added. Lead-re-run: 43/43 + 26/26 green, validate OK, scorer 45/48 = 93.75% exit 0 (hybrid path untouched, as predicted). Lead Codex RE-CERTIFICATION: PASS, no mandatory items. Stage-3 final state: hybrid search (qwen3-embedding:0.6b via local ollama, RRF k=60, CAND_K=100) + benchmark scorer, gate PASSED. Ollama service form: switched from the executor's ad-hoc `ollama serve` to `brew services start ollama` (persists across reboots; endpoint verified v0.31.1; hybrid search verified live under the managed daemon - and it correctly emitted the loud STALE warning because beats had changed since the last compile). Searcher teammate torn down per the team rule after acceptance (shutdown_request approved, process exited, pane gone - verified). Stage-3 commits: 4b804747 (3a), 3593469d (hygiene), 71157133 (corpus-truth), e219b745 (3b hybrid). Not yet pushed. Next: stages 4 (rebuild-on-write) + 5 (session-start staleness guard) on Jonah's word.

## Files touched
- .claude/memory/session_2026-07-02_beats-stage3-search.md (this beat)
- .claude/memory/MEMORY.md (index pointer)
- beats/bench/validate.py (supersession hygiene: dangling/cycle = error)
- beats/bench/README.md (hygiene rule documented + q21 trap retirement)
- beats/bench/benchmark.json (q21 trap retirement annotation)
- .claude/memory/session_2026-05-26_improv_to_offers_rename.md (marked superseded)
- .claude/memory/decision_improv_renamed_to_endow.md (marked superseded, both-ends sync)
- .claude/memory/session_2026-05-29_endow_to_justify_rename.md (supersedes backlink)
