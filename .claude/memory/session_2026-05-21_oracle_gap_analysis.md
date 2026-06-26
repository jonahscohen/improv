---
name: oracle-v2.1.9-gap-analysis
description: Comparison of Sidecoach implementation vs latest oracle v2.1.9 commands
metadata:
  type: project
  relates_to:
    - session_2026-05-21_phase6_intelligent_flow_chaining.md
---

# Oracle v2.1.9 Gap Analysis

## Current Status

**Oracle version:** 2.1.9  
**Total commands:** 24 (23 user-invocable + meta-command)  
**Sidecoach coverage:** 21/23 commands explicitly mapped

## Command Audit

### ✓ Fully Mapped to Flows
(21 commands covered by flows A-Q + flows 1-14)

- teach → flowA_brand_verify
- craft → craft flow  
- shape → shape logic in handlers
- animate → flowH_motion_integration  
- colorize → colorize guidance
- delight → delight guidance
- bolder → bolder guidance
- quieter/distill → distill guidance
- harden → harden guidance
- optimize → optimize guidance
- adapt → flowM_responsive_validation
- clarify → clarify guidance in handlers
- extract → flowE11_extract_tokens
- document → document in DESIGN.md flow
- audit → flowK_multi_lens_audit
- critique → flowL_design_critique
- live → live iteration guidance
- polish → flowJ_tactical_polish
- onboard → onboard flows
- layout guidance → embedded in flow handlers
- typeset guidance → embedded in component flows

### ✗ Missing Explicit Flows (3 commands)

**1. layout** (NEW in recent oracle)
- Description: "Fix layout, spacing, and visual rhythm"
- Coverage gap: Scattered across Flow J (tactical polish) and handler guidance
- Recommendation: Create dedicated flow for layout/spacing refinement (optimize grid, spacing ratios, visual rhythm)

**2. overdrive** (NEW in recent oracle)
- Description: "Push interfaces past conventional limits - shaders, spring physics, scroll-driven reveals, 60fps"
- Coverage gap: Partially covered by flowH_motion_integration, but not the "ambitious push"
- Recommendation: Extend motion flow or create new flow for advanced animations (physics engines, shaders, cinematic transitions)

**3. typeset** (NEW in recent oracle)
- Description: "Improves typography - font choices, hierarchy, sizing, weight, readability"
- Coverage gap: Covered by component research + DESIGN.md, but no dedicated typography flow
- Recommendation: Create flow for typography-specific optimization (font pairing, hierarchy, readability scoring)

## Sidecoach Completeness

**Core coverage:** 91% (21/23)  
**Missing:** 3 specialized commands added recently to oracle  
**Impact:** Minor - these are refinement commands, not core pipeline phases

## Recommendation

Add 3 new flows to reach 100% coverage:
1. **flowR_layout_optimization** (Layout refinement - spacing, grid, visual hierarchy)
2. **flowS_typography_excellence** (Typography optimization - fonts, hierarchy, readability)
3. **flowT_ambitious_motion** (Advanced animations - physics, shaders, cinematic)

These would extend the 10-flow core architecture (A-J) to a 13-flow complete system covering all 23 oracle commands.
