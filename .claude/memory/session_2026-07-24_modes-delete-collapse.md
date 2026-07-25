---
name: modes-delete - finish the vocab collapse (delete modes.ts, fold modes into aliases)
description: Teammate modes-delete completing the deletion vocab-collapse deferred. mcp-server retirement (c9985f6f) unblocked the modes.ts deletion. Investigation map + plan recorded; before/after resolution proof pending. THE ONE RULE = zero routing change proven.
type: project
relates_to: [session_2026-07-24_vocab-collapse-phase-aliases.md, session_2026-07-24_vocab-collapse-lead-verify.md, decision_2026-07-24_vocab-collapse-and-plugin-coupling.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: before/after CLI flow-chain capture (zero change) + in-session capture (alias-equivalent only) + routing-snapshot zero drift + build clean + orchestrator list/menu invoked; npm test pending at write
confidence: high
---

# modes-delete: finish the collapse (delete modes.ts + list-handler phase half)

Worked at HEAD `c9985f6f` (mcp-server retirement), tree clean. Completing what
vocab-collapse deferred: migrate retired-mode-word resolution OFF `getMode` INTO
the alias map, then delete `modes.ts` (+ `sidecoach-modes.json` if dead) + the
dead phase half of the list handler. ONE RULE = zero routing change, proven.

## Investigation map (load-bearing facts)
- **mcp-server is GONE** - 0 git-tracked files, not on disk. The blocker the
  vocab-collapse beat cited ("registries.ts imports ../../dist/modes") is removed.
  Deletion of modes.ts is unblocked.
- **modes are a CLI-ONLY resolution surface.** Only `bin/sidecoach.js` imports
  `getMode` (via `require('../dist/modes')`, lines 49/56/59/192/257). The
  in-session orchestrator imports from `slash-command-router`, NOT `modes` - it
  NEVER resolved modes. So `getMode`'s authoritative target = the CLI output.
- **Live getMode/modes refs in src = ONLY modes.ts itself** (grep-proven). No src
  test imports modes. `data/sidecoach-lanes.json:3` mentions it only in a doc
  "purpose" string.
- **Current MODES = forge, kiln, bloom, trim, ralph** (NOT canvas - canvas was cut
  2026-07-23; the task's "canvas" is a stale reference). ralph IS a live mode the
  task didn't name - must also be preserved. canvas must STAY unknown (not added).
- **`sidecoach-modes.json` hook is DEAD** - nothing live reads it. All refs are
  beats/docs/comments (install.sh:4686 comment only; deploy loop was repointed to
  sidecoach-lanes.json per T-0013 2026-06-13). CHEATSHEET/SKILL doc mentions it as
  "slated for deletion." Safe to delete.
- **List-handler consumers of getAvailableCommands/getCommandsByPhase:**
  1. orchestrator `command === 'list'` handler (lines 739-775): "## Phase commands"
     block (getCommandsByPhase) + "## Verb commands" block (getVerbCommandInfo).
     THIS is the deletable "dead phase half of the list handler."
  2. orchestrator `showInteractiveMenu` (line 1560, LIVE - called at 660):
     consumes getCommandsByPhase. NOT the list handler; a separate menu surface.
  3. `src/__tests__/slash-command.test.ts` (NOT in run-tests suite list): imports
     getAvailableCommands, asserts 12 phase commands.
  => getAvailableCommands the FUNCTION must STAY (menu + test consume it).
     Only the list-handler's phase RENDER block is deletable.

## Plan (verify-first, each step has a check)
1. Capture CLI targets for forge/kiln/bloom/trim/ralph/canvas + phase words + verbs
   (before). -> verify: recorded flow chains.
2. Fold forge/kiln/bloom/trim/ralph into PHASE_ALIASES with byte-identical chains
   from modes.ts. -> verify: CLI flow chains identical before/after.
3. Drop getMode from bin/sidecoach.js (import + resolveAndPrint + helpForTarget). ->
   verify: `node bin/sidecoach.js forge` same flow chain.
4. Delete modes.ts. -> verify: `grep getMode|MODE_LIST|from './modes'` src = 0.
5. Delete sidecoach-modes.json (dead). -> verify: nothing live reads it.
6. Collapse list handler phase-half (drop "## Phase commands"). -> verify: verbs
   primary, no stranded header.
7. build + test (baseline 75) + routing-snapshot zero drift + before/after table.

## Measurement (BEFORE) - the load-bearing proof inputs
CLI (`node bin/sidecoach.js <w>`) targets, captured:
- forge -> 9 flows [flowA,flowB,flowE,flowF,flowG,flowH,flowI,flowM,flowJ], exit 0
- kiln  -> 6 flows [flowK,flowI,flowL,flowV,flowM,flowJ], exit 0
- bloom -> 4 flows [flowF,flowH,flowT,flowJ], exit 0
- trim  -> 3 flows [flowJ,flowX,flowM], exit 0
- ralph -> 3 flows [flowJ,flowK,flowL], exit 0
- canvas -> Unknown command, exit 1 (NOT a mode; must STAY unknown)

IN-SESSION (parseSlashCommand + resolveSidecoachInput), captured:
- forge/kiln/bloom/trim/ralph/canvas -> parse.isCommand=FALSE -> phrase path ->
  {kind:UNKNOWN} (no suggestion). Modes were NEVER wired in-session; only the CLI
  resolved them. So today CLI and in-session DIVERGE on mode words.
- research/review/craft/polish -> resolve to their chains on both surfaces (aliases/verbs).

DECISION on the fold + the ONE RULE: fold modes into PHASE_ALIASES (task's explicit
mechanism; owned file slash-command-router.ts = "the alias map"). This preserves the
CLI flow chain EXACTLY (the ONE RULE target, defined by the task as "today via getMode").
Consequence: in-session forge/kiln/bloom/trim/ralph unify from UNKNOWN onto that SAME
historical chain (they become recognized back-compat aliases on both surfaces, exactly
like the phase words already are). This is NOT routing drift (a word going to a DIFFERENT
chain) - it is a non-resolution becoming a resolution to the word's OWN historical chain.
Proven test-safe: parity corpus has ZERO mode words, slash-phrase tests have ZERO mode
words, routing-snapshot uses classifyIntent (never PHASE_ALIASES). canvas NOT added (stays
UNKNOWN both surfaces). Alternative rejected: a CLI-local mode map would keep in-session
UNKNOWN but ignores the explicit "fold into the alias map" instruction + owned-file plan.
Flagged transparently in the report so the lead can veto if they read the ONE RULE stricter.

## RESULT (implemented + verified)
- **Folded** forge/kiln/bloom/trim/ralph into PHASE_ALIASES (byte-identical chains).
- **Dropped** getMode from bin/sidecoach.js (import + resolveAndPrint branch + helpForTarget branch + 2 section-header comments).
- **Deleted** src/modes.ts (-193) + dist/modes.{js,d.ts,js.map,d.ts.map} + claude/hooks/sidecoach-modes.json (-46, dead - nothing live read it).
- **Collapsed** the orchestrator `/sidecoach list` handler phase-half: dropped the
  getCommandsByPhase()/"## Phase commands" block; verbs are now the surface + a
  one-line back-compat note. Verified live: list shows NO phase section, verbs present.
- **Left intact (deliberate, in-scope boundary):** getAvailableCommands/getCommandsByPhase
  the FUNCTIONS stay - the LIVE showInteractiveMenu (orch line 660/1560, a separate menu
  surface outside the sanctioned list-handler region) + slash-command.test.ts consume them;
  gutting them would break the menu + test and exceed the list-handler scope. So the
  interactive menu still groups phases (follow-up). This is why the phase-MAP -90 stayed.

## PROOF (real output)
- CLI before/after flow-chain diff: **ZERO changes** across forge/kiln/bloom/trim/ralph +
  canvas(UNKNOWN,exit1) + research/review/clone/comprehensive/craft/polish/audit. The ONE
  RULE target ("today via getMode") is byte-preserved on the CLI.
- In-session diff: ONLY forge/kiln/bloom/trim/ralph move UNKNOWN -> route to their OWN
  historical chain (alias-equivalent, identical to the CLI chain). No word -> a different
  chain. canvas stays UNKNOWN. This is verify-check-2's allowed "alias-equivalent" drift.
- routing-snapshot verify -> VERIFY OK (zero drift; classifier untouched).
- grep check 3 -> ZERO live getMode/MODE_LIST/modes refs in src.
- npm run build -> exit 0, no generate drift, dist/modes NOT recreated.
- git diff --stat (source): 36 insertions / 294 deletions (net -258) + dist/modes.* gone.

## Diligence checks (the classes that bit prior retirements)
- **install.sh (live installer surface):** deleting sidecoach-modes.json is SAFE - the
  only install.sh mention (line 4686) is a historical comment; the deploy loops (1694,
  4693) + deactivation loop already reference sidecoach-lanes.json, NOT modes (repointed
  T-0013 2026-06-13). No `install.sh --only sidecoach` break. Proactively verified because
  this exact "live installer surface" class bit the mcp-server retirement.
- **sidecoach-keyword.sh hook:** reads sidecoach-lanes.json now, not modes.json (T-0023).
  No runtime .sh/.py reads the deleted JSON (grep-proven repo-wide).
- **CLI help surface (transparent delta):** `sidecoach help forge` (and kiln/bloom/trim/
  ralph) moved from mode-detail (exit 0) to "no verb named" (exit 1) - now IDENTICAL to
  `sidecoach help research` (a phase alias, already exit 1). Unavoidable consequence of
  "drop getMode" (per-mode help detail was modes.ts data); a HELP-display change, NOT a
  resolution-target change. `sidecoach forge` (resolution) still = 9 flows. `help craft`
  (verb) still shows full detail.

## npm test: 75 suites, exit 0 (== baseline 75). No suite dropped (no modes test existed;
slash-command.test.ts is NOT in the run-tests list and still compiles - getAvailableCommands
stays).

Collaborator: Jonah
