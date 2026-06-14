---
name: P4d Task 2 corpus-row reconciliation - computed-eligibility parity gap (OUT_OF_SCOPE sits after the eligibility check)
description: Codex's Task 2 Step 5 assumed every declared corpus outcome reproduces under COMPUTED eligibility, but NUDGE_ELIGIBLE is checked before the OUT_OF_SCOPE/SILENT fallbacks - so a genuinely-eligible prompt can never reach OUT_OF_SCOPE; one pre-existing row had eligible omitted (=false) when production computes true; corrected the data, not the assertion
type: decision
relates_to: [session_2026-06-14_p4d-v2-approved.md, session_2026-06-14_p4d-mcp-migration-exec.md]
---

During P4d Task 2 execution, impl-p4d hit a real gap in Codex's plan. Task 2
Step 5 added a corpus-wide assertion that classifyIntent run with the COMPUTED
(faithfully-ported) eligibility reproduces every shared-corpus row's declared
`expect`. One PRE-EXISTING row broke:
  "The landing page is done. Make the migration production-ready."
  declared expect=OUT_OF_SCOPE, `eligible` omitted (=false).

Root cause (impl verified, not speculation): the prompt is GENUINELY eligible
(action "make" + target "landing page"); the faithful port computes true AND an
independent Python oracle running the real hook sanitize/is_informational/
_intent_eligible also returns true. In classifyIntent, NUDGE_ELIGIBLE is evaluated
BEFORE the OUT_OF_SCOPE fallback (keyword-resolver.ts ~352-354), so ANY
computed-eligible prompt yields NUDGE_ELIGIBLE and can never reach OUT_OF_SCOPE.
Codex's reasoning covered ROUTE/CLASSIFY winning despite eligibility, but missed
that OUT_OF_SCOPE/SILENT sit AFTER the eligibility gate. Of 23 rows, 6 declared
eligible=false but compute true; 5 still match (earlier ROUTE/CONTEXT_CHECK wins);
only this 1 OOS row breaks. mcp-server's own npm test stayed green (270/269, only
OOM); the failure was only in the engine-run computed loop.

Choice made: Option 1 - correct the DATA, not the assertion. Change that one row
to expect NUDGE_ELIGIBLE + eligible:true.

**Alternatives considered:**
- Option 2 (carve-out in the computed loop: skip outcome-equality when declared
  eligible=false but computed=true AND expect is OOS/SILENT): rejected - weakens
  the new parity assertion and could mask real regressions.
- Assert computed === declared `eligible`: already rejected by Codex (an earlier
  branch can win even when eligible is true); this case proves a softer version is
  needed, not a stricter one.

**Why this one:** the row's eligible:false/OUT_OF_SCOPE was a classifier-in-
isolation artifact (eligibility forced false); it never matched end-to-end
production, where the hook computes eligible=true and the system nudges. The hook
is out of scope to change and the port is verified faithful, so the corpus should
tell the truth about production. 1-line data change, no code/behavior change, all
4 corpus consumers (engine !!eligible, Python bool(eligible), MCP declared loop,
MCP computed loop) go green, and the strong assertion stays intact.

**Guardrails imposed on impl before commit:** (1) confirm OOS still exercised
under computed eligibility by another row that computes false; (2) run the Python
parity test to confirm the shared-corpus change doesn't break that consumer (do
NOT modify any Python/hook file); (3) no Option-2 carve-out; (4) rationale in the
commit message body (JSON has no comments). To be flagged to Codex in the final
code review.

**Revisit when:** the hook's eligibility logic changes (would re-derive which rows
compute eligible=true), or the classifier reorders NUDGE_ELIGIBLE vs the
OUT_OF_SCOPE/SILENT fallbacks (would change which declared outcomes are reachable
under computed eligibility).

Collaborator: Jonah.
