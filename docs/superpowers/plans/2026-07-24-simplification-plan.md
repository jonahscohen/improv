# Sidecoach simplification plan (maintainability + workflow-simplicity)

**Authored against commit:** `e378a632`
**Author:** Jonah (via simplify-audit teammate)
**Date:** 2026-07-24
**Scope:** the two MISSION-PRIMARY gaps the 2026-07-23 upgrade plan is blind to -
maintainability/complexity (rubric GAP3) and workflow simplicity (rubric GAP5).
Distributability (GAP4) is owned elsewhere and is out of scope here.

**Nature:** CONSOLIDATION, not rewrite. Every step removes duplication or dead
surface while preserving behaviour. The 75-suite green baseline and the certified
taste gate (`generate-validators --check` + `absolute-ban-detector` BAN_SCANNERS +
the classifier-parity suites) are the safety net and must survive every step.

**Codename note:** the competitor is referred to only as "oracle".

> Stamp check (Team Rule #10): this plan is authored against `e378a632`. Before
> executing any step, run `git rev-parse --short HEAD`; if HEAD has moved, re-run
> the one-line verification greps in Section 1 (they are cheap) before trusting the
> file lists in Sections 3-4. Three other teammates were editing this tree when this
> was written, so drift is expected. Every file path below was verified present at
> `e378a632`.

---

## 0. TL;DR for the executor

- The 2026-06-23 claims are **substantially TRUE and, on routing, understated.** Nothing
  here was already fixed by the June engine convergence; the convergence unified the
  detector ENGINE, not the routing/vocabulary surface. Numbers in Section 1.
- The cheapest prize is **dead code**: ~22 orphaned/duplicate `src/` modules (~3.7k
  non-test lines, 16% of the non-test file count) that the `tsc` + 75-suite gate can
  prove safe to delete, plus their orphaned tests. Steps 1-5.
- A second, larger latent finding: **86 test files (11k lines, 63% of test SLOC) never
  run in the default `npm test` gate.** They look like coverage and are not. Step 6.
- **Workflow simplicity is a product decision, not a code cleanup.** Section 4 lays out
  three costed options for collapsing the 4-5 user-facing vocabularies; the recommended
  one is Option B. Do not execute it without Jonah's pick.
- Two removals are gated on Jonah's decisions, not risk: the `mcp-server` package
  (standing WIRE-UP ruling, `decision_sidecoach_mcpserver_fate.md`) and the vocabulary
  collapse. Section 5.

---

## 1. Claim verification (the 2026-06-23 hypothesis vs measured reality at `e378a632`)

Source of the claims: `session_2026-06-23_sidecoach-oracle-gap-analysis.md` and
`..-capability-map.md`, restated as rows 15/17 of the borrow-list reconciliation. Each
was re-measured from scratch below. Verdict legend: STILL TRUE / OVERSTATED / FIXED.

### Claim A - "6+ routing implementations." Verdict: STILL TRUE (understated).

Counting distinct modules that map user input to flows/lanes/actions:

**LIVE routing surfaces (9):**
| # | Module | Lines | Role | Live consumer (verified) |
|---|---|---|---|---|
| 1 | `src/slash-command-router.ts` | 369 | phase-command + verb dispatch + composite/help/list + `/sidecoach <phrase>` union | orchestrator Step 2, `bin/sidecoach.js` |
| 2 | `src/verb-command-registry.ts` | 620 | the 21-verb table | router, orchestrator, CLI, lane-derivation |
| 3 | `src/lane-classifier.ts` | 188 | lane scoring (`loadRegistry`/`evaluateLane`) | router `resolveSidecoachPhrase` |
| 4 | `src/intent-detector.ts` | 613 | natural-language intent -> flow | orchestrator NL fallback |
| 5 | `src/lane-derivation.ts` | 57 | derives lane flow-sequences from verb chains | build generator + runtime |
| 6 | `src/sidecoach-orchestrator.ts` | 1991 | top dispatcher + its own Tier1-7 flow map | CLI, tests, MCP tool |
| 7 | `src/orchestrator.ts` | 471 | phase/dependency sequencer (`IntelligentOrchestrator`) | instantiated by #6 |
| 8 | `src/flow-conditional-router.ts` | 273 | conditional flow routing | imported by #6 |
| 9 | `claude/hooks/sidecoach_lanes.py` | 273 | Python lane classifier | LIVE via `sidecoach-keyword.sh` hook |

(`src/model-routing.ts` (467) routes flows to MODELS - a different axis, not
user-command routing - so it is not counted here, but it is a 10th "routing" module by
name.)

**DEAD / dormant routing surfaces (4 more), proven unreachable:**
| Module | Lines | Why dead | Proof |
|---|---|---|---|
| `src/sidecoach-entry-point.ts` (+`-cache.ts`) | 248+158 | a whole parallel NL+slash router | its only caller is the private `processWithEntryPoint`, which has **zero call sites** (`grep -rn processWithEntryPoint` -> only its own def + compiled dist) |
| `src/command-routing-adapter.ts` | 154 | superseded adapter | only consumer is `__tests__/phase3-completion.test.ts` |
| `src/sidecoach-command.ts` | 128 | a 7th command->flow table (`COMMAND_FLOW_MAP`) | only importer is `sidecoach-skill.ts`, itself orphaned |
| `mcp-server/src/keyword-resolver.ts` | 415 | the triplicate classifier copy | consumed only inside the unwired mcp-server package |

**Conclusion:** 9 live + 4 dead = **13 routing-ish modules**, of which "6+" counts only
the obviously-overlapping ones. The claim is true and understated. The June convergence
did not touch this - it unified detection, not routing.

Verify this section yourself:
```
grep -rn "processWithEntryPoint" sidecoach --include=*.ts | grep -v dist   # -> only the definition, no caller
grep -rln "command-routing-adapter'" sidecoach/src | grep -v dist          # -> only a test
```

### Claim B - "triplicated classifier." Verdict: STILL TRUE (verbatim).

The lane classifier still exists as three independent copies that cannot cross-import
(`tsc` TS6059 rootDir barrier, documented in each file header):
- `claude/hooks/sidecoach_lanes.py` (273) - **LIVE** (production hook tier)
- `src/lane-classifier.ts` (188) - **LIVE** (engine tier)
- `mcp-server/src/keyword-resolver.ts` (415) - **DEAD** (unwired package)

Kept in lockstep by `sidecoach/parity/classifier-corpus.json` (23 cases) and three
parity test files, one per copy. The engine test runner tethers the dead mcp-server copy
via one required-suite line (`scripts/run-tests.ts:40`). Any lane-rule change is a 3-edit
+ 3-parity-reverify chore. Confirmed unchanged since 2026-06-23.

### Claim C - "138 files / ~40k SLOC." Verdict: STILL TRUE (essentially unchanged).

Measured at `e378a632`:
| Surface | Files | Lines |
|---|---|---|
| `sidecoach/src` non-test `.ts` | **143** | **38,282** |
| `sidecoach/src` test `.ts` | 153 | 17,552 |
| `sidecoach/mcp-server/src` non-test `.ts` | 41 | 5,755 |
| whole `sidecoach/` git-tracked (incl committed `node_modules`/`dist`) | 8,584 | - |
| - of which `mcp-server/` | 4,156 | - |
| - of which committed `node_modules` | 6,370 | - |

"~138 files / ~40k SLOC" maps to the non-test `src/` surface: **143 files / 38.3k lines**
today. Within noise of the year-old claim. Not fixed, not overstated.

### Claim D - "4 parallel user-facing vocabularies." Verdict: STILL TRUE (arguably 5 on the CLI).

Enumerated at `e378a632`:
1. **Phase commands** - `SLASH_COMMANDS` in `slash-command-router.ts`: 15 keys (`research,
   craft, implement, review, clone, constrain, migrate, refactor, type, motion, reference,
   comprehensive, teach, rapid, list`). `craft` is shadowed by the verb registry (verb
   wins at `parseSlashCommand:92` before `SLASH_COMMANDS:103`), so that entry is dead; 12
   phase-only keys remain reachable.
2. **Verb commands** - `VERB_REGISTRY`: **21 verbs** (`craft, polish, audit, critique,
   shape, onboard, animate, bolder, colorize, delight, layout, overdrive, quieter, typeset,
   clarify, harden, adapt, distill, optimize, extract, document`).
3. **Lanes** - 5 (`lane_build, lane_ship, lane_delight, lane_calm, lane_converge`),
   *derived* from verb chains (`lane-derivation.ts`), reached only by NL classification.
4. **Natural-language intent** - `intent-detector.ts` -> flows (the fallback path).
5. **Modes (CLI-only, "retired")** - `modes.ts` is marked DEPRECATED/RETIRED for the
   engine, **but `bin/sidecoach.js` still surfaces 5 modes** (`forge, kiln, bloom, trim,
   ralph`) in `sidecoach list` and runs them via `getMode`. So a CLI user still sees a 5th
   vocabulary the skill claims is gone - a live surface/skill drift.

Total distinct command words across phases+verbs alone: **35**. Only `lane_live` was ever
removed (`4d61ba1f`). The claim holds; the modes-on-CLI drift makes it slightly worse than
stated.

---

## 2. What is LIVE - do not touch (the preserve-set)

Every consolidation below is bounded by this. The live routing chain a real request
travels is exactly:

```
process(utterance)                                   [sidecoach-orchestrator.ts:672]
  -> Step 2:  parseSlashCommand()                    [slash-command-router.ts]  (phase cmd / verb / composite / help / list / teach / document)
  -> Step 2.5: resolveSidecoachInput()               [-> resolveSidecoachPhrase -> lane-classifier evaluateLane]
  -> Step 1:  intentDetector.detect()                [intent-detector.ts -> orchestrator.ts]
  (+ forceFlowId / resumeFromCheckpoint bypasses)
```

Preserve, untouched: `sidecoach-orchestrator.ts`, `orchestrator.ts`, `intent-detector.ts`,
`slash-command-router.ts`, `verb-command-registry.ts`, `lane-classifier.ts`,
`lane-derivation.ts`, `lane-runner.ts`, `lane-convergence.ts`, `flow-conditional-router.ts`,
`model-routing.ts`, `product-rule-registry.ts`, `flow-validation-capabilities.ts`,
`validators.generated.ts`, `absolute-ban-detector.ts`, the live per-flow handler files
(`flow-handler-*.ts` that the orchestrator imports at lines 34-63), the tier bundles
(`flow-handlers-tier3-tier4.ts`, `-tier5-specialized.ts`, `-curate-qa.ts`,
`-core.ts`, `-extended.ts`), and `claude/hooks/sidecoach_lanes.py`.

**The gate that proves every step:** `cd sidecoach && npm test` runs
`generate-lanes && generate-validators && generate-validators --check && tsc` (the
compile + taste-generation safety net) and then the 75 suites. `tsc` has
`include: ["src/**/*"]`, so it compiles every `src` file: if a "dead" file were secretly
imported, `tsc` fails loudly. There is no barrel/index re-export in `src/`, so individual
module deletion cannot silently break an `export *`. The count printed is
`run-tests: N suite(s) passed`.

> Constraint honored by this document: the author ran **no** `npm test`/`npm run build`
> (three teammates were writing into this tree concurrently). Every verify clause below is
> for the EXECUTOR to run once the tree is quiet, not a result claimed here.

---

## 3. The consolidation plan (risk-sequenced, cheapest and safest first)

Each step is independently landable and independently revertable via git. Do them one at a
time; run the verify before moving on. None of steps 1-6 changes user-facing behaviour -
they remove code no live path reaches.

### Baseline step 0 - establish the number you are protecting

Before any deletion, capture the baseline so every later step compares against it.
```
cd sidecoach && npm test 2>&1 | tail -3
```
-> **verify:** last line is `run-tests: 75 suite(s) passed`, exit 0. Record the 75. If it
is not 75/green at HEAD, STOP and report - the safety net is down and nothing below is safe
(Team Rule #9). Also record `find src -name '*.ts' | wc -l` (expect 296).

### Step 1 - delete dead handler DUPLICATES (safest: live twin proven)

These files each define a handler CLASS that is a byte-duplicate-in-intent of the class the
orchestrator actually imports from the tier bundle. The orchestrator imports
`FlowNRapidIterationHandler`/`FlowOCloneMatchHandler`/`FlowPConstraintDesignHandler`/
`FlowQMigrationHandler` from `flow-handlers-tier3-tier4.ts` (verified at
`sidecoach-orchestrator.ts:49-55`), NOT from these standalone files. And
`flow-handlers-new-tiers.ts` is an entire dead parallel copy of FlowA-I (the live FlowA-I
come from the per-flow `flow-handler-*.ts` files, orchestrator lines 34-45).

Remove (module + its orphaned test where one exists):
| File | Lines | Live twin |
|---|---|---|
| `src/flow-handlers-new-tiers.ts` | 416 | per-flow `flow-handler-brand-verify.ts` ... `-accessibility.ts` |
| `src/flow-handler-rapid-iteration.ts` | 104 | `flow-handlers-tier3-tier4.ts:570` |
| `src/flow-handler-clone-match.ts` | 122 | `flow-handlers-tier3-tier4.ts:739` |
| `src/flow-handler-constraint-design.ts` | 98 | `flow-handlers-tier3-tier4.ts:790` |
| `src/flow-handler-migration.ts` | 98 | `flow-handlers-tier3-tier4.ts:840` (test-only importer) |

**Prize: 5 files, 838 non-test lines** + `flow-handler-migration`'s two test importers
(`phase-g-block2-flows-qv.test.ts`, `phase-g-block4-performance.test.ts` reference it; if
those are not in the 75 they are removed with it). Neither the modules nor their tests are
in the 75-suite gate.

- **verify:**
```
grep -rln "flow-handlers-new-tiers\|flow-handler-rapid-iteration\|flow-handler-clone-match\|flow-handler-constraint-design" sidecoach/src --include=*.ts | grep -v dist
```
  -> expect **only** the files themselves (and any test that is being deleted with them);
  no orchestrator/production hit. Then `cd sidecoach && npm test` -> `run-tests: 75 suite(s)
  passed`, exit 0 (tsc proves nothing imported them; count unchanged). If `flow-handler-migration`'s
  tests were in the 75, the count drops by exactly that many and `tsc` stays green - either
  outcome is pass as long as exit 0 and no *unexpected* suite fails.

### Step 2 - delete the dead router modules (test-only or orphan-pair)

| File | Lines | Why safe |
|---|---|---|
| `src/sidecoach-entry-point.ts` | 248 | reached only by the never-called `processWithEntryPoint` |
| `src/sidecoach-entry-point-cache.ts` | 158 | test-only |
| `src/command-routing-adapter.ts` | 154 | consumer is one test |
| `src/sidecoach-skill.ts` | 87 | zero consumers repo-wide |
| `src/sidecoach-command.ts` | 128 | only importer is `sidecoach-skill.ts` |

One coupled edit: `sidecoach-orchestrator.ts` imports `SidecoachEntryPoint`/`globalEntryPoint`
(line 23) and contains the dead `processWithEntryPoint` method (lines 643-670). Delete that
import and that private method. It is provably dead (Section 1 proof); `tsc` will confirm no
other reference remains. Delete the orphaned tests that import these
(`phase-iv-entry-point.test.ts`, `phase-iv-e2e-integration.test.ts`, `phase3-completion.test.ts`)
- none is in the 75.

**Prize: 5 files + 1 dead method, ~775 non-test lines** (+ ~950 lines of orphaned test).

- **verify:**
```
grep -rn "processWithEntryPoint\|SidecoachEntryPoint\|globalEntryPoint\|command-routing-adapter\|sidecoach-skill\|sidecoach-command" sidecoach/src --include=*.ts | grep -v dist | grep -v '\.test\.ts'
```
  -> expect no hits (all references gone). Then `cd sidecoach && npm test` -> exit 0,
  `run-tests: 75 suite(s) passed`.

### Step 3 - delete the superseded convergence module

`src/convergence-loop.ts` (374) is superseded by the live loop
(`lane-convergence.ts` + `lane-runner.ts`, imported by the orchestrator). Its only consumer
is `__tests__/t20-convergence-loop.test.ts` (405 lines), which is **not** in the 75-suite
gate.

**Prize: 1 module (374 lines) + 1 orphaned test (405 lines).**

- **verify:**
```
grep -rln "convergence-loop'" sidecoach/src --include=*.ts | grep -v dist   # -> only the test being deleted
cd sidecoach && npm test                                                     # -> exit 0, 75 passed
```

### Step 4 - remove the orphaned "built-but-never-wired" modules (needs one glance each)

Higher-judgment than steps 1-3 because deleting them forecloses an intent that was coded but
never connected. All three have zero production consumers at `e378a632`:
| File | Lines | Note |
|---|---|---|
| `src/reference-update-service.ts` | 337 | "update all 5 bundled reference systems" - never wired to any updater |
| `src/flow-domain-integration.ts` | 124 | "Supports Task #2" - live path uses `flow-domain-validators.ts`/`-mapping.ts` directly |
| `src/project-drift-detector.ts` | 84 | test-only; distinct from the live `design-debt-tracker.ts` |

Recommend: confirm with Jonah that none is a near-term intent, then delete. If any is
"planned soon", leave it and log it as a known orphan instead.

**Prize (if all removed): 3 files, 545 lines** + their orphaned tests.

- **verify (per file):** `grep -rln "<name>'" sidecoach/src --include=*.ts | grep -v dist`
  -> only tests; then `npm test` -> exit 0, 75 passed.

### Step 5 - remove the abandoned dev harnesses (optional, lowest value)

Eight `phase*`/`dogfood*` files (1,163 lines) are one-shot development verification scripts:
not imported, not in the gate, some self-executing. `phase-ii-verification.ts`,
`phase2-flow-test.ts`, `phase3-reference-integration-test.ts`,
`phase4-orchestration-e2e-test.ts`, `phase4-stress-test-yes-and.ts`, `dogfood-runner.ts`,
`dogfood-craft-step2.ts`, `dogfood-teach-step1.ts`. Lower priority - they cost nothing at
runtime (never loaded) but clutter the file count. Delete only after a glance; a couple may
be worth keeping as manual smoke harnesses.

**Prize (if all removed): 8 files, 1,163 lines.**

- **verify:** `npm test` -> exit 0, 75 passed (they are not in the gate, so the count is
  invariant).

### Step 3-5 combined prize

Steps 1-5 remove **up to ~22 `src` modules and ~3.7k non-test lines (16% of the 143-file
non-test surface, ~10% of non-test SLOC)** plus ~2-3k lines of orphaned test, with `tsc` +
the 75-suite gate proving each safe. No behaviour change.

### Step 6 - reconcile the orphaned test tree (measurement first, then triage)

`scripts/run-tests.ts` is an **explicit 75-entry allowlist, not a glob**. Measured: of 153
`.test.ts` files in `src` (17,552 lines), only **67 (6,486 lines) run** in the default
`npm test`. **86 files (11,066 lines - 63% of test SLOC) never execute.** Some may run under
auxiliary scripts (`npm run bench` covers `t13`/`t16`); most are simply stranded (e.g.
`phase-h-block1..7`, `phase-iii-integration`, `phase-iv-*`). This is a maintainability defect
in its own right: half the test tree reads as coverage and guards nothing.

This step is a triage, not a blind delete. For each of the 86:
1. Does an auxiliary npm script run it? (`grep -n "<basename>" sidecoach/package.json sidecoach/scripts/run-tests.ts`)
2. Does the module it tests still exist and is it live?
3. If live + valuable -> **add it to the SUITES allowlist** (raises real coverage).
4. If it tests dead code (already removed in steps 1-5) -> delete it.
5. If duplicative/obsolete -> delete.

- **verify (per re-added suite):** it appears in `run-tests.ts` and `npm test` still exits 0
  with the count raised by exactly the number added. **verify (per deleted):** count
  unchanged, exit 0.
- **quantified prize:** converts an 11k-line "coverage theatre" surface into either real
  gate coverage or deleted lines. Net file-count reduction depends on the live/dead split
  (bounded below by the ~15 dead-module tests removed in steps 1-5).

> Do this AFTER steps 1-5 so the dead-module tests are already gone and the triage set is
> smaller.

---

## 4. Workflow simplicity - the vocabulary decision (COSTED OPTIONS, Jonah picks)

Collapsing user-facing surfaces is a product decision, not an agent's call. Here are three
concrete, costed options. Each preserves the engine; they differ only in what a user is
allowed to TYPE and what the docs advertise.

**Current state:** 5 surfaces - phase commands (12 reachable), 21 verbs, 5 lanes (derived,
NL-only), NL intent, and CLI-only modes (5). The verbs and lanes are the load-bearing pair
(lanes are literally derived from verb chains). Phases and modes are legacy skins.

### Option A - "verbs + NL only" (aggressive; the 2026-06-23 draft's Stage-4 target)

Cut phase commands and CLI modes entirely; keep the 21 verbs + NL intent; keep lanes as an
internal execution construct (still derived, still NL-reachable, just not a named surface).

- **Removes/retires:** `SLASH_COMMANDS` phase table + `getAvailableCommands` phase half
  (`slash-command-router.ts`, ~90 lines), `modes.ts` (193) + `bin/sidecoach.js` mode display
  (~15 lines), the `sidecoach-command.ts` `COMMAND_FLOW_MAP` (already dead, Step 2).
- **Doc churn:** `SKILL.md` "two parallel command surfaces" -> one; README; `LANES.generated.md`
  framing.
- **User-facing behaviour change:** anyone who typed `/sidecoach research` or a mode name
  loses it (must use a verb or NL). Migration aliases can soften this.
- **Prize:** collapses 5 surfaces to 2; removes ~300 lines of routing + the modes drift;
  every command word has exactly one home.
- **Risk:** MEDIUM. Touches the live `slash-command-router.ts` and CLI. Verify:
  `npm test` green + `bin/sidecoach.js list` still runs + a `parseSlashCommand` fixture that
  a retired phase word now falls through to NL (add a test).

### Option B - "verbs + NL surface, lanes as the only preset, delete phases + modes" (RECOMMENDED)

Same as A, but explicitly **promote lanes to the one preset vocabulary** (they already are
the composite chains; modes were a worse duplicate of exactly this) and ship **back-compat
aliases** mapping each retired phase word -> its verb (e.g. `research -> shape`,
`implement -> craft`, `review -> audit`) so nothing breaks for existing muscle memory.

- **Removes:** phase table + modes (as A), but keeps a thin `PHASE_ALIASES` map (~15 lines)
  so retired words still route.
- **Prize:** same surface collapse as A (5 -> 2 typed vocabularies: verbs + NL, with lanes
  as the named preset set and NL as the catch-all), but **zero breaking change** - aliases
  absorb the old words and can be removed in a later major.
- **Risk:** LOW-MEDIUM. The alias map is a pure addition on top of the deletion; the 75 gate
  plus one new alias-routing test proves it. This is the "consolidate without a flag day"
  path and fits the "more capable AND simpler" spine best.
- **Why recommended:** it achieves the headline simplification (one classifier surface, one
  preset surface, one NL surface; modes drift gone) while honoring the repo's own rule that
  breaking a user's typed command is a product event. It is the smallest diff that actually
  moves the vocabulary count down.

### Option C - "document-only unification, no code cut" (conservative)

Leave all routing code; change only the docs so users are *taught* one surface (verbs + NL),
and mark phases/modes as deprecated-but-supported. Add a lint/test asserting `SKILL.md`
advertises one surface.

- **Prize:** zero code risk; removes the *cognitive* sprawl for new users; buys time.
- **Cost:** the maintainability tax stays (every routing module still lives, still
  drifts); the modes-on-CLI inconsistency is documented rather than fixed. This does not
  satisfy GAP5 - it relabels it.
- **Risk:** MINIMAL. Verify: `SKILL.md` diff + `npx @google/design.md`-style doc lint if one
  exists.

**Recommendation: Option B.** It is the only one that reduces the real surface count without
a breaking change, and it resolves the modes/skill drift instead of documenting around it.
Sequence it AFTER steps 1-3 (so the dead `sidecoach-command.ts` `COMMAND_FLOW_MAP` is already
gone and the phase-table deletion is the only live edit).

---

## 5. Decisions for Jonah (not risk-sequenced - these are gates)

### Decision A - the vocabulary option (Section 4). Recommended: B.

### Decision B - retire or wire the `mcp-server` package.

`decision_sidecoach_mcpserver_fate.md` records a standing **WIRE-UP ruling (2026-07-15)**
that has not been executed. The package is `4,156` git-tracked files (its own committed
`node_modules` + `dist` + `src` + tests), wired to no live consumer, and holds the **third
classifier copy** (`keyword-resolver.ts`). It is the single largest file-count prize in the
whole repo, but removing it is a **product reversal**, not a cleanup, so it is out of scope
for an executor and belongs to Jonah.

- If **RETIRE**: follow the safe-removal sequence already written in
  `decision_sidecoach_mcpserver_fate.md` (cut the one required-suite tether at
  `scripts/run-tests.ts:40` first, verify `npm test` green at 74 suites, then
  `git rm -r sidecoach/mcp-server` and `sidecoach/.mcp.json`, then de-mislead the four
  parity docstrings). **This also collapses the classifier from TRIPLICATED to DUPLICATED**
  (Python + engine), which is the irreducible floor - the Python hook cannot import the TS
  (stdlib-only, deployed standalone), so engine<->Python duplication cannot be removed
  without a larger rearchitecture. Prize: -4,156 tracked files, -1 classifier copy, -1
  routing module, lane-rule edits drop from 3-edit to 2-edit.
- If **WIRE-UP**: the triplication stays by design; then Claim B is intentional, not debt,
  and should be re-labeled in the beats so it stops recurring as a "gap".

Either way, **the recurring "triplicated classifier" finding is resolved by making this
decision**, not by more code. Recommend RETIRE unless a concrete external MCP consumer has
appeared since 2026-07-15 (none is visible in the tree).

### Decision C - committed `node_modules` (6,370 files).

`sidecoach/` and `sidecoach/mcp-server/` commit their `node_modules`. This is 74% of the
tracked file count and overlaps the distributability gap (out of scope here) but is worth a
one-line ruling: gitignore + `npm ci` at install, or keep vendored for offline installs.
Flagging only; not planning it.

---

## 6. What could not be determined statically (and why)

- **Behavioural equivalence of the dead handler duplicates.** I proved the standalone
  `flow-handler-{rapid-iteration,clone-match,constraint-design,migration}.ts` classes are
  unreferenced and that the live twins live in `flow-handlers-tier3-tier4.ts`. I did **not**
  diff the two class bodies line-by-line to prove they are semantically identical - it does
  not matter for deletion (the standalone ones are unreachable regardless), but if anyone
  wants to *merge* rather than *delete*, that diff is required first.
- **Whether the 86 orphaned tests would pass if re-added.** Static analysis shows they are
  outside the gate; it cannot show whether they are green against current code. Step 6's
  triage must actually run each candidate before promoting it into the allowlist. I could
  not run them (concurrent-teammate + no-`npm test` constraint).
- **Runtime cost of the dead code.** Confirmed the dead modules compile into `dist` (so they
  inflate the build) but are never `require`d at runtime, so their runtime cost is zero. The
  cost is purely maintenance + build-time + file-count.
- **`model-routing.ts` infra axis (reconciliation row 43).** Whether the model-tier
  routing/persona/stop-callback infra is still fully live was not re-audited here - it is a
  different axis (flow->model, not input->flow) and out of this plan's scope.
- **The exact post-deletion suite count for Step 1's `flow-handler-migration`.** Its test
  importers may or may not be in the 75; the verify clause handles both outcomes (exit 0 +
  no unexpected failure), but the precise number needs the executor to run it.

---

## 7. Execution order summary

| Order | Step | Risk | Files removed | Lines removed (non-test) | Gate delta |
|---|---|---|---|---|---|
| 0 | baseline capture | none | 0 | 0 | record 75 |
| 1 | dead handler duplicates | lowest | 5 | 838 | 75 -> 75 |
| 2 | dead router modules | low | 5 (+1 dead method) | ~775 | 75 -> 75 |
| 3 | superseded convergence-loop | low | 1 | 374 | 75 -> 75 |
| 4 | orphaned built-never-wired | low-med (glance) | 3 | 545 | 75 -> 75 |
| 5 | abandoned dev harnesses | low (glance) | 8 | 1,163 | 75 -> 75 |
| 6 | orphaned-test triage | med | varies | - | 75 -> higher (real coverage) |
| A | vocabulary collapse (Option B) | low-med | ~2 + doc | ~300 | 75 -> 75 + new alias test |
| B | mcp-server RETIRE (Jonah) | product call | 4,156 tracked | - | 75 -> 74 |

Steps 1-5 are pure, reversible, behaviour-preserving dead-code removal an executor can do
today against the 75-suite gate. Step 6 raises real coverage. A and B are Jonah's decisions.
The whole plan nets **simpler with zero capability loss** - the "more capable AND simpler"
spine, satisfied on the simpler half for the first time since the gap was named.
