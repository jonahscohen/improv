---
name: Distributability GAP4 - SKILL.md de-machine-bound (absolute path killed, monitor on PATH)
description: First bite of the mission-primary backlog. The sidecoach SKILL.md hardcoded this machine's absolute repo path to sidecoach-monitor.js, making the skill non-portable to any other checkout; replaced with a bare-name PATH invocation wired through install.sh the same way the existing sidecoach CLI symlink already works. Also CORRECTS the 06-23 gap: "requires a TS build" is now FALSE (dist/ + generated sources are tracked; the CLI runs build-free).
type: project
relates_to: [session_2026-07-23_borrow-list-reconciliation.md, session_2026-06-23_sidecoach-oracle-gap-analysis.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests - grep proves 0 absolute paths in SKILL.md; `command -v sidecoach-monitor` resolves; monitor emits VALID JSON from 4 cwds incl /tmp and $HOME; bash -n install.sh OK. Full npm test DEFERRED (a5a-label labeling is live in sidecoach/).
confidence: high
---

Collaborator: Jonah. 2026-07-24. After the borrow-list reconciliation surfaced that the plan is blind to the three MISSION-PRIMARY gaps, Jonah chose to act on that backlog rather than build more plan capability. Took the most concrete of the three: **distributability (GAP4, first captured 2026-06-23)**.

## Drift check FIRST (the gap is a month old - Team Rule #10)
Verified each 06-23 claim at HEAD `1ea7ae73` before touching anything:
- "No plugin manifest" - **STILL TRUE**. No `.claude-plugin/plugin.json` anywhere.
- "SKILL.md hardcodes an absolute path" - **STILL TRUE**, unchanged for a month, at `claude/skills/sidecoach/SKILL.md:54` and `:68`.
- "Bare package metadata" - **STILL TRUE**. `sidecoach-intent-detector` 0.1.0, no files/license/repo/description.
- "Requires a TS build before anything runs" - **NOW FALSE (gap corrected).** `dist/` is tracked (1189 files) AND `src/lanes.generated.ts` + `src/validators.generated.ts` are tracked. PROVEN: `node bin/sidecoach.js --help` runs and exits 0 with no build. The compiled output ships, so a consumer does not build.

## What was actually wrong, and the fix
The SKILL invoked the monitor as `node /Users/spare3/Documents/Github/improv/sidecoach/bin/sidecoach-monitor.js ...`. Any other checkout, machine, or teammate gets a dead path. **It was the ONLY skill in `claude/skills/*/SKILL.md` that hardcodes a path** - a singleton defect, not a house convention (grep-proven across all skills).

**Why this fix:** the repo ALREADY solved this shape twice. install.sh:4684 symlinks `sidecoach/bin/sidecoach.js` -> `~/.local/bin/sidecoach` with a PATH warning, and deactivate removes it (1681); `tilt-lab` uses the identical pattern. So the monitor just needed the same treatment rather than a new mechanism (the `claude/cmux/cmux` PATH-shim was the other candidate precedent, but the `~/.local/bin` symlink is the pattern sidecoach itself already uses).

**How:**
- `claude/skills/sidecoach/SKILL.md` - both invocations now bare-name: `sidecoach-monitor "/sidecoach <command> <target>"` and `RESULT=$(sidecoach-monitor "$UTTERANCE" --json)`.
- `install.sh` - chmod +x and `ln -sf sidecoach/bin/sidecoach-monitor.js -> ~/.local/bin/sidecoach-monitor` alongside the existing CLI symlink; PATH warning text extended to name the monitor.
- `install.sh` deactivate - removes the new symlink too, so uninstall stays complete.
- Created the symlink LIVE on this machine so the skill is not broken until someone re-runs install.sh (mirrors the cmux precedent: live immediately, no restart).

## Verification (real, not claimed)
- `grep -n "/Users/" claude/skills/sidecoach/SKILL.md` -> exit 1, ZERO matches.
- `command -v sidecoach-monitor` -> `/Users/spare3/.local/bin/sidecoach-monitor`.
- `bash -n install.sh` -> OK.
- Monitor emits **VALID JSON** (jq) with 0 raw ESC from FOUR cwds: repo root, sidecoach/, `/tmp`, `$HOME` - the portability claim actually tested from foreign directories, not asserted.

## Observed-once anomaly (recorded honestly, NOT reproduced, NOT caused by this change)
The first e2e run of the SKILL template from `/tmp` failed `JSON.parse` with `Bad control character in string literal at position 1592` - the `panel` field contained raw ANSI escape codes, which are invalid inside a JSON string. If that recurs it breaks the SKILL's own documented `JSON.parse` contract. I could NOT reproduce it: valid JSON across 4 cwds, with and without stderr redirect, and under NO_COLOR=1 / FORCE_COLOR=1 / FORCE_COLOR=3. Confirmed NOT caused by this change (the old absolute-path invocation parses fine; the change altered only HOW the monitor is invoked, not its output). Recorded as a real one-off observation with its exact error rather than inflated into a confirmed bug or buried.

## Deferred (NOT done - do not read this beat as "distributability closed")
- `.claude-plugin/plugin.json` manifest - still missing.
- package.json metadata + `files` allowlist - still bare.
- Absolute paths remain in `src/dogfood-*.ts` and several `src/__tests__/*.ts` (dev-only, lower priority than the shipped SKILL).
- **Full `npm test` gate NOT run** - the a5a-label Codex labeling pass is live in `sidecoach/` and running the suite would race it. Nothing in this unit touches `sidecoach/` source, so the risk is low, but the gate is owed before this is called complete.
- Independent cross-model review of this diff still owed.

## Files touched
- claude/skills/sidecoach/SKILL.md (2 invocations de-absolutized)
- install.sh (monitor symlink + chmod + PATH warning text; deactivate cleanup)
- live: ~/.local/bin/sidecoach-monitor symlink created
