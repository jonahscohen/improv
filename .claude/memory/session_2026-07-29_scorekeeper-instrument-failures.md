---
name: Five instruments that reported confidently while structurally blind
description: Every zero I nearly wrote down was wrong - relative-path grep, zsh glob expansion, stderr-only reports, unvalidated substring filters, and a baseline measured mid-write
type: feedback
relates_to: [session_2026-07-29_scoreboard-harness.md, session_2026-07-29_coach-confirmed-and-my-fourth-bad-probe.md, feedback_shortcuts_are_lies.md]
author_human: Jonah
author_model: claude-opus-4.8
machine: spare3
source: session
verified: each failure reproduced, then corrected and re-run
confidence: high
---

The scorekeeping charter said this session had already destroyed four instruments that reported confidently while unable to see what they claimed to check. Building the scoreboard, I produced five more. Every single one was caught by a planted known-positive, and none would have been caught by reading my own code.

**1. Relative paths under a resetting cwd.** Probed the installed skill surface with `cd <repo> && SURF="claude/skills/..."` then grepped `$SURF`. The tool harness re-anchored cwd, the files did not resolve, and the loop printed `0 mentions` for all 14 tools. The control - `sidecoach-palette`, which I knew was documented - also printed 0. That is the only reason I did not write down "every tool is undiscoverable." Fix: absolute paths.

**2. zsh expanded my grep flag.** `grep -rln "x" src/ --include=*.ts` died with `no matches found: --include=*.ts` because zsh globbed the flag value before grep saw it. The known-negative control printed "(none - control clean)" - a clean-looking result from a command that never ran. Fix: quote the glob.

**3. The competitor detector writes findings to stderr and leaves stdout empty.** My harness captured stdout with `2>/dev/null` and the canary gate immediately failed: 0 findings on a page I had manually watched produce 5. Without `--json` their stdout is empty and the exit code is 0, so `detect.mjs page.html > out.txt` yields an empty file and a success code. Fix: `2>&1` everywhere their report is parsed, with a comment saying why.

**4. A substring filter validated against nothing.** To count which slop tells they catch and we miss, I grepped our whole output for each rule id. Our detector also prints every rule it could NOT measure, so `marketing-buzzword` matched the inconclusive-lens list and the row reported "0 missed - TIE". The truth is 4 missed (overused-font, single-font, bounce-easing, marketing-buzzword). Same bug inflated the de-duplication row to 6. Fix: scope both sides to emitted finding lines, and keep `gradient-text` - a tell both detectors genuinely fire - in the loop as a permanent in-band control, so a filter that matches everything or nothing shows up as a wrong answer on a known row.

**5. A verification baseline measured during another teammate's half-landed write.** `npx tsc --noEmit` was green at 07:10, red at 07:28 (`src/craft-laws.ts` importing a nonexistent `./craft-corpus`), green again at 07:35. craft-laws.ts landed 03:27, craft-corpus.ts 03:31. I sampled inside the four-minute window and nearly recorded a permanent LOSS for a transient state.

**6. A verdict decided by machine load rather than by either tool.** The wall-clock row used 3 samples, no warmup, and a bare `<=` comparison. Two consecutive runs of the same harness produced WIN 9 / LOSS 14 and then WIN 8 / LOSS 15, because the timing row flipped. Investigating the raw samples showed why: their detector is stable at 52-61ms, ours ranges 184-739ms, and my earlier hand-measured "theirs 558-743ms" was contaminated by other agents hammering the machine with typechecks at that moment. A verdict that flaps between runs is not a measurement of anything. Fix: discard a warmup run, take 5 samples, report median plus min-max range so variance is visible, and call anything inside a 15% band a TIE instead of awarding a win to whoever caught the quieter second. The honest result is a clear LOSS - they are roughly 3.4x faster and far more consistent.

The reproducibility check that caught this is worth keeping as a habit: run the harness twice and diff the output. A benchmark that cannot reproduce its own tally cannot referee anyone else's claim.

**7. An importer grep cannot see a subprocess spawn - and it failed in the flattering-to-nobody direction.** The board's top-ranked family is reachability, and TWO of its rows were measured with the wrong instrument. "Image generation REACHABLE: 0 invokers" came from grepping `src` for `image-generation`; the flow does not import the module, it resolves and spawns `bin/sidecoach-image.js` as a child process. Truth is 2 of 26 flow handlers. "Craft corpus REACH: 1 of 26" came from grepping flow handlers for `polish-craft`; 20 of them reach the corpus through `craft-flow.ts`, which is the file that does the importing. Truth is 21 of 26. Fix: a `reach_flow_handlers` probe that counts direct references, bin spawns, AND one transitive hop, with the hop depth stated on the row and a bogus-capability control that must return 0.

This is the subtlest failure in the list because it ran in the direction that READS as rigour. A falsely harsh number about your own work does not trigger the instinct to double-check; it feels like integrity. Both errors survived my own review for exactly that reason, and were caught by another agent driving the actual flow and watching it write a real PNG. The standard that follows: a claim of zero reach must be disproved by attempting the behavior, not by a second grep.

**8. My interactive `grep` and the harness's `grep` are different programs.** `grep -rl 'sidecoach-image' <installed SKILL.md>` returned 1 when I typed it and 0 inside the harness. In the interactive shell `grep` is a shell FUNCTION wrapping ugrep with `--ignore-files`; the harness runs under `bash script.sh`, where that function does not exist and plain BSD grep is used - and BSD `grep -r` does not follow a symlink passed as an argument (only `-R` does). The installed skill files are symlinks into the repo, so the row reported 0 mentions of a string plainly present. Fix: explicit files with plain `-l`, plus a comment that the harness must not depend on which grep the operator has. The general lesson is worse than the bug: every number I hand-verified interactively was produced by a different tool than the one the committed harness uses, so hand-verification does not transfer to the harness at all.

**9. Projecting one tool's exit-code semantics onto another's.** My timing guard rejected any sample exiting 2, on the reasoning that 2 means usage error. That is OUR convention. Their detector exits 2 when it HAS FINDINGS and 0 when clean, so the guard discarded every sample and the row went UNMEASURED. Fix: only a signal/not-executable status (>=126) invalidates a sample. This also sharpened the fail-open finding - since their 0 means "clean" in their own vocabulary, a missing file returning 0 is indistinguishable from a genuinely clean page.

**Why this happened.** The shared root cause is not carelessness, it is that a broken instrument and a true negative are the same string. `0`, `[]`, empty output, and exit 0 are what a working tool prints when it finds nothing AND what a broken tool prints when it looked nowhere. There is no way to tell them apart by reading the result. The only discriminator is whether the instrument fires on something you already know is there.

**What changed as a result.** The harness will not report a detector number until that detector fires on a planted positive and stays clean on a known-negative; rows behind a failed canary emit UNMEASURED, not a pass. The gate is runnable on its own via `--selftest`, and it earned its keep by catching failure 3 on its first execution - a bug I had already written into the script while believing I had verified the underlying behavior by hand.

The lesson to carry: I verified the competitor's detector output manually, then wrote a function to read that same output, and the function was wrong. Manual verification of a behavior does not transfer to the code that later measures it. The canary has to live inside the harness.
