---
name: P4b-2 - fold in renderUrl activation (Jonah) + queue a live end-to-end lane run
description: Jonah chose to fold the renderUrl input path into P4b-2 so the browser rules actually fire (not a dormant engine), then run one live end-to-end lane via the MCP against a served page to prove the whole chain; this expands P4b-2 scope to touch the mcp-server (sidecoach_lane renderUrl arg) beyond the original engine-only plan
type: decision
relates_to: [session_2026-06-14_p4-reality-check.md, session_2026-06-14_p4b2-code-review.md, feedback_post_phase_reality_check.md]
---

After the reality-check (P4b-2 browser rules only fire when the lane target is a
literal URL -> dormant for free-text targets), Jonah chose: FOLD IN the renderUrl
activation path, THEN queue a live end-to-end lane run.

**Scope (sanctioned expansion beyond the original engine-only P4b-2 plan):**
- ENGINE: add optional renderUrl to the checkpoint (target identity, set at start,
  additive+persisted); startLane accepts + stores it; lane-runner step/boundary
  validator call sites use renderUrlFromContext({ renderUrl: cp.renderUrl, target:
  cp.target }) so an explicit renderUrl wins and the target-as-URL fallback is
  preserved.
- MCP: add optional renderUrl to sidecoach_lane (laneShape/LaneInput) start op
  (validated URL); lane.ts threads it into engine.startLane. THIS CROSSES the
  original "engine-only, does NOT touch mcp-server" boundary - explicitly
  lead+user-sanctioned now.
- The engine plumbing is already partial (renderUrlFromContext prefers renderUrl
  over target), so the core change is threading a REAL renderUrl from
  checkpoint/MCP-arg into the call sites instead of deriving it from the free-text
  target.

**Tests (failing-first):** engine - a lane started WITH a renderUrl activates the 4
browser rules (real verdict) on a data:/served fixture; NO renderUrl + free-text
target stays inconclusive (dormant, as before); checkpoint persists renderUrl across
reload. MCP - sidecoach_lane start accepts+threads renderUrl; schema rejects a
non-URL.

**Cross-package now:** build BOTH (engine + mcp-server), run BOTH test runners
(engine npm test; mcp-server npm test - note the known python_repl OOM env-fail
there), dist allowlist spans engine dist + mcp-server dist.

**Then: LIVE END-TO-END RUN (verification, per the reality-check directive).** Serve
a tiny real page (e.g. python http.server on a tmp HTML), drive a lane through the
MCP sidecoach_lane start with renderUrl pointing at it, advance, and CONFIRM a
browser rule reaches a real verdict (pass/fail, not inconclusive) end-to-end. This
proves the whole chain (MCP -> engine -> collector -> rule), not just the plumbing.

**Sequence:** impl folds in renderUrl -> I verify -> FINAL Codex re-review (4 fixes +
renderUrl, engine+MCP) -> merge -> live e2e run -> P4b-2 truly DONE.

Collaborator: Jonah.
