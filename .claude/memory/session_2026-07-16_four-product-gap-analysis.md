---
name: Four-product gap analysis - taste-skill, visual-explainer, slop.md, hallmark
description: Jonah asked for a gap analysis of our offerings vs 4 external products; the convergent finding is we have no generative aesthetic layer (all our assets are negatives), plus a visualizer authorship gap, plus 4 VERIFIED honesty defects in our own repo surfaced by the comparison
type: project
relates_to: [session_2026-07-03_external-skills-recon-round2.md, feedback_sidecoach_mission_beat_oracle.md]
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: grep/read verification of every load-bearing claim
confidence: high
---

Collaborator: Jonah. 2026-07-16.

Analyzed: Leonxlnx/taste-skill, nicobailon/visual-explainer, pols.dev/slop.md, nutlope/hallmark.
Method: 4 parallel agents (deep external read + repo grep), then I independently verified every
claim that accused our own repo of a defect. Do not trust the agent claims I did not re-verify.

## The convergent finding (all four products land on the same gap)

We have NO GENERATIVE AESTHETIC LAYER. Every aesthetic asset we own is a NEGATIVE:
16 reflex-reject fonts, 7 saturated lanes, 6 absolute bans, 27 anti-laws. We know what not to
build and have no vocabulary for what to build instead. All four externals are, in different
ways, positive/generative vocabularies with weaker verifiers.

Evidence we cannot propose: flow-handler-design-tokens.ts falls back to the literal string
'(undefined in DESIGN.md)'. Zero hits repo-wide for generatePalette/buildPalette/colorScale/
colorHarmony. OKLCH appears 3x in src/, all parsing. We can read a color; we cannot choose one.
design-laws.ts:363 REGISTER_SPECIFIC_LAWS is a BINARY brand/product register with qualitative
strings; taste-skill has continuous 1-10 dials (VARIANCE/MOTION/DENSITY) inferred from a brief.

## Gaps, ranked

1. GENERATIVE AESTHETIC. Steal hallmark's custom-theme.md palette-CONSTRUCTION protocol
   (anchor accent -> derive paper L from vibe -> tint neutrals -> compute contrast -> declare
   3 axes). Recipe, not pantry: 16 of hallmark's 20 themes ship NO palette in the installable
   artifact (tokens.css lives in site/, excluded by package.json files:["skills"]), and 16 of 20
   use a font on OUR ban list. Their default genre (editorial) is the exact lane
   fontshare-reference:76 tells us to defend against.
2. VISUALIZER AUTHORSHIP. We have complete GOVERNANCE and zero AUTHORSHIP: visualizer-guard.sh
   (21 regression cases) + token contract + surface-visual-gate.sh that BLOCKS an 8-row table
   and demands a chart we have no skill to build. A referee with no players. Sub-finding: our
   surface rule conflates "in-chat rendering unavailable" with "visuals impossible" - the
   file+browser channel visual-explainer uses works on EVERY surface, including cmux/terminal
   where most of our work happens. That is a wrong assumption encoded in a hook and a mandate.
3. ANTI-SAMENESS ROTATION. hallmark reads .hallmark/log.json + a CSS stamp and is required to
   pick differently on 3 axes next time. Our session memory is WRITE-ONLY (session-memory-writer
   .ts: 2 writes, its lone read only appends a MEMORY.md index line). We own the better substrate
   (beats) and lack the mechanism. slop.md/taste-skill's palette-rotation rules are
   unimplementable in a stateless SKILL.md - we could actually do it.
4. TASTE FRONTIER. slop.md is ~100 tells (~55 mechanically detectable); we detect ~4. It maps
   almost exactly onto our WORST measured metric (subjective lens R=0.188/P=0.397) and overlaps
   the 2 classes where oracle still beats us (ai-color-palette, dark-glow) - a live violation of
   the beat-oracle mission. Cheapest real detector available: font-family read against the
   ALREADY-WRITTEN reflex-reject list.
