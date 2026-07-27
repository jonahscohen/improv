---
name: Installer coverage-closure HALTED - a second agent is doing the same unit live
description: Baseline re-proven (52/1/139/26/parity), read-only per-class drift audit completed, then work stopped without editing anything because install.sh, browser-tree.json and hook-registry-guard.sh were observed changing under me mid-session
type: project
relates_to: [session_2026-07-27_installer-coverage-audit.md, session_2026-07-26_agent-routing-task7-codex-fix.md]
author_human: Jonah
source: session
verified: baseline suites re-run green; collision proven by timestamped file-appearance evidence, not inference
confidence: high
---

# Installer coverage closure - halted on a live write collision (2026-07-27)

Collaborator: Jonah. Unit assigned: measure and close the UNGUARDED installer
coverage classes (skills, agents, hook runtime data files, bin launchers,
settings wirings) left open by the 2026-07-27 coverage audit, then extend the
enforcement mechanically.

**No files were edited. The unit was halted before the first write.** The reason
is the finding.

## Verification baseline (Team Rule 9, taken BEFORE anything)

At HEAD `e42b9a57`, all five named suites run and pass:

| suite | result |
|---|---|
| test-hook-registry.sh | 52 passed, 0 failed |
| test-installer-manifest.sh | PASS |
| test-component-browser.sh | 139 passed, 0 failed |
| test-install-hook-deploy.sh | 26 passed, 0 failed |
| test-settings-deploy-parity.sh | ALL PARITY CHECKS PASSED |

Matches the numbers the prior audit recorded, so the baseline is real and stable.

## The collision, proven by timestamps rather than assumed

The working tree already contained an uncommitted `install.sh` (+240/-65)
implementing a `hook_data_files()` table - which is precisely this unit's
highest-value class. The tell that it was IN-FLIGHT rather than finished: its
comments referenced three artifacts that **did not exist on disk** at the time
of reading (`hook-registry-guard.sh --audit-data`, a `hook_data` key in
`browser-tree.json`, and `claude/hooks/test-hook-data-parity.sh`).

Those three artifacts then appeared, one at a time, while this session watched:

| local time | observation |
|---|---|
| 06:25:22 | `test-hook-data-parity.sh` **absent**; `hook_data` **not** in browser-tree.json; `audit-data` occurrences in hook-registry-guard.sh = **0** |
| 06:25:30 | install.sh mtime moves |
| 06:25:55 | browser-tree.json rewritten - now **has** `hook_data` |
| 06:26:31 | hook-registry-guard.sh rewritten - now has **3** `audit-data` occurrences |
| 06:27:39 | `test-hook-data-parity.sh` **created**, 9228 bytes |
| 06:28:15 | `test-ampersand-shim.sh` created, 18657 bytes |

`git status` gained two modified files and two untracked files between 06:25:22
and 06:27:45. A second session (`725f113d`) was observed running commands in this
repo throughout, and `cmux list-panels` showed two `opus-executor` panes.

**Why this had to stop the unit rather than be worked around:** the three files
being rewritten - `install.sh`, `browser-tree.json`, `hook-registry-guard.sh` -
are exactly the three this unit would have had to edit. Two agents editing them
concurrently guarantees one silently loses the other's work, and neither would
notice until a suite went red for reasons unrelated to either change. Design
belongs to the orchestrator; picking a merge strategy unilaterally is not an
execution decision.

## Per-class drift audit (read-only, completed - this part is still valid)

Measured against **HEAD `e42b9a57`** (the committed baseline), because the working
tree is a moving target. "installer refs" counts mentions in install.sh.

| class | on disk | deployed by install.sh at HEAD | delta at HEAD |
|---|---|---|---|
| skills | 18 dirs under `claude/skills/` | 17 (16 of the 18 + `justify`, which lives outside `claude/skills/`) | **GAP: `consolidate`, `tilt-lab` - 0 references, never deployed** |
| agents | 3 `.md` in `claude/agents/` | all 3, via the `route-intent.sh` special case (`install.sh:5098`) | none |
| hook data/config | 9 `.json` in `claude/hooks/` | 7 | **GAP: `grounding-intent.json` (read by grounding-gate.sh) and `consolidate-intent.json` (read by consolidate-nudge.sh) - 0 references, never deployed** |
| bin launchers | 3 | 2 (`claude-teams-launcher.sh`, `tilt-lab-launcher.sh`) | `bin/ampersand` is new/untracked - owned by the concurrent ampersand teammate, not this unit |
| wirings | settings/app/cluster wirings JSON | referenced | no drift found; `test-settings-deploy-parity.sh` already covers this direction |

The two data-file gaps are the **runtime-breaking** class and the same defect
shape that shipped twice before (`route-intent.json` 2026-07-26): both
`grounding-gate.sh` and `consolidate-nudge.sh` guard on `[ -f "$INTENT_FILE" ] ||
exit 0`, so on a fresh install they load, look present, and do nothing, forever,
with no signal. The two skill gaps are lower severity (a missing `/consolidate`
and `/tilt-lab` surface, which fails visibly rather than silently).

The concurrent agent's in-flight `hook_data_files()` table closes both data-file
gaps and both skill gaps. So the fix being built is the right fix - it is the
duplication that is the problem, not the direction.

## Self-analysis

**Why did this happen?** The brief named one collision risk (`bin/ampersand` and
install.sh lines ~4340-4450, reserved for the ampersand teammate) and this session
took that enumeration as the complete set of concurrency hazards. It was not: a
second agent held the *rest* of install.sh plus two files the brief never
mentioned.

**How was it caught?** Not by reasoning. The first `git status` showed install.sh
already modified, and the reflex to check whether that diff was finished or moving
- `stat` the mtime, then re-`stat` it - is what surfaced it. The decisive evidence
was cheaper still: reading a file the diff's own comments referenced
(`test-hook-data-parity.sh`), finding it absent, and finding it present three
minutes later. **A comment referencing a file that does not exist is a reliable
in-flight signal**, and it cost one `ls` to check.

**The generalisable rule:** before editing any file that `git status` already
reports as modified, establish whether the existing modification is at rest. An
mtime that moves twice inside a minute is a writer, not a leftover. This is the
same class of error the 2026-07-23 beat named - acting on a proxy (git status says
"modified") instead of the condition (is someone writing it right now).

## What the orchestrator has to decide

1. Whether this unit is redundant with the in-flight agent and should be dropped.
2. If not, which agent owns `install.sh` / `browser-tree.json` /
   `hook-registry-guard.sh`, so exactly one does.
3. `MEMORY.md` was deliberately **not** edited by this session - it was already
   modified and uncommitted by another agent, and appending to a file a teammate
   is mid-edit is the same collision this beat is about.

## Files touched

None. This beat is the only artifact. No commits, no edits to `install.sh`,
`bin/ampersand`, `browser-tree.json`, or any hook.
