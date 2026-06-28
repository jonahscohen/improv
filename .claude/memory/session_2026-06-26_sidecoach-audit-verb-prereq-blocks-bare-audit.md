---
name: Sidecoach `audit` verb fails closed when run bare (flowK requires flowJ polish prereq)
description: Running `/sidecoach audit <target>` standalone errors on a flow-prerequisite chain (flowK_multi_lens_audit requires flowJ_tactical_polish to have run first) and returns a MISLEADING false-clean (verdict clean / grade F / 0 findings) instead of actually rendering + scanning the page
type: reference
relates_to: [session_2026-06-26_sidecoach-audit-is-diagnosis-reframe.md, session_2026-06-26_marketing-homepage-critique.md]
---

Collaborator: Jonah. 2026-06-26.

## What happened
Asked to diagnose the marketing homepage, I correctly routed to `/sidecoach audit
localhost:4830` (per the audit-is-diagnosis reframe) and ran the engine:
`node sidecoach/bin/sidecoach-monitor.js "/sidecoach audit localhost:4830"`.

It came back `success:false`:
- `flowK_multi_lens_audit` -> status `error`: "Flow prerequisites not met: Required flow
  flowJ_tactical_polish has not been executed"
- `flowI_accessibility` -> `skipped` (canExecute false, cascades off the same prereq)
- buildReport nonetheless rendered `verdict: clean`, `overallGrade: F`, `0 findings`, and the
  panel printed "clean - grade F - 0 findings".

## Why this is a bug (not just a quirk)
The whole point of the audit-is-diagnosis reframe is that `audit` is the PRIMARY READ PATH
for diagnosing an existing page on request - i.e. run bare, with NO prior build/polish. But
the flow chain hard-requires flowJ_tactical_polish to have executed first, so the exact
use case the reframe blesses (bare diagnostic audit) FAILS CLOSED. Worse, it fails to a
"clean / 0 findings" panel, which is a FALSE POSITIVE: a caller who trusts the panel verbatim
(as SKILL.md instructs) would report the page is clean when the engine never rendered or
scanned anything. Grade F + 0 findings + verdict clean is internally contradictory and should
never be surfaced as a result.

## Workaround used this session
Ignored the false-clean panel and ran the audit's actual read path by hand: rendered
localhost:4830 in Chrome MCP at desktop in both themes, captured every section, and ran the
detection lenses on source via grep (text-align:justify, sub-13px font-size, U+2013/U+2014,
marketing-buzzword list). That produced the real diagnosis.

## Fix direction (not yet done - flagged to Jonah)
Either (a) make `audit` self-sufficient: flowK should declare flowI/its scan steps as its
own prereqs and NOT depend on flowJ_tactical_polish (polish is a SEPARATE verb, not an audit
precondition); or (b) at minimum, when a required flow is missing, the runner must NOT emit a
`verdict: clean` buildReport - it should surface `verdict: error` / no-grade so the panel
can't read as a passing audit. Option (a) is the real fix; (b) is the guardrail. Likely lives
in the flow-prereq/canExecute logic + buildReport composition in the lane/flow runner.

## Files to look at when fixing
- sidecoach flow registry / prereq declarations for flowK_multi_lens_audit + flowI_accessibility
- the buildReport composer that emits verdict/grade even when flows errored/skipped
