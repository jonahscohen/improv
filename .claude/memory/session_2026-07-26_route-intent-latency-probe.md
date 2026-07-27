---
name: route-intent has no catastrophic backtracking; latency is flat 60-85ms on adversarial input
description: Timed the live hook against five adversarial prompts including 200KB of repeated tier-matching text. Worst case 84ms versus 67ms baseline, so the bounded quantifiers hold and there is no regex DoS on the user's own session.
type: reference
relates_to: [session_2026-07-26_lexicon-type-validation-gap.md, session_2026-07-26_agent-routing-tasks67-live.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: timed ~/.claude/hooks/route-intent.sh directly on 5 adversarial inputs with cooldown disabled and isolated cooldown files
confidence: high
---

# route-intent latency probe

The hook runs on EVERY prompt, so a pathological regex would be a denial of
service on the user's own session. Measured rather than assumed.

| input | latency |
|---|---|
| normal prompt (baseline) | 67.3 ms |
| `where is` + 5,000 spaces + `set` | 61.6 ms |
| `find all the` + 10,000 `a` | 64.1 ms |
| `where is ` + `a ` x3000 + `set` | 69.9 ms |
| 200KB of repeated `find all the callers of x` | 84.0 ms |

Flat. Worst case is 25 percent over baseline on a 200KB prompt, and most of the
~60ms floor is python3 interpreter startup rather than matching.

**Why it holds:** every tier pattern uses BOUNDED quantifiers
(`[a-z0-9_.\- ]{2,40}`) rather than unbounded nested ones. There is no
`(a+)+`-shaped construct anywhere in the lexicon, which is the shape that
produces exponential backtracking.

**Constraint for future lexicon edits:** keep quantifiers bounded. An
unbounded nested quantifier added to `route-intent.json` would be invisible in
review (it is data, not code) and would hang every prompt in the session. This
is the one class of lexicon edit that needs a latency re-check.

## Files touched
- `.claude/memory/session_2026-07-26_route-intent-latency-probe.md` (this beat)
- No repo files changed; probes used temp files only
