---
name: P4b-2 browser-evidence collector - DO IT engine-driven with Playwright (Jonah)
description: Jonah chose engine-driven Playwright for the P4b-2 browser-evidence collector; the heavy-dep objection that originally deferred it is moot - Playwright is already installed (tilt-lab) and the 1GB ms-playwright browser cache is shared machine-wide (Chrome MCP uses it too); sequence after P4f
type: decision
relates_to: [session_2026-06-14_p4-resequence-convergence-first.md, session_2026-06-14_p4f-kickoff.md]
---

Jonah confirmed: do P4b-2 (browser-evidence collector) engine-driven with
Playwright, AFTER P4f. The original deferral reason (new heavy Playwright dep) is
moot on this machine.

**Facts that changed the call (verified, not assumed):**
- Playwright IS already here: tilt-lab declares playwright ^1.60.0 and it is
  installed (tilt-lab/node_modules/playwright + playwright-core, ~17MB JS).
- The browser binaries are already cached + SHARED machine-wide:
  ~/Library/Caches/ms-playwright = 1.0 GB (Chromium 1148/1223, headless shell,
  ffmpeg) and the Chrome MCP uses the SAME cache (mcp-chrome is in it). tilt-lab
  has a Playwright verify/cli.mjs harness already.
- So adding Playwright to sidecoach is a ~17MB npm-package add reusing the shared
  cache - NOT a fresh ~300MB install. CI-capable.

**Why engine-driven over model-driven:** sidecoach has NO engine-side programmatic
visual validation today - every lane/product validator is static (ast-grep + file
reads). The StepReport `screenshot` evidence kind (lane-types.ts:12) is a
MODEL-ATTESTED string, nothing verifies it - which undercuts the P4a framework's
ethos (missing/unverifiable evidence -> inconclusive, never pass). Engine-driven
Playwright gives the framework real teeth (headless-Chromium evidence: axe-core
a11y, computed contrast, a captured screenshot artifact) instead of the model's
word. Model-driven (reuse cmux/Chrome MCP) is thinner but keeps weak attested
evidence and needs the model in the loop (no autonomous/CI validation).

**Alternatives considered:**
- Model-driven via existing cmux/Chrome MCP: rejected - weak attested evidence,
  model-in-loop only.
- Puppeteer (lighter): rejected - Playwright already present + shared; no benefit.
- Drop P4b-2: rejected by Jonah (chose to build it).

**Scope guardrails for the P4b-2 plan (when authored):** minimal - reuse the shared
ms-playwright cache (do NOT trigger a fresh browser download; add `playwright` to
sidecoach deps only); a small browser-evidence collector that captures a real
screenshot artifact + runs axe-core (or computed-style/contrast) and feeds it as
VERIFIED StepReport evidence into the existing lane/product-validator path;
headless; reduced-motion-aware; must degrade gracefully if no browser is available.

**Revisit when:** Playwright is removed from tilt-lab / the shared cache is purged
(re-evaluate the dep cost), or the validator framework moves to a different
evidence model.

**Sequence:** P4f first (in flight), then P4b-2. P4e (copy gating) still deferred.

Collaborator: Jonah.
