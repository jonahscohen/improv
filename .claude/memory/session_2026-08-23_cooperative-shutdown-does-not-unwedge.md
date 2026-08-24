---
name: A teammate can APPROVE shutdown and still not be reaped; user manual close is terminal
description: Three build agents each returned shutdown_response approved:true yet their processes + panes persisted; approve != exit. Never kill; hand surfaces to the user for cmux-app close.
type: feedback
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: live (shutdown_response approved:true from all three; ps still shows them alive minutes-to-an-hour later; not killed)
confidence: high
relates_to: [session_2026-08-23_teammate-teardown-kill-respawn-wedge.md]
---

Post-compaction close-out of the megamind build (Phases 1+2 committed at cdb530f2 / bddbea14 / 96852d13).

WHAT HAPPENED: three named build teammates (gated-promote surface:45, taste-miner surface:43, cmux-tracker-build surface:47, all @session-dd93764a) held live panes after their units were accepted. I sent cooperative shutdown_request to all remaining teammates. A first background poll (~100s) showed the panes still up, so I initially (WRONGLY) called them wedged. Then their shutdown_response messages arrived: ALL THREE returned approved:true and said they were exiting cleanly (cmux-tracker approved ~01:16, taste-miner + gated-promote ~02:33-02:34). But a second poll (8x6s) STILL showed all three panes up and ps STILL showed all three processes alive - one of them (cmux-tracker) an hour past its own approval. They even kept emitting idle_notification after approving, i.e. their turn loop was still draining - they were NOT wedged in the stopped-draining sense.

THE CORRECTED LESSON: a teammate can process a shutdown_request, APPROVE it, announce it is exiting, and STILL not be terminated - the cmux runtime did not reap the process or close the pane. So "approved:true" is NOT proof of teardown, and neither the earlier stopped-draining wedge nor this approve-but-not-reaped case is fixable by re-sending. My first poll window was also too short to even see the approvals (they took minutes). Do not conclude anything from a ~100s poll.

OPERATIONAL RULE going forward:
- Send cooperative shutdown ONCE. Wait for the shutdown_response (it can take MINUTES, not ~100s) AND verify the pane/process is actually gone. Approval alone is not done; gone is done.
- If, after the approval, the process/pane still persists (approve-but-not-reaped) or the agent never responds (stopped-draining wedge): STOP. Do not re-send in a loop, do not kill (respawns wedged), do not force-close (that path is only for a CONFIRMED-DEAD pane, and these are alive).
- Hand the specific surfaces to the user for a manual cmux-app close and move on. This is the terminal step for BOTH failure shapes.
- Justify watcher is never in this set and is never touched.

STATE at write time: surfaces 43/45/47 - all approved shutdown, all still alive + paned (runtime did not reap), handed to the user to close from the cmux app. Their work is fully committed, so closing them loses nothing. Session paused per the user's choice (deploy + review Phases 1-2 before Phase 3; work kept local, not pushed).

Files: none (housekeeping + handoff only).
