---
name: Homepage narrative copy drafted (the closed loop)
description: Section-by-section below-hero copy for marketing-site - LOOP/toolkit/stats/support/FAQ/CTA in PRODUCT.md voice
type: project
relates_to: [session_2026-05-29_new-website-queued.md]
---

Collaborator: Jonah

Drafted the full below-hero homepage narrative for marketing-site/index.html as copy-strategist on team homepage-narrative (task #2). Delivered to team-lead via SendMessage; not yet applied to index.html (that is a separate build task).

What was written:
- THE LOOP (new centerpiece, inserted right after hero): 5-step closed loop - Plan (sidecoach) / Design (sidecoach + design peers) / Build (Claude Code + skills layer) / Validate (justify + verification hooks) / Remember (beats). Each step: title, 2-3 sentence description naming the real tool(s), one-line "who cares" hook for a PM/stakeholder. Closed-loop framing: Remember feeds the next Plan.
- THE TOOLKIT: revised the 3 existing cards (justify/sidecoach/beats) to map each to its loop role, equal billing kept.
- STAT BAND: 6 robustness-signal stats with {PLACEHOLDER} counts (flows, validators, hooks, skills, components, and a literal 0 for accounts/telemetry).
- SUPPORT LAYER: reframed "In the wings" as "the foundation" - Skills / Hooks / Plugins / Reference library / tilt-lab.
- FAQ: 8 Q&A (what is this, terminal required, replaces designer, cost/phone-home, adopt one tool, what is Claude Code, team memory sharing, safe to change the site).
- CLOSING CTA: short, reuses the curl install framing.

Key decisions:
- Arc: kept LOOP before TOOLKIT (brief's order). Why: the loop is the sell/story; toolkit is the 5-second scan that follows. Noted the mild tension with PRODUCT.md's "scan in 5 seconds" principle - the scan still lands high because hero + loop are short.
- Used {N_FLOWS}/{N_VALIDATORS} placeholders even inside the sidecoach toolkit card (not just the stat band). Why: the live card hard-codes "Eight flows, 159 validators" but beats show 26 flows (T-0015) and 185+ rules post-Tier1/2 - both stale. Let the stat audit fill them rather than ship a stale number. Flagged to lead.
- Voice: matched existing page's spaced-hyphen style (" - "), no emdashes, no emojis, no SaaS patterns, no "we use AI to X", no demo CTA. Did not duplicate the existing Posture/"What this is not" section.

Revision 1 (2026-06-10, Jonah-approved arc + 2 changes):
- Added MISSION OPENER as the new first section below the hero (eyebrow + title "Built with Claude, not handed to it." + lede + 2 paragraphs). States the goal up front: Yes& is a dev shop that augments its work with Claude (not replace), tools built BY the shop WITH Claude and dogfooded on real client work, togetherness is the point. One light ampersand nod ("it is right there in the name: an ampersand"). First sentence lands for stakeholders, last sentence (ownership + dogfooding) credible to senior devs.
- TOOLKIT now moves to SECOND (after mission, before the Loop) and is trimmed to a fast orientation: section lede cut to one sentence, three card descriptions trimmed to 1-2 sentences each with CTA jump-offs to sidecoach/beats/justify pages. Loop-role tags kept (plan + design / remember / validate), equal billing kept. The Loop section does the actual selling.
- Everything else from the original draft approved as-is.

Revision 2 / FEEDBACK (2026-06-10, Jonah direct): the mission opener was rewritten to a calmer register on the way to ship - no punchlines, facts only. The page shipped and was verified.

Self-analysis (why my draft needed the calmer pass):
- What went wrong: my mission opener leaned on rhetorical moves - a punchy declarative title ("Built with Claude, not handed to it."), "None of it is a demo reel," and the "It is right there in the name: an ampersand" turn. These read as copywriter flourishes, exactly the register PRODUCT.md warns against ("voice of a developer who shipped real tools, not a marketing copywriter," "specific over evocative," "confidence without bravado").
- Why it happened: I treated the mission opener as the emotional/sell beat of the page and reached for punchlines to make it land, over-indexing on "must grab a stakeholder in the first sentence." That pulled me toward evocative over specific. The brief even hinted at restraint (nod to the ampersand "lightly, or not at all") and I took the more-clever option.
- The rule going forward for Improv copy: facts over punchlines. State what is true plainly and let the specifics carry the weight. No turns of phrase that exist to be quotable. The ampersand/"yes, and" nod is a trap - it invites cleverness; default to NOT using it. A calm, declarative register is the house voice for this brand, including in the highest-stakes opener.

Files touched: this beat + MEMORY.md index. (No index.html edit - copy handed to lead; index.html assembled + shipped by the build owner.)
