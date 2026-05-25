---
name: session-2026-05-25-library-wiring
description: Wiring sidecoach/reference/_extracted/ content into flow handlers. The absorbed library was a string template until now; this session makes it a runtime input.
type: project
relates_to: [session_2026-05-25_word_scrub.md, session_2026-05-25_capability_gap_analysis.md]
---

Human collaborator: Jonah.

## Directive

User said: "wire the library into the flow handlers". The forensic agent found 7 of 34 absorbed rules wired, 27 of 34 documented-only or missing. The smoking gun: SKILL_REF in verb-command-registry.ts is a path string the orchestrator stringifies into help text, never readFileSync's. This session changes that.

## Plan (7 tasks #121-#127)

- W1 reference-loader utility (this is the keystone - cache + path resolution + soft-fail on missing files)
- W2 flowD wired with saturated-aesthetic lanes + font reflex-reject list
- W3 linguistic-ban validator (slop words + rhetorical templates) into flowJ
- W4 prescribe Emil's named easings, reject weak curves
- W5 fix Title Case contradiction in extended-domain-validator
- W6 wire responsive-foundation.md into flowM + add flowM to craft chain
- W7 re-dogfood on marketing-site, verify catches yesterday's bugs

## What the absorbed content includes (for reference)

- `sidecoach/reference/_extracted/legacy-design-skill/reference/`: 35 files including brand.md, product.md, color-and-contrast.md, typography.md, motion-design.md, interaction-design.md, responsive-design.md, ux-writing.md, plus 22 verb command references
- `sidecoach/reference/_extracted/make-interfaces-feel-better/`: SKILL.md (16 principles) + typography.md + surfaces.md + animations.md + performance.md
- `sidecoach/reference/_extracted/external/emil-design-eng/`: frequency-first matrix + 3 named easings + FM x/y gotcha
- `sidecoach/reference/_extracted/external/typeui-fundamentals/`: 7 modular ratios + heading-size-by-role + line-height-by-tier + font-pairing
- `sidecoach/reference/_extracted/external/taste-skill/`: linguistic ban list + slop archetypes + Strategic Omissions + parametric dials
- `sidecoach/reference/_extracted/external/bencium-design/`: 5-tier breakpoint table + interaction-type duration + POUR
- `sidecoach/reference/_extracted/external/refactoring-ui/`: HSL saturation falloff + Two-Part Shadow + anti-ratio scales
- `sidecoach/reference/responsive-foundation.md`: canonical responsive reference (~22KB)

## W1 landed

`sidecoach/src/reference-loader.ts` shipped. ~370 lines. Exports:
- `loadCanonical(name)` - reads sidecoach/reference/<name>.md
- `loadExtracted(source, relativePath)` - reads from _extracted/<source>/<path>.md
- `loadSlopWordList()` - returns ~30 word/phrase ban list (Elevate, Seamless, Delve, Tapestry, Acme, etc.) with optional extension from taste-skill source
- `loadRhetoricalPatterns()` - 8 named regex patterns (triplet-negation, negation-as-positioning, imperative-pair, world-of-opener, realm-of-opener, tapestry-prose, goes-without-saying, delve-into)
- `loadPrescribedEasings()` - Emil's 3 named strong easings with use cases
- `loadBannedEasings()` - weak/bounce/elastic curves with reason
- `loadFontReflexReject()` - 16 typefaces to refuse on greenfield (Inter, Fraunces, Outfit, etc.)
- `loadAbsoluteBans()` - the 6 predecessor absolute bans with detection hints + rewrite options
- `loadSaturatedAestheticLanes()` - 7 lanes (Editorial-typographic, Brutalist-utility, Acid-maximalism, plus 4 emerging) with tells
- `loadLineHeightTiers()` - TypeUI line-height-by-size table
- `loadBreakpointTable()` - Bencium 5-tier breakpoints

Per-process caching, soft-fail on missing files, additive-not-load-bearing semantics. Compiled clean. Probe verified all 10 loader functions work + slop/rhetorical detection fires correctly on test copy.

