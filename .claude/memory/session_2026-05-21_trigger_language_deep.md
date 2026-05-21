---
name: session-2026-05-21-trigger-language-deep
description: "Sidecoach trigger language expansion - rationale, collision matrix, implementation strategy"
type: project
relates_to:
  - session_2026-05-21_sidecoach_trigger_language.md
  - sidecoach_flows_comprehensive.md
---

# Sidecoach Trigger Language - Deep Dive

## Strategy

Expanded from 4-5 patterns per flow to 6-8 patterns per flow, with explicit collision avoidance rules.

**Goal:** Capture 90%+ of sensible variations while maintaining <5% false positive cross-flow triggering.

## Key Distinctions

### 1. Clone vs Implement (Flows 1 vs 10)

**Clone/Match (Flow 1):** Emphasizes EXACT replication
- Trigger tokens: "match", "steal", "clone", "1:1", "exact", "identical", "copy precisely"
- Context: Always paired with a reference source
- Example: "Steal this button from Figma" → Flow 1
- Example: "Match the header exactly" → Flow 1

**Implement from Design (Flow 10):** Emphasizes BUILDING from design
- Trigger tokens: "implement", "code", "build from", "build based on"
- Context: Assumes design already exists, focus is on implementation
- Example: "Implement the card from this mockup" → Flow 10
- Example: "Build from the Figma design" → Flow 10

**Disambiguator:** Look for "exact/steal/match" vs "code/implement/build". If ambiguous (just "build"), check if reference is design system (→ Flow 10) or live reference (→ Flow 1).

---

### 2. Audit vs Review (Flows 3 vs 5)

**Audit (Flow 3):** Reporting ONLY, no implementation
- Trigger tokens: "audit", "find issues", "scan for problems", "what's wrong"
- Context: User wants issue list, not fixes
- Example: "Audit the dashboard" → Flow 3
- Example: "Scan this section for problems" → Flow 3

**Review/QA (Flow 5):** Comprehensive multi-lens check with FIX intent
- Trigger tokens: "code review", "QA this", "comprehensive check", "for quality"
- Context: User wants multi-lens assessment AND guidance on fixes
- Example: "Code review this PR" → Flow 5
- Example: "Comprehensive quality check" → Flow 5

**Disambiguator:** "audit" → Flow 3, "review" → Flow 5. If "QA", check context (standalone QA = Flow 5; QA as part of another flow = that flow).

---

### 3. Explore vs Iterate (Flows 4 vs 13)

**Explore/Discovery (Flow 4):** Open-ended, unvalidated, NO success criteria
- Trigger tokens: "explore", "what if", "experiment", "discovery", "brainstorm"
- Context: User wants to see possibilities, not converge on best
- Example: "Explore sidebar layouts" → Flow 4
- Example: "What if we changed the colors?" → Flow 4

**Rapid Iteration (Flow 13):** Goal-driven, has success criteria or feedback loop
- Trigger tokens: "iterate", "refine", "round", "cycle through", "try variations [with feedback]"
- Context: User wants to converge based on criteria/feedback
- Example: "Iterate on the button with user feedback" → Flow 13
- Example: "Rapid iteration round 2" → Flow 13

**Disambiguator:** Look for success criteria, user feedback, or "round N". If none exist, ask: "Do you have success criteria?" If no, Flow 4. If yes, Flow 13.

---

### 4. Design Component vs Implement (Flows 7 vs 10)

**Design Component (Flow 7):** Creating NEW component
- Trigger tokens: "design a", "create", "new", "from scratch", "build [component]"
- Context: Component doesn't exist yet
- Example: "Design a date picker" → Flow 7
- Example: "Create the tooltip from scratch" → Flow 7

**Implement (Flow 10):** Coding from EXISTING design
- Trigger tokens: "implement", "from [design/Figma]", "based on [reference]"
- Context: Design already exists
- Example: "Implement the date picker from Figma" → Flow 10
- Example: "Code the button based on the mockup" → Flow 10

**Disambiguator:** "design a [component]" or "new [component]" → Flow 7. "implement [component] from/based on [source]" → Flow 10. If just "build [component]", check if source exists (→ Flow 10) or not (→ Flow 7).

---

### 5. Refactor Layout vs Migrate Component (Flows 8 vs 14)

**Refactor/Improve Layout (Flow 8):** Structural/whitespace improvements to section
- Trigger tokens: "refactor [section]", "cluttered", "hierarchy", "layout", "restructure", "clearer"
- Context: Focus is on improving visual structure, whitespace, readability
- Example: "The dashboard feels cluttered" → Flow 8
- Example: "Improve layout of the header" → Flow 8

