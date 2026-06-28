---
name: Sidecoach invocation gap (the engine is never reached by the natural path)
description: A fresh Claude session, given a textbook natural design-intent prompt, produced a good critique entirely by hand via Chrome MCP and used ZERO sidecoach. The whole arc proved the engine's DETECTION quality vs the oracle; nobody ever validated INVOCATION. This is the real gap.
type: project
relates_to: [session_2026-06-26_marketing-homepage-critique.md, session_2026-06-26_MISSION-COMPLETE-stage5-6.md, session_2026-05-23_sidecoach_intent_ambiguity.md]
---

Collaborator: Jonah. 2026-06-26.

## THE FINDING (Jonah surfaced it)
I handed Jonah a "natural language" stress prompt for the marketing site ("Something
about the marketing homepage feels off... tell me what's actually wrong with it").
A separate fresh Claude session ran it and produced a genuinely GOOD diagnosis
(session_2026-06-26_marketing-homepage-critique.md) - entirely by hand, eyeballing
localhost:4830 via Chrome MCP at 1440px in both themes. ZERO sidecoach: no
lane-classifier route, no rendered scanner, no registry rules, no runValidator, no
/sidecoach. The engine we spent the whole Option-B arc converging and proving sat
completely untouched. And because the hand-rolled critique was good, nothing felt
broken to that session - it had no reason to reach for the tool.

## DEBUG TRACE (what actually happened)
- The keyword hook (claude/hooks/sidecoach-keyword.sh) + lexicon (sidecoach-intent.json)
  DO work: run directly on the exact prompt with a cold cooldown, classify_intent
  returns NUDGE_ELIGIBLE and the hook emits the advisory nudge (exit 0, nudge JSON). So
  the script + lexicon are NOT the failure.
- Cooldown bleed was NOT the cause: the global cooldown file ~/.claude/.sidecoach-intent-cooldown
  was last touched Jun 25 17:11; the other session ran Jun 26 ~07:52 (~15h later, far
  outside the 1800s window). Cooldown was stone cold.
- KEY EVIDENCE: the NUDGE_ELIGIBLE emit path (sidecoach-keyword.sh:339-344) calls
  touch_cooldown() WHEN it prints. If the nudge had fired in that session at 07:52, the
  cooldown file mtime would be 07:52. It is still 17:11 the prior day. => the intent
  nudge never executed in the other session (hook didn't run in its harness, or the
  lane modules didn't import in its CWD/env, or classify returned SILENT). Could not
  fully reconstruct that session's environment from here.
- (My "warm cooldown" suppression sub-test was malformed - I wrote an empty file but the
  hook reads file CONTENT as a timestamp, not mtime - so that one result is invalid and
  not cited.)

## THE REAL (environment-independent) ROOT CAUSE
Even when the nudge FIRES it is (a) advisory ("not a mandate: decide, then proceed") and
(b) BUILD-framed ("before hand-coding," "produce a stronger result," "substantive UI
work," "skip it for trivial tweaks"). A read-only "diagnose what's wrong with my existing
page" is the PUREST audit/critique use case for sidecoach, yet:
- the nudge talks about BUILDING, so a Claude doing a diagnosis reasonably reads it as
  "not a build, I'll just look";
- the CLAUDE.md hard QA gate is CHANGE-gated ("before reporting done on any substantive
  UI CHANGE") - a diagnosis changes nothing, so it doesn't compel sidecoach either;
- there is NO hard route for "audit/critique an existing URL" - it's all soft nudge + judgment.
So the engine that beats the oracle has no reliable on-ramp for the single most natural
design-QA request a user can make.

## THE BIG PICTURE
The whole arc measured DETECTION QUALITY (eval vs oracle on a frozen corpus). It never
measured INVOCATION - whether a fresh Claude on a natural prompt actually ROUTES INTO the
engine. The first real invocation test failed completely. A proven engine nobody is wired
to reach. Invocation is the actual product surface, and it is not happening.

## SELF-ANALYSIS (per protocol)
I told Jonah the prompt would "trip the natural language detection," vouching for the gate
as a working routing mechanism, without ever having observed the natural path cause an
end-to-end invocation. I described the architecture the way the skill/docs ASPIRE to it,
not as it behaves. Same class of miss as claiming completion without verification: I
certified a behavior I had not watched happen. FIX/RULE: before claiming a trigger/gate
"works," observe it fire AND observe the downstream action it is supposed to cause, in a
real session - not just unit-test the matcher in isolation.

## NEXT (not yet done - for the fix pass)
- Reframe the nudge to cover DIAGNOSIS/critique of existing UI, not just building.
- Add a hard-ish route (or a stronger gate) for "look at <url> and tell me what's wrong" ->
  sidecoach audit/critique, since that is the canonical use case.
- Validate INVOCATION as a first-class test: a fresh session + natural prompt must
  demonstrably route into the engine, measured, not assumed.
- Consider per-session (not global) cooldown, and confirm the hook + lane modules actually
  load in the harness every session uses (the 07:52 non-touch suggests they may not have).

## Files touched
- (diagnosis only; no code changed this turn)
</content>
</invoke>
