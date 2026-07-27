---
name: Agent routing Tasks 6-7 complete - the classifier is LIVE in the harness
description: Fail-open hardening (d58844a6) and wiring (8993fc62, 369cb198). Suite 30/30. Verified end to end through the real hook path - settings.json has exactly one registration, all five symlinks resolve, and a live prompt produces a correct nudge. Codex caught a real install bug.
type: project
relates_to: [session_2026-07-26_agent-routing-task45-verified.md, session_2026-07-26_agent-routing-execution.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: controller ran suite 30/30, confirmed settings.json parses with exactly 1 registration, all 5 symlinks resolve, and piped a real prompt through ~/.claude/hooks/route-intent.sh producing the correct Explore nudge
confidence: high
---

# Tasks 6-7: the routing layer is live

Collaborator: Jonah. Implemented by `task67-wiring` (sonnet). Commits
`d58844a6` (fail-open), `8993fc62` (wiring), `369cb198` (Codex fix),
`d7fba8ba` (housekeeping). Suite 30/30.

## It is actually running

Verified through the REAL path, not the repo copy:

```
$ echo '{"prompt":"find all the callers of detect-session-model across the hooks directory"}' \
    | ~/.claude/hooks/route-intent.sh
ROUTE CHECK: this prompt reads as a read-only sweep. Explore (built-in) could
field it. Dispatch if the work is longer than the dispatch overhead; answer
directly if it is not. Your call either way.
```

`settings.json` parses and holds exactly ONE `route-intent` registration. All
five symlinks resolve: the hook, the lexicon, and the three roster agents.

## Codex earned its keep

The mandatory cross-model review caught a real bug the whole test suite missed:
`cluster_hooks()` deployed only `route-intent.sh`, not `route-intent.json` or
the `~/.claude/agents/` roster that the installer's own description promises. A
fresh install would have shipped a silently non-functional hook - the lexicon
absent means the hook exits 0 immediately and simply never fires.

**Why no test caught it:** every test runs against the REPO working tree, where
all files exist by construction. Nothing exercised the INSTALL path. A test
suite validates the code; it does not validate the deployment of that code.

Fixing that exposed a second bug the teammate found itself: the live
`settings.json` wiring sat in a different UserPromptSubmit group than
`cluster-wirings.json`'s `matcher:null` resolves to, which would have produced a
DUPLICATE hook on any future automated re-run. Fixed live.

## Two brief defects the teammate corrected

1. **Step 6's alignment script was broken** - a first-occurrence-only regex that
   returns nonsense on this file. It built a correct scoped check instead
   (sourcing the edited block), getting 9/9/9/9/9/9.
2. **`TITLES` is a sixth positionally-consumed parallel array** that my plan
   never mentioned. Had it edited only the five I listed, the installer's
   cluster titles would have silently shifted. My plan's hazard note was right
   in kind and incomplete in fact.
3. `sidecoach-keyword.sh` is not in `cluster-wirings.json` at all, so the
   brief's "copy its shape" instruction pointed at nothing. It copied from
   three other confirmed UserPromptSubmit entries instead.

## Deferred minor

Task 6's whitespace-prompt assertion is partly vacuous: the SILENCE half proves
nothing, since no tier regex can match empty text. The rc=0 half is real and
does verify the hook does not crash on whitespace, which is the actual
fail-open contract. Logged as a minor rather than a fix round.

That is the fourth instance of this defect class in seven tasks. All four were
assertions whose success condition was "nothing happened."

## Files touched
- `claude/hooks/test-route-intent.sh` (9 assertions across both tasks)
- `claude/hooks/cluster-wirings.json`, `install.sh` (agent-routing cluster)
- `~/.claude/settings.json` (1 registration), `~/.claude/hooks/`, `~/.claude/agents/`
- `.claude/memory/session_2026-07-26_agent-routing-tasks67-live.md` (this beat)