**Migrate/Refactor Component (Flow 14):** API change, implementation replacement
- Trigger tokens: "migrate [component]", "API", "breaking change", "replace [old]", "upgrade", "rewrite"
- Context: Component is changing fundamentally, other code depends on it
- Example: "Migrate the button to the new API" → Flow 14
- Example: "Replace the old modal with the new version" → Flow 14

**Disambiguator:** "refactor [section/area]" + layout keywords → Flow 8. "refactor [component]" + "API" or "breaking change" → Flow 14. If just "refactor [component]" with no qualifier, ask: "Is this about layout/structure or API change?" 

---

### 6. Polish vs Improve Layout (Flows 2 vs 8)

**Polish/Enhance (Flow 2):** Adding feel, animation, interaction
- Trigger tokens: "feel", "polish", "enhance interaction", "animation", "microinteraction", "janky"
- Context: Focus is on sensory experience, not structure
- Example: "Make the form feel better" → Flow 2
- Example: "This button needs more life" → Flow 2

**Improve Layout (Flow 8):** Fixing structure, hierarchy, whitespace
- Trigger tokens: "hierarchy", "cluttered", "clearer", "layout", "whitespace", "structure"
- Context: Focus is on information architecture and visual organization
- Example: "The dashboard feels cluttered" → Flow 8
- Example: "Improve the visual hierarchy" → Flow 8

**Disambiguator:** "feel", "polish", "animation" → Flow 2. "hierarchy", "layout", "structure" → Flow 8. If just "improve [element]", check context (interaction → Flow 2, layout/structure → Flow 8).

---

### 7. Responsive vs Layout (Flows 12 vs 8)

**Responsive Review (Flow 12):** Testing across screen sizes, breakpoints
- Trigger tokens: "responsive", "breakpoint", "mobile", "tablet", "sizes", "screen sizes"
- Context: Focus is on testing at different viewport sizes
- Example: "Responsive check" → Flow 12
- Example: "Mobile review" → Flow 12

**Refactor Layout (Flow 8):** Improving structure within a single screen size
- Trigger tokens: "hierarchy", "whitespace", "section", "cluttered", "layout", "restructure"
- Context: Focus is on reorganizing content
- Example: "The dashboard feels cluttered" → Flow 8
- Example: "Improve layout of the header" → Flow 8

**Disambiguator:** "responsive", "breakpoint", "mobile review", "sizes" → Flow 12. "cluttered", "hierarchy", "section" → Flow 8. If "mobile optimization", clarify: "Are you testing responsive behavior or improving layout?"

---

## Implementation Checklist

**For intent detection system:**

1. ✓ Build token set per flow (6-8 primary patterns)
2. ✓ Build exclusion/collision rules (negative filters for ambiguous terms)
3. ✓ Build priority ordering (longest match, then disambiguators)
4. ✓ Test with sample utterances:
   - "Make the button feel better" → Flow 2 (feel token)
   - "The sidebar feels cluttered" → Flow 8 (cluttered token, layout context)
   - "Refactor the button component" → Flow 8 (refactor section default) or ask (no API keyword)
   - "Refactor button API" → Flow 14 (API keyword)
   - "Build a date picker" → Flow 7 (new component context)
   - "Build the date picker from the mockup" → Flow 10 (from source context)
   - "What if we tried blue?" → Flow 4 (what if token, no criteria)
   - "Let's iterate round 2" → Flow 13 (iterate + round token)

5. ✓ Fallback strategy when ambiguous:
   - Present top 2 likely flows to user
   - User picks or clarifies
   - Learn from correction (update weights)

---

## Trigger Language by Flow

### Original → Expanded

| Flow | Original Triggers | Expanded to |
|---|---|---|
| 1 | 4 patterns | 7 patterns |
| 2 | 4 patterns | 8 patterns |
| 3 | 4 patterns | 7 patterns |
| 4 | 5 patterns | 7 patterns |
| 5 | 4 patterns | 7 patterns |
| 6 | 3 patterns | 7 patterns |
| 7 | 3 patterns | 7 patterns |
| 8 | 4 patterns | 8 patterns |
| 9 | 4 patterns | 8 patterns |
| 10 | 3 patterns | 7 patterns |
| 11 | 4 patterns | 7 patterns |
| 12 | 4 patterns | 7 patterns |
| 13 | 4 patterns | 7 patterns |
| 14 | 4 patterns | 7 patterns |

**Total:** ~50 original patterns → ~100 expanded patterns across all flows

---

## Next Steps

1. Build intent detection engine using token sets + collision rules
2. Test with sample user utterances to calibrate disambiguation logic
3. Monitor false positive rate (target: <5% cross-flow misclassification)
4. Update Sidecoach to use expanded trigger language
5. Gather real usage data to refine further

---

Collaborator: Jonah
Date: 2026-05-21
