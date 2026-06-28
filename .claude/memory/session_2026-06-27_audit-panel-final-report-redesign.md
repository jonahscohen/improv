---
name: Audit panel redesign - Jonah reversed staged-progress, wants a FINAL REPORT
description: Jonah saw the staged panel and reversed his earlier "staged-progress" pick. 4 points - (1) staged framing comes too early / panel should be a final report, (2) still too verbose / exposes machinery (route, flowK, conf, render loaded 1280×800, scanned), (3) truncated "next" is useless, (4) redesign into an attractive, sensible, helpful FINAL report panel.
type: feedback
relates_to: [session_2026-06-26_audit-staged-panel-built.md, session_2026-06-26_audit-output-ux-diagnosis.md]
---

(Note: the staged-panel work it relates to is NOT fully superseded - the JSON-wall-kill,
monitor default-flip, --json renderedPanel, and the skill/daemon/postresponse wiring all
stand. Only the panel CONTENT/framing - staged process view - is being redesigned into a
final report.)

Collaborator: Jonah. 2026-06-27.

## THE FEEDBACK (on the staged panel built 2026-06-26)
1. "This comes too early. I think I was wrong and maybe the panel needs to come at the end."
   -> the staged render->a11y->taste framing reads as PROCESS; he wants a FINAL REPORT, not a
   "watch me work" view. (Reverses the AskUserQuestion "staged-progress" pick.)
2. "Still a very verbose 'I'm gonna show you everything' presentation." -> drop the internal
   mechanics: route, "rendered audit", flowK, conf 1.00, "render loaded 1280×800", "scanned".
   The user does not care HOW it ran.
3. "What does 'next' being truncated do to help me?" -> a fix cut off mid-selector
   ("...button.inst…") is useless. Fixes must be COMPLETE + actionable (selector + metric).
4. "Turn this into a more attractive, more sensible/helpful FINAL report panel." -> redesign,
   my judgment.

## THE PLAN (build my best report, show him, iterate)
A final audit REPORT, not a process view:
- Header: tool mark + `audit · <url>` (drop the utterance echo).
- VERDICT headline, prominent: mark + verdict + grade + N findings.
- FINDINGS grouped by category (accessibility = objective, taste = subjective) and by rule,
  with counts + a plain-English description ("low-contrast x18  contrast under 4.5:1").
- PRIORITY FIXES: top N offenders, FULL selector + the concrete metric (4.23:1), never
  truncated mid-string (truncate the selector tail if long, but always keep the metric).
- Drop: route/flowK/conf, the staged lens "scanned/1280×800" lines.
- Honest inconclusive case stays (did-not-run, never a fake clean).

## DATA NEEDED (computed in the orchestrator from audit.findings, bounded payload)
- byRule: [{rule, lens, count}] (counts over ALL findings, ~10 distinct rules).
- topFixes: top ~6 (blocking first) {selector, metric, rule}.
Attach to result.audit; present.js renders descriptions + layout from these.

## Files (planned)
- sidecoach/src/sidecoach-orchestrator.ts (result.audit gains byRule + topFixes)
- sidecoach/bin/sidecoach-present.js (renderAuditReport replaces the staged audit branch)
</content>
