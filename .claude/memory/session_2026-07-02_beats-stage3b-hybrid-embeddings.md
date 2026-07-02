---
name: Beats evolution STAGE 3b - local-embeddings hybrid (ollama + RRF)
description: qwen3-embedding:0.6b via local ollama + RRF hybrid over lexical+vector; lifts recall 79.2% -> 93.75% (45/48, GATE PASSED) after Jonah's q21 corpus-truth ruling; residual misses q03x2 + q10p are the documented semantic frontier; includes the cert-mandated degraded-mode full-stream fold
type: project
relates_to: [session_2026-07-02_beats-stage3-search-impl.md, feedback_memory_first_zero_failure_execution.md]
---

Stage 3b of the beats evolution (collaborator: Jonah Cohen). Jonah chose LOCAL EMBEDDINGS to close the 79.2% -> 90% gap left by stage-3a lexical retrieval. Built on committed 3a (4b804747).

## Embedder pick: qwen3-embedding:0.6b (via local ollama)

**Choice made:** qwen3-embedding:0.6b, dim 1024, served by a local ollama daemon; all embedding calls go through ollama's HTTP `/api/embeddings` using stdlib `urllib` only (beats.py stays pip-free - no torch/numpy, which matters on this bare python-3.14 machine where torch wheels are a trap).

**Alternatives evaluated (per the bleeding-edge rule + Jonah's directive):**
- **qwen3-embedding:0.6b** (chosen): newest strong small embedding model ollama serves; probe cosine 0.72 (related) vs 0.43 (unrelated); hybrid scorecard 43/48.
- **embeddinggemma** (dim 768): pulled and fully re-scored -> 41/48, worse than qwen3. Rejected.
- **nomic-embed-text**: the directed fallback, not needed - qwen3 did not misbehave.

**Why:** best honest benchmark result of the two bleeding-edge models, small (639 MB) and fast (~180 ms/embed), one-time offline download, zero per-query API cost.

## Architecture

- **Embedder** (`embed_text`): urllib POST to ollama; FAIL-SOFT (any transport/HTTP/parse error -> None). Uniform embedded text = `name + "\n" + description + "\n" + body` truncated to a global 4000-char cap. Unit-L2-normalized so cosine == dot product. A deterministic `_stub_embed` (hashed bag-of-tokens unit vector) is gated by `BEATS_EMBED_STUB` (documented test-only, like `--inject-parity-fault`) so suites run without ollama.
- **Compile**: embeds every beat into a new `beats_vec(filename, dim, vec BLOB)` table (float32 `struct` pack); `meta` gains `embed_model`, `embed_dim`, `vectors_present`; `TOOL_VERSION` bumped to 2. Vectors are all-or-nothing (self_verify enforces vec-count == beats-count, exit 5). FAIL-SOFT: embedder down at compile -> still exit 0 lexical-only with a single loud `VECTORS ABSENT: ...` line and `vectors_present=0`. Atomic temp-then-replace unchanged.
- **Verify**: a desynced/emptied `beats_vec` when `vectors_present=1` is a broken artifact (exit 4), same posture as the beats_fts count check.
- **Search (hybrid)**: query embedded via the same endpoint; cosine brute-force over the stored unit vectors in pure python (`struct`+`zip`, ~864x1024 = ~0.9M mults, ~0.1s); Reciprocal Rank Fusion (RRF_K=60) over the lexical top-CAND_K and vector top-CAND_K lists (CAND_K=100), THEN the existing pipeline unchanged: supersession resolution, index-file exclusion, bidirectional graph expansion, top-N. The whole pipeline was flipped from bm25 (lower=better) to fused RRF scores (higher=better); lexical-only mode is single-list RRF, monotonic in lexical rank, so the lexical ordering (and the 38/48 baseline) is preserved EXACTLY. FAIL-SOFT: no vectors in the db OR embedder unreachable -> loud one-line warning + lexical-only results, exit 0 (distinct from broken-db exit 4).
- **Scorer**: reports `MODE: hybrid` vs `lexical-only`/`DEGRADED`; the 90% gate is only meaningful in hybrid mode.

## HONEST SCORECARD

- **Lexical-only (3a / fail-soft): 38/48 = 79.2%.** **Hybrid (3b): 43/48 = 89.58%.** +10.4 points from vectors, but ONE query under the 0.90 bar (44/48 = 91.7% needed; 43/48 = 0.8958 < 0.90 -> scorer exit 1).
- Latency: compile ~155 s one-time (864 embeds); per query ~0.3 s (embed + cosine); full 48-query scorer 11.8 s.
- Vectors recovered q02, q24p, q26p, q29, q31 and regressed nothing net except a wash on q01 (a mode-all that traded). The **5 remaining misses**:
  - **q21 x2 (naming, the unmarked-stale TRAP)**: semantic similarity makes this WORSE - it pulls the old "endow" naming beats (the trap) above the "justify" answer. q21[0] gets the answer to rank 5 but the trap `decision_improv_renamed_to_endow` sits at rank 2 (stale-above-satisfaction -> MISS); q21[1] misses outright. This is the benchmark's deliberate adversarial case working as designed.
  - **q03 x2 (buzzword, mode-all)**: needs v2-rebuild AND v3-precision-plan in top-5; v3-plan is 2 hops from v2-rebuild and semantically distant from "current state", stays buried.
  - **q10p (codex-review paraphrase)**: the reference beat loses to more verbose codex-review session beats.
- Global knob sweeps (RRF_K 10-100, CAND_K 20-300, EXPAND_DAMPING 0.5-0.9, FTS weights) all PLATEAU at 43/48; CAND_K=100 is the honest best (deeper plateaus). No per-case logic anywhere.

**Per the lead's terminal instruction ("if hybrid still lands under 90%: STOP and report") and the anti-gaming mandate, I STOP at 89.58%.** I did not game to cross the bar. The one missing query is dominated by the intentional q21 trap (2 of the 5 misses) - a case designed to punish retrieval that surfaces unmarked-stale beats, which semantic retrieval does even harder. The obvious next principled lever the lead could greenlight is a GLOBAL RECENCY factor (newer beat = more likely current truth; mtime is already in the db) - it directly targets the q21 chain (the justify answer is newer than the endow trap) - but it risks demoting legitimately-old answers (q31), so it needs its own measured pass and is a lead/Jonah design call, not an executor improvisation.

## GATE PASSED (45/48 = 93.75%) after Jonah's corpus-truth ruling

The 89.58% (43/48) operating point was ONE query under the bar, dominated by the q21 unmarked-stale trap (my analysis: semantic retrieval makes q21 WORSE, pulling the old "endow" naming beats above the "justify" answer). Jonah ruled this a CORPUS-TRUTH problem, not a retrieval one, and marked the improv/offers/endow naming chain `superseded_by` per protocol (committed 71157133; validator hygiene enforced in 3593469d). With the chain properly marked stale, my hybrid engine's supersession resolution collapses the endow beats to the justify head and the machine-stale set excludes them from ranking above the answer. Re-scored on the updated 865-beat corpus: **45/48 = 93.75% >= 0.90 bar, scorer exit 0 - GATE PASSED.** Residual misses: q03 x2 (mode-all, 2-hop v3-plan) + q10p (token-avoiding paraphrase) - the documented semantic frontier. No recency factor needed (Jonah's ruling addressed the q21 blocker my recency idea targeted).

