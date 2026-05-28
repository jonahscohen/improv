---
name: T-0005 multiple-choice over-fire fix
description: Three documented over-fires fixed in multiple-choice hooks; binary + fact-list patterns now pass; 29/29 tests green
type: project
relates_to: [feedback_multiple_choice_2026-05-26_discord_thread_failure.md, session_2026-05-26_peekaboo_parity_audit.md, session_2026-05-24_multiple_choice_third_failure_fix.md, session_2026-05-27_hook-sweep-team.md]
---

T-0005 closed. Jonah's hook-sweep team dispatched a teammate to fix three documented over-fire patterns in the multiple-choice enforcement hooks.

Changes (both `claude/hooks/multiple-choice-detect-stop.sh` and `claude/hooks/multiple-choice-enforce.sh` updated symmetrically):

1. **Precondition guard added**: `opt_count >= 3 AND (trailing_q == 1 OR trailing_deflection == 1)`. opt_count is now `max(option_count, bold_label_count)` since the two counters overlap on bold-labeled vocabulary lines. `bold_label_count >= 2` stays as an independent strong-signal override so the original "**Approach A/B/C**" Failure 2 catch is preserved.

2. **Tightened trailing_q detection**: now locates the line number of the last list-item (numbered, dashed, or bold-label) and takes a 250-char window from there to end-of-response. Requires `?` within that window, not anywhere in the response. Newlines are PRESERVED in the window so sentence extraction (via Python regex `[^.!?\n]*\?`) stops at line boundaries - the earlier bash `grep -oE` greedily concatenated bullet text with later questions and misidentified the opener.

3. **Binary question recognizer added**: `is_binary_question()` returns true for yes/no openers (should/shall/want/do/does/did/is/are/can/could/would/will/may/might/have/has/ok/okay/ready/sound/good/alright) and simple "X or Y?" forms (single `or`, zero commas). Pre-empted by multi-choice indicators ("one of the others/options/...", "which one/approach/...", "prefer/pick/choose/select a/one/...", "any of these/those", or `>=2 commas + or`) which force NOT binary. When the trailing question is binary, trailing_q stays 0.

4. **Interrogative-introducer override**: lines matching `^...(Would you (like|prefer)|You (can|could|...)|Want me to|Should I|Do you want|What.s your).*:\s*$` are treated as implicit trailing questions even without `?`. Preserves the historic Failure 1 catch (T3/T21 - "Would you like me to:" followed by numbered options).

Why: three live false-fires logged 2026-05-26 (Discord-thread routing binary, Peekaboo capabilities fact list, audit-findings fact list) plus one today (5-item fact list + "Want me to queue any?") were burning user turns on apologies. The precondition + binary-detector combination eliminates them without regressing the Sprint 1 catches.

How: tightened the fire-decision logic to require BOTH structural option signals AND a trailing-question signal, with binary questions explicitly downgraded. The strong bold-label heuristic stays as override because bold-labeled option paragraphs are a near-perfect deflection signal regardless of question shape.

Test results: 29/29 hooks tests pass (24 existing + 5 new T-0005 regression tests covering binary `X or Y?`, fact list with no trailing q, fact list with question >80 chars away, today's live false-fire `Want me to queue any?` after a 5-item list, and a positive control of 3 options + "Which one would you prefer?" which must still BLOCK). Verified via `bash claude/hooks/test-multiple-choice-enforce.sh`.

Files touched:
- claude/hooks/multiple-choice-detect-stop.sh (Stop event - actual fire site in production)
- claude/hooks/multiple-choice-enforce.sh (legacy PreResponse hook - exercised by tests, dormant in production)
- claude/hooks/test-multiple-choice-enforce.sh (5 new T-0005 cases added)
