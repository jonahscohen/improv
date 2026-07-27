---
name: Task 1 fix round 1 landed and verified (toolless tier fixed, guard added)
description: Commit 32410432 dropped the tools key from sonnet-impl, added assert_agent_no_tools plus the missing file guard. Suite 6/6 pristine; guard behavior proven by deleting the file and observing a clean labeled FAIL with no awk leak.
type: project
relates_to: [session_2026-07-26_agent-routing-task1-review.md, session_2026-07-26_agent-tools-frontmatter-rule.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: controller ran the suite (6/6 pristine) and negative-tested the guard by moving sonnet-impl.md aside - clean labeled FAIL, zero awk output, file restored
confidence: high
---

# Task 1 fix round 1

Collaborator: Jonah. Commit `32410432`, branch `agent-routing`.

## What changed

1. `claude/agents/sonnet-impl.md` - the `tools: All tools` line is gone. The
   file now has `name`, `description`, `model: sonnet` and nothing else in
   frontmatter, matching the proven `opus-executor` pattern.
2. `claude/hooks/test-route-intent.sh` - `assert_agent_tools` gained the
   file-existence guard its sibling already had, and a new
   `assert_agent_no_tools` helper asserts the ABSENCE of a `tools:` key.
3. Two new assertions cover `sonnet-impl` and `opus-executor`. Task 1's total
   is now 6, up from 4.

## Verification the controller performed directly

Not taken from the teammate's report, which never arrived:

- `sed` on the frontmatter confirms the `tools:` line is absent
- `bash claude/hooks/test-route-intent.sh` reports 6 passed, 0 failed with no
  stray output
- **Negative test of the new guard:** moved `sonnet-impl.md` aside and re-ran.
  Output was two clean labeled FAILs
  (`missing /.../claude/agents/sonnet-impl.md`) with **zero awk leakage**, then
  the file was restored and all three agents verified present. This proves the
  guard both fires and stays pristine, which is exactly what finding (b) was
  about.

## Process note

`task1-roster` completed and committed the fix but its report message never
arrived; several teammates are looping on idle notifications without processing
their mailbox, including two that have not acknowledged shutdown requests.
Repo state was checked directly instead of waiting. **The work is real and
verified regardless of the missing message - a message not delivered is not
work not done, which is the mirror of the earlier lesson that a message sent is
not an outcome delivered.**

## Files touched
- `claude/agents/sonnet-impl.md` (tools line removed)
- `claude/hooks/test-route-intent.sh` (guard + negative helper + 2 assertions)
- `.claude/memory/session_2026-07-26_agent-routing-task1-fix.md` (this beat)
