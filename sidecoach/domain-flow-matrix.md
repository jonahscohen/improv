# Domain → Flow Mapping Matrix

**Created:** 2026-05-22  
**Purpose:** Map 7 design domains to Sidecoach flows for Phase 1 consolidation  
**Scope:** Foundation for embedding Sidecoach intelligence into flow execution

---

## Design Domains (7 Shared Domains)

| # | Domain | Focus | Rules | Primary Register | Secondary Register |
|---|--------|-------|-------|------------------|--------------------|
| 1 | **Color & Contrast** | Palette, contrast ratios, semantic color use, WCAG AA/AAA | 6 rules | Brand | Product |
| 2 | **Typography** | Scales, hierarchy, readability, font pairing, size ratios | 6 rules | Brand | Product |
| 3 | **Spatial Design** | Whitespace, grid systems, proportion, balance, golden ratio | 6 rules | Brand | Product |
| 4 | **Motion Design** | Easing, timing, reduced-motion, accessibility, choreography | 6 rules | Brand | Product |
| 5 | **Interaction Design** | State indicators, click targets, affordances, feedback, micro-interactions | 6 rules | Product | Brand |
| 6 | **Responsive Design** | Breakpoints, touch targets (40x40px), adaptive layouts, fluid typography | 6 rules | Product | Brand |
| 7 | **UX Writing** | Microcopy, tone, clarity, instructional clarity, error messages, accessibility | 6 rules | Product | Brand |

**Total:** 42 domain rules + 27 anti-patterns = 69 deterministic checks

---

## Flow → Domain Coverage Matrix

### Tier 1: Strategy & Research Flows

| Flow | Domain 1: Color | Domain 2: Type | Domain 3: Space | Domain 4: Motion | Domain 5: Interact | Domain 6: Responsive | Domain 7: UX Write |
|------|-----------------|----------------|-----------------|-----------------|-------------------|-------------------|--------------------|
| **Flow A: Brand Verify** | ✓ (detect) | ✓ (detect) | ✓ (detect) | ✓ (detect) | ✓ (detect) | ✓ (detect) | ✓ (detect) |
| **Flow B: Component Research** | ✓ | ✓ | ✓ | ✗ | ✓ (primary) | ✓ | ✓ |
| **Flow C: Font Research** | ✗ | ✓ (primary) | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Flow D: Design References** | ✓ (primary) | ✓ | ✓ (primary) | ✓ | ✓ | ✓ | ✓ (secondary) |
| **Flow E: Motion Patterns** | ✗ | ✗ | ✗ | ✓ (primary) | ✓ (secondary) | ✗ | ✗ |

**Tier 1 Coverage:** All 7 domains covered in research phase. Flow A acts as detection/gateway.

### Tier 2: Execution Flows

| Flow | Domain 1: Color | Domain 2: Type | Domain 3: Space | Domain 4: Motion | Domain 5: Interact | Domain 6: Responsive | Domain 7: UX Write |
|------|-----------------|----------------|-----------------|-----------------|-------------------|-------------------|--------------------|
| **Flow F: Design Tokens** | ✓ (primary) | ✓ (primary) | ✓ (primary) | ✓ | ✓ | ✓ | ✓ |
| **Flow G: Component Impl** | ✓ | ✓ | ✓ | ✓ | ✓ (primary) | ✓ | ✓ |
| **Flow H: Motion Integration** | ✗ | ✗ | ✗ | ✓ (primary) | ✓ (primary) | ✗ | ✗ |
| **Flow I: Accessibility** | ✓ (WCAG) | ✓ (readability) | ✓ (spacing) | ✓ (reduced-motion) | ✓ (a11y) | ✓ (touch targets) | ✓ (microcopy) |

**Tier 2 Coverage:** Execution flows apply all domains. Flow I ensures WCAG 2.1 AA across all.

### Tier 3: Polish & QA Flows

