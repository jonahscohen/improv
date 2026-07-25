---
name: 6 standalone bins made discoverable on the sidecoach CLI + drift wired into the audit flow
description: sidecoach list/help + SKILL.md now enumerate palette/roll/preauthor/deck/refs/drift; drift additionally flow-invoked as flowK's Theming token-drift lens
type: project
relates_to: [session_2026-07-25_drift-detector-wired.md, session_2026-07-25_reference-update-service-wired.md, session_2026-07-24_stage2a-palette-recipe.md, session_2026-07-24_stage2bd-preauthor-deck.md, session_2026-07-24_stage2c-direction-roll.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: probe (15/15) + 4 regression suites + tsc + regression diffs + foreground codex (0.142.5, 4 P2/P1 folded)
confidence: high
---

# Wire-up: 6 orphaned bins -> discoverable + reachable; drift -> flow-invoked

Closes the gap flagged to Jonah: `bin/sidecoach-{palette,roll,preauthor,deck,refs,drift}.js` were built + tested
but the primary `sidecoach` CLI surface never surfaced them, so a user could not discover or reach them.
Authored against HEAD f493eb1e.

## Tiers (honest, per bin)

- **DISCOVERABLE (tier 1)**: palette (2a), roll (2c), preauthor (2b), deck (2d), refs, drift. All 6 are now
  enumerated by `sidecoach list` and `sidecoach help` (grouped Generative: palette/roll/preauthor/deck;
  Governance: refs/drift) and documented in `claude/skills/sidecoach/SKILL.md` (per-tool purpose + invocation
  + exit contract).
- **FLOW-INVOKED (tier 2)**: `sidecoach-drift` ONLY. flowK (multi-lens audit) now shells out to the drift bin
  for its Theming/token-consistency lens.

## Why drift is the only genuine flow wire (not forced)

flowK's "Theming" dimension already claims to check "Token consistency (no hardcoded colors)" / "No hardcoded
breakpoints (use tokens)" but shipped as a static `warning / ['visual testing required']` placeholder. Drift
measures EXACTLY that (custom-property tokens off the DESIGN.md baseline). canExecute already requires
`context.projectPath` = drift's only input. No fabrication -> real fit. Mapping is honest + fail-closed:
- verdict `drift` -> escalate Theming to **fail**, name the drifted tokens (proven defect).
- verdict `clean`/`inconclusive` -> Theming stays **warning** (the other 4 theming checks are still manual);
  append an audited note. NEVER a false pass on the whole dimension from one clean sub-check.
- any bin failure (missing/timeout/non-JSON/exit-2 empty-stdout) -> helper returns `null` -> STATIC placeholder
  retained, audit never crashes.

## Why the other 5 stayed discoverable (honest reasons)

- **preauthor**: named as a candidate ("render-before-build gate in a build flow") but its input is a brief
  JSON (name+surface+palette+type) that NO flow-handler execution context carries. flowG (build) emits guidance,
  it does not build, so there is no in-handler build to gate; a subprocess wire would mean FABRICATING a brief.
  Left discoverable + documented as the pre-build gate to run by hand.
- **palette/roll/deck**: generative authoring aids / human-in-the-loop direction pick (deck: "user picks by
  responding"). Not checks a flow's execute() would call.
- **refs**: on-demand maintenance (refresh bundled reference systems), not a per-flow check.

Architectural constraint that bounded this: flow handlers are GUIDANCE PRODUCERS (guidance[]/checklist[]/memory),
NONE shell out; the real URL-audit read path is `runRenderedAudit` in sidecoach-orchestrator.ts (line ~895) which
is OUT of ownership. So drift is wired into flowK (the guidance/composition + directory-target audit path), NOT
the URL read path - stated plainly, not overclaimed.

## Changes

- `sidecoach/bin/sidecoach.js`: added `STANDALONE_BINS` registry + `printStandaloneBins()`; rendered in
  `topLevelHelp()` (compact) and `listAll()` (detailed). Additive only.
- `sidecoach/src/flow-handler-multi-lens-audit.ts`: added `execFileSync`/`path` imports, a `DriftOutcome`
  interface + `runTokenDriftCheck()` helper (fully contained), and a call site that folds the verdict into the
  Theming dimension. Bin resolved script-relative: `path.resolve(__dirname, '..', 'bin', 'sidecoach-drift.js')`
  (works under both ts-node = src/ and compiled = dist/, since bin/ is a sibling of both). Spawned with
  `process.execPath` (same node, no PATH dependence) + 20s timeout.
- `claude/skills/sidecoach/SKILL.md`: new "Standalone tools" section (two tables + drift flow-wire note).

## Verify (real output captured)

- `node bin/sidecoach.js list` / `help` show all 6 grouped; exit 0. Regression diff vs HEAD copy: NO pre-existing
  list/help line removed or changed (additions only); `help audit` + `audit <target>` resolve byte-IDENTICAL;
  unknown verb still exit 1.
- Drift flow wire probe (ts-node, `.probe-drift-in-audit.ts`, 15/15 PASS): drift-project -> Theming **fail**
  naming 5 tokens (bin invoked); clean-project -> warning + "none - tokens match" note (no false fail); no-design
  -> warning "not assessed" fail-closed (never pass); nonexistent dir (exit 2, empty stdout) -> STATIC placeholder
  kept, execute status success, NO throw (failure contained).
- `npx tsc --noEmit` exit 0.
- 4 regression suites exit 0: audit-rendered, orchestrator-slash-command, flow-composition-craft-landing
  (runs the craft chain incl. flowK - drift fired without crashing), phase-h-block5-orchestrator-integration (10/0).
- run-tests.ts NOT edited; dist/ NOT rebuilt or committed.

## Notes for integration (Jonah owns)

- No new test file was added to run-tests.ts (I am forbidden to edit it). The flowK drift wire is proven by the
  standalone probe; if a permanent suite is wanted, add a `flow-handler-multi-lens-audit` test that mirrors the
  probe's 4 cases and register it.
- dist rebuild happens at integration (`npm test` rebuilds first); the src change is inert on the live in-session
  path until then. `bin/sidecoach.js` list/help changes are live immediately (pure JS over committed dist).

## Foreground Codex review (codex-review.py wrapper, gpt-5.5, 164s, exit 0, no P0)

Folded 4, declined 1 with reason (all re-verified after):
- P1 maxBuffer: default 1MB execFileSync buffer could truncate a huge drift report -> unparseable JSON.
  FOLDED: explicit `maxBuffer: 16MB` (overflow still throws -> null -> static placeholder, fail-safe intact).
- P2 `sidecoach help <tool>` errored (helpForTarget only knew verbs/setup). FOLDED: added `findStandaloneBin`
  + a bin-detail branch (accepts `sidecoach-drift` OR bare `drift`); verified exit 0 with detail.
- P2 invocation honesty: only `sidecoach` is in package.json#bin, so bare `sidecoach-palette` is not a PATH
  command. FOLDED: list/help now print `node bin/<tool>.js ...`, matching SKILL.md (did NOT expand
  package.json#bin - a distribution decision out of scope).
- P2 SKILL refs row omitted `70 internal`. FOLDED.
- DECLINED P1 "dist is stale (drift lens absent at runtime)": correct observation but EXPLICITLY out of scope -
  spec forbids rebuilding/committing dist; the rebuild is the lead's integration step (`npm test` rebuilds
  first), same as every prior wire-up beat. The src change is correct; it goes live on that standard rebuild.
  The producer-side `process.exit` truncation Codex also noted is the drift bin's own logic (out of ownership);
  my fail-safe already contains a truncated read.

Post-fold re-verify: tsc 0; probe 15/15; `help drift`/`help palette`/`help sidecoach-drift` exit 0 with detail;
unknown target still exit 1; list/help regression-diff still additions-only; craft-composition suite (live
flowK) exit 0.

## Files touched
- `sidecoach/bin/sidecoach.js`
- `sidecoach/src/flow-handler-multi-lens-audit.ts`
- `claude/skills/sidecoach/SKILL.md`
