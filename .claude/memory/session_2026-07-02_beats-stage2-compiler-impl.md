---
name: Beats evolution STAGE 2 - compiler IMPLEMENTED (beats.py + tests + gitignore)
description: opus-executor delivered beats/beats.py (compile/verify, stdlib-only, FTS5 probe, atomic db swap, in-compile parity self-verify, exit contract 0/2/3/4/5/6), the regression test (14 cases / 25 checks), and beats/.gitignore; all checks green, real-corpus smoke file_count=861; Codex cross-model gate PASSED after 5 rounds (every finding folded)
type: project
relates_to: [session_2026-07-02_beats-stage2-compiler.md, session_2026-07-02_beats-stage1-recall-benchmark.md]
supersedes: session_2026-07-02_beats-stage2-compiler.md
---

Collaborator: Jonah Cohen. 2026-07-02. Executor delivery of the stage-2 spec dispatched in [[session_2026-07-02_beats-stage2-compiler]].

## What was built
- `beats/beats.py` (executable, python3 stdlib-only, single self-contained file, style modeled on `claude/hooks/codex-review.py`): `compile` and `verify` subcommands.
  - Corpus default `<repo-root>/.claude/memory`, build default `<beats-dir>/.build`; both overridable via `--corpus`/`--build`.
  - pyyaml-free line-based frontmatter parser: handles scalar, inline-list `[a, b]`, block-list `- a`, and empty (`key:`, `key: []`, `key: ~`, `key: null`) forms; strips surrounding quotes; unknown keys preserved verbatim in `extra` (raw strings, no list parsing).
  - Reads utf-8-sig strict, normalizes CRLF->LF; no-frontmatter files still indexed and counted; unreadable/undecodable files are a hard exit 3 listing every offender.
  - Emits `beats.jsonl` (one sorted object/file, full field set + sha256 of raw bytes, mtime, size, is_stale) and `beats.db` (table `beats` PK filename; FTS5 `beats_fts` porter/unicode61; `meta` row with corpus_hash/compiled_at/file_count/tool_version).
  - FTS5 probed FIRST via throwaway in-memory table -> exit 4 if absent. DB written to a temp path, integrity-checked, then `os.replace`d over the old db (atomic).
  - Mandatory in-compile self-verification against the written artifacts: (a) count parity disk==jsonl==beats==beats_fts, (b) content parity re-sha256 every file vs stored db AND jsonl values, (c) FTS spot query for a real body term >=1 row. Any failure deletes the temps and exits 5 (never installs bad artifacts).
  - `verify`: recompute corpus_hash from disk vs `meta.corpus_hash`; exit 0 fresh, exit 6 stale (prints added/removed/changed counts + names), exit 4 if db missing/malformed, exit 2 if corpus dir missing.
  - Exit contract, class name on stderr: 0 success / 2 corpus missing / 3 undecodable / 4 db-or-FTS5 broken / 5 parity fault / 6 stale. Single success summary line only on full pass.
- `beats/_tests/test-beats-compile.sh` (executable bash): 7 cases, PASS/FAIL per check, non-zero exit on any fail. Fixture corpus built in temp dirs; real corpus only ever read. Covers happy path (jsonl/rows/one-stale/verify-fresh), corpus-missing (2), undecodable-with-named-file (3), stale add+modify (6), injected parity fault (5, via hidden `--inject-parity-fault`), real-corpus read-only smoke (0, file_count>=800), and FTS MATCH smoke.
- `beats/.gitignore`: `.build/` so derived artifacts never commit.

Why: the markdown corpus stays the source of truth; the compiler produces regenerable, gitignored derived indexes for a future retrieval path, with fail-loud gates so a broken/stale build can never masquerade as good.

## Verification (all run, real output observed)
- `python3 beats/beats.py --help` exit 0; hidden `--inject-parity-fault` correctly absent from help.
- `bash beats/_tests/test-beats-compile.sh`: 15 passed, 0 failed, script exit 0.
- Real-corpus smoke line: `SMOKE: real-corpus file_count=860` (>= 800 bar met), compile exit 0.
- Extra external probes beyond the suite: verify-with-db-removed and verify-with-malformed-db both exit 4; jsonl inspection confirmed scalar superseded_by -> is_stale=True, `~`/`[]`/empty -> unset, inline+block relates_to -> arrays, unknown `custom_field` -> `extra`, no-frontmatter file indexed+counted. Exit codes 0/2/3/4/5/6 all observed.

## Codex cross-model gate (producer=Opus, reviewer=Codex, via claude/hooks/codex-review.py)
5 real-Codex rounds, all exit 0 (genuine cross-model, not same-model fallback). Every finding folded or explicitly declined with a spec-grounded reason; final round clean.
- R1 (High/Med): folded (H1) verify could pass on a malformed db, and (M4) self-verify never validated the meta row; added exit-4 tests and an artifact-survival test. Declined as out-of-spec: supersedes/superseded_by-as-list (spec types them scalar; matches validate.py), inline-list full-YAML comma handling (spec = tolerant, filenames have no commas), verify full decode-for-exit-3 (verify is the fast staleness guard), two-file joint atomicity (spec scopes atomicity to the db; db installed last so a half-install shows as stale not silent-success), non-empty-corpus guard (spec supports flat corpus).
- R2 High: verify probed beats_fts existence but not row-count parity -> added beats_fts==beats count check + case 12 (emptied beats_fts -> 4).
- R3 High: both tables emptied with meta intact slipped the 0==0 check -> added beats-rows==meta.file_count internal-consistency check + case 13.
- R4 High: meta.file_count forged to 0 to match emptied tables -> in the hash-match branch, require meta.file_count==on-disk count (a corpus_hash is derived from exactly that many files; mismatch is a tampered/malformed meta) + case 14.
- R5: clean - no remaining in-scope high/medium bug or regression. Malformed/desynced db -> 4, hash mismatch -> stale 6, per-file content re-parity stays compile's exit-5 job (out of verify scope).

The layered verify malformed-detection (integrity_check, beats_fts existence, beats_fts==beats, beats==meta.file_count, meta.file_count==disk-count) is the fixpoint: any further "verify fresh with broken retrieval" attack needs per-file content parity, which the spec deliberately assigns to compile, not verify.

**Decision - where the compile/verify responsibility boundary sits.** verify does cheap structural + meta-consistency checks and hash comparison only; it never re-parses per-file body/sha content. Why: verify is the session-start staleness guard and must stay fast; deep content parity is compile's mandatory self-verification (exit 5). Alternatives rejected: (a) making verify re-run full parity - too slow for a startup hook and duplicates compile; (b) leaving verify hash-only - lets a structurally broken db report fresh. Revisit when: verify stops being the hot session-start path, or a broken-db class emerges that structural checks cannot catch.

## Verification commands run (real output observed)
- `python3 beats/beats.py --help` -> exit 0 (hidden --inject-parity-fault absent from help).
- `bash beats/_tests/test-beats-compile.sh` -> `25 passed, 0 failed`, exit 0.
- Real-corpus smoke line: `SMOKE: real-corpus file_count=861` (>= 800 bar), compile exit 0.
- Focused probe: meta-parity self-check fires on a wrong meta.corpus_hash and is clean on a good build (no false positive).
- gitignore: `git check-ignore beats/.build/beats.db` confirms the build dir is ignored.

## Files touched
- beats/beats.py (new)
- beats/_tests/test-beats-compile.sh (new)
- beats/.gitignore (new)
- .claude/memory/session_2026-07-02_beats-stage2-compiler-impl.md (this beat)
- .claude/memory/MEMORY.md (index pointer)
