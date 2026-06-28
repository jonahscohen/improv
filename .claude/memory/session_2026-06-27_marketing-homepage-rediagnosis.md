---
name: Marketing homepage re-diagnosis (localhost:4830, 2026-06-27)
description: Third "feels off" pass on the Improv marketing homepage - page byte-unchanged since Jun 22, all prior findings hold; audit grade F (20 contrast findings), critique no longer degraded when run from marketing-site/
type: project
relates_to: [session_2026-06-26_marketing-homepage-diagnosis.md, session_2026-06-26_marketing-homepage-critique.md]
supersedes: session_2026-06-26_marketing-homepage-diagnosis.md
---

Jonah asked the SAME "something feels off, what's actually wrong" question about localhost:4830
(marketing-site) a third time. Ran `/sidecoach audit` + `/sidecoach critique` first (diagnose-IS-an-audit
rule), then re-verified live in Chrome.

**Freshness check first (debugging protocol):** `marketing-site/index.html` mtime is 2026-06-22 06:31,
git log shows last marketing change was 85052a7b (2026-06-22); HEAD commit 95cb51e1 (sidecoach Phase 2)
did NOT touch the marketing index. The page is byte-identical to the Jun 26 diagnosis. So all prior
findings stand unchanged - this is a confirmation pass, not new drift.

**Audit (objective, measured):** blocked, grade F, 20 blocking findings - ALL low-contrast on the
secondary/label text layer (below WCAG AA 4.5:1):
- `dd.stat__caption` (BY THE NUMBERS captions) - 3.02:1, six instances. Faintest text on the page.
- `span.process__num` (loop cards 01-05) - 3.26:1, five instances.
- `span.tool-card__tag` (PLAN+DESIGN / VALIDATE+TUNE / RECORD+RECALL) - 3.26:1, three instances.
- `p.section__eyebrow` (small-caps section labels) - 4.23:1 and 3.86:1.
- `button.install-block__copy` (curl ... | bash, gray-on-cream) - 4.23:1, hero + footer. Flagged
  both as low-contrast AND gray-on-color.
Taste lens: 0 findings (no buzzwords, tiny-type, justified text, or nested-card anti-patterns) - so the
drag is NOT copy slop; it is the contrast layer + message architecture.

**Root cause of "feels off" (the thing the eyeball can't name):** headlines are crisp, confident,
high-contrast serif; the ENTIRE supporting layer (eyebrows, tags, loop numbers, stat captions, install
command) whispers below AA. That bold/quiet mismatch reads as washed-out and draft-like even though no
single element looks broken. Visually re-confirmed in the screenshots: "The scale of it, counted." is
sharp while the "3 / DESIGN FLOWS / sub-caption" beneath it nearly vanishes into the teal.

**Message-architecture findings (judgment layer, all re-confirmed live, unchanged from Jun 26):**
1. Inverted hero hierarchy - 76px H1 is brand name "Improv" + opaque theater eyebrow "BUILD THE SCENE
   WITH"; the real value prop ("A toolkit for Claude Code...") is the 20px subhead. Contradicts
   PRODUCT.md plainspoken voice + "scan in 5 seconds." Confirmed live.
2. Dark theme default = OS prefers-color-scheme. Page loaded dark; dev audience skews dark-mode OS, so
   most first visitors see the generic dark-SaaS version and the signature warm cream (DESIGN.md "the
   default") is a coin flip. Dark-theme ampersand FX renders as a chunky red dithered blob.
3. CTA bookend too literal - hero subhead "...clone the repo, keep what you use" echoed verbatim by the
   closing CTA + identical curl block. Page ends on a repeat, not a build.
4. "By the numbers" is vanity metrics counting internal abstractions (now 6 counters: 26 flows, 30
   validators, 51 hooks, 17 skills, 27 components, 22 verbs) AND pre-apologizes ("measures depth, not
   marketing") - protesting too much, on the faintest-text section.
5. Alignment wobble - WHAT THIS IS / loop intro / numbers intro / closing CTA centered; THE TOOLKIT
   intro left-aligned. Confirmed live (centered "what this is" paragraph then left-aligned toolkit).
6. Loose pacing - large empty teal gaps (esp. below the centered WHAT THIS IS paragraph). Confirmed.
7. Foundation glossary uses the IDENTICAL "See in reference >" link label on every item (one circular:
   the "reference" item links to reference.html). Confirmed live.
8. Clearest product explanation is buried in the FAQ (collapsed, far down) - reinforces inverted
   hierarchy: best communication is hidden.

**Tooling note (new this pass):** prior diagnosis recorded the critique running DEGRADED ("PRODUCT.md
not found - using generic personas"). Root cause: the monitor runs from the repo root (improv/) which
has NO PRODUCT.md, but `marketing-site/` has its own PRODUCT.md (1084b) + DESIGN.md (9748b). Running the
monitor with cwd=marketing-site cleared the "not found" degradation (degraded=false). BUT the persona
extraction still fell back to the generic Alex/Jordan/Sam/Riley/Casey template rather than parsing the
marketing PRODUCT.md's actual "digital creative practitioners (PMs/AMs/designers/engineers)", and the
critique's second flow (flowK_multi_lens_audit) still errors because flowJ_tactical_polish has not run.
So critique grade A / 0 findings is NOT a "page is clean" signal - the LLM-review framework is handed to
claude (checklist 0/19 "handed to claude") and the automated taste detector simply found nothing. The
solid objective signal remains the audit's contrast findings. Two real sidecoach bugs to file: (a)
critique should resolve PRODUCT.md from the rendered target's project dir, not just cwd, and parse its
personas instead of falling to template; (b) the flowK-needs-flowJ gating makes critique's audit flow
always error when run standalone.

**Single highest-leverage fix:** lift the secondary-text layer above 4.5:1 (eyebrows, tags, loop nums,
stat captions, install text). That one token-level change clears all 20 blocking findings and removes
the washed-out feeling. The message-architecture items (hero hierarchy, CTA echo, vanity numbers) are
the second tier.

Files touched: none (diagnosis only). Collaborator: Jonah.
