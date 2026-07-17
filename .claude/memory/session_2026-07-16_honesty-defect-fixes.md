---
name: Fixed the 4 honesty defects surfaced by the four-product gap analysis
description: Jonah ruled "fix the 4 verified defects" over the capability gaps; the false-pass fix grew into a fail-closed BAN_SCANNERS registry after Codex found TWO more false-certification sites I missed; 5 Codex rounds to GO
type: project
relates_to: [session_2026-07-16_four-product-gap-analysis.md, feedback_self_review_before_codex.md]
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: 66 suites + tsc + 5/5 migration harnesses + behavioral probe + 5 rounds real Codex (GO)
confidence: high
---

Collaborator: Jonah. 2026-07-16. Follow-on from session_2026-07-16_four-product-gap-analysis.md.
Jonah chose "fix the 4 verified defects" over the three capability-gap options.

## What shipped

1. FALSE PASS KILLED (the real one). loadAbsoluteBans() shipped 6 bans; scanProject ran 5
   scanners; the adapter marks any finding-less ban as passed -> ban-identical-card-grids was
   certified clean on every project forever AND the summary string named it clean.
   Fix went past the flagged line: added BAN_SCANNERS, a readonly {name, kind, scan} table that
   is now the single source of truth. SCANNED_BAN_NAMES, BOTH scan loops, scannedBanLabel() and
   scannedBanCount() are all DERIVED from it, so "a ban name with no invoked scanner" is no
   longer expressible. Module-load drift guard throws if reference-loader and the table disagree.
   PROVEN: injected a fake scanner-less ban -> guard threw with the drift message -> reverted.
2. DEAD CODE DELETED. loadFontReflexReject (16 fonts, zero consumers). Vocabulary is NOT lost -
   the live broader 21-face list is claude/skills/fontshare-reference/SKILL.md + sidecoach/
   reference/_extracted/local-skills/fontshare/INTEGRATION.md. Left a comment saying where to
   source it if a real font detector is ever built. (Jonah did NOT pick "wire the font detector"
   - that gap stays open by choice.)
3. README THEATER REMOVED. The SidecoachDetectBridge / `npx sidecoach detect` / 28-rule bullet
   described a command that does not exist.
4. LOTUS CONTRADICTION FIXED. anti-slop.ts recommended Inter (slop.md's #1 tell, #1 on our own
   reject list). Inter now appears only as banned; the USE INSTEAD line points at the
   fontshare-reference reject list.

## Self-analysis: I missed 3 of the 5 false-certification sites. Codex caught them.

Why: I pattern-matched "the bug is where the agent pointed" and fixed the adapter + summary in
absolute-ban-detector, then declared the unit done. I never grepped for OTHER places that
hand-typed the ban list. Root cause = I treated the finding as the bug rather than as ONE
INSTANCE of a class (hand-typed duplication of a derived fact). Codex round 1 found Flow J's
duplicate clean-string; round 2 found Flow J's "(6 named anti-patterns)" header; rounds 3-4
found stale operational comments still describing the deleted scanner as current behavior.
This is the same shape as feedback_self_review_before_codex.md: these were self-catchable with
one grep, not hard edge cases. The durable lesson is the FIX I chose in the end - deriving the
strings from the table means the duplication class cannot recur, which is worth more than
having found the 3 sites by hand. Next time: when a fact is stated in code twice, fix the
duplication, then grep for site #3 BEFORE calling Codex.

## Codex-found issues I would have shipped

- dist/ IS TRACKED (1184 files) and bin/sidecoach.js loads ../dist - my source fix would not
  have reached the actual package without npm run build. Rebuilt; verified dist no longer
  contains loadFontReflexReject or "6 named bans".
- eval/migration-harness/scanner-snapshot.mjs called ban.scanIdenticalCardGrids UNGUARDED and
  only worked by reading a STALE dist. It would have thrown on undefined the moment dist was
  rebuilt - a latent trap my own rebuild would have sprung.
- The golden encoded the buggy behavior (expected an identical-card-grids finding). I did NOT
  just recapture to make it green: proved across all 5 fixtures that the ONLY delta was that one
  rule disappearing, with nothing added, THEN recaptured. Golden diff is a pure 14-line deletion.

## Verification

Baseline probed BEFORE touching anything (66 suites green). After: 66 suites, tsc clean, all 5
migration harnesses verify OK (scanner/buildreport/convergence/reference/routing), behavioral
probe confirms the 5 live scanners still FIRE on a violating fixture and a violating page fails
its bans (the loop refactor preserved semantics), grep for residual 6-ban claims across src/ AND
dist/ = 0. Real Codex (0.142.5, now working via the node-path-default hook): 5 rounds, 8
findings folded, round 5 GO with an independent dist smoke-check.

## Left open deliberately

category-reflex-detector.ts still contains 'Identical Card Grids' - DIFFERENT subsystem (filters
inspiration references by their own metadata prose, not a project scanner). Codex confirmed it is
not on the certification path. It is separately suspected theater (it grades a reference's title/
description, not any artifact) and needs its own rebuild-or-retire decision.
Also still open from the analysis: the domain-flow-matrix.md "69 deterministic checks" claim
(registry has 42 rules; only 5 of design-laws' 27 anti-laws have scanners), and the stale claim
in reference_visualizer_token_contract.md that the guard is registered in repo settings.json
(it is 0 there; it is installer-wired via app-wirings.json).

Files touched: sidecoach/src/absolute-ban-detector.ts, sidecoach/src/reference-loader.ts,
sidecoach/src/flow-handler-tactical-polish.ts, sidecoach/src/product-rule-registry.ts,
sidecoach/src/validators/checks/anti-pattern-checks.ts,
sidecoach/src/__tests__/{product-rule-registry,decouple-isolation}.test.ts, sidecoach/README.md,
sidecoach/eval/migration-harness/{scanner-snapshot.mjs,inputs/absolute-bans.html,golden/scanner/absolute-bans.json},
sidecoach/dist/** (rebuilt), lotus/src/ui/agent/design-knowledge/anti-slop.ts, + this beat + MEMORY.md.
