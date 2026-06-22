---
name: Sidecoach reference-routing map (how flows reach references)
description: Which sidecoach flows consume which reference sources, and which lanes/verbs actually reach them - the wiring + the gaps
type: reference
relates_to: [session_2026-05-25_sidecoach_omc_gap_analysis.md]
---

Mapped 2026-06-22 (Jonah) when asked "how do flows route to reference-based skills, break them all down." This is the engine-truth, not the SKILL.md design-stack diagram.

## Two parallel reference systems (the key mental model)
1. **Standalone Claude skills** (`~/.claude/skills/{component-gallery-reference, fontshare-reference, design-references, motion-reference, icon-source}`) - auto-trigger on their OWN keywords at the Claude level, independent of sidecoach. The sidecoach engine (TS/node) CANNOT invoke them.
2. **Sidecoach's internal accessors** - the engine reads its own embedded/bundled copies. `sidecoach/src/*-reference.ts` accessors over `reference-data.ts` (embedded + some live disk reads) and `sidecoach/bundles/*.json` (snapshots refreshed by `reference-update-service.ts`).

## Accessors -> data source -> consuming flow
- component patterns: `component-gallery-reference.ts` -> `reference-data` embedded componentIndex (+ bundles/component-gallery.json for reflex/update) -> **flowB_component_research** (`getComponentPatterns`).
- fonts: `fontshare-reference.ts` -> embedded candidates + `reference-loader.loadFontReflexReject()` -> **flowC_font_research** (`getFontCandidates`/`getPairingRules`).
- design refs: `design-references-reference.ts` -> `reference-data.loadDesignReferences()` reads the **LIVE** `~/.claude/design-references/*/ref.md` from disk (only `addReference` write is a no-op) -> **flowD_reference_inspiration** (`searchReferences`/`getCategoryReflex`). flow-handlers-new-tiers surfaces the catalog count.
- motion: `motion-reference.ts` -> embedded easings/palette + `reference-loader` prescribed/banned easings + bundles/motion-reference.json -> **flowE_motion_patterns** (`getEasingCurves`/`getMotionPalette`).
- icons: `icon-source-reference.ts` -> `data/icons/lucide.json` + bundles/icon-source.json -> attached as a STATIC artifact (`buildIconSourceArtifactContent`) by **flowG_component_implementation** and **flowO_clone_match** (not an interactive lookup; no flow of its own).

## Reachability - which lane/verb actually triggers each (THE GAP)
Lanes are the current runtime (modes retired). 6 lanes in `lanes.generated.ts`:
- **lane_build** (shape->craft->polish): flowSequence includes flowB + flowE + flowG. So component patterns + motion + icon artifact fire. **Skips flowC (fonts) and flowD (design-refs inspiration).**
- lane_ship / lane_delight / lane_live / lane_calm / lane_converge: **consult ZERO reference flows.** (flowH motion-integration and flowS typography do NOT call the reference getters - only flowE/flowC do.)

Verb registry (`verb-command-registry.ts`):
- `craft` -> flowB+flowE+flowG (references fire).
- `typeset` -> flowS only; lists "fontshare reference" in parityPlus TEXT but never runs flowC, so no font data is injected.
- `animate`/`overdrive` -> flowH/flowT (no motion-reference getter calls).
- No verb routes to flowC or flowD at all.

## Net
- flowC (fontshare) and flowD (live design-references inspiration) are **orphaned from every lane and every verb** - only reachable if the intent detector classifies a request directly to them ("research fonts", "find inspiration for X").
- Only **1 of 6 lanes** (lane_build) pulls any reference data, and it still omits fonts and the personal design-refs catalog.
- The craft guidance TEXT claims "design references vetted for AI-slop" but flowD never runs in lane_build - aspirational, not wired.
- Sidecoach never hits live component.gallery/fontshare.com at flow time; it reads embedded snapshots/bundles. Design-references + DESIGN.md tokens ARE read live from disk.

## Where the leverage is (if making it "more aggressive")
Add flowC + flowD into lane_build's craft step (and lane_delight/lane_live where relevant); wire flowC into the `typeset` verb; consider a preflight that injects design-references matches into any build lane regardless of verb.

Files: sidecoach/src/{flows.ts, flow-composition.ts, lanes.generated.ts, verb-command-registry.ts, reference-systems.ts, reference-data.ts, *-reference.ts, reference-loader.ts, reference-system-preflight.ts}; claude/hooks/sidecoach-lanes.json; sidecoach/bundles/*.json.
