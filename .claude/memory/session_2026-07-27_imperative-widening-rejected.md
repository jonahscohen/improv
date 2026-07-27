---
name: The imperative-recall fix was rejected on evidence - clause markers vs verb phrases
description: Adding "want you to|need to|lets|time to" to the boundary alternation recovered the four target phrasings but made seven negations route to the most expensive tier, including "i do not want you to refactor". Reverted; the recall gap stands deliberately.
type: decision
relates_to: [session_2026-07-27_imperative-recall-gap-confirmed.md, session_2026-07-27_agent-routing-rereview-clean.md]
supersedes: session_2026-07-27_imperative-recall-gap-confirmed.md
author_human: Jonah
author_model: claude-opus-5
source: session
verified: implemented as specified, suite went 51 to 55 green on the named cases, then a Codex gate found 7 regressions; reverted at d2a3e15f and the branch is back to 51/51
confidence: high
---

# Imperative widening rejected

Choice made: **keep the recall gap, revert the widening.** Four natural
phrasings ("i want you to refactor...", "lets refactor...", "we need to
refactor...", "time to refactor...") still do not route, and that is now a
deliberate state rather than an oversight.

## Alternatives considered

- **Ship the widening as specified** (the reviewer's proposal, which I relayed
  verbatim): rejected because it made seven previously-silent prompts route to
  `opus-executor`, the most expensive tier, including explicit refusals:
  - `do we need to refactor this parser module before the release, or is that unnecessary`
  - `i dont think we need to refactor the parser module, it is fine as it is today`
  - `i do not want you to refactor the parser module; just explain the risks`
- **Widen with tighter anchoring:** deferred, not attempted. It needs real
  design rather than an alternation edit, and the cost of being wrong is
  asymmetric (see below).

## Why this one

The linguistic distinction is the whole finding. The ORIGINAL alternation
members (`and|then|now|also|next`) are conjunctions and adverbs: words that
intrinsically MARK a clause boundary, so a bare `\b` in front of them is
sufficient. The five tokens I proposed adding are VERB PHRASES that occur
anywhere in a sentence. Prefixed with only `\b`, they anchor nothing, so
`do not want you to refactor` matches just as readily as `want you to
refactor`.

The error is in the specification, not the implementation. The teammate built
exactly what was written, verified it against every case the spec named, and
the spec's own cases all passed. The hole was only visible in cases the spec
never listed, which is why the independent Codex gate caught it and the suite
did not.

**The asymmetry that settles it:** a missed nudge costs nothing, because
silence is the documented default and the lead handles the prompt itself. A
false positive dispatches real work to the most expensive tier, which is
precisely the outcome this whole feature exists to prevent. A recall gap is a
smaller defect than a precision gap, so erring toward silence is correct.

## Revisit when

Someone wants the four phrasings recovered badly enough to design a real
anchoring rule - one that distinguishes an imperative from a negated or
interrogative mention of the same verb phrase. Any such attempt must be tested
against the seven negation cases above, not only against the four target
phrasings.

## A second methodology trap, same family

The teammate's first mutant was a `sed` copy of the hook placed in `/tmp`. It
reported "silent" for every payload, which looked like a clean result. It was
an artifact: `HOOK_DIR` resolves the lexicon relative to the script, so the
out-of-tree copy hit `[ -f "$LEXICON" ] || exit 0` and never reached any
mutated code.

That is the same shape as my own neuter-not-delete lesson: **a mutant that
exits before reaching the mutated code proves nothing while looking exactly
like a pass.** Any out-of-tree copy of this hook must be run with
`ROUTE_INTENT_LEXICON` set explicitly. See
[[session_2026-07-27_mutation-testing-fail-open-code]].

## Files touched
- `claude/hooks/test-route-intent.sh` (band-table comment corrected, bb49094c)
- `claude/hooks/route-intent.json` (widened at b70fb413, reverted at d2a3e15f)
- `.claude/memory/session_2026-07-27_imperative-widening-rejected.md` (this beat)
