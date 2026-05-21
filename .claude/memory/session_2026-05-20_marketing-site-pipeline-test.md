---
name: Marketing microsite - the first real pipeline run
description: Jonah picked option (a) from the design-process discussion - use the installed pipeline on a real UI build to surface friction. The build is a local marketing microsite that sells claude-dotfiles as a packaged product. Autonomous (no direction asked). Location is marketing/ in the dotfiles repo.
type: project
relates_to: [session_2026-05-20_readme-4-house-rewrite.md, session_2026-05-20_design-references-catalog.md, session_2026-05-20_motion-reference-skill.md]
---

## The test

Jonah's 2026-05-20 challenge after I confirmed the pipeline had never actually fired on a real build pre-2026-05-19: "use what's installed, run the pipeline on a real UI task to see what fires."

The real UI task: build a local marketing microsite that sells claude-dotfiles as a packaged product. Autonomous (no direction questions to Jonah). Routes through the full pipeline as the README documents.

## Pipeline route I'm running

Per the README's "how the layers stack on a real build" sequence:

1. PRODUCT.md + DESIGN.md (derived from existing material - README, yes& logos, brand voice in the corpus - so I don't have to ask Jonah brand questions)
2. /impeccable shape <feature> mentally - propose brand direction + site structure
3. component-gallery-reference - research hero / nav / card-grid / footer patterns
4. fontshare-reference - typography (NOT from reflex-reject list)
5. design-references - check the personal catalog (1 reference: unlumen-kbd)
6. motion-reference - GSAP + Lenis canonical patterns
7. icon-source - pick one icon library
8. make-interfaces-feel-better - tactical polish during impl
9. /impeccable audit + critique + polish at QA time

## Decisions locked autonomously

- **Location**: `claude-dotfiles/marketing/` (subdirectory of the dotfiles repo, NOT a separate repo - this microsite is part of the package)
- **Tech**: Astro (built for marketing sites, zero-JS by default, supports interactive islands for GSAP + Lenis)
- **Typography target**: Schibsted Grotesk (display) + Hanken Grotesk (body) + JetBrains Mono (code). Validated against fontshare-reference reflex-reject list - all clear.
- **Icon library**: TBD via icon-source skill when first icon is needed
- **Audience**: Engineering teams and individual developers considering adopting the dotfiles. Mid-senior level, motion-literate, value polish.
- **Narrative spine**: Same as README - problem / opinion / system / proof + the four houses. Different format (visual marketing site vs documentation).

## Why this matters

The README claims an 8-step pipeline sequence that has zero corpus evidence pre-2026-05-19. This build is the test. Either it works as documented (and we have evidence next time we touch the README), or it has friction (and the friction tells us what to cut, wrap, or fix).

## Collaborator

Jonah
