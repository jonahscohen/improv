---
name: Marketing homepage critique (what feels off)
description: Diagnostic read of the marketing-site homepage at localhost:4830 - component craft is high but message-level clarity/rhythm drags it; ranked findings + the corrected mid-animation false alarms
type: project
relates_to: [reference_dev_servers_ports.md]
---

Jonah asked for a diagnosis of why the marketing homepage "feels off." Reviewed
localhost:4830 (marketing-site/index.html) at 1440px desktop in both themes via Chrome MCP.

**Verdict:** Component-level craft is high (typography, color, cards, the radial
loop carousel all clean). The drag is at the MESSAGE level - the page leads with brand
cleverness over plain value, paces loosely, and bookends with literal repetition. It
reads as a beautifully-set mood piece more than a page that lands the pitch fast.

**Ranked findings:**
1. Inverted hero hierarchy. The 76px H1 is the brand name "Improv" + an opaque
   improv-theater eyebrow ("BUILD THE SCENE WITH"). The actual value prop ("A toolkit
   for Claude Code...") is the 20px subhead. Eye lands on a word that means nothing to a
   cold visitor. Directly contradicts PRODUCT.md voice ("plainspoken, specific over
   evocative, NOT a marketing copywriter") and the "scan in 5 seconds" principle.
2. Theme default = OS prefers-color-scheme (index.html:20). Dev audience skews dark-mode
   OS, so most first-time visitors see the dark-teal version, which reads more like
   generic dark SaaS and hides the signature warm-cream brand DESIGN.md calls "the
   default." The strongest, most differentiated version is a coin flip on a setting we
   don't control. Decision to make: force cream, or lead with it.
3. CTA bookend too literal. Hero subhead ends "...clone the repo, keep what you use";
   final CTA headline is "Clone it and keep what you use." + the EXACT same curl block +
   "Read the source". Page ends on an echo, not a build.
4. "By the numbers" = vanity metrics. Counts internal abstractions (26 design flows, 30
   validators, 51 hooks, 22 design verbs) opaque to the PM/AM/designer audience. Intro
   pre-apologizes ("measures depth, not marketing") - a tell it knows it reads as the
   marketing it disclaims.
5. The Loop centerpiece is the busiest, most "theatre" moment (grain-dither plane + 5
   tilted ink cards + rotating radial carousel) - in tension with DESIGN.md's stated "no
   motion theatre, everything structural." Caption/label legibility suffers on the grain
   texture; the prev/next arrows are very faint/low-discoverability.

**Polish nits:** literal "Copyright (c) 2026" instead of (c)-symbol (index.html:383);
footer nav runs together with no separators; foundation glossary is 5 items in a 2-col
grid leaving the bottom-right cell empty.

**Self-correction / process note:** caught TWO mid-animation false alarms and verified
before asserting - (a) the stats showed 20/14 mid count-up (final 26/30 correct, no data
bug); (b) the loop stepper looked "empty/broken" mid-scroll but is a working scroll-driven
radial carousel. Also nearly flagged en/em-dashes from the rendered serif, but grep found
ZERO U+2013/U+2014 in source (plain spaced hyphens, house-style compliant) - dropped it.
Lesson reinforced: confirm from source/settle state, never assert from a single pixel frame.

**Re-verified 2026-06-26 (second session, fresh render).** Jonah re-asked the same "feels
off" question. Re-ran the full audit via Chrome MCP at desktop in BOTH themes; index.html
unchanged since (mtime Jun 22). All 6 ranked findings + polish nits still hold. Detection
lenses run on source came back clean (no text-align:justify, no sub-13px type, zero
U+2013/U+2014, zero marketing buzzwords) - confirms the drag is message-architecture, NOT
copy slop or objective defects. The stats count-up again showed throttled values (1/2/1...)
in the screenshots; root-caused as requestAnimationFrame throttling in a BACKGROUND
(non-foregrounded) tab during MCP capture, not a data bug - markup hard-codes 26/30/51/17/
27/22 (index.html:272-297) which render with JS-off and reduced-motion. Did NOT flag it.
Refinements added this pass:
- Stat band grew from 4 to 6 counters (added 17 skills, 27 installable components), making
  the vanity-metric section HEAVIER, and the "measures depth, not marketing" pre-apology
  remains.
- Foundation glossary: all 5 items use the IDENTICAL link label "See in reference" (one of
  the 5 items IS "reference", linking to reference.html saying "see in reference" - circular),
  and 5 items in a 2-col grid leaves the bottom-right cell empty (confirmed visually).
- Mission section is a near-full viewport of whitespace for one short centered paragraph
  (loose pacing, confirmed visually).
- The clearest, most concrete product explanation lives in the FAQ (6 sections down,
  collapsed by default) - reinforces inverted hierarchy: best communication is buried.
- Dark-theme hero ampersand FX renders as a chunky abstract red voxel blob; the light-theme
  halftone reads more clearly as an "&". Another point for owning one theme as the hero.

Collaborator: Jonah.
</content>
