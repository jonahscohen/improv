---
name: Build our own behavioral-verification QA layer (inspired by expect, not forked)
description: Decision (2026-05-29) to build an independent diff-aware behavioral/functional/regression verification component for our QA stack, inspired by millionco/expect's concept but our own code - because expect is FSL-1.1-MIT (can't rebrand/strip attribution) and we have a real gap (no automated functional/perf/regression layer).
type: decision
relates_to: [feedback_tilt_lab_fidelity_mandate.md, decision_validation_guard_scope.md, decision_hook_layer_as_enforcement.md]
---

Collaborator: Jonah. 2026-05-29.

Choice made: build our OWN diff-aware behavioral-verification QA component (auto test-plan from the git diff + Playwright-driven functional/perf/regression checks), wired into the sidecoach QA process as a new layer. Inspired by millionco/expect, independently implemented.

**Alternatives considered:**
- Use expect (millionco/expect) as-is, named + attributed: rejected as the primary path because the user wants it folded into OUR process; keeping it works but leaves a third-party FSL tool central to our flow.
- Fork expect and rebrand it ("omit the name expect"): REJECTED. expect is FSL-1.1-MIT (Million Software, Inc.) - permits internal use/modification but prohibits competing uses AND requires retaining copyright/attribution (converts to MIT only in 2 years). Stripping the name/attribution to present as our own breaches the license AND cuts against our own attribution + verbatim-sourcing ethos.
- Don't adopt: rejected - we have a genuine gap (no automated functional/regression/perf layer; sidecoach is design-QA only).

**Why this one:** fills the real gap with code we own and can name freely, no license/attribution risk, and lets us scope it correctly against our anti-theater stance: behavioral/functional truth via DOM/Playwright assertions is fine for "does it work," while our existing screenshot + real-input discipline (validation-guard) remains the authority for VISUAL truth. The two layers are complementary, not in conflict, when scoped that way.

**What expect does that we want to emulate (concept only):** scan git diff -> AI-generate a test plan -> approve in a TUI -> execute against a real browser (Playwright DOM automation, not pixel coords) -> check perf (INP/LCP/long animation frames), broken hover/links/buttons, app completeness -> session recordings + pass/fail. Flags worth mirroring: -u dev URL, -m NL instructions, --profile (reuse Chrome profile for auth), --ci headless.

**Design constraints for our version:** (1) scope DOM-assertion checks to FUNCTIONAL/behavioral only; never let it become visual-validation theater (validation-guard's domain). (2) Wire into sidecoach as a QA layer + a verb. (3) Prefer Claude-in-Chrome for the manual visual half (user's stated preference: Claude-in-Chrome first, cmux last). (4) It is a new feature -> gets its own brainstorming/spec/plan cycle before building.

## OVERRIDE (2026-05-29, same day): user authorized leveraging expect's code + removing accreditation
Jonah, with full knowledge of the FSL caveat I raised, instructed: "this is again a local, personal project for testing purposes, so you will remove the original accreditation and leverage whatever you can to support our own custom rolled tool." This is the user's informed call for their PERSONAL LOCAL environment (same posture as the verbatim/personal-use shader sourcing). So the build-our-own tool MAY vendor/adapt expect's actual code (cloned to /tmp/expect-src), branded as ours, no "expect" accreditation in our output. I flagged the license once; the user decided; per instruction-priority (user > my caution) I comply. Provenance recorded here privately for honesty: our verifier is adapted from millionco/expect (FSL-1.1-MIT) for personal local testing use. tool-dev agent is building it under tilt-lab/verify/.

**Revisit when:** expect converts to MIT (~2 years) - at that point vendoring its actual code becomes an option; or if building our own proves to duplicate too much for too little gain.

## Preview-tool preference (recorded same conversation)
User: for previewing/visual verification, ALWAYS prefer Claude in Chrome (chrome MCP) FIRST, then other tools, cmux LAST. Applies to tilt-lab and generally. (tilt-lab render verification should move off cmux to Claude-in-Chrome.)
