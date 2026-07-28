---
name: The four-question audit - lead verification of all five units, and the pattern across them
description: Jonah asked whether sidecoach, the hooks, beats search, and anything else actually works. Five agents measured against real inputs. Verdicts verified independently by the lead, including a byte-identical diff proving sidecoach's flow layer ignores its target.
type: project
relates_to: [session_2026-07-27_route-intent-live-efficacy.md, session_2026-07-28_capability-evidence-inventory.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: each unit's headline claim re-run or re-probed by the lead; sidecoach flow claim proven by a scrubbed diff of two maximally different targets
confidence: high
---

# "Does anything we built actually work?" - measured (2026-07-28)

The question was asked honestly after the 2026-07-27 finding that the agent-routing hook
was wired, deployed, fast, green, and had 0% recall on 627 real prompts. Five agents
measured. Every headline was re-verified by the lead rather than accepted.

## Verdicts

| unit | verdict | lead's independent check |
|---|---|---|
| beats search | WORKS | correct beat ranks 1; closed-port ablation prints VECTORS ABSENT and changes results |
| hooks (71 wired) | BROADLY ALIVE, 1 inverted | paired control: diagnostic text arms genuine, silent in an envelope |
| sidecoach ENGINE | REAL | objective detectors P 1.000/R 1.000 on skipped-heading and broken-image, 89 held-out pages |
| sidecoach FLOW layer | NOT REAL for file targets | see the diff below |
| capability inventory | 27% proven, 47% suite-only | 0 lotus invocations vs 245 files mentioning it; 18 skills, only 2 repo skills ever invoked |

## The sidecoach flow proof, run by the lead

Two maximally different targets: a 0-byte file and a deliberately catastrophic page
(skipped heading h5 then h1, 6px text, near-white on white, broken image, 160 buzzwords).

    audit(empty.html)  -> 8866 bytes
    audit(awful.html)  -> 8866 bytes
    diff (paths and timestamps scrubbed) -> startTime, endTime, executionDuration 0 vs 1

Byte-identical apart from clocks. The flow layer's findings and grades are constants: one
finding is the flow grading its OWN guidance text, the other fires when a value EQUALS its
target. It IS real for URL targets; path, file and directory targets silently skip the
render. `sidecoach-detect <file.html>` renders correctly via file:// - the defect is the
FLOW surface, not the engine.

## The pattern across all five

What a human DRIVES works. What fires AUTOMATICALLY is where the failures live, and they
fail silently in the direction of looking healthy: a router with 0% recall, a gate 5x
louder on envelopes than on real prompts, a flow returning grade B for anything, a clean
bill of health for every JS app because empty-DOM silence was reported as "no defects".

## The measurement lesson, which is the real deliverable

Every one of the five agents caught a FALSE result in its own harness before reporting:

- `beats-search` built a strawman grep baseline and only found it when a different model
  graded the BASELINE's fairness. A claimed 4.3x advantage became 1.08x and not significant.
- `hooks-live` scored healthy Stop hooks at 0% because they arm a flag and exit 0 silently;
  its first framing would have declared the question-asking enforcer dead.
- `sidecoach-live` wrote a guard test that injected the result it asserted, so deleting the
  guard would have passed it.
- `inventory` computed a skill fire rate whose denominator was mostly teammate envelopes,
  wrong by more than 10x.
- `bakfix` reintroduced, in its own repair, the substring hazard the file had spent a week
  eliminating.

Route-intent's lesson was "test with real INPUTS". The stronger form learned today: an
authored OUTPUT expectation fails in the CONFIDENT direction, reporting working things as
dead and broken things as fine. Before measuring a detector, read what it emits on a hit;
if it writes state, measure the state. And when you build both the system and its baseline,
have a different model grade the baseline.

## Lead errors this session, both the same shape

1. Claimed `install.sh:1847` still held a destructive sed, from a fingerprint taken before
   the patch landed.
2. Claimed the CLAUDE.md sed sites would meet a symlink, without checking that the call
   site is guarded by `[ ! -L ]` six lines above. `bakfix` reproduced and refuted it, and
   relocated the real defect to the INSTALL path where a symlink into the user's own
   dotfiles aborts the installer.

Both are the same error: asserting a defect from a measurement taken somewhere other than
where the defect would live.

## Files touched

- none by the lead (verification only)
