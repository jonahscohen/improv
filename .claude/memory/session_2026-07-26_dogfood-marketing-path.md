---
name: Dogfood marketing-site path "fix" - already resolved by deletion
description: The stale marketing-site refs in the dogfood scripts were already fixed - the source was deleted 2026-07-25 (ce3743fd) as a dead harness; only dist/ orphans + a stale dep-map finding remain.
type: project
relates_to: [session_2026-07-24_simplification-phase2-deadcode.md, session_2026-07-13_dependency-map-page.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
machine: spare3
session_id: e0422a1b-d4b9-484e-963a-2a59dc56cb39
source: session
verified: tests (tsc --noEmit exit 0) + git-history
confidence: high
---

Teammate task: "fix stale marketing-site path references in the dogfood scripts"
(sidecoach/eval/dogfood-craft-step2.ts:10 + sidecoach/eval/dogfood-teach-step1.ts:8,
flagged by the dependency map as pointing at the departed
`/Users/spare3/Documents/Github/improv/marketing-site`). Collaborator: Jonah Cohen.

## The truth (the premise was stale)

There is NOTHING to fix in source. The fix already happened yesterday as a deletion.

- The dogfood scripts were **deleted** on 2026-07-25 in commit **ce3743fd**
  ("sidecoach: remove 8 dead dev harnesses (simplify phase 2)"), which IS an ancestor
  of HEAD. That commit removed the source `.ts` for all three dogfood scripts (1,166
  lines across 8 phase-*/dogfood-* files): `sidecoach/src/dogfood-craft-step2.ts`,
  `sidecoach/src/dogfood-teach-step1.ts`, `sidecoach/src/dogfood-runner.ts`.
- The scripts were NEVER at `sidecoach/eval/` (the task's cited path). They lived in
  `sidecoach/src/` (rootDir), compiled to `sidecoach/dist/`. The `eval/` path in the
  task was a wrong guess layered on top of the dep-map's bare `dogfood-craft-step2.ts:10`
  citation.

### Why the lead's grep for the literal `improv/marketing-site` came back EMPTY - two reasons

1. **The files no longer exist.** They were deleted (ce3743fd). Grepping deleted files
   finds nothing.
2. **Even when they existed, that literal substring was never in the source.** The path
   was built as `path.resolve(__dirname, '..', '..', 'marketing-site')` - `'marketing-site'`
   is an isolated `resolve()` argument, never concatenated as `improv/marketing-site`.
   The full absolute `/Users/spare3/Documents/Github/improv/marketing-site` only ever
   existed at RUNTIME (post-resolve) and in the dep-map's prose description of it.

## What the dogfood scripts did

Dev-only harness that exercised sidecoach flows against a real project (the in-repo
marketing-site) rather than a fixture:
- `dogfood-teach-step1.ts` - ran `/sidecoach teach` against the marketing-site project
  path (Wave-1/U5 had already hardened it to throw a clear error naming
  ~/Documents/Github/improv-site instead of silently `mkdirSync`-ing a ghost dir).
- `dogfood-craft-step2.ts` - ran `/sidecoach craft marketing-site`, wrote the multi-flow
  craft output to a file.
- `dogfood-runner.ts` - the runner that resolved the repo root and drove the steps.

## Wired nowhere (independently confirmed, not just trusting the commit message)

- NOT in `scripts/run-tests.ts` (grep: none).
- NOT in any `package.json` script (grep: none).
- ZERO live importers - no `import`/`require` of dogfood in src/, eval/, or scripts/.
  The only live-source mention of "dogfood" is a code COMMENT in
  `sidecoach-orchestrator.ts:1086` (describes historical dogfood output behavior),
  not an import. So the deletion commit's "zero live importers and no gated test" holds.

## Decision: NO repoint, NO source edit (the dead harness was already removed)

The task anticipated this outcome ("if it's a dead dogfood harness referencing a moved
site, the right fix may be to remove the dead path/step ... not repoint it"). The removal
already happened. Repointing to ~/Documents/Github/improv-site would resurrect a dead,
unwired, machine-bound dev harness - wrong. Left source untouched.

## Verification

- `sidecoach/eval/dogfood-*.ts` and `sidecoach/src/dogfood-*.ts`: confirmed ABSENT (5 paths checked).
- `git merge-base --is-ancestor ce3743fd HEAD`: YES (deletion is in current history).
- Final repo-wide sweep for a marketing-site PATH ref in live executable source
  (excl dist/node_modules/memory/docs): CLEAN. The only residual "marketing-site"
  strings in live files are historical doc-comments (typography-validator.ts:7,
  panel-model.ts:5, panel-renderer.ts:3, linguistic-ban-validator.ts:134,
  docs/dependency-map/serve.py comments) - none are path constructions.
- `npx tsc --noEmit` in sidecoach/: **exit 0**. Post-deletion source typechecks clean,
  proving no dangling import to the removed files. (Did NOT run `npm run build` - it
  writes to dist/, which was out of scope.)

## Remaining stale residue - flagged for lead integration (out of my scope)

1. **Orphaned compiled artifacts in `sidecoach/dist/`** (12 tracked files:
   dogfood-{craft-step2,teach-step1,runner}.{js,js.map,d.ts,d.ts.map}). These still
   contain `path.resolve(__dirname,'..','..','marketing-site')` and
   `'/sidecoach craft marketing-site'`. They are compiled output of deleted sources.
   Task said "Do NOT touch dist/", so left for the lead - a clean dist rebuild (or
   `git rm` of these 12) clears them. (Prior beat
   session_2026-07-24_plugin-coupling-vendor-lanes-data.md already named this as the
   "next step: exclude them from the shipped dist or guard/repoint.")
2. **Dependency map (`docs/dependency-map/index.html`) has 3 now-FALSE spots** that
   still claim the scripts "still name"/"still hard-code" the path:
   - line 537 (sidecoach evidence): "Its dogfood config points at marketing-site by absolute path"
   - line 539 (sidecoach debt): "The dogfood scripts still hard-code an absolute marketing-site path..."
   - line 661 (FINDINGS, `false` boolean): "Partly resolved (Wave 1, U5). The sidecoach
     dogfood scripts still name the departed .../marketing-site (dogfood-craft-step2.ts:10,
     dogfood-teach-step1.ts:8)..."
   These are the lead's browser-verified, Codex-reviewed audit artifact (resolved-boolean
   + debt-flag semantics), so left for lead integration rather than edited by a teammate.
   Precedent for the correction style: FINDINGS line 655 ("Resolved (2026-07-24, commit
   c9985f6f). ... deleted ... true"). Finding 661 can flip to `true` for the dogfood
   clause; the TASKS.md marketing-site-area clause in it is still accurate.

Net: source is CLEAN; the "fix" was a deletion that already shipped; only dist/ orphans
and a stale dep-map finding remain, both reserved for the lead.

Files touched: none (source/dist/dep-map all left untouched by design). Beat written +
MEMORY.md index updated.
