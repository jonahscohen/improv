---
name: P4f kickoff - FlowHistory outbox publisher; Codex authoring the plan
description: P4f (last lane build item) started - add a second outbox publisher 'flow-history' that durably writes committed lane step results to flow history (fencing-conditional, idempotent) via the P4b-1 outbox replay path; Codex authoring the plan (task-mqdoxpyj), I review next
type: project
relates_to: [session_2026-06-14_p4d-COMPLETE.md, session_2026-06-14_p4b1-COMPLETE.md]
---

P4f started right after P4d merged. P4f = FlowHistory outbox publisher (the last
lane BUILD item; P4b-2/P4e remain deferred).

**Scope (I investigated the integration points):** P4b-1 built the outbox + the
generic LaneSideEffectSink (only declared publisher today) + publishOutbox/replay/
ack, anticipating P4f (OUTBOX_PUBLISHERS is a list; ack is already per-publisher,
removing the record only when pendingPublishers empties; lane-checkpoint-store.ts
:188 comment reserves the flow-history publisher). P4f adds a SECOND publisher
'flow-history' that writes a committed lane step result into flow-history.ts via
the outbox replay path - fencing-token-conditional + idempotent (spec :687-723;
EXECUTE-time flow-history writes are FORBIDDEN per :713-719). Touches:
OUTBOX_PUBLISHERS, publishOutbox dispatch+ack generalization, the two
outbox-record creation sites in lane-runner.ts (~:298, ~:486), and a fencing-aware
dedup layer over the append-oriented FlowHistory.recordFlow (its public API +
20-run cap must stay intact for existing callers; new fields additive).

**Workflow:** durability-core + spec-bound -> Codex authoring the plan
(task-mqdoxpyj-q9y503, --write --effort high) with a precise brief (spec section +
the 4 integration files + the dedup design problem). Next: I review the plan
(integrity dash/NUL scan since --write bypasses content-guard, spec faithfulness,
both creation sites, publishOutbox ack invariant, fencing semantics, FlowHistory
API preservation, test coverage), then execute via a fresh impl team, Codex code
review, merge. NOT pushed.

**Still needs a Jonah decision:** P4b-2 browser-evidence collector introduces a new
Playwright dependency - FLAG before starting that one.

Collaborator: Jonah.
