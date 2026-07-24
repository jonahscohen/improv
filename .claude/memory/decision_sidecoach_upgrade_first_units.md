---
name: Sidecoach upgrade plan - first units chosen (3a + 4a, not the flagship)
description: Jonah chose to start the sidecoach upgrade plan at Stage 3a (real detect CLI) + Stage 4a (rendered font-family class), executed by parallel named teammates, rather than opening with the top-ranked Stage 1 defect-mining loop. Records the reasoning, the three pushbacks on the plan, and two plan-drift corrections found at execution time.
type: decision
relates_to: [session_2026-07-23_sidecoach-upgrade-plan.md, session_2026-07-23_oracle-v4-gap-analysis.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: baseline probed before dispatch - npm run build green, npm test 71 suites passed; unit verification pending teammate reports
confidence: high
---

Collaborator: Jonah. 2026-07-23. Jonah asked for a read on the staged upgrade plan and then for a recommendation. Choice made via AskUserQuestion: **start at Stage 3a + Stage 4a, executed by parallel named teammates**, not at the top-ranked Stage 1.

## Choice made
Land the two cheapest provable units first - `bin/sidecoach-detect.js` (Stage 3a) and the rendered `font-family` taste class (Stage 4a) - concurrently, each clearing its own runnable verify check.

**Alternatives considered:**
- Stage 1 flagship first (provider sampling + defect distribution): rejected as the OPENING move. It is correctly ranked #1 strategically and is the one durable borrow, but it is the stage most likely to consume weeks of API budget and terminate in a JSON artifact nobody wires up. It also reads better against a wider rule set, which Stage 4 supplies.
- Cheap probes first (measure our own concept sameness + the power analysis for the ablation delta): rejected as the opener but NOT dropped - both remain live questions (see pushbacks) and 1a supplies the sampler that answers the sameness one.
- Amend and re-stamp the plan before executing: rejected. The plan's own meta-finding is that this is the FIFTH borrow list and the prior four never drained; another turn spent improving the artifact is the documented failure mode, not the fix.

**Why this one:** 3a is wiring over scanners that already work (no new detection logic), and it is the soft prerequisite that makes 1b and every later Stage 4 class trivial to bolt on. 4a is a computed `font-family` read against a vocabulary that already exists in the repo. Both are days not weeks, both are provably done or provably not, and landing them converts the plan from list five into work in progress.

**Revisit when:** 3a + 4a are green and reviewed. At that point the sequencing question reopens - Stage 1a/1b should follow immediately, and the two open measurement questions below should be answered before 1d or 2c get built.

## Three pushbacks on the plan (raised, not yet folded into the doc)
1. **Stage 1d (prose ablation) has an unanswered power question.** It measures a defect-rate delta that may be smaller than run-to-run variance, over a paired with/without generation per line per provider. The plan locks N via `power-analysis.mjs` elsewhere but never states what N makes an ablation delta significant. If that N is large, 1d is not MED-HIGH - it is expensive and inconclusive. Answer the power question BEFORE building 1d.
2. **Stage 2c (outside-ranking roll) borrows a conclusion, not a mechanism.** The roll exists to break model sameness; the rival measured THEIR sameness (30/35 identical concepts over 16 runs). We have never measured OURS. Stage 1a's sampler gives us that measurement almost free - take it before spending 2c's MED effort.
3. **The sequencing puts the payoff last.** Recommended order lands the flagship mid-list; a stall at 60% leaves better plumbing and no defect-mining loop.

## Plan-drift corrections found at execution time (plan stamped @a22d41fc, HEAD @1ea7ae73)
Drift is 3 commits and none of it invalidates the plan - `4d61ba1f` is the live-verb removal the plan already assumed was in flight, plus two hook false-positive fixes. Two factual corrections to the plan's current-state section:
- **Font vocabulary location is imprecise.** The plan says it "lives in `src/fontshare-reference.ts` (name/family/fallback)". That file is a service CLASS; the actual vocabulary lives in `src/reference-data.ts` (`getFontNames()`, `getFont()`, the fontshare-sourced typeface entries and a `system_fonts` entry). Stage 4a work must ground on `reference-data.ts`.
- **CLI inventory is stale by one.** The plan lists 6 files in `bin/`; there are 7 (`sidecoach-artifacts.js` is unlisted). The load-bearing claim - that there is NO `detect` CLI - still holds.

## Verification baseline at dispatch (Team Rule #9)
Probed BEFORE any change: `npm run build` green (generate-lanes + generate-validators + `--check` no drift + tsc); `npm test` green at **71 suites passed**. Both units are required to keep this green and to explain any golden-snapshot drift rather than blindly regenerating it.

## Files touched
- this beat + MEMORY.md index. No code changed by the lead - two teammates dispatched to build 3a and 4a.
