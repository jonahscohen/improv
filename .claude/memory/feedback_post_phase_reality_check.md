---
name: After each delivered phase, ask "is this real or fluff I can't guarantee?"
description: Standing directive from Jonah - after every delivered/merged phase, run a skeptical end-to-end reality check; verify the thing is actually consumed/activated and does what it claims, not just that the mechanism passes its own tests
type: feedback
---

Jonah (2026-06-14): "I want you to ask yourself after each delivered phase: 'is
this whole thing real? is it going to do what it says it's going to do, or is this
fluff I can't guarantee?'"

**Why:** a long autonomous build can produce many "merged, Codex SHIP, verified
green" phases whose MECHANISMS pass their own tests while the END-TO-END value is
unproven - the code is written and tested but nothing consumes it, nothing
activates it in real usage, or the signal quality on real inputs is unmeasured.
Green tests prove the mechanism, not the lived outcome. Reporting such a phase as
"done" without flagging the gap is the fluff Jonah is calling out.

**How to apply (after EVERY delivered phase, before calling it done):**
1. CONSUMPTION: does anything actually READ/USE what this phase produces? Trace the
   consumer path concretely (grep for callers), not by assumption. A write with no
   reader is a record, not a feature - say so.
2. ACTIVATION: in REAL usage (not just tests), will this code path actually FIRE?
   Check the real trigger/input (e.g. does a real caller provide the input the
   feature needs), not just that the test harness supplies it.
3. SIGNAL QUALITY: for heuristic/validator/quality features, tests on crafted
   fixtures prove the mechanism, NOT the false-positive/false-negative rate on real
   inputs. Do not claim real-world efficacy you have not measured.
4. LIVED END-TO-END: has the feature actually been exercised the way a real user/
   model would use it, end to end, once? If only the plumbing is tested, say
   "plumbing tested, lived use unproven."
5. Report the answer HONESTLY: separate "mechanism real + tested" from "actively
   consumed / activates in practice / measured on real inputs." Flag every gap as a
   gap, propose wiring it or explicitly mark it deferred/observability - never let a
   write-only or dormant capability read as a working feature.

This is the positive counterpart to the verification protocol: not just "does it
render / pass" but "is it actually wired into reality and will it do the job."

First application (2026-06-14, lane phases): found P4f writes durable lane entries
to flow history that have NO lane-specific consumer (the lane prerequisite logic
runs off the CHECKPOINT, not flow-history), and P4b-2's browser collector only
fires when the lane TARGET is a literal URL (normal targets are free-text -> the
browser rules stay inconclusive/dormant in practice). Both mechanisms are correct
and tested; both have real activation/consumption gaps that were NOT visible from
"green + SHIP". See [[session_2026-06-14_p4-reality-check]].

Collaborator: Jonah.
