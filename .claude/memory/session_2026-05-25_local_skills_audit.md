---
name: Local skills audit for sidecoach integration
description: Audit of 8 installed skills to extract integration patterns for sidecoach flow handlers; output directories created at sidecoach/reference/_extracted/local-skills/
type: project
relates_to: [sidecoach_consolidation_gameplan.md]
---

Auditing 8 skills for sidecoach to query automatically:
1. component-gallery-reference (60 components, 95 design systems, 2672 examples)
2. design-references (personal catalog at ~/.claude/design-references/, currently 1 entry: unlumen-kbd-keycap)
3. fontshare-reference (typeface curation, anti-reflex list)
4. motion-reference (GSAP + Lenis canonical glue patterns)
5. icon-source (8-library pool, verbatim path sourcing)
6. design-build (orchestrator overlap with sidecoach)
7. design-team (multi-agent parallel sprints)
8. visual-effects (5 Tier-1 shaders + 9 Tier-2 + 5 FX categories)

Output directories created at `sidecoach/reference/_extracted/local-skills/<skill>/`.

Currently in flight: writing INTEGRATION.md files for each skill + summary memory with integration table.

Key finding: design-references catalog is SHALLOW - only 1 entry (unlumen-kbd-keycap). The infrastructure exists (vocab, schema, /curate skill) but the catalog itself is essentially empty. Sidecoach can integrate the lookup pattern but must surface this as a gap to fill.

Progress (in flight):
- 8 subdirs created at sidecoach/reference/_extracted/local-skills/
- component-gallery/INTEGRATION.md WRITTEN (60-component slug taxonomy, mobile-nav callout, trigger-word mapping, flow integration table)
- design-references/CATALOG.md WRITTEN (full enumeration: 1 entry total, vocab listed, gap surfaced honestly)
- fontshare/INTEGRATION.md WRITTEN (25-name reject list, voice-word→filter heuristics, fallback catalogs)

Second batch DONE:
- motion-reference/INTEGRATION.md WRITTEN (9 canonical patterns inc. Lenis+GSAP glue, gotchas, reduced-motion)
- icon-source/INTEGRATION.md WRITTEN (8-library pool, selection protocol, mixing detector)
- design-build/INTEGRATION.md WRITTEN (10-phase orchestration, overlap analysis with sidecoach)

COMPLETE - all 8 integration documents written:
- component-gallery/INTEGRATION.md - 60-component slug taxonomy, mobile-nav callout, trigger word mappings
- design-references/CATALOG.md - 1-entry catalog enumerated, vocab listed, sparseness surfaced
- fontshare/INTEGRATION.md - 25-name reject list, voice-word filters, fallback catalogs
- motion-reference/INTEGRATION.md - 9 canonical patterns inc. Lenis+GSAP glue, gotchas, reduced-motion
- icon-source/INTEGRATION.md - 8-library pool, selection protocol, mixing detector
- design-build/INTEGRATION.md - 10-phase orchestration spec, overlap analysis with sidecoach
- design-team/INTEGRATION.md - multi-agent sprint pattern, 16 roles, dispatch template
- visual-effects/INTEGRATION.md - 5 Tier-1 shaders + 9 Tier-2 + 6 FX categories + 17 post-process

## INTEGRATION TABLE - sidecoach flow → skill → trigger

