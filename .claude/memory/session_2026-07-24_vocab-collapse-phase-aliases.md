---
name: Vocabulary collapse - PHASE_ALIASES + modes drift, zero behavior change proven
description: Implemented decision 1 (GAP5 option B) - renamed SLASH_COMMANDS to PHASE_ALIASES (back-compat alias layer, dropped the dead verb-shadowed craft entry) and de-advertised the retired modes from bin/sidecoach.js list/help while KEEPING getMode resolution. Behavior preservation PROVEN by a before/after capture: every phase word + every retired-mode word + all 21 verbs + phrases resolve to the EXACT same target. Realized prize is a SURFACE collapse, not a big line deletion - the plan's modes.ts (-193) and getAvailableCommands (-90) deletions are blocked by out-of-scope/off-limits dependencies.
type: project
relates_to: [decision_2026-07-24_vocab-collapse-and-plugin-coupling.md, session_2026-07-24_simplification-plan.md, session_2026-07-24_simplification-phase1-deadcode.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests + before/after routing capture + routing-snapshot golden + build; codex review
confidence: high
---

# Vocabulary collapse (GAP5, option B) - PHASE_ALIASES + modes drift reconciled

Executed decision 1 (`decision_2026-07-24_vocab-collapse-and-plugin-coupling.md`):
collapse the ~5 parallel user-facing vocabularies toward verbs + NL (+ lanes preset),
keeping a thin `PHASE_ALIASES` map so every old phase word still routes, and reconcile
the modes/skill drift the audit found. RISKIEST unit; load-bearing rule = ZERO behavior
change on routing. Worked at HEAD `7ccfb169`, tree clean, baseline 76 suites green.

## What changed (owned files only)
- **`src/slash-command-router.ts`** - renamed the module-private `SLASH_COMMANDS` to
  `PHASE_ALIASES` and reframed it as an explicit back-compat alias layer (doc comment).
  Values are byte-identical to the old map EXCEPT the `craft` entry was dropped: `craft`
  is a verb, so parseSlashCommand matches the verb FIRST (line ~92) and the phase `craft`
  was provably shadowed/dead. Updated the 3 internal refs (parseSlashCommand fallback,
  knownCommandNames, matchKnownCommand). No exported signature changed.
- **`bin/sidecoach.js`** - modes drift: removed modes from the CLI DISCOVERY surface
  (usage banner, topLevelHelp "Modes" block, listAll "Modes" block, the two "Valid modes"
  error hints, the `<mode>`/`[verb|mode]` usage lines) and dropped the now-unused
  `MODE_LIST` import + `modeNames()`. KEPT `getMode` resolution in resolveAndPrint +
  helpForTarget so `sidecoach forge`/`help forge` still resolve to the identical plan
  (ONE RULE). Added a one-line footer noting deprecated phase/mode words still resolve.
- **`claude/skills/sidecoach/SKILL.md`** - reframed "two/three parallel command surfaces"
  to "21 verbs + NL typed surfaces, phase words as back-compat aliases" (line 3 desc +
  the command-surfaces section). Doc-only; SKILL.md already said modes were retired.

## Behavior preservation - PROVEN (the load-bearing check)
Wrote a before/after capture harness (scratchpad `route-capture.mjs`) that dumps, from the
COMPILED dist, what every phase word + verb + mode word + 5 phrases resolves to. Built,
captured BEFORE; implemented; rebuilt, captured AFTER. **`diff` = IDENTICAL** across:
14 phase words + shadowed `craft` (all -> same flowIds), 5 modes (getMode -> same
verbChain+chain), all 21 verbs, all 5 phrase-path inputs. Also spawned the real CLI for
12 phase/verb/mode invocations + `help forge`: every RESOLUTION invocation byte-identical.
`craft` proven to route to the VERB's 11-flow chain (starts flowA), not the dead phase
chain - dropping the dead entry changed nothing. The only intended CLI diffs are the
DISCOVERY surfaces (`list`/`help`): modes section removed, verbs/flows/setup intact.
(Self-note: one capture diff on `help forge` was a FALSE alarm - zsh does not word-split
unquoted `$w`, so the loop ran it as one arg "help forge"; the clean 2-arg re-run is
IDENTICAL. Harness artifact, not a regression - caught by reproducing before trusting.)

## Verify (real results)
1. Behavior table: every phase/mode/verb/phrase input -> SAME target (before===after).
2. `routing-snapshot.mjs verify` -> **VERIFY OK (current == golden)**, exit 0. ZERO drift
   (the golden tests the lane-classifier over the parity corpus + the verb list; I touched
   neither, so no drift - not even alias-equivalent drift was needed).
3. `npm run build` clean: tsc + generate-validators --check + generate-lanes-data --check
   all OK, no drift.
4. `npm test` -> **run-tests: 76 suite(s) passed**, exit 0. Identical to baseline 76, 0 failed.
5. `git diff --stat` (source, ex-dist): 3 files, +59/-47 (net +12).

## The honest prize + what could NOT be collapsed (left as-is, with reasons)
Realized prize is a SURFACE/vocabulary collapse + semantic reframe, NOT the plan's ~300-line
deletion, and the source line count is net +12 (dead code removed is outweighed by the
PHASE_ALIASES documentation + deprecation notes). Reason: the plan's two big deletions are
BLOCKED by dependencies outside this unit's scope:
- **modes.ts NOT deleted (plan projected -193).** `mcp-server/src/registries.ts:22` imports
  `../../dist/modes` (`MODE_LIST`, `getMode`). mcp-server retirement is Jonah's Decision B
  (out of scope). Deleting modes.ts breaks the mcp-server build. modes.ts stays as its own
  header already documents: the deprecated MCP legacy feed. "Retired consistently" achieved
  at the USER surface (no CLI advertises modes), not by file deletion.
- **getAvailableCommands phase half NOT removed (plan projected -90).** Consumed by the
  off-limits `sidecoach-orchestrator.ts` list handler (lines 740/1561, NOT the
  routing-dispatch region). Emptying it would strand the orchestrator's unconditional
  "## Phase commands" header, a cosmetic regression I cannot fix without touching the
  off-limits file. So the IN-SESSION `/sidecoach list` still groups phase commands.
- **mode words still RESOLVE in the CLI (by the ONE RULE).** Verify check #1 requires
  retired-mode words to resolve to the same target after, so getMode dispatch stayed;
  modes are de-advertised, not removed. This is the exact intersection of "list no longer
  surfaces modes" (deliverable) and "retired-mode words resolve to the same target" (ONE
  RULE) - deprecated back-compat aliases, symmetric with PHASE_ALIASES.

## Follow-ups (flagged, not done here)
- In-session `/sidecoach list` still shows "## Phase commands" - collapsing that display
  needs an orchestrator list-handler edit (off-limits this unit) or a getCommandsByPhase
  redesign. modes.ts + getAvailableCommands deletions ride on Decision B / an orchestrator pass.
- CHEATSHEET.md / README / sidecoach-modes.json still reference modes; left untouched
  (out of the tight owned surface; sidecoach-modes.json is a shared mcp-server feed).

## Why / How
**Why** rename-not-delete + de-advertise-not-remove: the ONE RULE (zero routing change,
proven) dominates the line-count prize. Every big deletion the plan wanted is gated on an
out-of-scope (mcp-server) or off-limits (orchestrator) dependency, so the safe, honest
delivery is a surface collapse with a proof of zero behavior change. **How**: module-private
rename with the 3 internal refs updated; a before/after dist capture as the fail-loud proof;
kept every exported signature and the getMode dispatch intact; independent Codex review.

Collaborator: Jonah
