---
name: The concise gate caught 1 in 18 responses; measured against a real corpus and widened to 1 in 5
description: Measured on 232 real assistant responses from this session's transcript, the lexicon-and-list gate fired on 13 (5.6%) while 94 were long multi-section answers. Added a volume gate behind the existing depth override, and fixed a hole where a single-paragraph wall of any length was exempt.
type: project
relates_to: [session_2026-07-31_cleared-tasks-resurrecting.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: 232-response corpus measured before and after; 8-case behavioural matrix against the real hook with real Stop payloads; mutation control (gate neutered -> blocks disappear, suite goes 42/3 red, exit 1); suite 45 passed 0 failed with the summary as the last statement
confidence: high
---

# Measuring the concise gate instead of guessing at it (2026-07-31)

Commit stamp at authoring: daaa4b22.

Jonah: "modify the conciseness guard to actually work - doesnt seem like it works yet."

## The measurement

Extracted all 232 assistant text responses over 200 chars from this session's own transcript and
ran the shipped detector over them.

    hook would fire on        13 / 232   (5.6%)
      tangent detections      12
      list overruns            2
    long multi-section        94 / 232   (40.5%)

**It caught roughly one in seven of the responses it was built to catch.** The tangent half is a
lexicon of ~18 named openers, so it can only ever fire on drift that happens to open with a
phrase it already knows, and the observed drift mostly does not.

## What the corpus said, including one candidate it killed

Mining the trailing zone of every response for its opening words produced the real openers
("one thing worth" x5, "one correction to" x3, "the one thing" x3) - and also killed a candidate:

- **Content after an explicit `Next:` closing line fired ZERO times.** When a closing-action line
  is written, it genuinely is the end. Rule 3 is already obeyed; that detection would have been
  dead weight and was dropped rather than shipped.
- **A widened lexicon fired 24 (10.3%) but with visible false positives** - "Three things must
  happen before the reassembly can be trusted" is the answer, not a tangent. The header's warning
  about classifying too broadly is right, so this was dropped too.

Distribution, prose only with fences and table rows excluded:

    p50 191 words | p75 269 | p90 313 | p99 362 | max 397
    3+ bold-led sections: 11 responses (4.7%)

Chosen: **words > 300 OR bold-led sections >= 3**, both tunable via `CONCISE_WORD_CAP` /
`CONCISE_SECTION_CAP`.

## Reversing a documented decision, deliberately

The hook's header says a length gate is deliberately absent because it false-fires on legitimate
deep dives. That reasoning is sound and is why this is not a raw length check: it sits behind the
same `user-asked-for-depth` skip as everything else, and tables and code are excluded from the
count. The decision was right about raw length and wrong about leaving volume unguarded entirely.

## The hole that mattered more than the new gate

`too-little-prose` skipped on LINE count:

    if len(nonempty) < 2: emit(skip="too-little-prose")

**A single unbroken paragraph is exactly one non-empty line, so a wall of text of any length was
waved through** - the single worst shape, exempt by construction. Found only because a synthetic
480-word one-paragraph fixture allowed when it should have blocked. Now requires both too few
lines AND under 40 words.

## Result

    before  13 / 232  (5.6%)
    after   43 / 232  (18.5%)

Eight-case behavioural matrix against the real hook: short answer allows, wall of prose blocks,
three sections block, wide table allows, code dump allows, depth request allows, second stop in a
burst allows, `stop_hook_active` allows. 11 new cases added to the suite: **45 passed, 0 failed**.

## THREE OF MY OWN INSTRUMENTS BROKE IN THIS ONE TASK

1. Cleanup globbed `.concise-blocked-*`; the flag is `.concise-stop-blocked.<session>`. Stale
   flags from the first run made two passing cases look like failures.
2. A zsh loop used `set -- $t` expecting word splitting. **zsh does not word-split unquoted
   variables**, so every fixture path was empty and all six cases "allowed".
3. A fixture helper forwarded only two of three arguments, so the depth-request text never
   reached the transcript and the depth override looked broken.

All three produced FALSE NEGATIVES about working code. Twelve such errors are now on record in
two days. The through-line is unchanged: the instrument matched what I expected rather than what
the subject emits.

**And a fourth, structural one:** appending tests to the suite put them AFTER the summary line, so
`== 34 passed ==` printed and exit stayed 0 while the new cases ran unaccounted. Green-while-
failing, in the file whose job is to catch exactly that. The summary is now the last statement,
and a neutered gate takes the suite to 42/3 with exit 1.

## Files touched

- `claude/hooks/concise-detect-stop.sh` (volume + section detection, too-little-prose fix, tunables)
- `claude/hooks/test-concise-detect-stop.sh` (11 cases, summary relocated to the end)
