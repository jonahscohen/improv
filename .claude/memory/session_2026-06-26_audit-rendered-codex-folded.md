---
name: Codex review of the rendered-audit wiring - folded (no P0; 2 P1 + 2 P2)
description: Independent Codex (gpt-5.5) review of the /sidecoach audit <url> wiring. No P0. Folded all four - P1 partial-lens false-clean (one lens fails + 0 findings was reported clean; now inconclusive), P1 a second command surface rejected audit (CommandRoutingAdapter), P2 early-return skipped memory recording, P2 bare-domain URL detection. Re-verified live + suite.
type: project
relates_to: [session_2026-06-26_audit-command-rendered-wired.md, session_2026-06-26_audit-command-doesnt-render-rootcause.md]
---

Collaborator: Jonah. 2026-06-26.

## CODEX VERDICT: No P0. 2 P1 + 2 P2. All folded.
Codex independently ran the test + `tsc --noEmit` (both passed) before ranking.

## P1-A (folded) - PARTIAL-LENS FALSE CLEAN (the important one)
My verdict treated `obj.available || subj.available` as "rendered" and my own test wrongly
locked in "one lens failed + zero findings -> clean". But the failed lens (e.g. objective
a11y) may have had blockers - so a partial scan with zero findings is NOT clean.
FIX: 'clean' now requires BOTH lenses ran AND zero findings. A partial scan with zero
findings -> 'inconclusive'. audit-rendered.ts adds `bothLensesRan`; the orchestrator
toRenderedAuditResult routes ANY 'inconclusive' (no-render OR partial) to the honest
success:false / no-BuildReport path, and a partial scan WITH findings (warnings-only/blocked)
now prepends a "partial scan - coverage incomplete" note + the unavailable-lens reasons to
guidance + nextSteps. Test case 7 flipped to expect 'inconclusive'; added 7b (partial + a
warning -> warnings-only, reason still surfaced).

## P1-B (folded) - a SECOND command surface rejected /sidecoach audit
command-routing-adapter.ts validated only getAvailableCommands() (PHASE commands), so
`CommandRoutingAdapter.route('/sidecoach audit <url>')` returned "Unknown command: /audit"
(Codex reproduced). The live monitor path was fine, but this adapter is a real surface.
FIX: merged getVerbCommandInfo() into the validation/enrichment/isKnownCommand sites.
Verified: route now returns command:audit, error none; isKnownCommand('audit') true.

## P2-A (folded) - early return skipped memory bookkeeping
The rendered shortcut returned before the chain's recordFlowWithMemory, so a successful
audit created no "memory entry" and later history-based checks wouldn't see it. FIX: a
best-effort `this.recordFlowWithMemory(flowResult)` (try/catch - never fail the audit on it)
for the successful rendered audit.

## P2-B (folded) - URL detection false negatives (bare domains)
looksLikeUrl accepted http(s)/localhost/ipv4 but not example.com / example.com/path. FIX:
conservative bare-domain support - a bare host.tld is a URL only with a STRONG signal
(explicit port, a path, or a recognized public TLD) and NEVER when the host is a source/asset
file (Card.tsx, styles.css). Tests added (example.com, example.com/pricing, sub.example.io:3000
true; Card.tsx, styles.css, config.json, foo.bar false).

## RE-VERIFIED (whole unit, not just the patched lines)
- Build green (tsc + generate-validators --check OK).
- audit-rendered.test.ts: OK (incl. the flipped partial case + 7b + bare-domain matrix).
- LIVE: /sidecoach audit localhost:4830 still renders, verdict BLOCKED, 20 findings (no
  regression from the folds).
- P1-B probe: CommandRoutingAdapter accepts audit.
- Full suite: 65 suites passed, 0 failed (after the folds). GREEN.

## Files touched
- sidecoach/src/audit-rendered.ts (bothLensesRan verdict, bare-domain looksLikeUrl)
- sidecoach/src/sidecoach-orchestrator.ts (inconclusive shaping + partialNote + recordFlowWithMemory)
- sidecoach/src/command-routing-adapter.ts (merge verb commands)
- sidecoach/src/__tests__/audit-rendered.test.ts (partial -> inconclusive, 7b, bare domains)
</content>
