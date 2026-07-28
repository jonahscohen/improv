---
name: Codex vetted all four subsystems and disputed 16 of 20 claims - the session's own evidence was partly hollow
description: Four independent Codex passes on installer, hooks, skills and sidecoach. Two hooks fail OPEN, the sidecoach safety property is false on the human-visible panel, several suites contain rows that cannot fail, and none of the four headline numbers is reproducible.
type: project
relates_to: [session_2026-07-28_four-question-audit-lead-verification.md, session_2026-07-28_installer-integrity-lead-verified.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: lead reproduced the top finding in each of the four verdicts by direct execution
confidence: high
---

# The Codex vetting wave (2026-07-28)

Jonah directed this after concluding the Claude side kept reporting findings instead of
fixing them, and that he could not trust a self-assessment. He was right, and the pass paid
for itself four times over.

Four subsystems, four independent Codex passes through the deterministic wrapper
(`codex-review.py`, which fails loudly rather than downgrading to a same-model review).
**Of roughly 20 claims relayed to Jonah as verified, Codex disputed 16.**

## The four headline defects, each reproduced by the lead

| subsystem | defect | lead's reproduction |
|---|---|---|
| hooks | `codex-failure-watcher` fails OPEN | `sudo codex exec` and `env FOO=1 codex exec` are SILENT on a real capacity failure |
| hooks | `route-intent` still matches mid-sentence | "Do NOT proceed; refactor the router..." ROUTES |
| sidecoach | no-page audit still shows a grade | panel prints `verdict clean - grade A - 0 findings` for a target that rendered nothing |
| installer | the cycle is open on relative symlinks | `readlink` prefix match at :4203 vs the correct resolution at :2413 |

## The pattern across all four

**The verification was unsound in the same direction as the code.** Not one of these was
caught by the suites written specifically to prove the fixes:

- The one row testing the installer cycle compares two `shasum` outputs, both empty on a
  machine without `shasum`.
- A row scores a PASS using `-e` on a dangling symlink, where `-e` is false.
- The structural row's regex `sed[[:space:]]+-i` does not match `sed -E -i`, while its
  comment claims it catches ANY surviving `sed -i`. Confirmed by running the awk directly.
- The sidecoach test asserts `!res.buildReport` and never inspects `res.panel`, which is
  where the grade actually leaks.
- `test-settings-wire-parity` checks zero hooks when the directory is absent, and passes.
- Codex counted 22 of 42 route-intent assertions vacuous, 26 of 40 wire-parity, 11 of 35
  hook-data-parity.

## The finding with the longest reach

**None of the four headline numbers is reproducible.** 9.83%/1.94% for grounding-gate,
121-to-0, 33.3% over 4000 Bash calls, 0%-to-22.2% over 627 prompts. Each exists only as
prose in a source comment. No corpus, no labels, no script is committed anywhere, and in
each case the agent that wrote the fix also chose the split and the labels. They were
relayed to Jonah as measurements. They are unaudited claims.

## The lead's own failure, stated plainly

I spot-checked each fix with three or four probes and called it verified. Every probe I
chose was a case the fix was designed to handle. That is precisely the error this session
had already diagnosed twice - testing against inputs its author invented - committed by the
person whose job was to catch it. The sidecoach case is the sharpest: I inspected the JSON
result, saw `buildReport` absent and `rendered:false`, and never looked at the panel a human
actually reads.

## Two things that made the verdicts trustworthy

The hooks driver CORRECTED ITSELF against its own first measurement, when a 900s cooldown
file silenced every probe after the first and produced a falsely reassuring result. And it
named the two of eight Codex predictions that did NOT reproduce, which is what makes the
other six credible.

## Files touched

- none (verification and dispatch only)
