# Impeccable quieter.md (extracted)

Note: long dashes replaced with regular hyphens per repo policy.

## VERBATIM LIFT

Quiet design is harder than bold design. Subtlety needs precision. Reduce visual intensity in designs that are too loud, aggressive, or overstimulating without losing personality or making the result generic.

---

## Register

Brand: "quieter" means more restrained palette, more whitespace, more typographic air. Drama is reduced, not eliminated; the POV stays intact.

Product: "quieter" means reducing visual noise. Fewer background accents, flatter cards, less color, less motion. The tool should disappear more completely into the task.

---

## Assess Current State

Analyze what makes the design feel too intense:

1. **Identify intensity sources**:
   - **Color saturation**: Overly bright or saturated colors
   - **Contrast extremes**: Too much high-contrast juxtaposition
   - **Visual weight**: Too many bold, heavy elements competing
   - **Animation excess**: Too much motion or overly dramatic effects
   - **Complexity**: Too many visual elements, patterns, or decorations
   - **Scale**: Everything is large and loud with no hierarchy

2. **Understand the context**:
   - What's the purpose? (Marketing vs tool vs reading experience)
   - Who's the audience? (Some contexts need energy)
   - What's working? (Don't throw away good ideas)
   - What's the core message? (Preserve what matters)

If any of these are unclear from the codebase, STOP and call the AskUserQuestion tool to clarify.

**CRITICAL**: "Quieter" doesn't mean boring or generic. It means refined and easier on the eyes. Think luxury, not laziness.

## Plan Refinement

Create a strategy to reduce intensity while maintaining impact:

- **Color approach**: Desaturate or shift to more restrained tones?
- **Hierarchy approach**: Which elements should stay bold (very few), which should recede?
- **Simplification approach**: What can be removed entirely?
- **Sophistication approach**: How can we signal quality through restraint?

**IMPORTANT**: Subtlety requires precision. Quiet without intent collapses to generic.

## Refine the Design

Systematically reduce intensity across these dimensions:

### Color Refinement
- **Reduce saturation**: Shift from fully saturated to 70-85% saturation
- **Soften palette**: Replace bright colors with muted tones
- **Reduce color variety**: Use fewer colors more thoughtfully
- **Neutral dominance**: Let neutrals do more work, use color as accent (10% rule)
- **Gentler contrasts**: High contrast only where it matters most
- **Tinted grays**: Use warm or cool tinted grays instead of pure gray. Adds depth without loudness
- **Never gray on color**: If you have gray text on a colored background, use a darker shade of that color or transparency instead

### Visual Weight Reduction
- **Typography**: Reduce font weights (900 -> 600, 700 -> 500), decrease sizes where appropriate
- **Hierarchy through subtlety**: Use weight, size, and space instead of color and boldness
- **White space**: Increase breathing room, reduce density
- **Borders & lines**: Reduce thickness, decrease opacity, or remove entirely

### Simplification
- **Remove decorative elements**: Gradients, shadows, patterns, textures that don't serve purpose
- **Simplify shapes**: Reduce border radius extremes, simplify custom shapes
- **Reduce layering**: Flatten visual hierarchy where possible
- **Clean up effects**: Reduce or remove blur effects, glows, multiple shadows

### Motion Reduction
- **Reduce animation intensity**: Shorter distances (10-20px instead of 40px), gentler easing
- **Remove decorative animations**: Keep functional motion, remove flourishes
- **Subtle micro-interactions**: Replace dramatic effects with gentle feedback
- **Refined easing**: Use ease-out-quart for smooth, understated motion. Never bounce or elastic
- **Remove animations entirely** if they're not serving a clear purpose

### Composition Refinement
- **Reduce scale jumps**: Smaller contrast between sizes creates calmer feeling
- **Align to grid**: Bring rogue elements back into systematic alignment
- **Even out spacing**: Replace extreme spacing variations with consistent rhythm

**NEVER**:
- Make everything the same size/weight (hierarchy still matters)
- Remove all color (quiet != grayscale)
- Eliminate all personality (maintain character through refinement)
- Sacrifice usability for aesthetics (functional elements still need clear affordances)
- Make everything small and light (some anchors needed)

## Verify Quality

Ensure refinement maintains quality:

- **Still functional**: Can users still accomplish tasks easily?
- **Still distinctive**: Does it have character, or is it generic now?
- **Better reading**: Is text easier to read for extended periods?
- **Restrained, not absent**: Does the POV survive the cuts?

When the result feels right, hand off to `/impeccable polish` for the final pass.

## EXTENSION

### Quieter vs. distill: the boundary

- **Quieter** preserves the structure and content; turns the volume down on visual intensity (saturation, contrast, motion, decoration).
- **Distill** removes structure and content; strips to essence.

If the design has the right elements but is shouting them, use quieter. If the design has too many elements competing for attention, use distill first, then maybe quieter.

### Saturation steps (concrete)

Quieter is best done in OKLCH, not by eyeballing. To desaturate an existing palette:

```
Original:   oklch(60% 0.28 30)   (very saturated red)
70-85%:     oklch(60% 0.20 30)   (still vivid, slightly muted)
50-65%:     oklch(60% 0.14 30)   (clearly muted, "dusty")
30-45%:     oklch(60% 0.07 30)   (almost neutral, color suggestion only)
```

Don't drop chroma to 0 unless the design genuinely should be monochrome.

### Weight reduction map

| Heavy | Restrained | Whisper |
|---|---|---|
| 900 (Black) | 700 (Bold) | 500 (Medium) |
| 800 (Extra Bold) | 600 (Semibold) | 400 (Regular) |
| 700 (Bold) | 500 (Medium) | 400 (Regular) |
| 600 (Semibold) | 400 (Regular) | 300 (Light) |

Drop one column per quieter pass. Going from Black-anchored to Bold-anchored typically reads as "much quieter" without losing hierarchy.

### Animation reduction map

| Excessive | Restrained | Removed |
|---|---|---|
| 600ms + bounce easing | 250ms + ease-out-quart | none |
| 40px travel on entry | 12px travel on entry | crossfade only |
| Stagger 100ms per item | Stagger 30ms per item | no stagger |
| Parallax with 3 layers | Parallax with 1 layer | no parallax |
| Hover scale to 1.1 | Hover scale to 1.02 | hover color shift only |

## WHAT'S MISSING

- **No "how quiet is too quiet" rubric.** Doc says don't collapse to generic but no test for when you've overshot.
- **No before/after table format.** Like make-interfaces-feel-better, this could codify changes in a structured log.
- **No "audience tolerance for quiet" guidance.** A B2B enterprise tool can be very quiet; a consumer entertainment app can't. Not stated.
- **No multi-pass guidance.** Should quieter run once and stop, or iterate?
