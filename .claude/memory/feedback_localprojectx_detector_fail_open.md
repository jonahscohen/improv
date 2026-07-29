---
name: LOCALPROJECTX's detector fails OPEN on every degenerate input
description: Exit 0 on a missing file, garbage input, no args, and a page whose defects live only in a linked stylesheet - four axes where sidecoach fails closed
type: feedback
relates_to: [session_2026-07-29_scoreboard-harness.md]
author_human: Jonah
author_model: claude-opus-4.8
machine: spare3
source: session
verified: exit codes captured head to head on identical inputs
confidence: high
---

Measured head to head, identical inputs, both detectors run as black boxes. This is the family sidecoach wins outright, and it is worth knowing precisely because it is the one place their reach advantage buys them nothing.

| Input | LOCALPROJECTX | sidecoach |
|---|---|---|
| Missing target file | exit 0, prints `[]` under `--json` | exit 2, IO error |
| Unparseable/binary input | exit 0 | exit 3, inconclusive |
| No arguments at all | exit 0 | exit 2, usage error |
| Defects only in a linked stylesheet | 0 findings, exit 0, silent | exit 3, refuses to certify clean |

The missing-file case is the dangerous one. A CI gate, hook, or agent that runs their detector against a path that has moved gets exit 0 and an empty findings array, which reads as "clean" to every consumer. Nothing distinguishes "scanned and found nothing" from "never scanned anything."

The linked-stylesheet case contradicts their own documentation. Their `--help` states that HTML scans catch linked CSS. A page whose only defects live in `styles.css` reachable via `<link>` produced zero findings and no output at all; the same `styles.css` passed directly produced 3 findings (overused-font, gradient-text, bounce-easing), and so did passing the directory. So the rules exist and work - the single-file HTML path just does not follow the link, and reports success rather than reporting that it could not see.

Compounding it: without `--json` their entire human report goes to stderr and stdout stays empty, while the exit code stays 0. Redirecting stdout to a file yields an empty file and a success code on a page with real defects.

Sidecoach's contrasting contract is the thing to protect: a lens that did not run is never clean, a partial scan with zero findings is `inconclusive` (exit 3), and the summary says so in words - "NOT CLEAN: at least one lens did not run. A scan that did not happen is not a passing scan."

**Do not trade this away while closing the distribution gap.** It is the strongest differentiator we have that is not a line count, and it is invisible to anyone who only compares feature lists.
