---
name: REAL BUG caught by reality-check - mcp-server test runner lacks HOME isolation, lane tests pollute the real flow-history
description: the mcp-server OWN test runner (mcp-server/__tests__/run-tests.ts) has no HOME isolation; since P4f, its lane-driving tests (lane-tool-e2e, lane-render-url) trigger a real lane FINALIZE -> flow-history publish -> writes the REAL ~/.claude/sidecoach-flow-history.json; latent since P4f (my P4f check only ran the isolated ENGINE suite); fix = mirror the engine runner's HOME isolation in the mcp-server runner
type: project
relates_to: [session_2026-06-14_p4-reality-check.md, feedback_post_phase_reality_check.md, session_2026-06-14_p4f-COMPLETE.md]
---

The post-phase reality-check directly caught a real defect during P4b-2
verification.

**Symptom:** real ~/.claude/sidecoach-flow-history.json md5 CHANGED during a full
test run (1940706f -> 19233bd -> 85d42f6 across runs), despite the engine's P4f
HOME isolation.

**Root cause (definitively isolated):** engine-only `npm test` leaves the real file
UNCHANGED (engine run-tests.ts isolates HOME). mcp-server `npm test` CHANGES it. The
mcp-server has its OWN runner (mcp-server/__tests__/run-tests.ts) that globs
__tests__/ and has NO HOME isolation (and no PLAYWRIGHT_BROWSERS_PATH). Its
lane-driving integration tests - lane-tool-e2e (P4d) and the new lane-render-url
(P4b-2) - call the engine's startLane/advanceLane via the engine dist, which since
P4f publishes the committed step to flow history. With no HOME override, that
publish writes the REAL ~/.claude/sidecoach-flow-history.json.

**Latency:** this has polluted the real file since P4f merged (the engine dist on
main carries the flow-history publish; the mcp-server lane tests run against it). My
P4f verification only ran the ENGINE suite (P4f was engine-scoped) + checked
flow-history unchanged there - so the mcp-server runner's gap was never exercised in
my P4f check. P4b-2 (which builds+tests BOTH packages and adds another lane-driving
mcp test) is where the reality-check surfaced it.

**Impact:** test lane entries (lane:lane_build:craft etc.) have been
appended/upserted into the user's real flow-history file across runs. Not
destructive (rolling record, idempotent upsert) but real pollution. Pristine
pre-pollution value was 03ad42c... (no clean backup).

**Fix (routed to impl, folded into P4b-2):** add HOME isolation to
mcp-server/__tests__/run-tests.ts mirroring the engine runner - set
process.env.HOME to a fresh mkdtemp (and PLAYWRIGHT_BROWSERS_PATH to the real
shared cache, respecting a pre-existing value) BEFORE running suites; spawned/loaded
suites then write the temp HOME. Re-verify: BOTH engine AND mcp-server `npm test`
leave the real ~/.claude/sidecoach-flow-history.json byte-identical
(before==after). Add a guard/assertion if practical.

**Cleanup (flag to Jonah):** the real file has accumulated test lane: entries; offer
to surgically remove lane-prefixed test entries (cautiously - do not unilaterally
edit the user's real history), OR leave them (harmless rolling record).

**Lesson:** when a write-path (P4f flow-history publish) lands in one package but is
EXERCISED by another package's tests (mcp-server lane tests via the engine dist),
verify the OTHER package's test runner has the same isolation. My P4f check was
scoped to the package I changed; the pollution lived in the consumer's test runner.

Collaborator: Jonah.
