---
name: Audit output rebuilt - staged-progress panel is the default, JSON wall killed
description: Jonah picked the staged-progress panel. Built it - the monitor now defaults to the clean panel (15 lines, was 232 of JSON), the audit panel shows render -> a11y -> taste progression with per-lens counts, --json embeds renderedPanel for the skill's one-run use. Verified live + fail-closed.
type: project
relates_to: [session_2026-06-26_audit-output-ux-diagnosis.md, session_2026-06-26_audit-command-rendered-wired.md]
---

Collaborator: Jonah. 2026-06-26. Jonah chose "Staged-progress panel" (AskUserQuestion, with preview mockups).

## WHAT WAS BUILT
- sidecoach-monitor.js: DEFAULT output is now the clean rendered panel (was JSON.stringify -
  the 232-line wall). `--json` opts into the machine-readable result AND embeds the same panel
  string under `renderedPanel` so the skill prints it for the user from ONE run (no second,
  re-rendering pass - matters because the audit launches Chromium). `--render` kept as alias.
- audit-rendered.ts: RenderedAuditResult gains a `lenses` summary {objective,subjective:
  {available, findings, reason?}} computed in runRenderedAudit.
- sidecoach-orchestrator.ts: SidecoachResult gains an optional `audit` field
  {renderUrl, lenses, verdict, grade?, totalFindings}; toRenderedAuditResult populates it in
  both branches (rendered + inconclusive).
- sidecoach-present.js render(): branches on result.audit. For audits it renders the STAGED
  lens progression (render -> a11y -> taste, each ✓/✗ with scanned/N findings or unavailable+
  reason) in place of the generic flow phases/checklist/gates. The verdict line falls back to
  result.audit when there's no buildReport (inconclusive), so a non-clean verdict is ALWAYS
  shown, never hidden; next falls back to result.guidance.
- SKILL.md: template rewritten to the one-run model - run `--json`, print `r.renderedPanel`
  verbatim for the user, act on r.guidance/r.buildReport yourself. The default (no flag) prints
  the panel directly. Updated the "panel" section to match.

## VERIFIED (looked at the output)
- DEFAULT `/sidecoach audit localhost:4830`: 15 lines (was 232). Header "audit localhost:4830";
  staged lenses `render ✓ loaded · 1280×800 / a11y ✓ scanned · 20 findings / taste ✓ scanned ·
  0 findings`; `verdict blocked · grade F · 20 findings`; next = top finding. Matches the chosen
  mockup.
- FAIL-CLOSED panel (dead port localhost:59997): `render ✗ did not load / a11y ✗ unavailable ·
  ERR_CONNECTION_REFUSED / taste ✗ unavailable`; `verdict inconclusive · 0 findings` (no grade);
  next = "the audit did not run... verify the dev server". Honest, no fake clean.
- --json: valid JSON, carries renderedPanel + audit.lenses + guidance (one-run for the skill).
- audit-rendered unit test: OK. Full suite: 65 suites passed, 0 failed.

## NOTE / FOLLOW-UP
- True LIVE animation (spinner per stage redrawing in place) is NOT done - deliberately. In a
  captured transcript (Claude's Bash tool) there is no animation; the staged panel reads as
  progress there, and that was Jonah's pick. A real-TTY streaming variant is the deferred "live
  streaming" option if wanted later.
- result.panel (the old panel-renderer card) is still set on the audit result; it is now only
  visible via --json and is superseded by the default render. Harmless; could be removed later.

## Files touched
- sidecoach/bin/sidecoach-monitor.js, sidecoach/bin/sidecoach-present.js,
  sidecoach/src/audit-rendered.ts, sidecoach/src/sidecoach-orchestrator.ts,
  claude/skills/sidecoach/SKILL.md
</content>
