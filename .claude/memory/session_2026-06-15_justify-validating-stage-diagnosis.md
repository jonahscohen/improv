---
name: Justify "Validating..." stage - diagnosis (nothing broke, I bypassed it)
description: Diagnosis of why the justify Validating stage never showed - the stage is fully wired but no CLI helper drives POST /validating, and my loop skipped it + verified out-of-band with headless screenshots
type: project
relates_to: [session_2026-06-15_justify-marketing-queue.md, reference_browser_validation_tool_precedence.md]
---

Jonah asked (2026-06-15): "you aren't checking for fixes in browser like justify
mandates you do. We have an entire 'Validating...' stage. Did something break?"

ANSWER: Nothing broke. The Validating stage is fully wired end to end:
- Daemon: `POST /validating` endpoint exists (justify/server/ws-server.ts:338-345);
  it broadcasts `justify_validating` to all connected clients, refreshes
  lastMcpActivity/watchSessionActive (treats validating as live work, not idle).
- Core: `_claudeToValidating()` (justify/core/index.ts:1455-1480) flips the
  claudebar to an animated "Validating..." pill. State machine is
  Working -> Validating -> Review (_surfaceReviewIfPending guards against
  overriding an in-flight validating state at index.ts:1491).

THE GAP (not a break, a bypass on my side, in two layers):
1. CLI layer: there is NO `justify-validating` helper. `justify-done.sh` jumps
   straight to POST /respond + /prompts/clear. The /validating endpoint is only
   reachable by a manual `curl -X POST http://localhost:9223/validating`. So
   nothing in the documented loop (watch -> apply -> done) ever flips the bar to
   Validating. Confirmed: `grep -rl "/validating"` across /opt/homebrew/bin and
   ~/.claude/justify/*.sh and improv justify/cli/ = ZERO matches.
2. My loop: I went watch -> apply -> justify-done, skipping /validating entirely,
   and I verified each fix with my OWN headless Playwright screenshots instead of
   the actual connected browser (the marketing-site tab Jonah has open). So Jonah
   never saw "Validating...", and my "browser check" wasn't the page he was
   manipulating. That is the exact thing the correction names.

FIX (two parts) - BOTH DONE:
- Durable (DONE): created `justify-validating` CLI helper (justify/cli/justify-validating.sh,
  modeled on justify-done.sh) that POSTs /validating and prints a clean card.
  Deployed: copied to ~/.claude/justify/justify-validating.sh (chmod +x) and
  symlinked /opt/homebrew/bin/justify-validating. Smoke-tested against the live
  daemon - flips the claudebar to "Validating...". The Validating stage is now a
  first-class step: watch -> apply -> VALIDATING -> verify in the connected browser
  -> done.
- Process (DONE, applied this session on prompt-4): my justify loop is now
  watch -> apply -> justify-validating (bar shows Validating) -> verify the change
  in the live connected browser (real Chrome screenshot of localhost:4830, Read it)
  -> justify-done (bar -> Review, panel fills with the +/- diff). Never substitute
  my own headless screenshot for looking at the page the user is actually connected
  to. Verified end to end: stats grid rendered 30/51, Changes panel entry #8 showed
  the +2/-2 diff with both selectors.

VERIFICATION BOUNDARY (honest, reality-check): proved the endpoint+handler exist,
the helper deploys/POSTs (HTTP 200), the claudebar switched to the validating
shimmer SPARK animation, and the loop completes (Review-stage panel diff rendered).
NOT proved with a clean pixel: the literal "Validating..." TEXT label - the bar
pills collapsed to icon-only in my captures and when I hover-expanded for a text
shot the MCP tab's Chrome renderer froze (3 consecutive CDP captureScreenshot
timeouts; daemon still connections:2, so it was MY automation tab freezing under
the dithered-canvas hero, not a justify fault). So: stage works, helper drives it,
loop closes - the only unproven sliver is a clean photo of the word "Validating".

SELF-ANALYSIS (why it happened): I treated justify as authoring-only and bolted my
generic Verification-Protocol browser check (headless Playwright) onto the side,
not realizing justify HAS a dedicated in-loop validation state that I was supposed
to drive. The signal I missed: the claudebar has a Validating state distinct from
Working and Review - that distinction only exists because validation is meant to be
a visible, in-flow step, not an out-of-band afterthought.

Collaborator: Jonah.
