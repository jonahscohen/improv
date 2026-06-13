---
name: Homepage narrative HTML assembly (full below-hero rework)
description: Assembled the eight-section closed-loop narrative into index.html - mission opener (rewritten calm after Jonah's corny call), three-up, loop, stat band, foundation, FAQ, posture (kept), CTA banner
type: project
relates_to: [session_2026-06-10_homepage-narrative-css-components.md, session_2026-06-10_homepage-narrative-sidecoach-realign.md]
---

Collaborator: Jonah. 2026-06-10.

Full below-hero rework of marketing-site/index.html per the approved arc:

1. MISSION OPENER (cream) - "A development shop, working with Claude." First draft ("Built with Claude, not handed to it" / ampersand riff) was killed by Jonah mid-build: "corny... I just want you to explain what we're doing and why its important... calm confidence, no punchlines, just facts." Rewrote as plain facts: shop augments work with AI, tools cover what the bare model does not (plan against brief / hold design system / adjust live page / remember decisions), used daily on client work, they make the work dependable. TONE RULE recorded: the whole site sells with calm confidence, no punchlines. Scrubbed planned punchy titles too ("Counted, not claimed." -> "The scale of it, counted."; "The questions we actually get." -> "Common questions.").
2. TOOLKIT three-up (paper) - reordered sidecoach/beats/justify (Jonah's listing order), tags now loop roles (plan + design / remember / validate), descriptions trimmed to orientation length, CTAs jump to subpages. Fixed stale "Eight flows, 159 validators" copy.
3. THE LOOP (cream) - ol.process, 5 steps each with mono red number (aria-hidden), serif name, desc naming the real tool, red-tick stakeholder hook; decorative U-channel return rule labeled "remember feeds the next plan" (aria-hidden).
4. STAT BAND (ink) - dl.stats, 6 verified stats (26 flows / 218 validators / 49 hooks / 17 skills / 27 components / 0 telemetry), captions, count-up script (IO threshold 0.4, ease-out-quart 900ms, fires once, reduced-motion + no-JS safe because final values are the markup). Lede invites readers to count for themselves.
5. FOUNDATION (paper) - minor-list rewritten: skills / hooks / plugins / reference / tilt-lab.
6. FAQ (cream) - 8 native details/summary items, exclusive-open via name="faq", h3 inside summary.
7. POSTURE (ink) - untouched.
8. CLOSING CTA (cream) - .cta-banner ink card with second install block (id install-cmd-closing; existing copy script handles multiple buttons) + Read the source.

Numbers provenance: stats-miner teammate's audit (all reproducible; see realign beat). Copy: copy-strategist teammate drafts, mission rewritten per Jonah's tone correction. Component patterns: component-researcher (APG/details-summary/dl/ol).

Status: assembled, NOT yet verified visually - verification pass (screenshots desktop + mobile + FAQ interaction + count-up) is next, then sidecoach QA triad.

Files: marketing-site/index.html, marketing-site/styles.css (cta-banner on-inverse overrides added during assembly).
