---
name: Taste-gate per-project accepted-exceptions mechanism (.sidecoach-accept.json)
description: Jonah - "Register it as an accepted exception." Built a per-project accept file the taste-gate reads to suppress named absolute-ban findings the team deliberately keeps; registered the hero-metric-template stat band as accepted. Also fixed the gate's ban-name reporting (it was printing the literal "ban").
type: project
relates_to: [session_2026-06-15_stats-ledger-reverted.md, session_2026-06-15_stats-ledger-and-taste-gate.md, feedback_taste_failure_auto_gate.md]
---

After reverting the ledger to the original .stat card band (which re-triggers the
hero-metric-template ban at index.html:272), Jonah: "Register it as an accepted
exception." Built a proper exception mechanism rather than hardcoding or using the
30-min global suppress flag.

THE MECHANISM - per-project accept file:
- File: `<project>/.sidecoach-accept.json`, shape `{ "accept": [ { ban, file, reason } ] }`.
- The gate (sidecoach-taste-gate.sh) loads it from the resolved project root (nearest
  ancestor with DESIGN.md), and drops any absolute-ban finding whose banName + file
  basename match an accept entry BEFORE deciding whether to inject. Line numbers are
  ignored (they drift). Every entry carries a `reason` so the acceptance is on the record.
- SEPARATION OF CONCERNS: only the BLOCKING gate honors the accept. The raw detector
  (scanForAbsoluteBans) still reports the pattern - the pattern IS there; the accept only
  says "this is a deliberate design call, not an oversight, do not block on it." A linter
  detects; the ignore config is applied at the enforcement boundary. Verified: raw sweep
  still shows 1 finding; gate shows {} (silent).

REGISTERED: marketing-site/.sidecoach-accept.json accepts hero-metric-template / index.html,
reason = Jonah's explicit 2026-06-15 design call (the 3-up stat card band is the chosen
treatment; the ban-clearing ledger was rejected on taste).

LATENT BUG FIXED in passing: the gate's ban-scan node one-liner read `f.ban||f.id||'ban'`,
but AbsoluteBanFinding's field is `banName`. So every gate injection printed the literal
word "ban" (e.g. "anti-pattern ban|index.html:272|P1") instead of the real name. Fixed to
`f.banName||f.ban||f.id||'ban'`. Now injections name the actual ban (hero-metric-template),
which is also what makes accept-matching by ban name precise.

VERIFIED (verifiable-plan checks, all pass):
- TEST A (accept file present): piped a synthetic index.html Edit event into the gate ->
  returned {} (accepted, silent).
- TEST B (accept file moved away): same event -> gate fired with
  "anti-pattern hero-metric-template|index.html:272|P1" (real ban name now), proving the
  accept is specific to that ban+file, not a blanket mute, and the gate still enforces.
- Raw scanForAbsoluteBans('./marketing-site') still reports 1 finding (detector pure).

DESIGN NOTE for future: accept currently applies to absolute-ban findings only (the taste
validator findings have a different line shape "[error] taste/..."; not filtered). If a
taste-rule accept is ever needed, extend is_accepted to a second pass over the taste lines.
The accept lives at the hook layer; the sidecoach engine itself is unchanged, so build-report
/ monitor / MCP flows still surface the pattern (correct - those are advisory, not blocking).

Files touched:
- marketing-site/.sidecoach-accept.json (new - the accept registry)
- claude/hooks/sidecoach-taste-gate.sh (load accept file + filter; fix banName reporting)

Collaborator: Jonah.
