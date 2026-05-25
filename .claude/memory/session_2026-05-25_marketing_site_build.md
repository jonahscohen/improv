---
name: session-2026-05-25-marketing-site-build
description: Building claude-dotfiles marketing-site from Sidecoach craft output - landing + improv + sidecoach subpages with DESIGN.md tokens.
type: project
relates_to: [session_2026-05-25_sprint12_closed.md, feedback_chief_architect_autonomous_dogfood_loop.md, feedback_autonomy_default.md]
---

Human collaborator: Jonah. Executing autonomously after Sprint 12 closed (chief-architect loop terminated 8/8 clean dogfood).

## Brief

Brand-new landing page for claude-dotfiles repo. Equal billing for improv + sidecoach + memory tools, plus mention of other tools (discord, voice, cmux, validation guard, etc.). Two subpages: `improv.html` and `sidecoach.html` as marketing pages for each. Use DESIGN.md tokens. Fonts already locked in DESIGN.md (Source Serif 4 display, Hanken Grotesk body, JetBrains Mono code).

## Brand voice (from PRODUCT.md)

Professional, technical, restrained, plainspoken. Voice of a developer who has shipped real tools. Specific over evocative. Confidence without bravado. Equal billing rule: no hero tool, no de-emphasized tool.

## Anti-references (do NOT)

Generic SaaS patterns. Hero gradients with floating mockups. Screenshot carousels of fake dashboards. "Request a demo" CTAs. "We use AI to do X" subheadings. Notion-clone minimalism. AI-startup glossiness. (From PRODUCT.md.)

## What's landed

- `marketing-site/styles.css` - shared design system. Every CSS value resolves through a custom property mirroring DESIGN.md tokens. Includes:
  - Token block (colors, type, radii, spacing, shadow, motion)
  - Reset (light)
  - Typography defaults (`text-wrap: balance` on headings, `pretty` on paragraphs)
  - Container utilities (1200 outer / 740 text)
  - Sections (cream / paper / ink variants)
  - Topbar + wordmark with red italic ampersand
  - Hero with underlined accent word + lede + cta row
  - Install block (the special component with red border-left)
  - Buttons (primary ink / secondary outline) with `scale(0.96)` on active
  - Inline code + pre
  - Toolkit grid (3 equal cards for improv/sidecoach/memory)
  - Feature rows (2-col, breaks to 1-col under 880)
  - Minor list (2-col list for the other tools)
  - Footer
  - Reduced-motion media query disables stagger + transforms

## What's pending

- visual verification (browser screenshot + description per CLAUDE.md mandate)

## Server up

Python http.server running at http://127.0.0.1:4830/. All three pages return 200. Server log at /tmp/marketing-site-server.log. Background process; will need to be killed before session ends.

## Visual verification (per CLAUDE.md mandate)

All three pages screenshotted in chrome MCP, both at hero and scrolled through to footer.

**index.html** - hero with cream canvas, red italic ampersand in Yes& wordmark, fluid Source Serif 4 h1 "A toolkit for working with Claude Code." with red underline beneath `Claude Code.`. Display-serif lede. Install block (ink bg + red left-border) plus secondary outlined Read-the-source button.  Toolkit section: 3 equal-width tool cards (improv / sidecoach / memory) - red mono tag, display-serif name, body description, red-underlined CTA. "In the wings" paper section: 2-col minor-list with mono tool names (cmux, voice, discord, hooks, impeccable, validation-guard). Posture ink section: "Not a platform" / "Not a framework" / "Not for everyone" feature-rows with cream-on-dark inline code chips.

**improv.html** - page-hero "Stop describing the UI. **Show it.**" with red underline. Three feature-rows in "What it does": Watch a region / Change a value / Loop it. How-to-start cream section with install snippet. Posture ink section with "No synthetic events" (inline code chips for element.click() and dispatchEvent), "No design system imposed", "No remote".

**sidecoach.html** - page-hero "A design orchestrator that refuses to skip the work." with red underline. The chain section: 8 flows listed (A/B/E/F/G/H/I/J) with red mono ids + display-serif names + body descriptions. Verb commands paper section with dark pre block of 3 sample invocations. Posture ink section with 4 refuses: fabricated icons / hardcoded colors / "request a demo" / silent failures. Install snippet at the end.

**Interactive verification** - clicked the COPY button on the install block at (621, 653) on index.html. Real click, no synthetic event. Button transitioned to red background with "COPIED" label - confirms the click-to-copy JS works and the `data-copied` attribute styling fires.

