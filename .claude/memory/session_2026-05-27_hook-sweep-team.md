---
name: hook-sweep team (2026-05-27)
description: Team-lead log for the hook-sweep cmux-teams dispatch closing T-0002 through T-0005
type: project
relates_to: [session_2026-05-27_agent-teams-guard-hook.md, session_2026-05-27_second-fix-gate-global-memory-exempt.md]
---

Collaborator: Jonah

First real use of the agent-teams-guard hook: dispatched 4 named teammates into team `hook-sweep`, each owning one TASKS.md item. Each got its own cmux split.

## Teammate assignments

- `t2-subagent-scope` -> T-0002 (memory-nudge + verify-before-done subagent awareness)
- `t3-eval-gate` -> T-0003 (bash-guard cmux-eval HEREDOC false-block)
- `t4-exempt-paths` -> T-0004 (second-fix-gate global memory exempt)
- `t5-multiple-choice` -> T-0005 (multiple-choice-enforce over-fire patterns)

## Closures verified by team-lead

### T-0002 (closed)

Teammate chose approach (a) from the task body but landed on a *third* signal neither (a) nor (b) anticipated: the transcript JSONL file itself carries the markers.

- Agent-tool sidechains: every non-config record has `isSidechain: true`
- cmux-teams teammates: records carry `teamName` and `agentName` fields
- Parent sessions have neither

Added identical `is_subagent_context(transcript_path)` helper to both hooks. Reads first ~20 lines of the transcript and returns True on either signal. OR-combined into the existing `recently_satisfied()` / `recently_verified()` short-circuits at 4 sites total. Importantly: only suppresses the `additionalContext` nudge text - the `.memory-dirty` / `.needs-verification` flag-setting still happens so subagent writes still arm the parent's commit/verify gates. Verified with a 3x2 matrix.

Files: claude/hooks/memory-nudge.sh, claude/hooks/verify-before-done.sh.

### T-0003 (closed)

Teammate went idle without sending a SendMessage first - had to ping for status. Discovery: 154 lines added to bash-guard.sh visible in git diff, so the work was done, just unreported. After the ping, teammate replied with the full report.

Approach (a): slice out the real cmux-eval invocation BEFORE running the inner blocklist. Two-stage Python in the cmux-eval block:
1. Strip HEREDOC bodies (tracked via `<<` / `<<-` / quoted-delimiter parsing) since heredoc text is data passed to another tool, not executed JS.
2. Scan for `cmux` at a real shell command-start position (start-of-input or after `;&|()\n{}`, whitespace-tolerant) and walk forward quote-aware (single+double quotes, with backslash-escape inside `"`) until an UNQUOTED `;`, `&`, `|`, or newline, requiring an `eval` token along the way.

All 17 inner pattern checks now grep against `$CMUX_EVAL_SLICE` instead of `$CMD`. Added 5 T-0003 test cases to `claude/hooks/test-validation-guards.sh` (HEREDOC body, flat quoted prose, printf with prose, real cmux eval after `&&`, real cmux eval inside subshell). Full suite ran clean: 51/51 PASS (was 46/46 baseline; +5 = new T-0003 cases). Verified by team-lead running the suite.

Files: claude/hooks/bash-guard.sh (cmux-eval block replaced at lines ~88-180), claude/hooks/test-validation-guards.sh.

### T-0005 (closed)

Teammate updated BOTH `multiple-choice-detect-stop.sh` (production Stop-event fire site) and `multiple-choice-enforce.sh` (dormant PreResponse hook still exercised by tests). Five-part fix:

1. Precondition guard: `opt_count >= 3 AND (trailing_q == 1 OR trailing_deflection == 1)` where opt_count = max(option_count, bold_label_count).
2. bold_label_count >= 2 retained as an independent override so the original 2026-05-24 third-failure catch on bold-labeled Approach A/B/C still fires.
3. `is_binary_question()` helper for yes/no openers (should/want/do/does/can/would/ready/sound) and "X or Y?" forms. Pre-empted by multi-choice indicators ("one of the others", "which one", "prefer/pick/choose a/one", "any of these", `>=2 commas + or`).
4. trailing_q now scoped to a 250-char window after the last list-item line, extracted via Python regex `[^.!?\n]*\?` with newlines preserved so a bullet's text can't concatenate with a later question.
5. Interrogative-introducer override preserved for "Would you like me to:" / "You can:" implicit questions.

Added 5 test cases (T-0005a binary, T-0005b 5-fact list no q, T-0005c list with question >80 chars away, T-0005d today's live false-fire 5 facts + "Want me to queue any?", T-0005e positive control 3 options + "Which one would you prefer?"). Suite: 29/29 PASS (24 existing + 5 new), verified by team-lead running `bash claude/hooks/test-multiple-choice-enforce.sh`. Teammate wrote own memory file at `session_2026-05-27_t0005_multiple_choice_overfire_fix.md` and indexed in MEMORY.md.

Files: claude/hooks/multiple-choice-detect-stop.sh, claude/hooks/multiple-choice-enforce.sh, claude/hooks/test-multiple-choice-enforce.sh.

### T-0004 (closed earlier in session)

Approach (b): regex `\.claude/projects/[^/]+/memory/` OR-combined with the existing substring EXEMPT list. Documented separately in session_2026-05-27_second-fix-gate-global-memory-exempt.md.

Side-observation surfaced T-0006 (P3): EXEMPT looks for `.claude/hooks/` but dotfiles source path is `claude/hooks/` (no leading dot), so source-tree hook edits trip the gate.

## Outstanding

All four teammates closed and verified. Team-lead pending: send shutdown_request to all four, then TeamDelete.

## Process observation

The agent-teams-guard hook worked as intended on first real use - dispatching 4 visible splits felt qualitatively different from dispatching 5 in-process subagents earlier in the session. Each teammate's progress is visible in its own pane; idle notifications arrive as the work completes. The TaskList integration is still unused (each teammate got its instructions via prompt text), but that's a refinement for next time, not a flaw of this run.

Second-fix-gate self-fired on consecutive TASKS.md edits during this update (close T-0002 + reshape Done section). Coherent task split across two edits - the gate doesn't know that. Not bothering with the suppress flag for this one-off but noting it as a friction point.
