---
name: Verify a negative assertion by injecting the defect, not by watching it pass
description: assert_agent_no_tools uses awk 'END{exit !found}' whose exit polarity is easy to invert. Proved it correct by writing `tools: All tools` back into sonnet-impl.md and confirming the suite went 5/1 - a green run alone would have proven nothing.
type: feedback
relates_to: [session_2026-07-26_agent-tools-frontmatter-rule.md, session_2026-07-26_agent-routing-task1-fix.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: defect injected into claude/agents/sonnet-impl.md, suite went 6/0 -> 5/1 with the correct label, file restored byte-identical (git diff --stat empty)
confidence: high
---

# Verify a negative assertion by injecting the defect

**A test that asserts the ABSENCE of something proves nothing by passing.** It
passes identically whether it works or is inverted. The only proof is making it
fail on purpose.

**Why:** `assert_agent_no_tools` hinges on
`awk '...{found=1} END{exit !found}'`, which exits 0 when the key IS present.
The `if` branch must therefore treat awk SUCCESS as a test FAILURE. That
inversion is easy to get backwards, and a backwards version would pass on
exactly the broken state it exists to catch - a silent green light over the
original bug.

**How to apply:** temporarily write the defect into the file, run the suite,
confirm it fails with the right label, then restore and confirm byte-identity
with `git diff --stat`. Applied here:

```
injected `tools: All tools` -> RESULTS: 5 passed, 1 failed
  FAIL: sonnet-impl grants all tools via omitted key
        (has a tools: key; omit it to grant all tools)
restored                    -> RESULTS: 6 passed, 0 failed
git diff --stat             -> empty (byte-identical to committed)
```

Polarity confirmed correct. The label that printed is also the one a future
developer will see, which is a second thing a passing run never exercises.

This generalizes past assertions: any check whose success condition is "nothing
is there" needs a mutation test before it can be trusted. The green run is the
weakest evidence available about it.

## Files touched
- `.claude/memory/session_2026-07-26_assertion-polarity-mutation-test.md` (this beat)
- No repo files changed; the injection was reverted and verified byte-identical
