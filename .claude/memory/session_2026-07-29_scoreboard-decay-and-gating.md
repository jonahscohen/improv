---
name: A scoreboard is an instrument too, and it decays in two directions
description: Per-row derivation stamps plus loud drift detection, after one row's VALUE went stale against a fixed command and another row's COMMAND went stale against a grown surface
type: decision
relates_to: [session_2026-07-29_scoreboard-harness.md, session_2026-07-29_scorekeeper-instrument-failures.md, decision_scorekeeper_rejected_claims.md]
author_human: Jonah
author_model: claude-opus-4.8
machine: spare3
source: session
verified: both decay modes reproduced; stamps and drift exit code live
confidence: high
---

Two rows on the scoreboard went wrong in opposite directions within a few hours, and the pair is the argument for treating the board itself as an instrument under maintenance.

**Decay mode 1 - the VALUE goes stale against a fixed command.** "Defects living only in a linked stylesheet" was scored WIN on the evidence "exit 3, refuses to certify clean." That was true when written. The lead re-ran it and measured exit 1, a verdict-precedence inversion where inconclusive lost to findings. By rule 2 the row is a LOSS until the command reproduces the number. (Re-measured at the time of writing: exit 3 again, because the fix landed in between - which is itself the point. The row's truth value changed three times in one session and the document could not express that.)

**Decay mode 2 - the COMMAND goes stale against a grown surface.** "Detector engine DISCOVERABLE" swept two named files, `SKILL.md` and `CHEATSHEET.md`, and read 0. `sidecoach-detect` lives in `reference/tools.md`. The loadable surface had grown from 2 files to 11 when the reference directory shipped, and the row was still looking at 2 of them. Measured across the whole surface: sidecoach-detect 3 files, sidecoach-image 4, sidecoach-palette 3. The image row's "1 of 11" was wrong for the same reason.

Neither is a careless number. Both were correct when derived and neither announced that it had stopped being correct.

**What was added.**

1. **Per-row derivation stamps.** Every row now carries the commit it was DERIVED at, not merely the commit the document was generated at. A reader can see whether a value came from this HEAD or an older one.
2. **Loud drift detection.** The harness writes `benchmark/derivations.tsv` and compares each new verdict against the previous run's. A changed verdict is named on stderr and the run **exits 10**. A silent overwrite is exactly how a regression gets absorbed into the next generation and never seen.
3. **Surface sweeps replaced hardcoded file lists.** Discoverability rows now walk the whole installed surface via `find -L` plus per-file grep, so adding a document cannot silently shrink a row's scope again. Audited the two adjacent rows the lead flagged: the tools-named sweep had the same bug and is fixed; the per-capability playbook count was reading the dev tree instead of the installed surface and now reads the installed one.

**Anti-spoof gate on the fail-closed rows.** `adversary` substituted a detector that could not run at all - printing "Cannot find module" and exiting 2 - and it scored the identical WINs as the real detector, because the rows tested only `exit != 0`. The wins are substantively deserved (our codes are differentiated 2/3/2 with a reason on stderr; theirs exits 0) but the row could not prove it. Each row now requires the SPECIFIC documented code AND that the tool emitted its own `sidecoach-detect:` diagnostic rather than a module-load failure. A detector that cannot run cannot earn a fail-closed win.

**Timing guard, corrected twice.** First version rejected any nonzero exit, discarding legitimate findings runs. Second version rejected exit 2 as a usage error - which is OUR convention, and their detector exits 2 when it HAS findings, so every competitor sample was thrown away and the row went UNMEASURED. Valid codes are now passed per tool: ours `0|1|3`, theirs `0|2`. Do not project one tool's exit-code semantics onto another's.

**On UNMEASURED growth, which was raised as a risk that it hides regressions.** It does not, here, and the direction is checkable: of the rows sitting at UNMEASURED, five are blocked by the charter or by the absence of any counterpart to measure (competitor typecheck - their dependencies are absent and installing is forbidden; model-backed operation cost - no credential may be spent; rendered browser lane - same install ban; per-image cost - relayed, reproducing it costs money; mutation-kill rate - they have no mutation harness in their tree at all, so there is nothing to run head to head). Exactly one, cost per static detector run, is a harness gap left open deliberately because measuring network egress for both processes is real work for a near-certain answer.

The decisive fact: UNMEASURED grew by removing two of OUR OWN wins (typecheck, mutation controls) and one tie (static cost). It did not convert a single LOSS into an UNMEASURED. The tally got worse for us because it got more honest, which is the only direction this board is allowed to move under pressure.
