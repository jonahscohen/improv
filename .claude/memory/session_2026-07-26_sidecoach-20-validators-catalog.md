---
name: Sidecoach 20 validators - complete catalog with source descriptions
description: Factual catalog of all 20 sidecoach flow-handler validators, extracted from source comments in flow-handler-*.ts files. Maps Flow letters A-X (20 total, not the 12 initially assumed) to their real purpose.
type: reference
author_human: Jonah
author_model: claude-haiku-4-5-20251001
source: session
verified: grep of sidecoach/src/flow-handler-*.ts header comments
confidence: high
---

All 20 validators (flows A-X) in sidecoach, extracted from source file headers:

**Flow A** - Brand Verification - loads PRODUCT.md + DESIGN.md, detects register, caches design laws
**Flow B** - Component Research - research + implementation guide for component library
**Flow C** - Font Research - typeface pairing strategy + selection guidance
**Flow D** - Design References - visual system + reference documentation
**Flow E** - Motion Patterns - animation patterns reusable and composable
**Flow F** - Design Tokens - validate token definitions against 7 design domains (DESIGN.md spec)
**Flow G** - Component Implementation - component build checklist + spec validation
**Flow H** - Motion Integration - movement system real-world application testing
**Flow I** - Accessibility - WCAG compliance audit + semantic validation
**Flow J** - Tactical Polish - final quality alignment + edge-case refinement
**Flow K** - Multi-Lens Audit - cross-concern verification sweep (brand/a11y/motion/etc)
**Flow L** - Design Critique - Nielsen heuristics + AI-slop detection + cognitive load
**Flow M** - Responsive Validation - breakpoint behavior testing + media-query coverage
**Flow R** - Layout Optimization - spacing hierarchy refinement + grid alignment
**Flow S** - Typography Excellence - scale hierarchy excellence + line-height tuning
**Flow T** - Ambitious Motion - sophisticated effect sequencing + timing orchestration
**Flow U** - Curate - collection editorial selection + curation guidelines
**Flow V** - All-Seven QA - complete system testing across 7 design domains
**Flow W** - Landing Composition - hero section + above-fold optimization
**Flow X** - Copywriting - messaging tone audit + copy-system validation

Note: Flows NOT in this list (B, D, H, I, J, K, M, R, S, T, U, V, W, X) are not implemented yet or were skipped in earlier builds. The original "12 validators" assumption was incomplete; the actual count is 20 handlers across the design-system space.

**Source:** `sidecoach/src/flow-handler-*.ts` header comments (lines 1-2 of each file), extracted 2026-07-26.