| Flow | Domain 1: Color | Domain 2: Type | Domain 3: Space | Domain 4: Motion | Domain 5: Interact | Domain 6: Responsive | Domain 7: UX Write |
|------|-----------------|----------------|-----------------|-----------------|-------------------|-------------------|--------------------|
| **Flow J: Tactical Polish** | ✓ | ✓ | ✓ | ✓ | ✓ (primary) | ✓ | ✓ |
| **Flow K: Multi-Lens Audit** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Flow L: Design Critique** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Flow M: Responsive Validation** | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ (primary) | ✗ |
| **Flow N: Rapid Iteration** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

**Tier 3 Coverage:** QA flows validate all domains. Flow M specialized for breakpoints.

### Tier 4: Specialized Flows

| Flow | Domain 1: Color | Domain 2: Type | Domain 3: Space | Domain 4: Motion | Domain 5: Interact | Domain 6: Responsive | Domain 7: UX Write |
|------|-----------------|----------------|-----------------|-----------------|-------------------|-------------------|--------------------|
| **Flow O: Clone Match** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Flow P: Constraint Design** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Flow Q: Migration** | ✓ (legacy audit) | ✓ (legacy audit) | ✓ (legacy audit) | ✓ (legacy audit) | ✓ (legacy audit) | ✓ (legacy audit) | ✓ (legacy audit) |

### Tier 5: Specialized Excellence Flows

| Flow | Domain 1: Color | Domain 2: Type | Domain 3: Space | Domain 4: Motion | Domain 5: Interact | Domain 6: Responsive | Domain 7: UX Write |
|------|-----------------|----------------|-----------------|-------------------|-------------------|--------------------|
| **Flow R: Layout Optimization** | ✗ | ✗ | ✓ (primary) | ✗ | ✗ | ✓ (secondary) | ✗ |
| **Flow S: Typography Excellence** | ✗ | ✓ (primary) | ✓ (vertical rhythm) | ✗ | ✗ | ✓ (fluid type) | ✗ |
| **Flow T: Ambitious Motion** | ✗ | ✗ | ✗ | ✓ (primary) | ✓ (secondary) | ✗ | ✗ |

### Special Flows

| Flow | Domain Coverage | Purpose |
|------|-----------------|---------|
| **Flow U: Curate** | All 7 (ref save) | Capture design reference into personal catalog |
| **Flow V: All-Seven QA** | All 7 (validation) | Comprehensive QA across all 7 domains |

---

## Domain Embedding Strategy

### Phase 1: Embed Domain Rules into Flows

1. **Flow A (Brand Verify)** - Detect register + cache all 7 domains [COMPLETE]
2. **Flow B (Component Research)** - Load domain context for Components (1, 2, 3, 5, 7)
3. **Flow C (Font Research)** - Load domain context for Typography (2)
4. **Flow D (Design References)** - Load domain context for visual research (1, 2, 3, 4)
5. **Flow E (Motion Patterns)** - Load domain context for Motion (4, 5)
6. **Flow F (Design Tokens)** - Apply domain rules to token generation (all 7)
7. **Flow G (Component Impl)** - Validate component against domain rules (1, 2, 3, 5, 7)
8. **Flow H (Motion Integration)** - Apply motion domain rules (4, 5)
9. **Flow I (Accessibility)** - Cross-domain WCAG validation (all 7)

### Phase 2: Validation Spread

10. **Flow J (Tactical Polish)** - Apply 14-point make-interfaces-feel-better checklist
11. **Flow K (Multi-Lens Audit)** - 27 anti-pattern scan + 5-dimension technical check
12. **Flow L (Design Critique)** - 12-rule Nielsen/design heuristics pass
13. **Flow M (Responsive Validation)** - Breakpoint testing (Domain 6 specialized)
14. **Flow N (Rapid Iteration)** - Browser-based refinement with domain constraints

---

## Anti-Pattern Detection (27 Rules)

### Visual & Layout (8 rules)
- Anti-001: Side-stripe borders
- Anti-002: Gradient text
- Anti-003: Glassmorphism as default
- Anti-004: Hero-metric template
- Anti-005: Identical card grids
- Anti-006: Modal as first thought
- Anti-007: Flat typography scales
- Anti-008: Body text exceeds 75ch

### Color (3 rules)
- Anti-009: Pure black/white
- Anti-010: Alpha as design substitute
- Anti-011: WCAG contrast failure

