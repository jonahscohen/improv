# Sidecoach v2: Complete Design System Replacement

**Current state:** 14 conversation-triggered flows covering QA/iteration

**Target state:** One unified orchestrator that IS the entire design pipeline - all 23 impeccable commands, all 16 make-interfaces-feel-better rules, all research capability, all tokens, all motion patterns, baked in invisibly.

---

## Architecture Redesign

### Four Tiers of Flows (Organized by Pipeline Phase)

#### 1. Strategy/Research Phase
*Triggered by: "design a", "create", "build", "new"*

- **Flow A: Brand/PRODUCT.md Verification**
  - Replaces: `impeccable teach`
  - Ensures project has valid brand register before design work
  - Validates against anti-references and strategic principles

- **Flow B: Component Research**
  - Embeds: component-gallery-reference lookup + recommendations
  - Queries 60 types across 95 systems
  - Recommends components by use case, constraints, accessibility floor
  - Returns pattern code + implementation guidance

- **Flow C: Font Research**
  - Embeds: fontshare-reference catalog + metadata
  - Checks font pairing against brand personality
  - Validates against impeccable's reflex-reject list
  - Returns typeface + weights + licensing

- **Flow D: Reference Inspiration**
  - Embeds: design-references personal catalog search
  - Replaces: manual `/curate` invocation
  - Searches user's one-off patterns catalog automatically
  - Returns relevant patterns from the wild

- **Flow E: Motion Pattern Library**
  - Embeds: motion-reference (GSAP + Lenis canonical patterns)
  - Tweens, ScrollTrigger, Flip, SplitText, DrawSVG
  - Smooth-scroll integration patterns
  - Returns code templates directly

#### 2. Execution Phase
*Triggered by: "implement", "code this", "build it"*

- **Flow F: Design System Tokens**
  - Full DESIGN.md workflow (google-labs-code spec)
  - Extract patterns → define tokens → lint for WCAG/consistency
  - Manage colors, typography, spacing, components
  - Validate token references in generated code

- **Flow G: Component Implementation**
  - Maps to: impeccable `craft` + design-to-code workflow
  - Takes design spec → generates implementation scaffold
  - Wires component variants, states, responsive behavior
  - Integrates design tokens automatically

- **Flow H: Motion Integration**
  - GSAP tweens, ScrollTrigger, Flip patterns
  - Lenis smooth-scroll setup and optimization
  - DrawSVG path animations
  - Handles animation state, interruption, performance
  - Returns production-ready motion code

- **Flow I: Accessibility Compliance**
  - WCAG 2.1 AA validation
  - Screen reader testing guidance (VoiceOver/NVDA)
  - Severity prioritization framework
  - Semantic HTML enforcement

#### 3. Polish/QA Phase
*Triggered by: "review", "polish", "audit", "feel better"*

- **Flow J: 16-Point Tactical Polish**
  - Embeds ALL make-interfaces-feel-better rules:
    - scale(0.96) on press
    - Concentric border radius (outer = inner + padding)
    - Icon swaps via opacity+scale+blur
    - Image outlines: rgba(0,0,0,0.1) never tinted
    - Hit areas ≥ 40x40px
    - Transition: all banned
    - font-variant-numeric: tabular-nums on dynamic numbers
    - text-wrap: balance on headings
    - Initial={false} on AnimatePresence
    - Sparse will-change
    - And 6 more tactical refinements
  - Returns before/after table grouped by principle

- **Flow K: Multi-Lens Audit**
  - 5 dimensions: accessibility, performance, theming, responsive, anti-patterns
  - Technical issue discovery + severity ranking
  - References npx impeccable detect CLI
  - Addresses all Critical and High findings

- **Flow L: Design Critique**
  - Nielsen heuristics review
  - AI-slop detection
  - Cognitive load assessment
  - Emotional journey mapping
  - Returns independent sub-agent review

- **Flow M: Responsive Validation**
  - Breakpoint testing (extract from DESIGN.md)
  - Touch target verification (40x40px minimum)
  - Viewport behavior validation
  - Device-specific testing checklist

- **Flow N: Rapid Iteration**
  - Variation generation algorithm (token-based tweaking)
  - Success criteria framework per iteration
  - Decision criteria for refinement cycles
  - Goal-driven refinement loop

#### 4. Special Workflows

- **Flow O: Clone/Match**
  - Pixel-perfect 1:1 replication from reference
  - Element tree, typography, interactions, exact spacing