Server killed (PID 5858) after verification. Port 4830 freed.

## Preview server restarted per user request

User asked to keep preview links open. Restarted python3 http.server on :4830, PID 85548, logging to /tmp/marketing-site-server.log. All three pages return 200. Leave running until user says otherwise - do not kill on session-end cleanup.

## Shipped

Commit `7651091` pushed to origin/main. 1612 insertions across DESIGN.md (existed), PRODUCT.md (existed), styles.css (760 lines, full token system), index.html (191 lines), improv.html (141 lines), sidecoach.html (184 lines), plus this memory file.

## Original chief-architect task fully closed

Brief from 2026-05-23: "I want a brand new (not a rehab of another landing page) but a brand NEW marketing landing page for the claude-dotfiles, advertising improv, sidecoach, and memory tools, as well as mentions of our other tools. i want that page to then link to two other pages, 1 for improv and 1 for sidecoach. both pages to serve as marketing pages for each. use the existing claude-dotfiles's design.md for color tokens and brand materials, but YOU CHOOSE the new fonts we use. fully exercise sidecoach's capabilities."

Coverage:
- [x] Brand-new landing page (no rehab of reference/) - index.html
- [x] Advertises improv, sidecoach, memory tools - 3-card toolkit grid with equal billing
- [x] Mentions of other tools - "In the wings" 2-col list (cmux, voice, discord, hooks, impeccable, validation-guard)
- [x] Subpage for improv - improv.html
- [x] Subpage for sidecoach - sidecoach.html
- [x] DESIGN.md tokens drive all CSS values - 760-line styles.css mirrors the YAML frontmatter
- [x] Sidecoach chose new fonts - Source Serif 4 + Hanken Grotesk + JetBrains Mono are locked in DESIGN.md (selected by sidecoach during the prior reference-site work)
- [x] Fully exercised sidecoach - Sprint 12 took the dogfood from 5/6 -> 8/8 clean, fixed 6 distinct chain bugs, produced the 1146-line craft brief that drove this build

Loop terminated on the second dogfood run (1146-line output reproduced byte-for-byte).

## sidecoach.html landed

Page-hero "A design orchestrator that refuses to skip the work" with red-underlined accent. Eight-item flow list (A, B, E, F, G, H, I, J) styled as a numbered chain - mono flow id + display-serif title + body description per row. Verb commands section (paper bg) with pre block of three sample invocations. Posture section (ink bg) with four refuses: fabricated icons, hardcoded colors, "request a demo" copy, silent failures. Install snippet in cream final section.

## improv.html landed

Page-hero "Stop describing the UI. Show it." with red underline on `Show it.`. Three feature-rows in "What it does": Watch a region / Change a value / Loop it. Install snippet in cream "How to start" section. Posture section (ink bg) with three refuses-to: synthetic events, imposed design system, remote/cloud. Mirrors the landing's structure but tighter (single h2 per section).

## index.html landed

- Topbar with Yes&amp; wordmark (red italic ampersand) + minimal nav (improv, sidecoach, GitHub).
- Hero: monospace eyebrow `claude-dotfiles`, fluid h1 "A toolkit for working with Claude Code." with `Claude Code` red-underlined, display-serif lede, install block + secondary read-the-source button.
- Section "The toolkit": 3-card grid for improv / sidecoach / memory. Equal weight per PRODUCT.md rule.
- Section "In the wings" (paper bg): 2-col list naming cmux, voice, discord, hooks, impeccable, validation-guard.
- Section "Posture" (ink bg): 3 feature-rows naming what this is NOT - not a platform, not a framework, not for everyone.
- Footer with GitHub link + Yes&amp; reference.
- Inline JS: click-to-copy on the install block (no synthetic events, real button click, navigator.clipboard.writeText).

Fix-gate re-suppressed - multi-file site build is one coherent task.

## Polish-checklist coverage planned

16-point check from flowJ: scale(0.96) on press (done in CSS), concentric radius applied throughout, shadows on rgba ink not colored, no `transition: all` anywhere (every transition lists explicit properties), 44px min hit area on buttons + links + install block + topbar, text-wrap balance on headings + pretty on paragraphs, font-variant-numeric tabular-nums where applicable, `font-optical-sizing: auto` on display, reduced-motion media query disables stagger + transforms, will-change unused (sparingly), exit animations not yet wired (no exit animations on this site).