### Spacing & Layout (4 rules)
- Anti-012: Inconsistent spacing rhythm
- Anti-013: Nested cards
- Anti-014: Cluttered information hierarchy
- Anti-015: No breathing room

### Typography (3 rules)
- Anti-016: Sans + serif mix (unmatched weights)
- Anti-017: Overlapping text
- Anti-018: Orphaned single words

### Motion (2 rules)
- Anti-019: Ease.out on entrance (wrong easing)
- Anti-020: No reduced-motion support

### Interaction (3 rules)
- Anti-021: Click targets <40x40px
- Anti-022: Missing focus states
- Anti-023: No feedback on state change

### Responsive (1 rule)
- Anti-024: Fixed pixel dimensions on mobile

### State & Edge Cases (2 rules)
- Anti-025: Empty states not designed
- Anti-026: Loading states missing

### Special (1 rule)
- Anti-027: Direct copy from reference (AI slop)

---

## Domain Rule Details

### Domain 1: Color & Contrast (6 rules)

| Rule | Applies To | Flows | Severity | Check |
|------|-----------|-------|----------|-------|
| **1.1: WCAG AA Contrast** | All text/UI | Flow K, L, I | CRITICAL | contrast-ratio >= 4.5:1 (body), 3:1 (UI) |
| **1.2: Semantic Color** | Components | Flow B, G | HIGH | colors map to meaning (error=red, success=green) |
| **1.3: Palette Consistency** | Design tokens | Flow F | HIGH | color family count <= 12 per register |
| **1.4: No Pure Black/White** | All colors | Flow J, K | HIGH | use tinted neutrals (avoid #000, #fff) |
| **1.5: Chroma Restraint** | Color selection | Flow D | MEDIUM | chroma 0.005-0.01 for neutrals |
| **1.6: Alpha Palette** | Opacity layers | Flow J | MEDIUM | use semantic alpha (shadow, overlay) not design |

### Domain 2: Typography (6 rules)

| Rule | Applies To | Flows | Severity | Check |
|------|-----------|-------|----------|-------|
| **2.1: Type Scale** | All heading/body | Flow C, F, S | HIGH | ratio >= 1.25 between size steps |
| **2.2: Line Height** | Body text | Flow C, S | HIGH | 1.5-1.8 for readability |
| **2.3: Line Length** | Paragraphs | Flow R, S | MEDIUM | 50-75ch (ideal 66ch) |
| **2.4: Font Pairing** | Design system | Flow C, F | HIGH | max 2-3 font families per register |
| **2.5: Weight Hierarchy** | Emphasis | Flow C, G | MEDIUM | meaningful weight variation (400, 600, 700) |
| **2.6: Letter Spacing** | Headings | Flow S | MEDIUM | optical correction for large sizes |

### Domain 3: Spatial Design (6 rules)

| Rule | Applies To | Flows | Severity | Check |
|------|-----------|-------|----------|-------|
| **3.1: Spacing System** | All layout | Flow F, R | HIGH | use 4pt/8pt/16pt modular system |
| **3.2: White Space** | Components | Flow B, G, J | HIGH | intentional breathing room >= 16px |
| **3.3: Grid Alignment** | Layouts | Flow R | MEDIUM | 8pt or 16pt snap |
| **3.4: Aspect Ratios** | Images | Flow G | MEDIUM | consistent 16:9, 4:3, or 1:1 |
| **3.5: Nested Depth** | Card hierarchies | Flow G, K | MEDIUM | max 2-level nesting |
| **3.6: Proportion** | Sections | Flow R | LOW | golden ratio or meaningful ratios |

### Domain 4: Motion Design (6 rules)

| Rule | Applies To | Flows | Severity | Check |
|------|-----------|-------|----------|-------|
| **4.1: Easing Curves** | Animations | Flow E, H, T | HIGH | use exponential (cubic-bezier(0.25, 0.46, 0.45, 0.94)) |
| **4.2: Duration** | Transitions | Flow E, H | HIGH | 200-400ms for UI, 600ms+ for elaborate |
| **4.3: Reduced Motion** | Animations | Flow H, I, K | CRITICAL | prefers-reduced-motion support |
| **4.4: Choreography** | Multi-element | Flow T | MEDIUM | staggered timing, cascade order |
| **4.5: Entrance Pattern** | New elements | Flow H, T | MEDIUM | ease.in on exit, ease.out on entrance |
| **4.6: Anticipation** | Micro-interactions | Flow E, J | LOW | prepare for action (pre-animation cue) |

### Domain 5: Interaction Design (6 rules)

| Rule | Applies To | Flows | Severity | Check |
|------|-----------|-------|----------|-------|
| **5.1: Click Target Size** | All buttons/links | Flow G, I, M | CRITICAL | >= 40x40px (iOS/Android standard) |
| **5.2: Focus States** | Keyboard nav | Flow G, I, K | CRITICAL | visible outline or equivalent |
| **5.3: Feedback** | State changes | Flow G, J | HIGH | visual confirmation on interaction |
| **5.4: Affordance** | Button design | Flow B, G, J | HIGH | button appearance signals clickability |
| **5.5: Cursor Change** | Hover states | Flow J | MEDIUM | cursor: pointer on interactive |
| **5.6: State Indicators** | Toggles/tabs | Flow G, H | MEDIUM | clear on/off/active states |

### Domain 6: Responsive Design (6 rules)

| Rule | Applies To | Flows | Severity | Check |
|------|-----------|-------|----------|-------|
| **6.1: Breakpoints** | Layouts | Flow M | HIGH | defined in DESIGN.md, consistent |
| **6.2: Touch Targets** | Mobile | Flow I, M | CRITICAL | >= 40x40px on touch devices |
| **6.3: Fluid Typography** | Text sizing | Flow S, M | HIGH | use clamp() or vw for responsive type |
| **6.4: Viewport Meta** | Mobile | Flow M | CRITICAL | <meta viewport="width=device-width"> |
| **6.5: Image Scaling** | Media | Flow M | MEDIUM | max-width: 100%, height: auto |
| **6.6: Overflow Handling** | Content | Flow M, R | MEDIUM | no horizontal scroll on viewports |

### Domain 7: UX Writing (6 rules)

| Rule | Applies To | Flows | Severity | Check |
|------|-----------|-------|----------|-------|
| **7.1: Microcopy Clarity** | Labels/hints | Flow G, L | HIGH | clear, action-oriented, scannable |
| **7.2: Error Messages** | Validation | Flow I, G | CRITICAL | actionable, not error codes |
| **7.3: Tone Consistency** | All text | Flow L, N | MEDIUM | voice matches PRODUCT.md personality |
| **7.4: Instructional Clarity** | Help text | Flow B, G | MEDIUM | explains "why" not just "what" |
| **7.5: Button Copy** | Actions | Flow G, J | HIGH | verb-first, specific ("Save Changes" not "OK") |
| **7.6: Accessibility Text** | ARIA/alt | Flow I, K | CRITICAL | screen-reader friendly, descriptive |

---

## Implementation Checklist (Phase 1 Foundation)

- [x] Task #15: Context Loader (loads PRODUCT.md + DESIGN.md)
- [x] Task #16: Register Detection (Flow A)
- [x] Task #17: Domain Matrix (this document)
- [ ] Task #18: Component Gallery Reference wiring (Flow B)
- [ ] Task #19: Fontshare Reference wiring (Flow C)
- [ ] Task #20: Design References wiring (Flow D)
- [ ] Task #21: Motion Reference wiring (Flow E)
- [ ] Task #22: Reference System pre-flight + fallback
- [ ] Task #23: 27 Anti-Pattern Rules validation
- [ ] Task #24: Category-Reflex AI slop detection

---

## Next Steps

1. **Verify matrix accuracy** against actual flow implementations (B-I, J-Q, R-V)
2. **Wire reference systems** (Tasks #18-22) to provide domain context to flows
3. **Embed anti-pattern checking** into audit flows (K, L, V)
4. **Implement category-reflex** for AI slop detection in Flow D + L
5. **Create test suite** validating each domain rule in isolation
