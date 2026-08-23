---
name: justify watch - owner mode is ATTENDED-ONLY, headless is the standing-watch mechanism
description: Owner mode (default) never re-invokes the owner on a batch; a parked owner-mode watch silently stalls. Headless dispatch is the canonical unattended standing watch.
type: reference
relates_to: [session_2026-08-17_justify-watcher-shutdown-guard.md]
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: codex-review
confidence: high
---

Established from the daemon source while answering a peer (the Ethos Justify Warden) whose owner-mode "watch" silently stalled a 7-prompt Send-All (it declared a "light watch", ended its turn, and nothing woke it).

**Two persisted dispatch modes on the :9223 daemon** (justify/server/watch-state.ts, `headless` field, persisted so it survives daemon restarts):
- **OWNER mode (headless:false, DEFAULT):** "the queue is the daemon's; the work is not." The dispatcher tick (justify/server/dispatcher.ts:295-299) sees a claimable batch and `if (!this.headless) return;` - it does NOTHING: no claim, no spawn, NO notify, NO re-invocation of the owner. By design (a detached worker would hide the work from the user). So owner mode is **ATTENDED-ONLY**: it is for a session actively running the claim->apply->respond->clear->re-poll loop ("keep looping until the user says stop", SKILL.md Step 6). It is NOT a standing/parked watch. End the turn in owner mode and the next batch silently stalls.
- **HEADLESS mode (headless:true):** the dispatcher polls (~2s tick), CLAIMS each Send-All batch, and spawns a detached `claude -p` worker to apply it, across session teardowns, with no owner session alive. Stale/dead-worker claims expire at a 40min TTL and re-dispatch, so a batch is never stranded. Set persisted via `justify-serve --headless` or POST /watch/mode {"headless":true}. Even headless DEFERS (ownerActive 30s grace) while an HTTP owner is actively polling GET /prompts, so headless + occasional in-session owner drains coexist under the claim-before-apply contract.

**Canonical answer for a standing/unattended warden:** arm HEADLESS. There is NO owner-mode heartbeat to adopt. A self-scheduled polling wakeup is only a bridge for someone insisting on owner-mode inspect-before-claim across turn-endings - it hand-rolls what headless does for free and only works while the wakeup keeps firing.

**Do NOT** treat idle_notification heartbeats as a batch-arrival signal - they are liveness pings ("NOT prompts and NOT work"), and justify-watch-standing-by.sh suppresses them.

**Possible improv hardening (surfaced to Jonah, not built):** owner mode gives no runtime signal that it is attended-only, so an agent can arm it, call it a "watch", and wrongly believe something will wake it. justify_status could warn when armed owner-mode with unclaimed prompts and no active owner. SKILL.md Step 6 already says "arm the daemon; do not run a session poll loop", but nothing enforces the attended-only nature at runtime.

**Third option = HARDENED HEADLESS WORKER (specced, DEFERRED).** Headless is not inherently "unverified": the worker (justify/cli/justify-worker.sh) spawns a full `claude -p` (bypassPermissions, --add-dir root), so it inherits CLAUDE.md rules. As shipped it is apply-and-report (forbids sub-workers, no browser verify, no explicit gate). It COULD be hardened to run a Codex diff review (codex-review.py is a stdin pipe, NOT a sub-worker, so the "no sub-workers" rule doesn't block it) + tests/lint before justify-done - giving unattended AND gated, losing only the interactive in-browser visual check. So the real menu is 3, not 2: (1) attended owner-mode review-first, (2) headless as-is (effectively auto-apply), (3) hardened headless (unattended + gated). The Ethos warden reached this fork 2026-08-20; Jonah chose (1) review-first, bridged with a SESSION-scoped self-poll monitor (re-fires only while the warden session lives - a session teardown reopens the between-sessions gap that headless's persistent daemon would not). Option 3 stays the durable answer if unattended is ever wanted; build justify-worker.sh's gate then.