5. Smaller: fact-check (doc-claims vs code), plan-review vs CODEBASE (our plan-consistency-lint
   is intra-document only), output-skill's banned-truncation-pattern list, redesign protocol's
   "what never changes silently" (URLs/nav labels/form field names/analytics events).

## VERIFIED honesty defects in our own repo (I re-checked each one myself)

1. FALSE PASS: loadAbsoluteBans() (reference-loader.ts:317) ships 6 bans; the scan loop
   (absolute-ban-detector.ts:230-236) calls only 5 scanners (scanIdenticalCardGrids deleted
   Stage-2 for ReDoS). So absoluteBanToValidationResult() puts ban-identical-card-grids in
   passedRules FOREVER, and the summary string (:245) literally asserts all 6 bans including
   "identical card grids" ARE CLEAN. We silently certify the exact rule both slop.md and
   taste-skill name. This violates our own fail-closed principle (audit-rendered.ts:130 returns
   inconclusive, never clean).
2. DEAD CODE: loadFontReflexReject() (reference-loader.ts:257) = 16 curated fonts, ZERO
   consumers. No scanner anywhere reads font-family. This is simultaneously our cheapest
   available detector and unwired.
3. README THEATER: sidecoach/README.md:48-49 claims a SidecoachDetectBridge running a "28-rule
   static analyzer via npx sidecoach detect during FlowK". Zero hits for DetectBridge/sidecoach
   detect anywhere. The command does not exist. (Related: README says 28, domain-flow-matrix.md
   :24 says 69, the registry has 59. Our own rule counts are unreliable.)
4. CONTRADICTION: lotus/src/ui/agent/design-knowledge/anti-slop.ts:17 instructs the model to use
   Inter - slop.md's #1 font tell and #1 on our OWN reflex-reject list. Our two anti-slop assets
   contradict each other today.

Also: our taste-skill extract (sidecoach/reference/_extracted/external/taste-skill/SKILL.md,
captured 2026-05-25) is v1; upstream shipped a v2 that roughly tripled the rule corpus. The
absorption beat's claim that "every external taste skill repo can be discarded" has EXPIRED.
And design-references is n=2 after 8 months (verified: find ~/.claude/design-references -name
ref.md | wc -l -> 2), both with empty screenshot fields, 13 of 15 vocab categories empty. Its
retrieval machinery (+3/+1 scoring, silence threshold) is scaffolding for a corpus that does
not exist; it takes its silence branch ~always.

## Where we are decisively ahead (do not adopt their versions)

Real rendered engine (Playwright, 1280x800 pinned, computed styles) vs 4 products that cannot
observe their own output. Fail-closed honesty. An eval corpus with held-out sets, oracle
comparison, author!=labeler discipline. Objective engine R0.936/P0.917 vs oracle R0.064/P0.545.
buzzword v3 F1 0.857 vs oracle 0.727. Write-time hook enforcement. Cross-model Codex gate
(their diff-review is single-model self-review rendered attractively, arguably worse than plain
self-review). A theater-purge CULTURE: we deleted a 196-rule validator when it did not measure;
taste-skill's answer to "agents skim our rules" was to add ~60 more.

Their 100 tells are 100 HYPOTHESES, not 100 rules.

## The meta-finding (matters more than any single gap)

This is the FOURTH borrow list. session_2026-07-03 already established the pattern: we evaluate
externals rigorously, produce ranked borrow lists, and never drain them. Worse -
sidecoach/reference/_extracted/external/taste-skill/named-vibe-variants.md section 3 ALREADY
captured ~14 of these exact gaps on 2026-05-25 and was never wired to anything (reference-loader
.ts:115 loads only that dir's SKILL.md, and only to harvest a slop word list). The risk here is
not missing the gap. It is capturing it a THIRD time and shelving it again.

Recommendation given: fix the 4 verified defects first (they are honesty bugs in shipped code,
not enhancements), then ONE generative move (palette-construction protocol), then the font
detector. Do not absorb 100 tells as 100 rules - that fails the mission's "more capable AND
simpler" constraint.

Files touched: this beat + MEMORY.md. No code changed - analysis only.
