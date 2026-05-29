---
name: Team spawn-race - simultaneous teammates double-claim the lowest-ID task
description: When N teammates are spawned at once and all read TaskList + claim simultaneously, two can grab the same lowest-ID task before the owner field syncs, causing duplicate/colliding work. Seen twice on 2026-05-29 (tilt-recon + tilt-acquire), both on the heaviest lowest-ID task.
type: feedback
relates_to: [session_2026-05-29_tilt-lab-recon-team.md, session_2026-05-29_tilt-lab-acquisition-exec.md]
---

Collaborator: Jonah. 2026-05-29.

## The failure mode
Spawning 5 teammates in one batch, each instructed to "claim the lowest-ID available task," makes them all read TaskList at nearly the same instant and all see task #1 unowned. Two (or more) claim it; the owner field only reflects the last writer, but BOTH teammates proceed to build it. Result: duplicate effects, half-written files from two sources, and a teammate confused about who is the "parallel builder."

Observed TWICE same day, both on lane 1 (the biggest task):
- tilt-recon: recon-d claimed lane 1, found recon-a had already written a complete report, stood down. (Benign - read-only recon, last-write-wins on a report file.)
- tilt-acquire: acquire-a owned task #1 per TaskList, but a second teammate was concurrently writing effects/fluid, mesh-gradient, swarm, fluid-solver - leaving gaps (fluid without manifest/test). Required manual cleanup: stood acquire-a down to lane 6, pinged b+e to find the real builder. Higher stakes because they WRITE files (corruption risk on same-file concurrent writes).

## Why it happened
The claim protocol has a read-then-write gap with no atomic compare-and-set. "Lowest-ID first" funnels every teammate at the SAME task simultaneously at spawn, maximizing collision probability on exactly one task (the biggest, which then has two builders for longest).

## How to prevent (apply next team dispatch)
1. STAGGER claims: assign each teammate a distinct starting lane explicitly in its spawn prompt (acquire-a->task1, b->task2, ...), instead of all racing for "lowest-ID." They fall back to "lowest pending" only AFTER finishing their assigned one.
   OR
2. Pre-assign owners up front: after TaskCreate, TaskUpdate owner on each task to a specific teammate name before/at spawn, so there is nothing to race for.
3. If keeping the claim-loop: tell teammates to claim, then RE-READ the task (TaskGet) and confirm they are still the owner before doing any work; if not, release and pick another.
4. Spread the heavy task: lane 1 had 5 effects + a shared solver; oversized lowest-ID tasks are the worst collision target. Split heavy lanes or give them a dedicated pre-assigned owner.

## Best default
Pre-assign distinct starting tasks in the spawn prompt (option 1) - simplest, removes the race entirely, costs nothing. Reserve the claim-loop for the tail (after a teammate's assigned task is done).