## W2 progress

design-laws.ts CATEGORY_REFLEX now imports `loadSaturatedAestheticLanes` from reference-loader and uses it as `oversaturated_families`. The 7 hand-curated lanes (SaaS cream, FinTech trustworthy, etc.) are replaced with the absorbed 7 lanes that match the predecessor's brand.md (Editorial-typographic, Brutalist-utility, Acid-maximalism, plus 4 emerging: Spotify-card-stack, Linear-clean, Notion-clone-minimalism, Vercel-marketing). The forensic agent's third damning finding is now closed.

About to wire flow-handler-design-references to surface the font reflex-reject list + add the rhetorical pattern check.

## W3-W6 landed

- W3 linguistic-ban-validator.ts shipped. scanForLinguisticBans() runs slop scan + rhetorical pattern scan. findingsToGuidance() formats for flow output. Wired into flow-handler-tactical-polish.ts: scans every HTML/MD in projectPath, surfaces P0/P1 findings in guidance + checklist + memory + result.message. Probe on marketing-site caught all 3 yesterday-templates (imperative-pair on improv.html, triplet-negation on index.html, negation-as-positioning on memory.html).
- W5 Title Case contradiction fixed in extended-domain-validator.ts:WRITE_011. Was "Headings: Title Case, Body: Sentence case" - now mandates sentence case everywhere as the absorbed taste-skill content requires.
- W6 flow-handler-responsive-validation.ts rewritten: loads canonical responsive-foundation.md + Bencium 5-tier breakpoint table from reference-loader. 44x44 hit area floor (overrides 40x40). Named anti-patterns including iOS 100vh svh/dvh/lvh fix. Pattern transitions per breakpoint (hamburger -> bottom-tab -> sidebar -> full nav). Mandatory verification steps. Degrade-plan template.
- W6 verb-command-registry.ts craft chain: flowM_responsive_validation inserted between flowI and flowJ. parityChecklist gains "responsive verified". guidanceAppend gains the verification confirmation line.

## Smoking-gun fix: duplicate handler implementations

Discovered during W7 dogfood that flowM + flowJ messages still showed the OLD stub text. Investigation: orchestrator imports from `flow-handlers-tier3-tier4.ts` (the old parallel handler module), not from `flow-handler-tactical-polish.ts` / `flow-handler-responsive-validation.ts` (the dedicated files I wired). Repointed the orchestrator imports.

## W7 post-fix dogfood

Output grew 1146 -> 1382 lines (+236). 9/9 flows successful. Critical changes:

- flowM message: "Responsive Validation: Bencium 5-tier breakpoints + 44x44 hit area + 39k chars canonical reference loaded" - the full 39KB canonical responsive-foundation.md now flows into context per chain run
- flowJ message: "Tactical Polish: 112-rule matrix 35/159 pass. Linguistic ban: 3 P0 + 0 P1 findings across 3 files."
- Three linguistic-ban findings ALL caught: imperative-pair on improv.html, triplet-negation on index.html, negation-as-positioning on memory.html, with full context + why + fix prescription per finding

The forensic agent's "7 of 34 wired" baseline is now closer to 17 of 34 wired. The library is a runtime input, not a string template.

## W4 landed

flow-handler-motion-patterns.ts imports loadPrescribedEasings + loadBannedEasings from reference-loader. Validation logic rewrote: strict prescribed-or-banned check replaces the pre-wiring loose `/cubic-bezier/.test()` permissiveness. Guidance now includes:
- PRESCRIBED NAMED EASINGS (Emil's --ease-out / --ease-in-out / --ease-drawer with exact cubic-bezier values)
- BANNED EASINGS (bounce, elastic, ease-in, ease-out-back, with reasons)
- FREQUENCY-FIRST DECISION (Emil's matrix: 100+/day = no animation, ever)

This addresses three of the forensic gaps in one pass: the loose easing acceptance, the missing prescribed curves, and the absent frequency-first decision tree.