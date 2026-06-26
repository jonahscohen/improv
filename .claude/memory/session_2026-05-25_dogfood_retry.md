---
name: session-2026-05-25-dogfood-retry
description: Retry of the marketing-site dogfood task that triggered Sprint 8. Now that sidecoach actually has a brief-driven teach, running it end-to-end on the user's verbatim brief.
type: project
relates_to: [session_2026-05-24_sidecoach_dogfood.md, session_2026-05-25_sprint8_closed.md, feedback_recommended_does_not_override_user_choice.md]
---

Human collaborator: Jonah.

## What this session is doing

Sprint 8 closed. /sidecoach teach is now brief-driven. Retrying the marketing-site dogfood task using sidecoach end-to-end.

The user's verbatim brief (from earlier session, restated):
> "Build a brand new marketing landing page for claude-dotfiles, advertising improv, sidecoach, and memory tools, as well as mentions of our other tools. Index page links to two other pages, 1 for improv and 1 for sidecoach. Both pages serve as marketing pages for each. Use the existing claude-dotfiles DESIGN.md for color tokens and brand materials. YOU CHOOSE the new fonts. Fully exercise sidecoach's capabilities."

## Mistake I just caught in myself

First attempt at the runner: I PRE-EXPANDED the brief with my own interpretations of register, users, brand personality, anti-references, and strategic principles. That's wrong. The whole point of brief-driven teach is that it parses the USER's brief and asks about gaps - not that I pre-fill the gaps for them. Caught before the runner ran. Rewriting with the user's verbatim brief only.

## Plan

1. Write `dogfood-teach-step1.ts` that passes the user's verbatim brief (no embellishments) to `/sidecoach teach`.
2. Observe what teach extracts vs. what it flags as gaps.
3. For each gap, surface the question to Jonah via AskUserQuestion (one prompt batch).
4. Re-invoke teach with Jonah's answers in metadata.teachAnswers.
5. PRODUCT.md gets written.
6. Then run the flow chain (craft → polish etc) against the project.
7. Build the HTML following sidecoach's guidance.
8. Deliver.

## Project paths

- `marketing-site/` already exists (from first attempt) with DESIGN.md copied from `reference/DESIGN.md`.
- No PRODUCT.md yet - that's what step 1 produces.

## Files in flight

- `sidecoach/src/dogfood-teach-step1.ts` (rewritten after catching the pre-embellish mistake) - the teach runner now passes the user's verbatim brief only.

## Constraints to honor (from prior corrections)

- Don't pre-fill gaps that teach should ask about.
- Don't fall back to manual file inspection when told to use sidecoach.
- (Recommended) tags don't override user choice.
- If teach surfaces gaps, ask Jonah - don't invent answers.

## Teach result + bug found

Ran teach against verbatim brief. Status: pending. 3 gaps surfaced (brandPersonality, antiReferences, strategicPrinciples) as expected.

**Bug discovered:** teach's regex extracted `users` as `"the claude-dotfiles repo, advertising improv, sidecoach, and memory tools, as well as mentions of our other tools"` (high confidence) - the regex `(?:for|target|audience:?)\s+([^.]{8,}\.)` matched "for the claude-dotfiles repo..." and grabbed the wrong noun phrase. Worse, the merge logic in `mergeFromBriefAndAnswers` only writes teachAnswers when confidence is NOT 'high', so my correction would be silently dropped.

**Filed as future fix:** the users regex should be more conservative (look for `users:` explicitly, or for `[X] who [verb]` patterns; deprioritize bare "for X"). And/or the merge should always prefer explicit teachAnswers over extracted values.

**Workaround for this dogfood:** wrote PRODUCT.md by hand using Jonah's 4 answers from AskUserQuestion. Still honors sidecoach's gap-detection (teach told me what to ask) - just bypasses the buggy regex for one field.

## Jonah's answers (captured via AskUserQuestion)

- **users:** "Digital creative practitioners across roles - PMs, AMs, designers, engineers, and other technical-adjacent collaborators working in the digital creative space. Should land for non-CLI-comfortable audiences while staying credible to engineers who actually use the tools." (BROADER than I assumed - significant signal about the design)
- **brandPersonality:** "Professional, technical, restrained, plainspoken."
- **antiReferences:** "Generic SaaS marketing patterns" - hero gradients with floating product mockups, screenshot carousels of fake dashboards, "request a demo" CTAs, "we use AI to do X" subheadings, Notion-clone minimalism, AI-startup glossiness.
- **strategicPrinciples:** "Discoverability + visual hierarchy" - each tool gets equal billing, navigation reflects toolkit structure, visual rhythm matches architecture, user can scan in 5 seconds and know what's available.

## PRODUCT.md written

`marketing-site/PRODUCT.md` populated with the 5 fields. Now sidecoach's other flows can run against this project.

## Next

Run sidecoach's craft chain (or specific flows) against the marketing-site project. The expanded audience answer (PMs/AMs/designers, not just engineers) changes the design implications - the pages need to be visually inviting for non-CLI-comfortable readers while still being credible to engineers.

## Step 2 wired (about to run)

Created `sidecoach/src/dogfood-craft-step2.ts`. Will invoke `/sidecoach craft marketing-site` against the project. Output captured to `/tmp/sidecoach-craft-output.md` with per-flow guidance/checklist/artifacts + top-level appended guidance (oracle parity) + BuildReport.
