---
name: P4b-2 final re-review NEEDS-FIXES - 1 P1 (abort doesn't bound latency on a stalled launch); everything else SHIP-sound
description: Codex final re-review confirmed all prior P4b-2 work closed/sound (contrast, hermeticity, concentric, renderUrl activation, test isolation+guard, genericity, --check) EXCEPT a refinement of the abort fix - finally awaits the launch promise, so an aborted collector still hangs if chromium.launch stalls; fix = fire-and-forget cleanup on launch-phase abort + an injected-unresolved-launch latency test
type: project
relates_to: [session_2026-06-14_p4b2-code-review.md, session_2026-06-14_p4b2-renderurl-foldin-decision.md, session_2026-06-14_mcp-test-flow-history-pollution.md]
---

Codex final re-review (task-mqea218t; session 019ec7f7) = NEEDS-FIXES, 1 P1 only.

**CONFIRMED CLOSED/SOUND (everything except the one below):** P1-1 contrast
(withheld unless fully measured, no 21/true fallback), P1-2 hermeticity
(serviceWorkers:'block' + WS block + http route before nav), P2 concentric (every
visible child), renderUrl activation (additive persisted identity, validated/stored,
threaded engine+MCP, only target identity persisted), test isolation (mcp runner
pins cache before temp HOME + real-file guard exits 3), genericity untouched/
excluded, static clean policies identical, --check authoritative, no new non-ASCII.

**REMAINING P1 - abort does not bound LATENCY on a stalled launch.** The round-1
abort fix maps the returned reason correctly, BUT the finally block AWAITS the
launch promise to close the browser (browser-evidence-collector.ts:254). If
chromium.launch() stalls, the aborted collector also stalls - so abort returns the
right reason but not promptly. The abort test only checks the reason after launch
eventually settles, not bounded latency. FIX (Codex-specified): on launch-phase
abort, fire-and-forget cleanup WITHOUT awaiting launch:
  if (!browser && launch) { void launch.then((b)=>b.close()).catch(()=>undefined); }
  else { await browser?.close().catch(()=>undefined); }
+ a deterministic injected-launch test proving the collector RETURNS before a
deliberately-unresolved launch promise settles.

**SELF-ANALYSIS:** round-1's abort fix (and my verification of it) checked that
abort returns available:false with the right reason, but NOT that it returns
PROMPTLY when the underlying op hangs - the finally-await re-introduced the hang.
LESSON: for cancellation/abort fixes, the test must assert bounded LATENCY (returns
before the slow operation settles, via an injected unresolved promise), not just the
returned value. Routed to impl.

**Next:** impl applies the abort-latency fix (failing-first injected-launch test),
re-verify (both runners green + real flow-history byte-identical + collector OK),
final Codex re-review, merge, live e2e run.

Collaborator: Jonah.
