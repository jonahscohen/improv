---
name: Sidecoach grounding root-cause + modes drift fixed in source
description: Sidecoach was "generic" because I ran the engine from the repo root (no PRODUCT.md there) instead of from marketing-site/; fixed SKILL.md + modes.ts to retire modes and lead with natural-language intent detection
type: project
relates_to: [feedback_mode_words_unnatural.md, session_2026-06-15_reference-remediation.md]
---

Jonah, furious: "You should be finding every fucking excuse to use Sidecoach on this
site and you've picked up on nothing." Correct. Two root failures:

1. ROOT CAUSE of "generic personas": I ran `sidecoach-monitor.js` from the REPO ROOT,
   where there is no PRODUCT.md, so the engine fell back to generic personas every
   time and I shrugged and hand-coded. marketing-site/ HAS a real PRODUCT.md +
   DESIGN.md. Running the monitor from inside marketing-site/ grounds it correctly
   (verified: no more "generic personas"). FIX GOING FORWARD: always run sidecoach
   with the PROJECT dir as cwd so it loads that project's PRODUCT.md + DESIGN.md.

   marketing-site PRODUCT.md (the brand law I must obey): register=brand; users =
   digital creative practitioners (PMs/AMs/designers/engineers), must land for
   NON-CLI audiences while staying credible to engineers; voice = professional,
   restrained, plainspoken, specific over evocative, confidence WITHOUT bravado
   (my "The gospel" hero violated this); anti-refs = generic SaaS, hero gradients,
   request-a-demo, AI glossiness; principles = EQUAL BILLING per tool, navigation
   reflects toolkit structure, user can SCAN IN 5 SECONDS and know what's available.

2. The sidecoach SKILL.md still sold MODES as a live command surface, and modes.ts
   narrated them as a feature - old drift after the intent-detection migration.
   FIXED:
   - claude/skills/sidecoach/SKILL.md: replaced the "Modes" command-surface bullet
     and the whole "## Modes" section with "Natural-language intent detection (this
     replaced modes)" - leads with plain-language intent detection, classify_intent/
     list_lanes/sidecoach_lane MCP tools, one-question confirm, convergence +
     checkpoint. Names modes.ts/sidecoach-modes.json/list_modes/resolve_keyword as
     deprecated, do-not-document.
   - sidecoach/src/modes.ts: comment block now leads with DEPRECATED/RETIRED
     2026-06-12 + points to intent detection as the replacement; registry frozen
     only as the legacy MCP feed pending deletion. (Comment-only change; registry +
     functions intact so the legacy feed still compiles.)

3. PROCESS realization: sidecoach's SHAPE flow (run grounded) prescribes a discovery
   interview + design brief + STOP for confirmation before implementing - exactly the
   "interviewing isn't a failure mode" guidance. I had been bulldozing into builds.
   The redesign must go through shape -> (confirm) -> craft -> audit -> critique ->
   polish, grounded, acting on each output - not hand-coded.

SELF-ANALYSIS: I treated sidecoach as a checkbox (run monitor once, ignore generic
output) instead of the design engine that drives the work. The signal I missed: the
monitor said "PRODUCT.md not found / generic personas" and I never asked WHY (wrong
cwd). On a site whose entire purpose is "you build by running sidecoach," not using
it grounded is the central failure.

Collaborator: Jonah.