- **Flow P: Constraint Design**
  - Design under explicit limits (budget, scope, accessibility floor)
  - Creative problem-solving within constraints

- **Flow Q: Migration**
  - Component/API refactoring
  - Dependency mapping + pre/post signoff gates

---

## Data Integration Points

**Everything embedded as read-only data inside Sidecoach:**

- **component.gallery index** (60 types, 95 systems)
  - Baked into Flow B
  - Lookup by use case, constraint, accessibility requirements
  - Returns pattern code + implementation notes

- **fontshare.com catalog**
  - Type family metadata, weights, licensing
  - Baked into Flow C
  - Brand personality matching

- **design-references personal catalog**
  - User's one-off patterns from `~/.claude/design-references/`
  - Baked into Flow D
  - Auto-searched without manual `/curate` invocation

- **GSAP + Lenis canonical patterns**
  - Tweens, ScrollTrigger, Flip, SplitText, DrawSVG templates
  - Baked into Flow H
  - Production-ready motion code

- **Impeccable's 23 commands**
  - Mapped to flows A-P
  - All logic + checklists embedded
  - teach, craft, shape, animate, colorize, delight, etc.

- **make-interfaces-feel-better 16 rules**
  - All in Flow J
  - Before/after formatting, tactical guidance

---

## Implementation Gameplan

### Phase 1: Expand Flows (2-3 hours)
- [ ] Map all 23 impeccable commands to flows A-P
- [ ] Map all 16 make-interfaces-feel-better rules to Flow J
- [ ] Create flow handlers for research phase (component, font, reference, motion lookups)
- [ ] Extend flow-handlers-core.ts and flow-handlers-extended.ts with new handler classes

### Phase 2: Embed Reference Data (4-5 hours)
- [ ] Download + index component.gallery (60 types, 95 systems) as JSON
- [ ] Download + index fontshare catalog (type families + metrics) as JSON
- [ ] Integrate design-references folder reading (scan `~/.claude/design-references/`)
- [ ] Embed GSAP/Lenis canonical patterns as code templates
- [ ] Create data loader in sidecoach/src/

### Phase 3: Flow Logic Expansion (3-4 hours)
- [ ] Research flows: lookup algorithms (component by use case, font by personality, etc.)
- [ ] Execution flows: design-to-code + motion integration logic
- [ ] Polish flows: embed all 16 tactical rules as executable checklist
- [ ] Token flow: full DESIGN.md management (extraction, validation, linting)
- [ ] Implement handler methods for each expanded flow

### Phase 4: Orchestrator Intelligence (2-3 hours)
- [ ] Detect user phase (strategy vs execution vs polish)
- [ ] Auto-recommend research flows before execution
- [ ] Chain flows (strategy → research → design → implement → polish)
- [ ] Context-aware flow sequencing based on conversation

### Phase 5: System Integration (1-2 hours)
- [ ] Wire reference data into sidecoach/src/
- [ ] Compile + test all new handlers
- [ ] Update README with full flow map + data sources
- [ ] Verify all 23 impeccable commands are covered
- [ ] Verify all 16 make-interfaces-feel-better rules are covered

---

## Why This Works

1. **No more skill hopping** - Everything is one invisible system
2. **Seamless research** - "design a button" → component.gallery lookup happens automatically
3. **Embedded expertise** - All 23 impeccable decisions + 16 make-interfaces-feel-better rules in the flows
4. **Motion baked in** - User says "add motion" → canonical GSAP/Lenis patterns surface
5. **Token workflow complete** - Extract, manage, lint, validate DESIGN.md automatically
6. **Personal catalog integration** - design-references searched automatically without `/curate` detour
7. **One unified experience** - Strategy → research → execution → polish all seamless

---

## Timeline

- **Full replacement** (all data + all flows + all logic): **12-15 hours of work**
- **Start with Phase 1** (expand flows): **2-3 hours** → immediate 23-command coverage
- **Then Phase 2** (embed data): **4-5 hours** → reference lookups live

---

## Success Criteria

- [ ] All 23 impeccable commands covered by Sidecoach flows
- [ ] All 16 make-interfaces-feel-better rules embedded in Flow J
- [ ] component.gallery research integrated and functional
- [ ] fontshare research integrated and functional
- [ ] design-references personal catalog auto-searchable
- [ ] GSAP/Lenis motion patterns available in flows
- [ ] DESIGN.md token workflow complete
- [ ] System verified end-to-end with real conversation triggers
- [ ] No separate skill invocations needed for any design phase
- [ ] One unified daemon handles entire pipeline invisibly
