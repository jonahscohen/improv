---
name: Beats parallel-run hardening - guard-injected search mandate + index eviction fix
description: Jonah-approved fixes for the two gaps the tiny-text self-audit exposed - the staleness guard now injects the parallel-run search mandate every fresh session (date-gated through 2026-07-16), and the saturated MEMORY.md index was repaired so new pointers survive the compactor
type: project
relates_to: [session_2026-07-02_beats-search-protocol-gap.md, session_2026-07-02_beats-stage4-5-hooks-implemented.md]
---

Collaborator: Jonah. 2026-07-02. Both fixes chosen by Jonah via AskUserQuestion after the tiny-text session self-audit (see relates_to).

## Unit 1: MEMORY.md index repair (eviction gap)
- Problem: the live index was budget-saturated (22,952/23,000 bytes) by standing entries + cap-exempt pinned "** ACTIVE" lines, so compact-memory.py evicted every newly added project pointer on the next write - all three of today's session-beat pointers had landed in MEMORY-archive.md within minutes of being written.
- Fix (Jonah chose "unpin stale ACTIVE lines" over changing compactor policy):
  - Archived the two stale IN FLIGHT pins (stage 3, stages 4+5 - both completed, superseded by their IMPLEMENTED beats) and marked the supersession in frontmatter BOTH ways (superseded_by on IN FLIGHT, supersedes on IMPLEMENTED). Why both ways: query-time supersession resolution only treats a beat as historical when the chain is marked; unmarked-stale is the q21 trap.
  - Hand-trimmed the two most bloated pinned lines (stage 4+5 IMPLEMENTED ~1,090 bytes -> ~510; stage 3b ~1,690 -> ~530) to conform to the one-line-pointer rule; full detail lives in the beat files.
  - Restored today's three evicted pointers to the live index (shortened) and removed their archive copies.
- Verified: MEMORY.md now 21,646 bytes (~1,350 headroom); manual compact-memory.py run = "already under budget, no change" (no re-eviction); search "stages 4 and 5 rebuild hook staleness guard" returns the IMPLEMENTED beat rank 1 with the IN FLIGHT beat resolved away; benchmark scorer re-run holds 45/48 (93.75%) exit 0.

## Unit 2: guard-injected parallel-run search mandate (behavioral gap)
- Problem: the parallel-run protocol (sessions ALSO run beats.py search on recall questions; misses become benchmark cases) lived only in beats a fresh session may never load - proven live when the tiny-text recall question was answered by grep with search never fired.
- Fix (Jonah chose "extend staleness guard" over amending CLAUDE.md early): beats-staleness-guard.sh fresh path (verify exit 0) now emits a one-line additionalContext mandate when today <= BEATS_PARALLEL_RUN_END (default 2026-07-16, env-overridable), silent past the date. Auto-expires; the cutover commit removes it with the CLAUDE.md flip. Lexicographic YYYY-MM-DD compare; malformed end date errs toward reminding; exit-0 contract untouched.
- Tests: suite extended to 21 checks - top-level BEATS_PARALLEL_RUN_END=1970-01-01 pins existing fresh-silent cases to post-cutover behavior; new case 5b asserts the in-window mandate is valid additionalContext JSON containing "beats.py search".
- Verified: test-beats-hooks.sh 21 passed 0 failed; manual guard runs - in-window emits the mandate, past-window emits {}, default (today) emits the 2026-07-16 mandate the next session will see. Codex cross-model review via codex-review.py: CLEAN (92s, real verdict; date-compare, set -u safety, JSON escaping, exit-0 contract all checked).

## Self-analysis carried from the audit
The behavioral gap existed because the retrieval layer shipped without a mechanical surface for its own protocol - diligence-dependent adoption, the exact thing the zero-failure mandate forbids. The mechanical injection closes it the way the mandate prescribes: the harness reminds, not the model's memory.

Files touched:
- .claude/memory/MEMORY.md (unpin/trim/restore) + MEMORY-archive.md (swap)
- .claude/memory/session_2026-07-02_beats-stage4-5-hooks.md, session_2026-07-02_beats-stage3-search.md (superseded_by)
- .claude/memory/session_2026-07-02_beats-stage4-5-hooks-implemented.md, session_2026-07-02_beats-stage3-search-impl.md (supersedes)
- .claude/memory/session_2026-07-02_beats-search-protocol-gap.md (resolution note)
- claude/hooks/beats-staleness-guard.sh (parallel-run mandate)
- beats/_tests/test-beats-hooks.sh (case 5b + default window pin)
