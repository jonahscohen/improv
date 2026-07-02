---
name: Beats evolution STAGE 1 SHIPPED - recall benchmark + fail-loud validator
description: Stage 1 of the ratified beats-evolution plan - seed recall benchmark (32 cases / 48 queries incl. paraphrase anti-leakage + 4 supersession traps) + corpus-scanning fail-loud validator; 3 Codex rounds folded to PASS; codex binary breakage found and fixed en route
type: project
relates_to: [proposal_beats_next_evolution.md, feedback_memory_first_zero_failure_execution.md]
---

Collaborator: Jonah Cohen. 2026-07-02. Jonah ratified the beats-evolution plan ("go ahead, start stage 1").

## What shipped (beats/bench/)
- `benchmark.json` - 32 hand-mapped cold-session cases, 48 scored queries (16 paraphrases that avoid rare filename tokens so BM25 cannot fake semantic recall). 4 supersession traps: q03 buzzword v1, q05 tiny-text operating point, q26 tilt-lab per-day beats (marked), q21 endow-name decision beat (UNMARKED - deliberate; do not "fix" its frontmatter, the trap is the point). Modes: any/all per case; all = complete truth spans complementary beats (q01,q02,q03,q05,q29).
- Scoring contract: query unit, top-5, bar >=90%; satisfaction rank (worst-ranked required answer for mode all); global stale rule enforced from the machine-derived set (`validate.py --stale-set`, 72 marked-stale corpus beats); ties forbidden. SEED benchmark - necessary NOT sufficient for cutover; cutover additionally needs the parallel-run record (every miss becomes a case, zero unexplained misses).
- `validate.py` - fail-loud (exit 0/1/2, no silent success): schema+type checks, path safety, corpus-wide frontmatter scan (858 files, unreadable=error), answers-not-superseded, unmarked-stale must be declared per-case (`unmarked_stale_ok`), mode-all-fits-top_n.

## Why / How verified
- Why benchmark-first: per the zero-failure mandate, the benchmark is the trap that catches a lazy retrieval build; nothing after it ships until it exists.
- Validator proven on both paths: caught a REAL mapping error at authoring time (q05 - I had mapped the superseded tiny-text operating point as current truth off a stale index one-liner; the file frontmatter was the truth), and 7 synthetic negative probes (traversal, superseded-answer via block-list YAML, overlap, missing-file, unhashable id, bool version, mode-all overflow) all exit 1 with no traceback.
- Cross-model gate: 3 real Codex review rounds via codex-review.py. R1 PASS-WITH-FIXES (mode any/all, global stale rule, paraphrases, seed-not-cutover, YAML-tolerant parsing, unmarked-stale declaration, schema/path hardening, fail-loud reads) - all folded. R2 PASS-WITH-FIXES (satisfaction-rank stale cutoff for mode all, corpus-wide machine-enforced stale set, id/bool schema edges) - all folded. R3 PASS, no findings.

## Incident: codex binary broken, root-caused, fixed
First R1 attempt died in 6s (exit 5, loud - the tool refused to fake a verdict). Smoke failed in 0.3s: npm wrapper spawned a missing vendored native binary (ENOENT on @openai/codex-darwin-arm64/vendor/.../codex; healthy 2026-06-30, so drift between then and now - likely a partial update). Fix: `npm install -g @openai/codex` (Jonah confirmed "codex needed to update, and now is updated"); smoke healthy 7.8s after. The fallback ladder worked exactly as documented: loud failure -> probe -> repair -> real cross-model review (no silent downgrade at any point).

## Files touched
- beats/bench/benchmark.json (new)
- beats/bench/validate.py (new)
- beats/bench/README.md (new)
- .claude/memory/session_2026-07-02_beats-stage1-recall-benchmark.md (this beat)
- .claude/memory/MEMORY.md (index pointer)
