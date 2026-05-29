---
name: tilt-lab acquisition execution (Plan 2)
description: Executing Plan 2. Prep tasks 1/2/4 done inline (contract addendum, renderer deps, conformance template); Task 3 folded into lane-1; dispatching the tilt-acquire team for the Task 5 fan-out, then central registration (Task 6).
type: project
relates_to: [session_2026-05-29_tilt-lab-acquisition-plan.md, session_2026-05-29_tilt-lab-recon-synthesis.md]
---

Collaborator: Jonah. 2026-05-29. User chose "build prep + dispatch the team."

## Prep done inline (25/25 tests green, tsc clean)
- Task 1 contract addendum: Effect gains OPTIONAL onPointer?(x,y) + mount?(host,opts). New runtime/pointer.ts PointerTracker (element-relative pointermove, 1 test). element.ts wires mount() after init, PointerTracker when onPointer present, pointer read in loop before frame, pointer.dispose on disconnect. Existing 24 tests unaffected -> 25 total.
- Task 2 deps: three ^0.170, ogl ^1.0.11, cobe ^0.6.3 added + installed.
- Task 4 template: runtime/effects/_TEMPLATE.test.ts.md (3-case conformance test + headless-GL-guard rules + redistribution flag guide).
- Task 3 (shared Stam fluid solver): FOLDED into the lane-1 acquisition task (both consumers halftone+fractal-glass are lane 1 / one agent -> it extracts runtime/lib/fluid-solver from the actual regent source in the report, rather than me guessing the solver inline).

## Next: dispatch tilt-acquire team (Task 5)
One agent per lane reads its recon report + the gradient reference + the template, ports verbatim into runtime/effects/<id>/{index.ts,manifest.json,index.test.ts}, runs vitest for its own effects, does NOT touch runtime/index.ts (registry centralized in Task 6 to avoid write conflicts). Canonical inventory + skips per the synthesis beat. Then Task 6: I register all in index.ts + integration test + build + smoke.

## Task 5 dispatched
Team tilt-acquire (5 teammates acquire-a..e) working 9 lane tasks from the shared TaskList (lane 1 regent +solver, 2 paper, 4 cobe, 5 casberry, 6 cursor-trail DOM, 7 aurora, 8a/8b motion-core, 9 ascii; lane 3 skipped as swirl dup). Shared brief docs/superpowers/tilt-lab-recon/ACQUIRE-BRIEF.md. Teammates: write effect dirs only, no runtime/index.ts edits, no commits/beats (team-lead does Task 6 registration + commits). Headless-GL-guard mandated so conformance tests pass in happy-dom.

## Spawn-race on lane 1 (resolved live)
acquire-a flagged a second teammate concurrently writing lane-1 files (mesh-gradient/swarm/fluid-solver complete + passing; fluid partial, no manifest/test; halftone/fractal-glass empty). Root cause = the batch-spawn double-claim race (see feedback_team_spawn_claim_race.md). Resolution: moved acquire-a OFF lane 1 to lane 6 (cursor-trail); pinged acquire-b + acquire-e to identify+own the lane-1 builder; I will reconcile lane-1 gaps during Task 6 central registration. Lane status as of resolution: lane 2 (paper) + lane 4 (globe) COMPLETE; lane 1 + lane 5 (particles) + lane 6 in progress; lanes 7/8a/8b/9 pending.

## Files
- tilt-lab/runtime/types.ts (addendum), runtime/pointer.ts + .test.ts (new), runtime/element.ts (wiring), package.json (deps), runtime/effects/_TEMPLATE.test.ts.md (new)
