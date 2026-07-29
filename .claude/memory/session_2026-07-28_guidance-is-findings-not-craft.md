---
name: The sidecoach payload contains NO craft guidance - it is a findings report with templated fix strings
description: Measured the shipped guidance for a craft command. 57 lines, 14 of them templated boilerplate, zero sentences of design advice. This is the mechanism behind the efficacy trial's null result.
type: project
relates_to: [session_2026-07-28_does-sidecoach-help.md, session_2026-07-28_final-wave-committed.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: sidecoach-monitor driven directly, output counted line by line
confidence: high
---

# The guidance is not guidance (2026-07-28)

Jonah said, with visible frustration, that he never wanted a purely mechanical system - he
wanted INSTRUCTIVE guidance with mechanical guards keeping the model on track. I had framed
the product as "machinery versus instructions" and told him the machinery was the defensible
ground. Then I read what the machinery actually emits.

## What `/sidecoach craft a pricing page` returns

57 lines total. Structure is a repeated block:

    #### Linguistic p1 slop words
    | Before | After |
    | linguistic-p1-slop-words = 6 | resolve the linguistic p1 slop words issue on the affected element |
    1 linguistic p1 slop words finding flagged; it undercuts the finished result.

- **7 templated fix lines** of the form `resolve the <rule name> issue on the affected element`
- **7 templated verdict lines** of the form `it undercuts the finished result`
- **ZERO sentences of prose guidance.** The only non-table line over 60 characters is the
  summary: `Blocked: 7 findings (1 blocking, 6 warnings, 2 infos), grade A.`

The "After" column - the column whose job is to say what to DO - is a string template with
the rule's own name substituted into it. A machine restating its finding as an imperative.

## Why this explains the null result

The efficacy trial found that the payload improves what sidecoach MEASURES and does not
improve what a blind judge SEES, with six polish rule classes dropping to exactly zero on
every treated page.

That is now fully explained rather than merely observed. **The payload's entire content is
the NAMES of the things it checks.** A model given a list of rule names will satisfy those
rule names. It cannot improve anything the list does not name, because nothing else is in
the payload. The measured circularity is not a subtle bias - it is the literal mechanism.

## The correction to my own framing

I told Jonah the competitive position was "rigor versus reach" and that his rigor was the
defensible ground. That framing was wrong in a way the measurement should have made obvious
to me an hour earlier: a checker with no teaching layer cannot be the rigorous half of
anything. It can only confirm whether the model happened to satisfy a list.

The rival's flows are prose - real procedure, real craft advice, no enforcement. This
product is the exact inverse, and the inverse of "advice nobody enforces" is not
"enforcement" - it is advice nobody wrote.

## What Jonah actually asked for, restated

Instructive guidance FIRST, with the mechanical layer as the guard that keeps the model on
it. Both halves. The detectors are the guard and they work; the thing they are supposed to
be guarding was never built.

## Files touched

- none (measurement only)
