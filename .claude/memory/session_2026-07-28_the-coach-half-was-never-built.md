---
name: The detector half is real and measured; the coaching half does not reach the user
description: Corrects an over-broad claim made under pressure. Craft content exists (design-laws.ts, 475 lines) but it is defect DESCRIPTIONS, not instruction, and the orchestrator never references it. Five commands emit 0-2 prose sentences each.
type: project
relates_to: [session_2026-07-28_guidance-is-findings-not-craft.md, session_2026-07-28_does-sidecoach-help.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: five verbs driven directly and counted; design-laws.ts inspected; orchestrator and report builder grepped for any reference to it
confidence: high
---

# What is actually true about the guidance layer

Jonah, angry and fairly so, asked whether sidecoach is a lie. I had just told him the
payload contains no craft guidance, on the strength of ONE probe of ONE command. That was
the same single-probe error I spent all day catching in others, so I measured properly
before letting the verdict stand.

## Measured across five verbs

| verb | payload lines | prose sentences |
|---|---|---|
| polish | 49 | 0 |
| audit | 9 | 2 |
| critique | 9 | 1 |
| shape | 9 | 0 |
| distill | 41 | 0 |

`audit` and `critique` are NINE LINES TOTAL. The larger payloads are larger because they
carry more findings tables, not more instruction.

## The content exists, and it is the wrong kind, and it is not wired

`sidecoach/src/design-laws.ts` is 475 lines carrying 41 long prose strings. So the vault is
not empty. But the strings are DEFECT DESCRIPTIONS:

- "Modal used as default pattern instead of inline or progressive disclosure"
- "Typography hierarchy without sufficient ratio between sizes (needs >=1.25)"
- "Text or interactive elements below 4.5:1 AA ratio"

That is a rulebook of violations - what a CHECKER needs. It is not instruction in how to
design, which is what a COACH needs. The two are different artifacts and only one was
written.

And it does not reach the user regardless: neither `sidecoach-orchestrator.ts` nor
`build-report-aggregator.ts` references design-laws at all.

## The accurate verdict, neither softened nor inflated

NOT a lie. The detection engine is real and independently measured - precision and recall of
1.000 on skipped-heading and broken-image across 89 held-out pages, verified today.

What is unsupported is the product's own description of itself. It is named and documented
as a design ORCHESTRATION and coaching system. Measured, it is a design CHECKER with a
findings report. The efficacy trial then confirmed the consequence directly: the payload
improves what it measures and does not improve what a blind judge sees.

The checker is real. The coach is not. The name says coach.

## On the day's spend

The session hardened the machinery: found the router dead at 0% recall, the test runner
reporting green over four failing suites, a config-destroying write in the installer, the
payload-source cycle. All real defects, all now fixed.

None of it made the product better at design, because none of it touched the half that was
missing. That is worth stating plainly rather than defending.

## Files touched

- none (measurement only)
