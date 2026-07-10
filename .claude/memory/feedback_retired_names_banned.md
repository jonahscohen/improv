---
name: Retired names banned from docs and beats
description: Jonah - the tactical-polish skill's pre-rename external name (and its four-letter shorthand) and sidecoach's pre-rename name must not appear in docs or beats at all; canonical names only (tactical-polish, sidecoach); enforced by content-guard
type: feedback
relates_to: [feedback_plain_language_not_phase_codes.md]
---

Collaborator: Jonah. 2026-07-03.

Jonah: the tactical UI-polish skill's former external-derived name - in any form, full or four-letter shorthand - and the design orchestrator's pre-rename name must never appear in docs or beats. Canonical vocabulary is tactical-polish and sidecoach, nothing else.

**Why:** stale and external-derived names fragment the record and undo renames - the orchestrator was renamed once, yet six live skill files still routed to commands under its dead name (broken references), and the polish skill's old name kept the project's own layer reading like a third-party add-on. The record should speak the system's own current vocabulary. This extends [[feedback_plain_language_not_phase_codes]] from comms to the written record itself.

**How to apply:**
- The skill IS tactical-polish now (vendored at claude/skills/tactical-polish/, installed bundled - the upstream npx pull was removed). Refer to it only as tactical-polish; refer to the orchestrator only as sidecoach.
- Enforced mechanically: content-guard blocks the old full name, the four-letter shorthand, the old compact filename token, and the orchestrator's pre-rename name (word-bounded, case-insensitive) in any .md write. Code files and captured corpus HTML are out of scope.
- First reading of this directive was too narrow (shorthand-only) and Jonah corrected it: the ban covers the name itself, not just its abbreviations. When Jonah says a name should not be mentioned "at all", that includes the full form.
- If a legitimate need to write one of the banned words arises, use the Hook Override Protocol - ask Jonah, do not rephrase the enforcement away.
- Implementation record: session_2026-07-03_retired-names-scrub.md.
