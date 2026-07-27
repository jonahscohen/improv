---
name: Task 1 review found two plan-mandated defects (tools frontmatter, test guard)
description: Reviewer passed spec compliance but flagged 2 Important findings, both originating in the PLAN text not the implementer - `tools: All tools` may parse as a two-item list leaving sonnet-impl toolless, and assert_agent_tools lacks the file guard its sibling has.
type: project
relates_to: [session_2026-07-26_agent-routing-task1.md, session_2026-07-26_agent-routing-plan.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: reviewer read diff 160eeed3..71dbd72f; finding (a) under live smoke-dispatch verification by the controller
confidence: medium
---

# Task 1 review

Collaborator: Jonah. Reviewer verdict: **spec compliant, task quality Needs
fixes.** Both Important findings are defects in MY plan text, faithfully
transcribed by the implementer. The implementer's execution was correct.

## Finding (a) - `tools: All tools` may grant nothing

`claude/agents/sonnet-impl.md:5` sets `tools: All tools`. The reviewer's
evidence: `opus-executor`, which OMITS the `tools:` key entirely, renders in
the agent roster as `(Tools: All tools)`, while `sonnet-impl` renders as
`(Tools: All, tools)`. The inserted comma is the signature of a parser
splitting the value into a list and joining `["All", "tools"]` - two invalid
tool names rather than a grant-everything sentinel.

`quick-answer`'s `tools: Read, Grep, Glob` renders correctly, which fits the
theory: real comma-separated tool names round-trip, the two-word literal
"All tools" does not.

If true, the tier every later task routes real edits to would have no working
tools, and no planned assertion would catch it.

**Correct pattern:** omit the `tools:` key entirely, as `opus-executor` does.
The display string "All tools" is what the harness SHOWS for an absent key,
not a value to write.

Being verified by live smoke dispatch before any fix lands, because the
reviewer explicitly could not confirm it from the diff.

## Finding (b) - inconsistent test guard

`claude/hooks/test-route-intent.sh:51-60`, `assert_agent_tools` has no
file-existence guard, unlike `assert_agent_model` at lines 36-48. On a missing
file it still FAILS correctly (empty value does not equal expected), so it
never silently passes, but it leaks a raw `awk: can't open file` line outside
the PASS/FAIL bookkeeping. Test output should be pristine.

## Why both are my fault, not the implementer's

I wrote both blocks verbatim into the plan and the implementer transcribed them
character for character, which is exactly what it was asked to do. The plan's
self-review checked placeholders, internal consistency, scope, and ambiguity -
it did NOT check whether the frontmatter values it specified were valid in the
target harness. **Lesson: a plan that hands over verbatim config must validate
that config against the real consumer, not just against itself.**

## Process note

`task1-reviewer` idled twice and ignored a direct query, so a replacement was
spawned; the original then delivered a thorough report anyway. It was slow, not
stuck. The duplicate was stood down. Cost: one wasted spawn. Adjusting the
patience threshold before replacing a silent reviewer.

## Files touched
- `.claude/memory/session_2026-07-26_agent-routing-task1-review.md` (this beat)
- `.superpowers/sdd/2026-07-26-agent-routing/progress.md` (ledger, git-ignored)
