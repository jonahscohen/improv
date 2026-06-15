---
name: P4b-2 code review (Codex) NEEDS-FIXES - 3 P1 + 1 P2 collector-quality defects -> impl
description: Codex code review of lane-p4b2 = NEEDS-FIXES; framework integration all confirmed sound, but 4 collector-internals defects - contrast false-trusted-pass on a BLOCKER (no-measure defaults to pass, violates never-pass-on-missing-evidence), incomplete network hermeticity (no SW/WS block), AbortSignal not honored mid-op, concentric-radius only checks first child; routed to impl with fixes
type: project
relates_to: [session_2026-06-14_p4b2-impl-done-verified.md, session_2026-06-14_p4b2-plan-approved.md]
---

Codex code review (task-mqe5pw2r; session 019ec788) of lane-p4b2 = NEEDS-FIXES.
CONFIRMED SOUND: genericity excluded+untouched+allowlist-gated+asserted-inconclusive,
trusted-marker gating (ad-hoc browser fields stay inconclusive), static clean
policies byte-identical + runtime promotion uses collected kinds only, --check
authoritative, PLAYWRIGHT_BROWSERS_PATH captured-before-HOME-override + P4f isolation
intact, test reconciliation sound, engine-only scope. 4 collector defects:

**P1-1 CONTRAST FALSE TRUSTED PASS (most important).** The collector skips
unparseable computed colors, ignores background images/gradients, assumes opaque
white base, and converts "nothing measured" into {wcagAA:true, ratio:21}
(browser-evidence-collector.ts:99/113/134/147); the rule treats wcagAA:true as a
blocker PASS (a11y-checks.ts:36). So an unmeasurable page FALSE-PASSES a BLOCKER
a11y rule - violates the framework's core "missing evidence -> inconclusive, never
pass" ethos (worse than no check). FIX: track measured/unmeasurable text counts;
OMIT the contrast evidence kind / return inconclusive when no text was faithfully
measured OR any unsupported background/color was encountered. Fixtures: no text,
gradient/image bg, unsupported computed color syntax -> all inconclusive not pass.

**P1-2 NETWORK HERMETICITY INCOMPLETE.** page.route is the only control
(:37/:40); it does NOT intercept Service Workers or WebSockets -> a reviewed page
can initiate cross-origin traffic. FIX: newContext({serviceWorkers:'block'}),
route/block WebSockets before navigation; cross-origin HTTP+WS leakage tests.

**P1-3 ABORTSIGNAL NOT HONORED MID-OP.** Polled only before launch + after goto;
no listener/race during launch/navigation/evaluate, no post-evaluate check
(:30/:36/:48/:51/:168). Abort during evaluate can return available:true; hangs
delay lane cancellation. FIX: register an abort listener that closes
page/context/browser + maps every interrupted phase to {available:false,reason};
race abort across phases; navigation + collection-phase abort tests.

**P2 CONCENTRIC-RADIUS FIRST-CHILD ONLY.** .find(visible) (:69) ignores additional
visible rounded children -> a valid first child hides failing siblings. FIX:
iterate EVERY visible direct child; count each qualifying parent-child pair.

**SELF-ANALYSIS (per protocol):** I missed P1-1 in plan review. I verified the
collector's hermeticity STRUCTURE (page.route) + degradation contract but did NOT
scrutinize the "couldn't measure" DEFAULT - which defaulted a blocker to pass. I
KNOW the never-pass-on-missing-evidence principle (it is P4a's whole ethos), so I
should have checked the collector's no-measure path against it. LESSON: for any
quality COLLECTOR, always verify the "couldn't measure / unsupported input" default
degrades to inconclusive, never to pass - especially for blocker rules. The partner
loop caught it: my review owns architecture/scope/integration, Codex's owns
collector-internals correctness.

**Next:** impl applies all 4 (each failing-test-first), re-verify (49+ suites,
collector OK in gate, real flow-history untouched, --check), Codex re-review, merge.

Collaborator: Jonah.
