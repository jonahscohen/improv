---
name: Falsifiable scoreboard vs LOCALPROJECTX plus a runnable harness
description: benchmark/SCOREBOARD.md and run-scoreboard.sh - 26 canary-gated rows across 9 metric families, tallying WIN 8 / LOSS 15 / TIE 1 / UNMEASURED 2
type: project
relates_to: [session_2026-07-29_scorekeeper-instrument-failures.md, feedback_sidecoach_mission_beat_oracle.md]
author_human: Jonah
author_model: claude-opus-4.8
machine: spare3
source: session
verified: commands rerun head to head, both instruments canary-gated
confidence: high
---

Built the scoring mechanism the team must clear before anyone claims a win against LOCALPROJECTX.

Deliverables, both in `sidecoach/benchmark/`:
- `run-scoreboard.sh` - regenerates the scoreboard from scratch. Any agent can run `bash benchmark/run-scoreboard.sh`. `--selftest` runs the instrument canaries alone and exits nonzero if either detector fails its canary.
- `SCOREBOARD.md` - generated, never hand-edited.
- `fixtures/{canary,linked-css,clean}` - written fresh on every run so the harness is self-contained.

Tally at commit 56251cb7: **WIN 8 / LOSS 15 / TIE 1 / UNMEASURED 2**, 26 rows.

Nine metric families covered: capability coverage, reach/distribution, discoverability, reachability, output quality on identical inputs, verification depth, cost per operation, wall-clock speed, failure behavior.

**Why the harness discovers the competitor tree instead of hardcoding it:** the naming constraint bans the real directory name from anything written. `find_localprojectx()` probes siblings of the repo root for two marker paths (`skill/scripts/detect.mjs` plus `cli/engine/registry/antipatterns.mjs`), with `LOCALPROJECTX_DIR` as an override. The name never appears on disk in our tree and the script still runs with zero configuration.

**How:** every row carries a command that actually runs. Default posture is LOSS; a row flips to WIN only when the command produces the number. UNMEASURED is tallied separately and never rounds up - two rows sit there honestly (end-to-end model-backed cost, because no credential may be spent on a benchmark, and the rendered/browser lane head to head, because the competitor's render path needs a dependency install the charter forbids).

Rows we win, all of them on fail-closed behavior or engine depth: rule registry size (81 vs 60), findings on the identical canary (16 vs 5), verb count in the entry doc (24 vs 23), typecheck green, and the four failure-behavior rows.

Rows we lose that matter most are recorded in the discoverability beat. The single largest gap is distribution, not capability.
