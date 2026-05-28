---
name: T-0010 sidecoach cheatsheet
description: Single-page verb + flow + mode cheatsheet shipped as in-repo CHEATSHEET.md and public marketing-site page
type: project
relates_to: [session_2026-05-28_t0008_sidecoach_keyword_hook.md]
---

T-0010 ships a single-page reference for the entire sidecoach surface in two places: an in-repo `CHEATSHEET.md` companion the SKILL file links to, and a styled `cheatsheet.html` on the marketing site.

## What was built

Two surfaces, one source of truth:

1. **`claude/skills/sidecoach/CHEATSHEET.md`** - in-repo doc with `type: reference` frontmatter. Sections:
   - Section 0 - Modes (5 modes from sidecoach-modes.json, T-0011's work): forge / kiln / bloom / canvas / trim. Columns: Mode | Shape of work | Verb chain | Example invocation.
   - Section 1 - Verbs (22 from sidecoach-verbs.json) grouped by phase: shape-strategy, build, review, tone, docs, tactical. Columns: Verb | What it does | Example invocation | Related flow(s).
   - Section 2 - Flows (38 from flows.ts) grouped by tier: Tier 1-6 + Special + Legacy. Columns: Flow ID | Name | Triggered by verb(s) | One-line purpose.
   - Section 3 - "How verbs route to flows" prose, references T-0008's keyword hook and the verb-command-registry.
   - Footer: "Generated from sidecoach-modes.json, sidecoach-verbs.json, and flows.ts. Regenerate after registry changes."

2. **`marketing-site/cheatsheet.html`** - styled HTML mirror of the same content. Uses the marketing-site's existing tokens (Hanken Grotesk + JetBrains Mono, ink/cream/red palette, page-hero pattern, section--paper/ink section variants).

## Coordination with parallel waves

- T-0008 (sidecoach-keyword.sh) already shipped, so the keyword regex registry in `sidecoach-verbs.json` was the source of truth for verb listing.
- T-0011 (modes naming pass) landed in parallel during this work. Detected mid-session when SKILL.md got a Modes section; added Section 0 Modes to CHEATSHEET.md + the HTML page so the cheatsheet stays comprehensive.
- T-0012 (model-tier routing) was running on the same wave but stayed out of the cheatsheet scope.
- Per coordination note: SKILL.md only got a single-line "See CHEATSHEET.md" link near the top (line 8), no rewriting of other sections.

## Files touched

Created:
- `claude/skills/sidecoach/CHEATSHEET.md` (new, ~180 lines)
- `marketing-site/cheatsheet.html` (new, ~570 lines)

Modified:
- `claude/skills/sidecoach/SKILL.md` (one line added near top linking CHEATSHEET.md)
- `marketing-site/styles.css` (~120 lines of `.cheatsheet__group` + `.cheatsheet__table` styles plus a `@media (max-width: 880px)` collapse pattern - extending the design system rather than inlining)
- `marketing-site/index.html` (added cheatsheet link to primary nav)
- `marketing-site/sidecoach.html` (added cheatsheet link to primary nav)
- `marketing-site/beats.html` (added cheatsheet link to primary nav)
- `marketing-site/endow.html` (added cheatsheet link to primary nav)
- `marketing-site/reference.html` (added cheatsheet link to primary nav)
- `TASKS.md` (T-0010 marked done, moved to ## sidecoach / ### Done)

## Visual verification

Opened the page via cmux surface:41 at http://localhost:8765/cheatsheet.html. Took 6 screenshots:
- Top nav with cheatsheet link active
- Hero "Every verb. Every flow. One page." rendering with display serif + red underline
- Section 1 "Verbs - the 22 slash commands" title and lede
- Verb table rendering in mobile-collapse layout (verb in mono, description in body, invocation in mono, flow IDs in red mono) - viewport was narrow enough to trigger the 880px breakpoint
- Section 2 flow table on default surface with hairline row separators
- Section 3 ink section "How a verb routes to a flow" rendering with cream-on-ink and display serif
- Footer with Yes& brand mark and secondary nav

All renders consistent with the marketing-site's existing visual language.

## Why the 38-not-36 footnote

The task spec said "36 flows" but `sidecoach/src/flows.ts` actually has 38 (24 lettered Tier 1-6 + 14 legacy flows). Documented all 38 honestly - the cheatsheet is the source-of-truth surface, and rounding down would create drift between docs and code.

## Why styles live in styles.css, not inline

The marketing-site pattern leans on the existing token system. Adding ~120 lines of cheatsheet-specific table styles to styles.css extends the design system rather than scattering inline `style="..."` attributes through 570 lines of HTML. Future cheatsheet-like reference pages can reuse `.cheatsheet__group` + `.cheatsheet__table` directly.

## What's next

T-0011 (modes naming) shipped in parallel and is already captured in the cheatsheet. T-0012 (model-tier routing) also done. T-0013 (vitest benchmark harness) and T-0014 (terminal CLI binary) remain open.
