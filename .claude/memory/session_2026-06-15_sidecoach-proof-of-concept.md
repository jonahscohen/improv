---
name: Sidecoach proof-of-concept run - IS it a functional product? (yes, with honest gaps)
description: Actually ran sidecoach's real evaluators against the live reference page + the intent detector on natural language + the engine test suite, instead of running the monitor for guidance and hand-judging; the evidence
type: project
relates_to: [session_2026-06-15_sidecoach-grounding-and-modes-drift.md, session_2026-06-15_usage-docs-team.md]
---

Jonah demanded I prove sidecoach ACTUALLY WORKS by leaning into its full capacity on
the site, and answer plainly: functional product or not? Earlier I had only run
sidecoach-monitor.js (returns guidance text) and hand-judged taste - NOT using the tool.

WHAT I ACTUALLY RAN (the real engine, not the monitor):
1. bin/sidecoach-taste-check.js marketing-site/reference.html marketing-site/styles.css
   -> 3 REAL line-numbered findings: 2x taste/fabricated-svg (theme-toggle moon/sun had
   no icon-source marker), 1x taste/translatey-in-hover (.tool-card:hover uses
   translateY lift not scale-on-press). Acted on the 2 reference findings per the
   validator's exact instruction (added <!-- source: lucide ... --> + class="lucide-X"
   + data-icon-source in the assembly's theme-toggle), re-ran -> 3 -> 1. The remaining 1
   is the index's tool-card in shared styles.css, already carrying a documented
   "this finding is overridden" comment (not the reference). LOOP PROVEN.
2. IntentDetector.detect() on 5 natural-language requests: 3 good (boring hero ->
   tactical polish 0.85; build a card -> component implementation 0.85; "less cluttered"
   -> disambiguation candidates = the one-question-confirm behavior), 2 misses
   ("accessibility problems on the reference page" misrouted to reference-inspiration -
   keyed on the noun "reference"; "the type on this page" matched nothing). Real,
   honest accuracy gaps surfaced.
3. npm test (the engine suite): 55 suites pass - intent, lanes, validators (taste,
   theming, anti-pattern), convergence, browser-evidence collector (contrast/a11y/
   hermeticity/abort) all OK.

VERDICT (honest, evidence-based): YES, sidecoach is a functional product. Its
evaluators parse real pages and return accurate, actionable, line-numbered findings;
the fix loop converges; 55 engine suites are green incl. the real-browser collector.
It is NOT perfect: the intent classifier misroutes on certain phrasings (the word
"reference" overrode "accessibility"; a typography phrasing missed), and the
model-facing MCP surface (classify_intent / sidecoach_lane) is NOT connected in this
session (settings.json mcpServers = voice-output/justify/peekaboo only), so the
natural in-chat lane workflow could not be exercised here - real gaps worth fixing.

SELF-ANALYSIS: the whole prior failure was conflating "ran the sidecoach command" with
"used sidecoach." The tool's value is the EVALUATORS (taste-check, build-report, the
validators, the browser collector) and the intent brain - none of which I had run
against the actual artifact. Running them is the difference between proof and opinion.

Files: marketing-site/reference.html (theme-toggle icons now annotated, via the
assembly script /tmp/assemble-reference.js). Collaborator: Jonah.
