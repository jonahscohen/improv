---
name: Slow-suite gate decision + dep-map mcp-server cleanup + beats-indexing assessment
description: Resolved the 5 SLOW-but-green suites (GATE all 5, verified green, run-tests entries handed to lead), reconciled the dependency-map to the retired sidecoach/mcp-server, and confirmed bulk-indexing 1026 beats is an intentional non-task.
type: project
relates_to: [session_2026-07-25_orphan-test-triage.md, session_2026-07-24_mcpserver-retirement.md, session_2026-07-26_tail-cleanup.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: tests (npx ts-node x5 green) + browser (dep-map rendered, no console errors). LEAD-INTEGRATED 2026-07-26: gated all 5 slow suites (gate 161 -> 166 no-drop); lead re-screenshotted the dep-map (sidecoach node has no mcp-server child, page coherent). Committed. B's flag re: MEMORY.md ~4.4x over the 23KB compactor budget (may be truncating at load) recorded as a real follow-up.
confidence: high
---

Two housekeeping items finished as a teammate. Did NOT touch scripts/run-tests.ts or dist/ (lead owns - entries PROPOSED below). Nothing committed.

## ITEM 1 - the 5 SLOW-but-green suites: DECISION = GATE all 5

Resolves the gate-cost flag raised by the orphan-test triage (session_2026-07-25_orphan-test-triage.md, "5 SLOW-but-green"). All 5 verified GREEN in isolation via `npx ts-node <file>`:
- t9-retry-control -> 52/52 (2s)
- t12-model-routing -> 54/54 (1s)
- sprint4-build-report-cli -> PASS (8s)
- sprint3-orchestrator-enrich-before-canexecute -> PASS, "flowF reached its handler with status=skipped" (4s)
- sprint4-build-report-single-opt-in -> PASS (3s)

**Key finding that drove the decision:** isolated runtimes are MODEST - ~18s total across the five, NOT the ~96s the triage reported. The triage's ~44s/~26s figures were measured under full-gate concurrent ts-node load; run individually (as the runner does, sequential `execFileSync` per suite) they are fast. So the "gate-cost" concern is much smaller than feared.

**Why GATE (not a separate slow lane):**
- Coverage is real and otherwise ABSENT: build-report single-flow opt-in + CLI e2e (build-report is a core subsystem), orchestrator enrich-before-canExecute ORDERING, model-tier routing (t12 = a distinct subsystem), retry-control (t9).
- Real added cost is small (~18s isolated; even the pessimistic ~96s-under-load is acceptable one-time for a design tool's gate).
- A separate lane needs a second npm script + a second thing to remember; a lane nobody runs ROTS. Project precedent is ONE comprehensive gate (orphan-triage gated 52, tail-cleanup gated 20). Consistency + low real cost => gate.

**PROPOSED run-tests.ts entries for the LEAD** (paste-ready, matches file style, all `required: true`; place as a new labeled block after the ported `src/phase-iii-integration.test.ts` entry, before the closing `];`). Gate count 161 -> 166 (+5):

```
  // SLOW-BUT-GREEN cohort gated 2026-07-26 (orphan-triage "5 slow", gate-cost decision resolved = GATE).
  // Each verified green in isolation (npx ts-node); isolated cost ~1-8s though the triage saw up to ~44s under
  // full-gate concurrent load. Coverage otherwise absent: build-report single/opt-in + CLI e2e, orchestrator
  // enrich-before-canExecute ordering, model-tier routing (t12, distinct subsystem), retry-control (t9).
  { rel: 'src/__tests__/sprint4-build-report-single-opt-in.test.ts', required: true },              // build-report single-flow opt-in (e2e)
  { rel: 'src/__tests__/sprint4-build-report-cli.test.ts', required: true },                        // build-report CLI e2e
  { rel: 'src/__tests__/sprint3-orchestrator-enrich-before-canexecute.test.ts', required: true },   // orchestrator: enrich before canExecute ordering
  { rel: 'src/__tests__/t12-model-routing.test.ts', required: true },                               // model-tier routing (distinct subsystem)
  { rel: 'src/__tests__/t9-retry-control.test.ts', required: true },                                // retry-control
```

The runner's retry-once wrapper only fires on FAILURE, so these green suites won't interact with it.

## ITEM 2a - dependency-map reconciled to the retired sidecoach/mcp-server

`docs/dependency-map/index.html` (JS-rendered graph + findings changelog, actively maintained per git log) still carried the retired `sidecoach/mcp-server`. The retirement (session_2026-07-24_mcpserver-retirement.md) is COMMITTED - `c9985f6f`, dir + `.mcp.json` deleted (4157 files), run-tests tether severed (grep confirms 0 refs) - and that beat explicitly deferred "docs/ dependency-map bookkeeping (beat step 7)" to the lead. This closes it.

Distinguished the THREE mcp-servers on disk: `sidecoach/mcp-server` (GONE - `ls` = No such file, not in `git ls-files`) vs `beats/mcp-server` (EXISTS, git-tracked, deliberately inert install hint - KEEP) vs `lotus/mcp-server` (different project - untouched).

Edits (all in index.html):
1. Removed the `sidecoach/mcp-server` graph node (it was `sidecoach`'s only kid -> dropped the `kids` block entirely, matching the childless-node pattern e.g. `corpus`). The graph shows CURRENT structure, so a deleted dir must not be a node.
2. De-stale'd the `sidecoach` node `desc` (dropped "the only component with a contractual parity obligation to a server nobody runs" - now false; the Python-hook<->engine-TS parity still exists so `sub: "...parity contract..."` stays accurate).
3. FINDINGS entry: rewrote the stale sidecoach/mcp-server finding as `Resolved (2026-07-24, commit c9985f6f)...`, `false`->`true` (the list is a changelog; resolved items stay with a "Resolved" prefix per convention, not deleted).
4. Fixed the dangling "also" in the `beats/mcp-server` finding (it referenced the now-resolved sibling) -> stands alone.
5. Header badges (hardcoded spans): "5 resolved" -> "6 resolved" (one finding flipped), and "Updated 2026-07-15 (post Wave 2)" -> "Updated 2026-07-26 (sidecoach/mcp-server retired)".

VERIFIED in browser (file:// render, JS executed): zero console errors; header shows "14 components / 11 findings, 6 resolved / Updated 2026-07-26..."; a11y tree + screenshot confirm the `sidecoach` card has NO kids row while `beats/mcp-server` (inert) and `justify`/`public` survive. Page coherent.

NOT fixed (out of scope, flagged for lead): the `corpus` node still says "~880 beats" (actual ~1121); and the `justify`/sidecoach settings.json line cites ":601-603" while claude/settings.json is 138 lines - both are pre-existing staleness unrelated to the mcp-server retirement.

## ITEM 2b - bulk-indexing the ~1026 historical beats: INTENTIONAL NON-TASK (reasoning confirmed)

Default was: do NOT bulk-index. Confirmed the reasoning HOLDS - both mechanisms exist and are actively maintained:
- **Retrieval over ALL beats**: `beats/beats.py` compiles the entire `.claude/memory/` corpus into a searchable index (hybrid lexical + optional vector/embedding path - `beats_vec` table, `embed_model`/`embed_dim`, vector-parity checks in `verify`). Served by `beats/mcp-server` `beats_search` (ranked, supersession-resolved). `beats/bench` benchmarks retrieval QUALITY. => every beat is retrievable whether or not it is line-referenced in MEMORY.md.
- **MEMORY.md is a hard-budgeted, auto-compacted index**: `claude/hooks/compact-memory.py` (wired via `memory-compact` hook) keeps it under BUDGET=23000 bytes (below the ~24.4KB harness load limit); over budget it line-caps (MAX_LINE=200) then ARCHIVES oldest entries to MEMORY-archive.md. Its docstring: over the limit "the index silently truncates and the agent works half-blind."

So bulk-appending ~1026 lines would fight the compactor (which exists to keep the index SMALL) and degrade the curated index's signal - the exact "degrades recall" concern. No targeted fix needed; the architecture already handles it.

**Secondary health observation (NOT my task, flagged for lead):** MEMORY.md is currently 102448 bytes = ~4.4x over the 23000-byte compactor budget, and its entries far exceed MAX_LINE=200 chars, despite `memory-compact` being wired. The compactor may simply not have run over the current index (runs on a specific hook event), or the budget/limits drifted. Worth a look - it makes bulk-indexing even MORE clearly counterproductive, and it means the index may already be truncating at load. Did not touch it.

## Files touched
- docs/dependency-map/index.html (mcp-server node removed, findings reconciled, badges updated)
- .claude/memory/{this beat, MEMORY.md pointer}

## NOT touched (lead-owned / out of scope)
- sidecoach/scripts/run-tests.ts (entries PROPOSED above), sidecoach/dist/
- MEMORY.md over-budget state, dep-map "~880 beats" + settings.json line-cite staleness

Collaborator: Jonah Cohen.
