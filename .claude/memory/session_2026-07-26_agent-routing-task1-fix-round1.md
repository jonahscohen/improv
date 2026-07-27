---
name: Agent routing Task 1 - fix round 1 (review findings)
description: Fixed two review findings on the Task 1 agent roster - sonnet-impl.md had a bogus "tools: All tools" value (should omit the key to grant all tools), and assert_agent_tools leaked a raw awk error on a missing file. Added a locking negative assertion (assert_agent_no_tools) so the bogus-value bug cannot silently regress.
type: project
relates_to: [session_2026-07-26_agent-routing-task1-roster.md]
author_human: Jonah
author_model: claude-opus-4-5
source: session
verified: tests - bash claude/hooks/test-route-intent.sh 6/6 passing; missing-file case manually verified to produce a clean labeled FAIL with no stray awk output
confidence: high
---

# Agent routing Task 1 - fix round 1

Collaborator: Jonah. Review of Task 1 (agent roster) came back with two
Important findings, both defects transcribed faithfully from the plan text
rather than execution errors.

## What changed

- `claude/agents/sonnet-impl.md`: removed the `tools: All tools` frontmatter
  line entirely. "All tools" is what the harness displays for an ABSENT
  `tools:` key, not a valid value to write - as written it was very likely
  parsed as two bogus tool names, leaving sonnet-impl with no working tools.
  `opus-executor.md`, the known-working all-tools agent, omits the key
  entirely; sonnet-impl now matches that pattern. Nothing else in the file
  changed.
- `claude/hooks/test-route-intent.sh`: added the same file-existence guard
  `assert_agent_model` already has to `assert_agent_tools`, so a missing file
  produces a clean labeled FAIL instead of leaking a raw
  `awk: can't open file ...` line. Added a new helper `assert_agent_no_tools`
  (asserts the frontmatter has NO `tools:` key) plus two assertions
  (sonnet-impl, opus-executor) so the bogus-tools-value defect is now
  regression-locked - nothing in the original suite would have caught it.

## Verification

`bash claude/hooks/test-route-intent.sh` -> 6 passed, 0 failed, pristine
output (was 4/4 before this round).

Manually renamed `claude/agents/sonnet-impl.md` out of the way and re-ran the
suite: both `sonnet-impl is sonnet` and `sonnet-impl grants all tools via
omitted key` failed with clean labeled messages
("missing .../sonnet-impl.md"), no raw awk error line - confirms the new
guard works before restoring the file.

## Why this happened (self-analysis)

The original Task 1 brief specified `tools: All tools` verbatim in its given
file content, and my mandate was to transcribe the brief's exact values
character-for-character - which I did, verified via diff. The defect was in
the plan text itself, not introduced by deviation. The gap: I verified
byte-for-byte fidelity to the brief but did not independently sanity-check
the brief's own claims against how the harness actually parses agent
frontmatter (i.e., cross-referencing real working agent definitions like
opus-executor, which omits the key). Faithful transcription is not the same
as correctness review - a future task should treat "matches the brief" and
"is actually correct in the runtime" as two separate checks, not one.

## Files touched
- `claude/agents/sonnet-impl.md` (modified - removed `tools:` line)
- `claude/hooks/test-route-intent.sh` (modified - added file guard + new
  helper + 2 assertions)
- `.claude/memory/session_2026-07-26_agent-routing-task1-fix-round1.md` (this beat)
- `.claude/memory/MEMORY.md` (index pointer)
