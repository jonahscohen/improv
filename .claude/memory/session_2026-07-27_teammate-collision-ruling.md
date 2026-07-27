---
name: Teammate file-collision ruling - ampersand keeps the contended installer unit, coverage takes the uncontended residual
description: A parallel-dispatch collision caught by the halting agent before its first write. Lead ruling on ownership, plus the dispatch defect that caused it - two briefs whose file surfaces overlapped in a way neither brief named.
type: decision
relates_to: [session_2026-07-27_installer-coverage-audit.md, session_2026-07-27_ampersand-selfheal.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: git status/diffstat and file mtimes inspected directly by the lead; both teammates' claims independently corroborated against the tree
confidence: high
---

# Collision ruling (2026-07-27)

Four teammates were dispatched in two waves. The second-wave brief for `coverage`
(installer component coverage) and the first-wave brief for `ampersand` (ampersand
self-heal) overlapped on three files. `coverage` detected it BEFORE its first write and
halted, which is the only reason no work was lost.

## What `coverage` saw

An uncommitted `install.sh` (+240/-65) already containing a `hook_data_files()` table -
the highest-value item in its own unit. The tell that it was in-flight rather than
finished: the code's own comments referenced three artifacts absent from disk, which then
appeared one at a time under observation (browser-tree.json rewritten 06:25:55,
hook-registry-guard.sh 06:26:31, test-hook-data-parity.sh created 06:27:39).

## Ruling

`ampersand` keeps the contended surface: install.sh in full, browser-tree.json,
hook-registry-guard.sh, hook-registry-stop.sh, and the two new test files. Its
mid-flight state is coherent, not red - `coverage` re-ran three suites against the
moving tree at 06:29 and got 52/0, PASS, 26/0.

**Why:** unwinding coherent in-flight work to restore a tidy ownership boundary costs
more than it buys. The boundary is the thing that was wrong, so the boundary moves.

`coverage` takes the residual it proposed, which is genuinely unclaimed by anyone:
mechanical disk-vs-installer reconciliation for `bin/*` (none exists today) and the
missing reverse direction of test-settings-deploy-parity.sh. New files only; any
install.sh edit it needs is written into its beat as a patch for the lead to sequence.

## Corroboration worth keeping

Both agents independently produced the SAME defect list: `grounding-intent.json` and
`consolidate-intent.json` never deployed (both hooks guard on
`[ -f "$INTENT_FILE" ] || exit 0`, so they ship looking present and doing nothing,
silently, forever - the identical shape to the route-intent.json defect of 2026-07-26),
plus the `consolidate` and `tilt-lab` skills with zero install.sh references. Convergence
from two isolated contexts raises confidence in the list well above either report alone.

## Lead self-analysis - the dispatch defect

The briefs DID carve out file ownership, but only at the region the lead happened to
anticipate: `ampersand` was reserved `bin/ampersand` and `install.sh ~4340-4450`. The
real collision surface was far wider, because registering a new component pulls an agent
into the registry files by necessity - browser-tree.json and hook-registry-guard.sh were
never named in either brief, so neither agent knew they were contested.

The failure mode: **carving ownership by the region you expect to be edited, rather than
by the whole subsystem a task must reach.** A brief that says "register this new file
wherever the manifest requires" has implicitly claimed the entire registration
subsystem, and a second brief that audits that same subsystem collides by construction.

Rule to carry forward: when two parallel briefs touch the same subsystem, assign the
SUBSYSTEM to one agent, not a line range. If both genuinely need it, serialise them or
give the second agent a read-only/report-only mandate from the start - which is what
`coverage` was ultimately given, and which it had already improvised correctly on its
own.

Second-order note: the halt cost roughly five minutes of one agent's time and saved a
silent overwrite of ~300 lines. An agent that stops on ambiguity and reports evidence is
behaving correctly even though it returns no diff.

## Files touched

- none by the lead (routing decision only)
