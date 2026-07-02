# Beats Recall Benchmark

Stage 1 of the beats next-evolution plan (see `.claude/memory/proposal_beats_next_evolution.md` and the execution bar in `.claude/memory/feedback_memory_first_zero_failure_execution.md`). This benchmark exists BEFORE any retrieval code so that the retrieval path is measured against hand-verified ground truth, never against its own claims.

## What it is

`benchmark.json` holds cold-session questions ("what did we decide about X?") hand-mapped to the beat files in `.claude/memory/` that answer them. Mappings were verified against each beat's frontmatter at authoring time (2026-07-02, collaborator Jonah Cohen) and cross-reviewed by Codex (verdict PASS-WITH-FIXES; all mandatory fixes folded, v2).

## Scoring

- **Unit is the query.** Every phrasing of a case - its `question` plus each entry in `paraphrases` - is scored as an independent query against the same answers/stale sets. Paraphrases avoid the rare filename tokens of their case (buzzword, lotus, tilt-lab, ...) so a filename/BM25 matcher cannot look semantically competent by token luck.
- **HIT (mode `any`, default):** at least one `answers` file in the top-5 results. The satisfaction rank is the best-ranked answer's rank.
- **HIT (mode `all`):** every `answers` file in the top-5. Used where the full truth spans complementary beats (q01, q02, q03, q05, q29); a partial answer is a wrong answer. The satisfaction rank is the WORST-ranked required answer's rank - complete truth is not present until the last required answer, so stale results anywhere above it fail the query.
- **Global stale rule:** a query is a MISS if any stale beat ranks strictly above the satisfaction rank. Stale beats are (a) the machine-derived set - every corpus beat with `superseded_by` frontmatter, emitted by `validate.py --stale-set`, which scorers MUST consume rather than re-derive - and (b) the case's `stale` entries, which trap UNMARKED stale beats when they exist (the original q21 endow trap was retired 2026-07-02 by the corpus-truth ruling; future unmarked-stale cases come from parallel-run misses).
- **Ties are forbidden**: scorers must produce a strict ranking (deterministic tiebreak, e.g. filename). Filenames compare after basename normalization.
- **Bar:** >= 90% of queries must be HITs.

## Seed benchmark, not a cutover license

Passing the bar here is NECESSARY but NOT SUFFICIENT to retire the read-everything startup protocol. Cutover additionally requires the parallel-run record: retrieval running alongside read-everything, every real-world miss added here as a new case, and zero unexplained misses over the parallel-run window. The genuinely held-out cases are exactly those parallel-run misses - questions no engine author has seen.

## Rules for evolving this benchmark

1. **Add, never bend.** If a retrieval run misses a case, fix the retrieval, not the case. A case may only be edited if its mapping is factually wrong (a beat was superseded after authoring), and the edit must be recorded in a session beat.
2. **Every parallel-run miss becomes a new case.** No exceptions - that is where held-out coverage comes from.
3. **Validate before commit.** `python3 validate.py` must exit 0. It checks schema and types, path safety, that every referenced beat exists, that no `answers` entry is itself superseded, that answers/stale sets do not overlap, that `mode: all` cases fit within top_n, that unmarked-stale traps are explicitly declared (`unmarked_stale_ok`), and it scans the ENTIRE corpus frontmatter (every beat must be readable; the marked-stale set is derived here, not in scorers). Supersession hygiene is enforced corpus-wide: a `superseded_by` pointing at a nonexistent beat, or a supersession cycle, is an ERROR - search resolves chains at query time and every chain must reach an existing, unmarked head.

## Files

- `benchmark.json` - the cases (32 cases, 48 scored queries).
- `validate.py` - fail-loud validator. Exit codes: 0 valid, 1 schema/mapping error, 2 corpus not found. Unreadable corpus beats and undeclared unmarked-stale entries are errors, not warnings. `--stale-set` prints the machine-derived marked-stale set (filename -> superseder) as JSON for scorers.
