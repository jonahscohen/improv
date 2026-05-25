# Sidecoach Sprint 11: Brand Personality Truthy + Craft Chain Expansion - Design Spec

**Date:** 2026-05-25
**Author:** Jonah Cohen (collaborator). Sprint executed autonomously by chief-architect mode.

## Goal

Fix the 2 bugs surfaced by Sprint 10's dogfood:

1. **flowA `Personality: ` display empty even when PRODUCT.md sets brand personality.** Root cause: `productMetadata.brand_personality` is `[]` (empty array from the existing markdown section parser - the `## Brand Personality` header creates a section key with empty body). JS truthy-evaluates `[]` as truthy, so `brand_personality || brandPersonality` returns `[]`, masking the real brandPersonality string.

2. **Registry's craft entry omits flowH (motion) and flowI (accessibility).** Sprint 8 spec said craft chain = [F, G, H, I, J] but the implementer entered only [A, F, G, J]. Per impeccable's `craft.md`, craft covers shape → tokens → components → motion → accessibility → polish (6 phases). Sidecoach is missing motion + a11y from craft.

## Two fixes, two tests

### Fix 1: flowA reads brandPersonality first, skips empty arrays

Two spots in `sidecoach/src/flow-handler-brand-verify.ts`:

- Line 120 (display): `productMetadata.brand_personality || productMetadata.brandPersonality || 'Not specified'`
- Line 222 (pre-flight check): `if (!projectContext.product.brand_personality && !projectContext.product.brandPersonality)`

For both, the fix prefers `brandPersonality` first AND filters out arrays. Cleanest replacement:

```typescript
// Helper at top of file
function nonEmptyStringOrNull(v: unknown): string | null {
  if (typeof v === 'string' && v.trim().length > 0) return v;
  return null;
}

// Line 120 replacement:
`Personality: ${nonEmptyStringOrNull(productMetadata.brandPersonality) || nonEmptyStringOrNull(productMetadata.brand_personality) || 'Not specified'}`

// Line 222 replacement:
if (!nonEmptyStringOrNull(projectContext.product.brandPersonality) && !nonEmptyStringOrNull(projectContext.product.brand_personality)) { ... }
```

This treats empty arrays AND empty strings AND undefined as "absent". Truthy non-empty strings (the real personality text) win.

Test (`sprint11-flowa-personality-display.test.ts`):
- Sandbox A: PRODUCT.md with `## Brand Personality / Technical and restrained.` → run flowA via process('/sidecoach craft') → flowA's guidance contains `Personality: Technical and restrained` (NOT empty).
- Sandbox B: PRODUCT.md with NO Brand Personality section → flowA's guidance contains `Personality: Not specified` (the fallback).

### Fix 2: Registry craft entry includes flowH and flowI

In `sidecoach/src/impeccable-command-registry.ts`, update the `craft` entry:

```typescript
flowIds: [
  'flowA_brand_verify',
  'flowF_design_tokens',
  'flowG_component_implementation',
  'flowH_motion_integration',  // ADDED
  'flowI_accessibility',         // ADDED
  'flowJ_tactical_polish',
],
guidanceAppend: [
  'Shape brief confirmed before any code was written; gates were not compressed.',
  'Production bar enforced: real content, semantic-first markup, deliberate spacing, full state coverage.',
  'Motion integrated: easing tokens applied to interactive components, reduced-motion respected.',  // ADDED
  'Accessibility verified: WCAG 2.1 AA scan complete, contrast and focus ring checks passed.',     // ADDED
  'After the first pass, iterate visually against the brief and the approved direction; patch material defects and re-inspect.',
],
parityChecklist: [
  'Shape brief confirmed',
  'Production bar',
  'Real content',
  'Semantic first',
  'Iterate Visually',
  'motion integrated',     // ADDED (lowercase matches output rendering)
  'accessibility verified', // ADDED
],
```

Test (`sprint11-craft-chain-includes-motion-a11y.test.ts`):
- Import `IMPECCABLE_VERB_REGISTRY` from registry.
- Assert `craft.flowIds` length === 6.
- Assert `craft.flowIds` contains 'flowH_motion_integration'.
- Assert `craft.flowIds` contains 'flowI_accessibility'.

After this fix, the dogfood should show 6 flows (or 6 with skipped status for flows whose canExecute returns false). The Sprint 10 T2 fix means even skipped flows appear in results.

## File structure

**Modified (2):**
- `sidecoach/src/flow-handler-brand-verify.ts` - add nonEmptyStringOrNull helper + update 2 read sites
- `sidecoach/src/impeccable-command-registry.ts` - extend craft flowIds + guidanceAppend + parityChecklist

**New tests (2):**
- `sidecoach/src/__tests__/sprint11-flowa-personality-display.test.ts`
- `sidecoach/src/__tests__/sprint11-craft-chain-includes-motion-a11y.test.ts`

## Re-dogfood after Sprint 11

Re-run `dogfood-craft-step2.ts`. Expected:
- 6 flows in flowResults (or 6 entries: some success, possibly some skipped)
- flowA's Personality line shows the real text (not empty)
- flowH and flowI appear in results
- No regressions

If a new bug surfaces, Sprint 12 starts immediately per chief-architect directive.

## Acceptance criteria

- 2 new tests pass
- 75 baseline tests still pass (Sprint 10 close)
- tsc clean
- Re-dogfood shows 6 flowResults entries with flowH and flowI present
- flowA's output shows "Personality: <real text>" not "Personality: "

## Out of scope

- Investigating whether other flows have similar truthy-array bugs (broader audit) - focused fix only
- Stripping the empty-array section keys from the parser output entirely (the parser writes them for legitimate use cases; consumers should defend against truthiness)
- BuildReport verdict propagation for impeccable verb chains (Sprint 9 close noted; still deferred)