## Lead certification fold - degraded-mode full-stream parity (mandatory)

Lead cert reconfirmed the 3b engine (RRF sign flip correct, cosine/decode sound, fail-soft cannot mask broken, anti-gaming holds) but FAILED on ONE item: in lexical-only/degraded mode the candidate stream was capped to `hits[:CAND_K]` BEFORE supersession resolution + expansion, so the legacy stage-3a lexical path was NOT preserved exactly (broad queries, `--top > CAND_K`, or heavy supersession collapse inside the first CAND_K could diverge/starve the page).

**Fix (two-layer, both from the Codex confirmation rounds):**
1. Compute the vector side FIRST (it sets `mode`), so the lexical candidate depth can depend on mode. The CAND_K cap now applies ONLY in hybrid mode; lexical-only/degraded uses the FULL hits stream. This kills the starvation: a page whose first CAND_K hits collapse under supersession would return a single result under the old cap; the full stream fills it.
2. The first-cut used single-list RRF `1/(RRF_K + rank)` in lexical-only mode, which preserves direct-hit ORDER but NOT the direct-hit-vs-damped-neighbor gap (3a blended expansion neighbors off raw bm25, not rank). Codex flagged this as a real expansion-parity regression. Final fix: lexical-only/degraded scores candidates as **`score = -bm25` over the full stream** (no RRF). Under the higher-is-better pipeline (max-per-head, `blended = score*EXPAND_DAMPING`, descending sort), `-bm25` is a CONSISTENT NEGATION of 3a's entire bm25-ascending pipeline, so direct hits AND damped expansion neighbors reproduce 3a's ordering exactly. Hybrid path (RRF over CAND_K-capped lexical+vector) is untouched; scorer stays 45/48.

**Regression (caseP1):** compiles a >CAND_K collapse fixture (120 stale -> 1 head, 30 distinct filler heads beyond CAND_K, with a relates_to chain so EXPANSION participates) using the ACTUAL committed stage-3a beats.py (4b804747), and asserts my degraded-mode output matches it byte-for-byte; plus a guard proving the old cap would have starved that page to <=1 head. Confirmed 3a (4b804747) has expansion+bigrams but no RRF, so the negation-parity claim is exact.

## Files touched

