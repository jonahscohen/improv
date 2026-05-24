---
name: Sprint 2 Task 2 - landing-composition-data.ts
description: Pure data module for register-aware section taxonomy, rhythm rules, anti-patterns
type: project
relates_to: [session_2026-05-24_sprint2_t1_floww_flowx_registered.md]
---

## Task 2: Build landing-composition-data.ts

**Status: IN PROGRESS**

### Files Created
- `sidecoach/src/landing-composition-data.ts` - register-aware section taxonomy
- `sidecoach/src/__tests__/landing-composition-data.test.ts` - 7-test validation suite

### Step 1: Test file written
- 7 assertions covering: brand vs product section counts, taxonomy keys, slot structure, rhythm register-awareness, anti-pattern divergence
- File: `/Users/spare3/Documents/Github/claude-dotfiles/sidecoach/src/__tests__/landing-composition-data.test.ts`

### Step 2: Test ran, failed as expected
- Error: "Cannot find module '../landing-composition-data'" (correct)

### Step 3: Implementation written
- File: `/Users/spare3/Documents/Github/claude-dotfiles/sidecoach/src/landing-composition-data.ts`
- Exports: getSectionTaxonomy, getRhythmRules, getAntiPatternCallouts, findSection
- Brand taxonomy: 5 sections (hero, manifesto, selected_work, about, contact)
- Product taxonomy: 7 sections (hero, social_proof, feature_triad, how_it_works, testimonials, faq, final_cta)
- Brand rhythm: 200px gaps, 1 section/screen, atmospheric guidance
- Product rhythm: 96px gaps, 2 sections/screen, structured guidance
- Brand anti-patterns: 4 callouts (no pricing, single CTA, no generic logos, no FAQ)
- Product anti-patterns: 4 callouts (clear value, literal titles, inline value first, don't duplicate hero)

### Next Steps
- Step 4: Run test to verify success
- Step 5: Commit with three separate bash calls

### Step 4: Test passed
- Command: `npx ts-node src/__tests__/landing-composition-data.test.ts`
- Output: `landing-composition-data PASS`
- Exit code: 0
- All 7 assertions passed:
  - Brand has 4-7 sections, product has 7+ sections
  - Both have hero, product has social_proof
  - Hero slots structure validated
  - Rhythm rules diverge (brand 200px > product 96px)
  - Brand shows 1 section/screen, product shows 2
  - Anti-pattern callouts differ between registers

### Task 2 COMPLETE
- Files: landing-composition-data.ts (234 lines), landing-composition-data.test.ts (63 lines)
- Pure data module with register-aware accessors
- Zero I/O, no dependencies beyond project-context
- Ready for Task 3 handler implementation