| Sidecoach flow / verb | Skill to query | Trigger / when |
|---|---|---|
| `craft <large-feature>` (>3 sections) | design-team | Multi-section build, landing page, campaign, multi-page site |
| `craft <component>` | design-build phase ordering | Always (lift the 10-phase sequence) |
| Flow A (brand-verify) | fontshare-reference | When type not locked; cross-match brand-voice words |
| Flow A (brand-verify) | design-references | After PRODUCT.md feel words extracted |
| Flow B (component-research) | component-gallery-reference | ALWAYS on entry; map task to one of 60 slugs |
| Flow B (component-research) | design-references | Alongside gallery, layer in personal-catalog patterns |
| Flow C (font-research) | fontshare-reference | ALWAYS on entry; enforce 25-name reject list |
| Flow D (design-references) | design-references | ALWAYS on entry; grep at score >= 3 |
| Flow E (motion-patterns) | motion-reference | ALWAYS on entry; routing-table → canonical pattern |
| Flow E (motion-patterns) | visual-effects | Generative motion (particle field, fluid drag) |
| Flow F (design-tokens) | fontshare-reference | Tokenize typography (weights, OT features, family slug) |
| Flow F (design-tokens) | icon-source | Tokenize icon library name + sizing |
| Flow F (design-tokens) | visual-effects | Tokenize background-surface effect choice |
| Flow G (component-implementation) | component-gallery-reference | Before writing code; extract states + ARIA + keyboard |
| Flow G (component-implementation) | icon-source | When component spec has icons; verbatim path enforcement |
| Flow G (component-implementation) | motion-reference | When component has motion; lift canonical snippet |
| Flow H (motion-integration) | motion-reference | When wiring motion into component; Lenis+GSAP glue |
| Flow I (accessibility) | component-gallery-reference | During WCAG audit; Accessibility-tagged examples |
| Flow N (audit/critique/polish triad) | component-gallery-reference | Cross-check missing states, name consensus |
| Flow N (audit) | motion-reference | data-lenis-prevent wheel-test, ScrollTrigger.refresh, anti-patterns |
| Flow N (audit) | icon-source | Cross-library mixing detection, fabricated-icon detection |
| Flow N (audit) | fontshare-reference | Flag fonts on reject list, suggest alternatives |
| Flow N (audit) | visual-effects | Compositing-order rules, GPU cost vs mobile |
| Flow tactical-polish | design-references | Match against `inline-affordance`, `detail-reveal`, etc. |
| Flow tactical-polish | motion-reference | Reduced-motion handling, exponential easing |
| New `/sidecoach effect <use-case>` | visual-effects | Direct invocation for generative texture decisions |
| Sidecoach craft entry router | design-build | Lift the 10-phase ordering + 2 gate checkpoints |

## KEY FINDINGS

1. **design-references is essentially empty.** Only 1 reference in the catalog (unlumen-kbd-keycap). Sidecoach can implement the lookup pattern but should nudge the user to curate more when a build pattern is novel.

2. **visual-effects is the most data-rich skill** - ships actual shader source code for 5 Tier-1 effects. Sidecoach can lift the most directly from here.

3. **component-gallery and fontshare are workflow skills** - no embedded data files. Sidecoach must do live web fetches or maintain a cache.

4. **fontshare-reference has the highest-leverage reusable data**: 25-name reject list. Worth extracting to `fontshare-reject-list.json` for programmatic enforcement.

5. **motion-reference's canonical glue snippets are load-bearing** - the 3-line Lenis+GSAP integration is the #1 thing sidecoach must lift verbatim.

6. **design-build and sidecoach overlap structurally.** design-build's 10-phase sequence + 2 gate checkpoints = the spec sidecoach's craft verb should follow.

7. **design-team enables parallel multi-agent sprints** - sidecoach has no equivalent. Should detect landing-page/multi-page scope and offer this dispatch.

8. **icon-source has zero programmatic enforcement** - sidecoach should implement the verbatim-path verifier and cross-library-mixing detector.

Files touched:
- /Users/spare3/Documents/Github/claude-dotfiles/sidecoach/reference/_extracted/local-skills/component-gallery/INTEGRATION.md
- /Users/spare3/Documents/Github/claude-dotfiles/sidecoach/reference/_extracted/local-skills/design-references/CATALOG.md
- /Users/spare3/Documents/Github/claude-dotfiles/sidecoach/reference/_extracted/local-skills/fontshare/INTEGRATION.md
- /Users/spare3/Documents/Github/claude-dotfiles/sidecoach/reference/_extracted/local-skills/motion-reference/INTEGRATION.md
- /Users/spare3/Documents/Github/claude-dotfiles/sidecoach/reference/_extracted/local-skills/icon-source/INTEGRATION.md
- /Users/spare3/Documents/Github/claude-dotfiles/sidecoach/reference/_extracted/local-skills/design-build/INTEGRATION.md
- /Users/spare3/Documents/Github/claude-dotfiles/sidecoach/reference/_extracted/local-skills/design-team/INTEGRATION.md
- /Users/spare3/Documents/Github/claude-dotfiles/sidecoach/reference/_extracted/local-skills/visual-effects/INTEGRATION.md
- /Users/spare3/Documents/Github/claude-dotfiles/.claude/memory/session_2026-05-25_local_skills_audit.md (this file)
