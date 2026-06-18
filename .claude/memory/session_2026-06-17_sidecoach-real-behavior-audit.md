---
name: Sidecoach engine real behavior - routes fine, but rubber-stamps Grade A without auditing
description: Live run of the sidecoach engine on a real file - classification/guidance are real, but the BuildReport declares clean/Grade A/0 findings in 1ms without inspecting the target. Jonah's "phony" skepticism is substantially correct.
type: project
relates_to: [feedback_simulations_match_real_tui.md, session_2026-06-17_sidecoach-demo.md]
---

Jonah challenged the sidecoach marketing demo as aspirational and said he's never seen sidecoach successfully route - "i still think it's a phony program." I ran the engine for real to settle it.

Command: `node sidecoach/bin/sidecoach-monitor.js "/sidecoach audit sidecoach-demo.html"` (exit 0).

**What is REAL:**
- Routing/classification works: detectedFlow = flowK_multi_lens_audit, confidence 1. It correctly understood the plain-language request.
- It returns a structured guidance scaffold (5 audit dimensions) + a 9-item checklist (all completed:false) - i.e. a to-do list for Claude to execute.

**What is THEATER (the "phony" part, with evidence from the raw JSON):**
- `executionDuration: 1` (ms). It never opened sidecoach-demo.html.
- `findings: []`, `severityCounts {blocking:0, warning:0, info:0}`, yet `verdict: "clean"`, `overallGrade: "A"`, `overallPassRate: 100`, `nextSteps: ["No findings - ship clean."]`. It declared a passing grade for a file it did not read.
- `domainGrades` only contains "claudemd-mandate" (1/1). The 5 advertised audit dimensions (a11y, perf, theming, responsive, anti-patterns) contributed ZERO real validation. The claimed "28-rule anti-pattern detection" did not run against the file.
- Second flow `flowI_accessibility` was SKIPPED ("prerequisites not met, canExecute returned false"). "1/2 flows successful" where success = "emitted guidance text".

**Honest verdict:** sidecoach is an intent-router + prompt-scaffold generator, NOT an auditing engine. The actual audit work is entirely on Claude to perform by following the guidance. The BuildReport/verdict layer is misleading: it stamps "clean / Grade A / ship" before (and independent of) any real inspection. So Jonah's instinct is correct with nuance - it's not vaporware (it runs and routes), but it overstates itself and does none of the substantive work it reports a grade on.

**Implication for the demo:** my simulated demo showed sidecoach "finding 2 issues, 1 note, applying fixes" - pure fiction. The real engine finds nothing because it inspects nothing. A faithful demo cannot show the buttery audit->critique->polish->fixes story. Brought the decision back to Jonah (rebuild from real transcript / shelve until the engine does the work / keep clearly-labeled illustrative).

**Product-integrity flag:** the marketing copy ("runs the right pass end to end, checks the result against your brand") oversells what the engine does. Worth reconciling before shipping a demo that depicts it.

Collaborator: Jonah.