- `beats/beats.py` - embedder (embed_text/_stub_embed/_l2_normalize/build_embed_text/cosine_unit) + constants (OLLAMA_URL, EMBED_MODEL, EMBED_TEXT_CHARS, STUB_EMBED_DIM, RRF_K, CAND_K); compile embeds + beats_vec + meta cols + parity; verify vec-parity; hybrid RRF cmd_search; TOOL_VERSION=2.
- `beats/bench/score.py` - per-run MODE reporting (hybrid/lexical/degraded).
- `beats/_tests/test-beats-search.sh` - stub-embedder wiring; hybrid-active, fail-soft (unreachable embedder + vectorless db), vec-parity, and gated real-model smoke cases (35 checks).
- `beats/_tests/test-beats-compile.sh` - stub wiring + vector-parity assertion (26 checks).

## Verification

test-beats-search.sh 44/44 (hybrid-active, every fail-soft path, vec-parity/filename/corrupt/dim-mismatch/malformed-embed_dim/old-schema, degraded-mode 3a parity caseP1+caseP2, gated real-model smoke at dim 1024), test-beats-compile.sh 26/26, validate.py exit 0. Final hybrid scorecard 45/48 = 93.75% (exit 0, gate passed). Not committed (orchestrator handles git). Codex rounds recorded below.

## Codex rounds

- **Round 1** (full 3b diff, real gpt-5.5): no sign-convention bug in the RRF flip; 4 findings, ALL FOLDED - (F1 High) an old stage-3a db (no vectors_present column) made the meta SELECT raise -> exit 4 instead of degrading; now read defensively (try/except OperationalError) so both search and verify treat a schema-old db as no-vectors -> lexical-only. (F2 High) query/index embedding-dim mismatch gave cosine 0.0 for all rows yet still fused as "hybrid"; now compares len(qvec) to meta.embed_dim and falls back loudly. (F3 High) vector parity was row-count only; now self_verify checks the beats_vec FILENAME SET == beats plus dim==embed_dim and blob length==dim*4, verify checks the filename set, and search skips vector rows whose filename is not a real beat. (F4 Medium) a malformed blob was silently skipped; now a struct.unpack failure abandons the whole vector side loudly (VECTORS ABSENT: corrupt stored vector). Test coverage added: filename-set parity, corrupt-blob fallback, dim-mismatch fallback, old-schema fail-soft (search suite now 38 checks, all green).
- **Round 2** (confirmation): reconfirmed the 4 round-1 folds; found 2 more fail-soft edge cases, both folded - (High) `int(vp_row[1])` on a malformed/NULL embed_dim crashed search (exit 1) instead of degrading, and a NULL/0 dim skipped the mismatch guard; now the int cast is guarded (except TypeError/ValueError) and the hybrid path requires index_dim > 0, else lexical-only. (Medium) the corrupt-blob fallback only caught struct.error; a NULL/TEXT vec BLOB raises TypeError; now caught too. Tests added (caseH8 malformed embed_dim, caseH9 NULL blob); search suite 40 checks, all green.
- **Round 3** (confirmation): 3 deeper malformed-db findings, all folded - (High) `int(embed_dim)` coerced REAL/TEXT values and could OverflowError on inf; now requires a STRICT positive int (no coercion) to enable the hybrid path. (High) per-row `beats_vec.dim` was trusted at unpack; a dim=1/4-byte row unpacked "fine" and polluted the ranking silently; now every row must have `dim == index_dim` and `len(blob) == index_dim*4`, else abandon the vector side loudly. (Medium) `embed_text` assumed dict JSON; `[]`/`null` raised AttributeError; now guarded with `isinstance(payload, dict)`. Tests added (caseH9 row-dim-mismatch); search suite 41 checks, all green.
- **Round 4** (confirmation): **CLEAN** - no remaining issues. Explicitly reconfirmed the three round-3 folds (strict-int embed_dim, per-row dim/blob validation, embed_text dict guard) and that all prior 3b behavior holds (vectorless/malformed degrade loudly to lexical-only, filename-set desync is a broken artifact, dim mismatch falls back, scorer mode keys off VECTORS ABSENT). 3b Codex gate CLOSED after 4 rounds (9 findings folded total, no sign-convention bug).
- **Fold round** (post lead-cert, degraded-mode parity fold, 2 Codex passes): pass 1 confirmed the candidate-cap fix but flagged (High) that lexical-only EXPANSION still blended damped neighbors off rank-based RRF instead of raw bm25, so expansion could reorder vs 3a; folded by scoring lexical-only as `-bm25` over the full stream (consistent negation of 3a's whole pipeline). Pass 2: **CLEAN for the implementation** - verified the degraded path is order-isomorphic to 3a (bm25-asc/keep-min/expand*0.5/asc-sort == -bm25/keep-max/expand*0.5/desc-sort) for direct hits AND expansion neighbors AND tiebreaks; hybrid untouched. Two non-blocking test caveats folded: caseP1 wording corrected to "filename order" (scores are legitimately sign-flipped), and caseP2 added - a neighbor that is NOT a direct hit reaches the page ONLY via expansion and matches 3a exactly, genuinely proving expansion parity. Search suite 44 checks, all green; scorer stays 45/48.
