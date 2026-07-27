---
name: Agent routing Minor follow-ups - band comment corrected, imperative widening REVERTED as a false-positive regression
description: MINOR 2 (size-band comment) landed. MINOR 1 (widen the opus_executor clause boundary with five imperative openers) was implemented exactly as specified, verified green, then reverted - a Codex review found the spec's own regex reintroduces the deliberation false positives the imperative shape exists to prevent. A clean candidate shape is measured but NOT landed; it is a design call for the lead.
type: project
relates_to: [session_2026-07-27_agent-routing-rereview-clean.md, session_2026-07-27_agent-routing-fixwave-green.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: tests (route-intent 51/0 after revert, hook-registry 52/0, component-browser 139/0) plus 18 live-hook probes; the regression was found by the deterministic Codex review wrapper and independently reproduced against the real hook and the parent lexicon
confidence: high
---

# Minor follow-ups on branch agent-routing

The clean re-review left exactly two Minor items. MINOR 2 landed. MINOR 1 landed and
was then reverted. Nothing else in the branch was touched.

## MINOR 2 - correct the size-band comment (LANDED, commit bb49094c)

The band table in `test-route-intent.sh` claimed the 156 KB case was "stopped by the
bash-side guard and never reaches python at all," and used it as the band table's entry
for the bash ARG_MAX guard. A four-cell mutation matrix settles it:

| case | bash ARG_MAX guard deleted | in-python 20000 bail deleted |
|---|---|---|
| 156 KB | silent, 0.08s (bail catches it) | silent, 0.04s (bash guard catches it) |
| 1.2 MB | 80 B on stderr, assertion FAILS | n/a, python is never reached |

So the 156 KB case discriminates NEITHER guard - it sits above both, and either one
alone keeps it silent. The bash guard's real coverage is the 1.2 MB assertion, the only
case that goes loud (`Argument list too long` on stderr) when the guard is removed.

**Why:** a comment that misattributes which guard a case exercises is worse than no
comment - it tells a future reader the 156 KB case is the bash guard's coverage, which
invites deleting the 1.2 MB assertion that actually provides it.
**How:** comment text only, no test logic changed. The band table now points the
>100000 row at the 1.2 MB assertion, and the 156 KB case is described for what it does
hold down: wall clock (14.94s against a 5s timeout before the scrub span was bounded).

A methodology note worth keeping: the first mutant I built was a `sed` copy of the hook
dropped in `/tmp`, and it reported "silent" for every payload. That was an artifact -
`HOOK_DIR` resolves the lexicon relative to the script, so the copy hit
`[ -f "$LEXICON" ] || exit 0` on line 20 and never ran any of the logic under test. A
mutant that exits before reaching the mutated code proves nothing while looking exactly
like a pass. Any out-of-tree copy of this hook must be run with `ROUTE_INTENT_LEXICON`
set explicitly.

## MINOR 1 - imperative recall widening (LANDED b70fb413, then REVERTED)

The spec was precise: add `want you to|need to|lets|let us|time to` to the
opus_executor clause-boundary alternation in both the refactor and redesign patterns,
so the leading group becomes
`(?:^|[.;!?\n]\s*|\b(?:and|then|now|also|next|want you to|need to|lets|let us|time to)\s+)`.

Implemented exactly as written. It worked on every case the spec named: the four
silent phrasings recovered, the two working imperatives kept working, and all four
named negatives (`do not refactor it`, `i hate the redesign`, `should we refactor
this`, `should we please refactor`) stayed silent. Suite went 51 -> 55, green.

Then the Codex review gate found the hole, and it is a real one.

**The defect:** the original alternation members (`and|then|now|also|next`) are
conjunctions and adverbs - words that intrinsically MARK a clause boundary, so `\b`
in front of them is sufficient. The five added tokens are VERB PHRASES that occur
anywhere in a sentence. Prefixed with only `\b`, they anchor nothing. Seven prompts
that were silent against the parent lexicon routed to the most expensive tier:

- `do we need to refactor this parser module before the release, or is that unnecessary`
- `i dont think we need to refactor the parser module, it is fine as it is today`
- `i do not want you to refactor the parser module; just explain the risks`
- `the issue title says lets refactor the parser module, but I only need triage notes`
- `the proposal says let us refactor the parser module next, but I only want risks`
- `the team keeps saying time to refactor the parser module, but I want a risk assessment`
- `do we need to redesign this settings page before launch, or is that unnecessary`

`do we need to refactor this` is the SAME deliberation shape as the asserted negative
`should we refactor this`. So this is not a new edge case discovered at the margin - it
is a regression against the tightening's own stated contract, and the assertion set did
not catch it because no negative in the suite happened to contain one of the five new
tokens.

**Why reverted rather than patched:** the correct shape is not a wider alternation, it
is a separate optional OPENER group that must itself sit at a real clause boundary:

    (?:^|[.;!?\n]\s*|\b(?:and|then|now|also|next)\s+)
    (?:(?:i|we)\s+)?(?:(?:want you to|need to|lets|let us|time to)\s+)?
    (?:(?:can|could|would|will) you\s+)?(?:please\s+)?refactor\s+(?:the|this|...)\b

Measured in a scratch lexicon against all 18 probes: the four recovered phrasings
route, the three must-keep-working imperatives route, and all seven false positives
plus all four original negatives stay silent. But that is a different regex from the
one the spec dictates, which makes it a design decision belonging to the caller, not an
execution detail. Landing it unilaterally is exactly the improvisation this execution
tier exists to avoid, so it is reported and not applied.

**Self-analysis - why my own verification missed it.** I probed exactly the ten cases
the spec enumerated and treated a green suite plus those ten as proof. Every one of
those negatives was inherited from the PRE-existing failure mode; not one of them
contained a token I had just added. That is the failure mode: verifying a change
against the test set that predates it confirms you did not break yesterday's cases, and
says nothing about the surface you just created. The rule to carry forward - when
widening a matcher, the negatives you must write are the ones built FROM the tokens you
added, not the ones already in the suite.

## Verification

- `bash claude/hooks/test-route-intent.sh` -> 51 passed, 0 failed (back to baseline)
- `bash claude/hooks/test-hook-registry.sh` -> 52 passed, 0 failed
- `bash claude/hooks/test-component-browser.sh` -> 139 passed, 0 failed
- 18 live-hook probes, each with `ROUTE_INTENT_COOLDOWN=0` and a unique
  `ROUTE_INTENT_COOLDOWN_FILE`. The per-probe cooldown file is not optional: without it
  the first probe that fires writes cooldown state and silences every probe after it,
  which reads exactly like a regression.

## Files touched

- `claude/hooks/test-route-intent.sh` - corrected size-band comment block (MINOR 2)
- `claude/hooks/route-intent.json` - reverted to its pre-MINOR-1 state
